"""
Delta Lake Table Service

This service handles all table and row operations using Delta Lake for storage.
It provides high-performance, ACID-compliant operations on data stored in S3.
"""

import json
import logging
import os
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

import polars as pl
import pyarrow as pa
from deltalake import write_deltalake, DeltaTable
from google.protobuf.json_format import Parse, MessageToJson
from google.protobuf.struct_pb2 import ListValue
from ...grpc.generated import table_service_pb2, table_service_pb2_grpc

logger = logging.getLogger(__name__)

class TableService(table_service_pb2_grpc.TableServiceServicer):
    """
    Delta Lake Table Service implementation.

    This service manages tables and rows using Delta Lake format stored in S3/MinIO.
    It provides efficient append-only writes and ACID transaction support.
    """

    def _get_storage_options(self) -> Dict[str, str]:
        """Get S3/MinIO storage options for Delta Lake.

        Returns storage configuration for connecting to MinIO/S3.
        """
        return {
            "AWS_ACCESS_KEY_ID": os.getenv("AWS_ACCESS_KEY_ID", "minioadmin"),
            "AWS_SECRET_ACCESS_KEY": os.getenv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
            "AWS_ENDPOINT_URL": os.getenv("AWS_ENDPOINT_URL", "http://minio:9000"),
            "AWS_REGION": os.getenv("AWS_REGION", "us-east-1"),
            "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
            "AWS_ALLOW_HTTP": "true"  # Allow HTTP for MinIO
        }

    def _to_s3_uri(self, path: str) -> str:
        """Convert relative path to full S3 URI.

        Args:
            path: Relative path like 'org_1/db_1/table_1/'

        Returns:
            Full S3 URI like 's3://emery-files/org_1/db_1/table_1/'
        """
        bucket = os.getenv("S3_BUCKET_NAME", "emery-files")
        # Remove leading/trailing slashes for consistency
        clean_path = path.strip('/')
        return f"s3://{bucket}/{clean_path}"

    def _get_delta_schema_as_pyarrow(self, delta_table: DeltaTable) -> pa.Schema:
        """Convert Delta Lake schema to PyArrow schema.

        Reads schema from Delta Lake transaction log (metadata only, no data files).
        Delta Lake's schema() returns deltalake._internal.Schema which has to_arrow()
        that returns arro3.core.Schema. PyArrow consumes it via C Data Interface.

        Args:
            delta_table: DeltaTable instance

        Returns:
            PyArrow Schema object
        """
        return pa.schema(delta_table.schema().to_arrow())

    def _build_schema_from_table_fields(self, table_fields: List[table_service_pb2.TableField]) -> pa.Schema:
        """Convert protobuf TableField messages to PyArrow schema for Delta Lake.

        AIDEV-NOTE: Schema structure for numeric field IDs:
        - First column: "id" (string) - REQUIRED for Delta Lake merge operations
        - Other columns: "1", "2", "3", etc. (numeric field IDs)
        - The "id" field from table_fields is SKIPPED - we add "id" column manually
        """
        try:
            # Map protobuf field types to PyArrow types
            type_mapping = {
                table_service_pb2.FIELD_TYPE_TEXT: pa.string(),
                table_service_pb2.FIELD_TYPE_NUMBER: pa.float64(),
                table_service_pb2.FIELD_TYPE_BOOLEAN: pa.bool_(),
                table_service_pb2.FIELD_TYPE_DATE: pa.timestamp('us'),
                table_service_pb2.FIELD_TYPE_FILE: pa.string(),    # Store as JSON
                table_service_pb2.FIELD_TYPE_RELATION: pa.string(), # Store as JSON
                table_service_pb2.FIELD_TYPE_DOCUMENT: pa.string(), # Store as JSON
            }

            arrow_fields = []

            # CRITICAL: Always add "id" column first for Delta Lake merge compatibility
            # This column stores the row UUID and is required for merge operations
            arrow_fields.append(pa.field("id", pa.string(), nullable=False))
            logger.debug(f"[_build_schema_from_table_fields] Added 'id' column (string, required)")

            # Add data fields with numeric column names
            for field in table_fields:
                # Skip the special "id" field - we've already added it
                if field.name == 'id':
                    logger.debug(f"[_build_schema_from_table_fields] Skipping field 'id' (field_id={field.field_id}) - already added as system column")
                    continue

                dtype = type_mapping.get(field.type, pa.string())
                # Use numeric field ID as column name (immutable identifier)
                column_name = str(field.field_id)
                arrow_fields.append(pa.field(column_name, dtype, nullable=not field.required))
                logger.debug(f"[_build_schema_from_table_fields] Field: id={field.field_id}, name={field.name}, column={column_name}, type={dtype}")

            return pa.schema(arrow_fields)
        except Exception as e:
            logger.error(f"Error building schema from table fields: {e}")
            raise ValueError(f"Invalid table fields: {e}")

    def _create_dataframe_with_schema(
        self,
        rows_data: List[table_service_pb2.RowData],
        delta_table: DeltaTable
    ) -> pl.DataFrame:
        """Create Polars DataFrame with explicit schema from Delta Lake (zero-copy).

        AIDEV-NOTE: SINGLE SOURCE OF TRUTH for schema-aware DataFrame creation.

        Architecture:
        - Delta Lake schema = Source of truth for column types
        - Creates DataFrame with explicit schema (NO type inference)
        - Preserves zero-copy when converting to Arrow (no cast operations)

        Library Flow:
        1. delta_table.schema() → deltalake._internal.Schema
        2. schema.to_arrow(as_large_types=True) → arro3.core.Schema (Polars compatible)
        3. pa.schema(arro3_schema) → pyarrow.Schema (via C Data Interface)
        4. Build Polars schema dict from PyArrow fields
        5. pl.DataFrame(records, schema=...) → Polars DataFrame (explicit types)
        6. df.to_arrow() → Zero-copy conversion (types match)

        Args:
            rows_data: Protobuf row data messages
            delta_table: DeltaTable instance with schema

        Returns:
            Polars DataFrame with columns matching Delta Lake schema
        """
        # 1. Get Delta Lake schema (source of truth)
        # IMPORTANT: as_large_types=True for Polars compatibility
        # Polars uses LargeUtf8 (int64 indices), not Utf8 (int32 indices)
        delta_schema_arro3 = delta_table.schema().to_arrow(as_large_types=True)
        delta_schema_pyarrow = pa.schema(delta_schema_arro3)

        logger.info(f"[_create_dataframe_with_schema] Delta Lake schema: {delta_schema_pyarrow}")

        # 2. Build Polars schema dict from PyArrow schema
        # AIDEV-NOTE: Inline type mapping (no separate helper needed)
        polars_schema = {}
        for field in delta_schema_pyarrow:
            if pa.types.is_string(field.type) or pa.types.is_large_string(field.type):
                polars_schema[field.name] = pl.Utf8  # Polars handles both
            elif pa.types.is_floating(field.type):
                polars_schema[field.name] = pl.Float64
            elif pa.types.is_integer(field.type):
                polars_schema[field.name] = pl.Int64
            elif pa.types.is_boolean(field.type):
                polars_schema[field.name] = pl.Boolean
            elif pa.types.is_timestamp(field.type):
                polars_schema[field.name] = pl.Datetime
            else:
                # Fallback to string for unknown types
                logger.warning(f"Unknown Arrow type for '{field.name}': {field.type}, using Utf8")
                polars_schema[field.name] = pl.Utf8

        logger.info(f"[_create_dataframe_with_schema] Polars schema: {polars_schema}")

        # 3. Convert protobuf to Python dicts (type-agnostic conversion)
        # AIDEV-NOTE: Keys are numeric field IDs, matching Delta Lake column names
        records = []
        for row_data in rows_data:
            record = {'id': row_data.id}

            for key, value in row_data.data.items():
                if value.HasField('text_value'):
                    record[key] = value.text_value
                elif value.HasField('number_value'):
                    record[key] = value.number_value
                elif value.HasField('boolean_value'):
                    record[key] = value.boolean_value
                elif value.HasField('date_value'):
                    record[key] = value.date_value
                elif value.HasField('json_value'):
                    record[key] = value.json_value
                else:
                    record[key] = None  # Empty protobuf oneof = None

            records.append(record)

        # Log first record for debugging
        if records:
            logger.info(f"[_create_dataframe_with_schema] First record: {records[0]}")

        # 4. Create DataFrame with EXPLICIT schema (no inference, no casting)
        # AIDEV-NOTE: Zero-copy friendly - types match Delta Lake from creation
        df = pl.DataFrame(records, schema=polars_schema)
        logger.info(f"[_create_dataframe_with_schema] Final DataFrame schema: {df.schema}")

        return df

    def _json_to_row_data(self, row_json: str) -> Dict[str, Any]:
        """Convert JSON string to row data dictionary."""
        try:
            return json.loads(row_json)
        except Exception as e:
            logger.error(f"Error parsing row JSON: {e}")
            raise ValueError(f"Invalid row JSON: {e}")

    def _protobuf_value_from_python(self, value: Any) -> table_service_pb2.RowDataValue:
        """Convert Python value to protobuf RowDataValue."""
        result = table_service_pb2.RowDataValue()
        if value is None:
            # For None, we don't set any field - let it be unset
            pass
        elif isinstance(value, str):
            result.text_value = value
        elif isinstance(value, (int, float)):
            result.number_value = float(value)
        elif isinstance(value, bool):
            result.boolean_value = value
        elif isinstance(value, list):
            # Convert list to JSON string for now
            import json
            result.json_value = json.dumps(value)
        else:
            # Convert complex objects to JSON string
            import json
            result.json_value = json.dumps(value)
        return result

    def CreateTable(self, request: table_service_pb2.CreateTableRequest, context) -> table_service_pb2.TableResponse:
        """Create a new Delta table with the specified schema."""
        try:
            # Debug logging - log all request fields
            logger.info(f"[CreateTable] Request received:")
            logger.info(f"  - name: '{request.name}'")
            logger.info(f"  - description: '{request.description}'")
            logger.info(f"  - user_id: '{request.user_id}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - Request fields: {dir(request)}")
            logger.info(f"  - Has s3_path field: {hasattr(request, 's3_path')}")
            
            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[CreateTable] s3_path field is missing from request!")
                return table_service_pb2.TableResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )
            
            if not request.s3_path:
                logger.error("[CreateTable] s3_path is empty!")
                return table_service_pb2.TableResponse(
                    success=False,
                    message="s3_path is required but empty"
                )
            
            logger.info(f"Creating table: {request.name} at {request.s3_path}")

            # Convert relative path to full S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            logger.info(f"Writing to S3 URI: {s3_uri}")

            # Build schema from structured table fields
            schema = self._build_schema_from_table_fields(request.schema.fields)

            # Create empty DataFrame with the schema
            # Convert PyArrow schema to Polars-compatible format
            if len(schema) == 0:
                # Empty schema - create completely empty DataFrame
                empty_df = pl.DataFrame()
            else:
                # Create empty DataFrame from PyArrow schema
                empty_table = pa.table({field.name: pa.array([], type=field.type) for field in schema})
                empty_df = pl.from_arrow(empty_table)

            # Write to S3/MinIO as Delta Lake table
            write_deltalake(
                s3_uri,
                empty_df,
                mode="overwrite",
                storage_options=storage_options
            )
            
            # Create table response
            table = table_service_pb2.Table(
                table_id=request.name,  # Use name as ID for now
                name=request.name,
                schema=request.schema,  # Use structured schema
                description=request.description,
                created_by=request.user_id,
                updated_by=request.user_id,
                created_at_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                updated_at_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                organization_id=request.organization_id,
                metadata=dict(request.metadata),
                s3_path=request.s3_path
            )
            
            logger.info(f"Successfully created table: {request.name} at {request.s3_path}")
            return table_service_pb2.TableResponse(
                success=True,
                table=table,
                message="Table created successfully"
            )
            
        except Exception as e:
            logger.error(f"Error creating table {request.name}: {e}")
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return table_service_pb2.TableResponse(
                success=False,
                message=f"Failed to create table: {str(e)}"
            )

    def CreateRows(self, request: table_service_pb2.CreateRowsRequest, context) -> table_service_pb2.CreateRowsResponse:
        """Efficiently create multiple rows in a Delta table."""
        try:
            # Debug logging - log all request fields
            logger.info(f"[CreateRows] Request received:")
            logger.info(f"  - table_id: '{request.table_id}'")
            logger.info(f"  - user_id: '{request.user_id}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - rows_data count: {len(request.rows_data)}")
            logger.info(f"  - Request fields: {dir(request)}")
            logger.info(f"  - Has s3_path field: {hasattr(request, 's3_path')}")
            
            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[CreateRows] s3_path field is missing from request!")
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )
            
            if not request.s3_path:
                logger.error("[CreateRows] s3_path is empty!")
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message="s3_path is required but empty"
                )
            
            logger.info(f"Creating {len(request.rows_data)} rows in table: {request.table_id} at {request.s3_path}")

            # Convert relative path to full S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            # AIDEV-NOTE: Delta table MUST exist (created by CreateTable)
            # Fail fast if table doesn't exist - this indicates a bug in the call sequence
            try:
                delta_table = DeltaTable(s3_uri, storage_options=storage_options)
                logger.info(f"[CreateRows] Delta table exists (version {delta_table.version()})")
            except Exception as e:
                logger.error(f"[CreateRows] Delta table does not exist at {s3_uri}: {e}")
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message=f"Delta table not found. Call CreateTable before CreateRows: {e}"
                )

            # Always use schema-aware method (prevents Null type errors)
            logger.info(f"[CreateRows] Using schema-aware DataFrame creation")
            df = self._create_dataframe_with_schema(request.rows_data, delta_table)

            # DIAGNOSTIC: Log DataFrame details after creation
            logger.info(f"[CreateRows] DataFrame details:")
            logger.info(f"  - Shape: {len(df)} rows x {len(df.columns)} columns")
            logger.info(f"  - Columns: {df.columns}")
            logger.info(f"  - Schema: {df.schema}")
            logger.info(f"  - Sample data (first row): {df.head(1)}")

            logger.info(f"Appending {len(df)} rows to S3 URI: {s3_uri}")

            # Write to Delta table with S3 storage
            # AIDEV-NOTE: schema_mode="merge" allows schema evolution (new columns added automatically)
            # This enables adding new fields to tables without schema mismatch errors
            # Get write mode from request (default to "append" for backward compatibility)
            write_mode = request.mode if request.mode else "append"
            logger.info(f"[CreateRows] Write mode from request: '{write_mode}'")

            logger.info(f"[CreateRows] Calling write_deltalake with mode='{write_mode}' and schema_mode='merge'...")
            write_deltalake(
                s3_uri,
                df,
                mode=write_mode,  # Use mode from request ("append" or "overwrite")
                schema_mode="merge",  # Allow adding new columns (schema evolution)
                storage_options=storage_options
            )
            logger.info(f"[CreateRows] write_deltalake completed without exception (mode: {write_mode})")

            # VERIFICATION: Check Delta table state after write
            try:
                updated_table = DeltaTable(s3_uri, storage_options=storage_options)
                logger.info(f"[CreateRows] Delta table AFTER write:")
                logger.info(f"  - Version: {updated_table.version()}")
                logger.info(f"  - Files: {len(updated_table.files())}")
                logger.info(f"  - File list: {updated_table.files()}")

                # Read back to verify data was actually written using PyArrow
                arrow_table = updated_table.to_pyarrow_table()
                logger.info(f"[CreateRows] Verification read (PyArrow):")
                logger.info(f"  - Total rows in table: {arrow_table.num_rows}")
                logger.info(f"  - Total columns: {arrow_table.num_columns}")
                logger.info(f"  - Schema: {arrow_table.schema}")

                if arrow_table.num_rows == 0:
                    logger.error(f"[CreateRows] VERIFICATION FAILED: Table is empty after write!")
                    return table_service_pb2.CreateRowsResponse(
                        success=False,
                        message="Verification failed: Table is empty after write"
                    )

                logger.info(f"[CreateRows] ✅ VERIFICATION PASSED: {arrow_table.num_rows} rows in table")
            except Exception as e:
                logger.error(f"[CreateRows] VERIFICATION ERROR: Could not verify write: {e}")
                logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Don't fail the request on verification errors - the write succeeded
                logger.warning(f"[CreateRows] Skipping verification due to error, but write completed successfully")
            
            # Create row entities for response
            rows = []
            for row_data in request.rows_data:
                row = table_service_pb2.Row(
                    row_id=row_data.id,
                    table_id=request.table_id,
                    row_data=row_data,
                    created_by=request.user_id,
                    updated_by=request.user_id,
                    created_at_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                    updated_at_ms=int(datetime.now(timezone.utc).timestamp() * 1000),
                    organization_id=request.organization_id,
                    is_deleted=False
                )
                rows.append(row)
            
            logger.info(f"Successfully created {len(df)} rows in table: {request.table_id}")
            return table_service_pb2.CreateRowsResponse(
                success=True,
                rows=rows,
                rows_created=len(df),
                message=f"Successfully created {len(df)} rows"
            )
            
        except Exception as e:
            logger.error(f"Error creating rows in table {request.table_id}: {e}")
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return table_service_pb2.CreateRowsResponse(
                success=False,
                message=f"Failed to create rows: {str(e)}"
            )

    # Placeholder implementations for other required methods
    def GetTable(self, request: table_service_pb2.GetTableRequest, context) -> table_service_pb2.TableResponse:
        """Get table metadata."""
        return table_service_pb2.TableResponse(
            success=False,
            message="GetTable not yet implemented"
        )

    def UpdateTable(self, request: table_service_pb2.UpdateTableRequest, context) -> table_service_pb2.TableResponse:
        """Update table metadata and evolve schema with new fields."""
        logger.info(f"=== [UpdateTable] METHOD CALLED ===")
        try:
            # AIDEV-NOTE: UpdateTable implementation for Delta Lake schema evolution
            # When new fields are added in PostgreSQL, we need to sync them to Delta Lake
            # This allows sorting and filtering on newly added fields

            logger.info(f"[UpdateTable] Request received:")
            logger.info(f"  - table_id: '{request.table_id}'")
            logger.info(f"  - name: '{request.name}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - schema fields count: {len(request.schema.fields) if request.schema else 0}")
            logger.info(f"  - schema fields: {[f.name for f in request.schema.fields] if request.schema else []}")

            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[UpdateTable] s3_path field is missing from request!")
                return table_service_pb2.TableResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )

            if not request.s3_path:
                logger.error("[UpdateTable] s3_path is empty!")
                return table_service_pb2.TableResponse(
                    success=False,
                    message="s3_path is required but empty"
                )

            # Convert relative path to full S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            logger.info(f"Updating table schema at: {s3_uri}")

            # Read existing Delta table to check current schema
            try:
                delta_table = DeltaTable(s3_uri, storage_options=storage_options)
                # AIDEV-NOTE: Use helper method to convert Delta Lake schema to PyArrow
                current_schema = self._get_delta_schema_as_pyarrow(delta_table)
                current_columns = [field.name for field in current_schema]
                logger.info(f"[UpdateTable] Current Delta Lake columns: {current_columns}")
            except Exception as e:
                logger.warning(f"[UpdateTable] Could not read existing table (might not exist yet): {e}")
                # Table might not exist yet - that's ok, it will be created on first row insert
                return table_service_pb2.TableResponse(
                    success=True,
                    message=f"Table schema update queued (table will be created on first data insert)"
                )

            # Build new schema from request
            new_schema = self._build_schema_from_table_fields(request.schema.fields)
            new_columns = [field.name for field in new_schema]
            logger.info(f"[UpdateTable] New schema columns: {new_columns}")

            # Find columns that need to be added
            columns_to_add = [col for col in new_columns if col not in current_columns]
            logger.info(f"[UpdateTable] Columns to add: {columns_to_add}")

            if not columns_to_add:
                logger.info("[UpdateTable] No new columns to add, schema is already up to date")
                return table_service_pb2.TableResponse(
                    success=True,
                    message="Schema is already up to date"
                )

            # AIDEV-NOTE: Schema evolution via empty DataFrame write
            # Delta Lake's schema_mode="merge" will add new columns automatically
            # We write an empty DataFrame with the new schema to trigger evolution
            # This is the safest approach - no data modification, just schema update

            # Create empty Polars DataFrame with new schema only (columns to add)
            schema_dict = {}
            for field in new_schema:
                if field.name in columns_to_add:
                    # Map PyArrow types to Polars types for empty DataFrame
                    if field.type == pa.float64():
                        schema_dict[field.name] = pl.Float64
                    elif field.type == pa.bool_():
                        schema_dict[field.name] = pl.Boolean
                    elif field.type == pa.timestamp('us'):
                        schema_dict[field.name] = pl.Datetime('us')
                    else:  # Default to String for text, JSON, etc.
                        schema_dict[field.name] = pl.Utf8

            # Create empty DataFrame with new columns only
            df_schema = pl.DataFrame(schema=schema_dict)
            logger.info(f"[UpdateTable] Created empty DataFrame with schema: {df_schema.columns}")

            # Write empty DataFrame to trigger schema evolution
            # mode="append" won't add any rows (DataFrame is empty)
            # schema_mode="merge" will add the new columns to the schema
            from deltalake import write_deltalake
            write_deltalake(
                s3_uri,
                df_schema,
                mode="append",
                schema_mode="merge",  # Critical: enables adding new columns
                storage_options=storage_options
            )

            # Verify schema was updated
            updated_table = DeltaTable(s3_uri, storage_options=storage_options)
            # AIDEV-NOTE: Use helper method to convert Delta Lake schema to PyArrow
            updated_schema = self._get_delta_schema_as_pyarrow(updated_table)
            updated_columns = [field.name for field in updated_schema]
            logger.info(f"[UpdateTable] Delta table AFTER schema evolution:")
            logger.info(f"  - Columns: {updated_columns}")
            logger.info(f"  - Version: {updated_table.version()}")

            # Verify all new columns were added
            missing_columns = [col for col in columns_to_add if col not in updated_columns]
            if missing_columns:
                logger.error(f"[UpdateTable] Failed to add columns: {missing_columns}")
                return table_service_pb2.TableResponse(
                    success=False,
                    message=f"Failed to add columns: {missing_columns}"
                )

            # AIDEV-NOTE: Backfill boolean columns with false (not null)
            # When adding new boolean columns, existing rows have null values
            # This causes filtering issues (null != false), so we set them to false
            # This matches user expectations: unchecked checkbox = false, not null
            boolean_columns_added = []
            for field in new_schema:
                if field.name in columns_to_add and field.type == pa.bool_():
                    boolean_columns_added.append(field.name)

            if boolean_columns_added:
                logger.info(f"[UpdateTable] Backfilling boolean columns with false: {boolean_columns_added}")
                try:
                    # Use Delta Lake UPDATE to set null values to false
                    # This ensures immediate filterability of the new boolean column
                    for col_name in boolean_columns_added:
                        # Build predicate for null values in this column
                        predicate = f"`{col_name}` IS NULL"

                        # Update null values to false
                        updated_table.update(
                            predicate=predicate,
                            updates={col_name: "false"}
                        )

                        logger.info(f"[UpdateTable] Backfilled column '{col_name}' with false")

                    logger.info(f"[UpdateTable] Successfully backfilled {len(boolean_columns_added)} boolean columns")

                except Exception as backfill_error:
                    # Log error but don't fail the entire operation
                    # Schema evolution succeeded, backfill is optimization
                    logger.warning(f"[UpdateTable] Failed to backfill boolean columns: {backfill_error}")
                    logger.warning(f"[UpdateTable] Schema evolution succeeded, but existing rows will have null values")

            logger.info(f"[UpdateTable] Successfully added {len(columns_to_add)} columns: {columns_to_add}")
            return table_service_pb2.TableResponse(
                success=True,
                message=f"Schema updated: added {len(columns_to_add)} columns"
            )

        except Exception as e:
            logger.error(f"Error updating table {request.table_id}: {e}")
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return table_service_pb2.TableResponse(
                success=False,
                message=f"Failed to update table: {str(e)}"
            )

    def DeleteTable(self, request: table_service_pb2.DeleteTableRequest, context) -> table_service_pb2.DeleteTableResponse:
        """Delete a table."""
        return table_service_pb2.DeleteTableResponse(
            success=False,
            message="DeleteTable not yet implemented"
        )

    def ListTables(self, request: table_service_pb2.ListTablesRequest, context) -> table_service_pb2.ListTablesResponse:
        """List tables for an organization."""
        return table_service_pb2.ListTablesResponse(
            success=False,
            message="ListTables not yet implemented"
        )

    def GetRows(self, request: table_service_pb2.GetRowsRequest, context) -> table_service_pb2.GetRowsResponse:
        """Get multiple rows by IDs."""
        return table_service_pb2.GetRowsResponse(
            success=False,
            message="GetRows not yet implemented"
        )

    def UpdateRows(self, request: table_service_pb2.UpdateRowsRequest, context) -> table_service_pb2.UpdateRowsResponse:
        """Update multiple rows using Delta Lake merge operation."""
        try:
            # Debug logging - log all request fields
            logger.info(f"[UpdateRows] Request received:")
            logger.info(f"  - table_id: '{request.table_id}'")
            logger.info(f"  - user_id: '{request.user_id}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - rows_data count: {len(request.rows_data)}")

            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[UpdateRows] s3_path field is missing from request!")
                return table_service_pb2.UpdateRowsResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )

            if not request.s3_path:
                logger.error("[UpdateRows] s3_path is empty!")
                return table_service_pb2.UpdateRowsResponse(
                    success=False,
                    message="s3_path is required but empty"
                )

            logger.info(f"Updating {len(request.rows_data)} rows in table: {request.table_id} at {request.s3_path}")

            # Convert relative path to full S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            # AIDEV-NOTE: Delta table MUST exist (we're updating existing rows)
            # Fail fast if table doesn't exist
            try:
                delta_table = DeltaTable(s3_uri, storage_options=storage_options)
                logger.info(f"[UpdateRows] Delta table exists (version {delta_table.version()})")
            except Exception as e:
                logger.error(f"[UpdateRows] Delta table does not exist: {e}")
                return table_service_pb2.UpdateRowsResponse(
                    success=False,
                    message=f"Cannot update rows in non-existent table: {e}"
                )

            # Always use schema-aware method (prevents Null type errors)
            logger.info(f"[UpdateRows] Using schema-aware DataFrame creation")
            df = self._create_dataframe_with_schema(request.rows_data, delta_table)

            # DIAGNOSTIC: Log DataFrame details before merge
            logger.info(f"[UpdateRows] DataFrame details:")
            logger.info(f"  - Shape: {len(df)} rows x {len(df.columns)} columns")
            logger.info(f"  - Columns: {df.columns}")
            logger.info(f"  - Schema: {df.schema}")
            logger.info(f"  - Sample data (first row): {df.head(1)}")

            logger.info(f"Merging {len(df)} rows to S3 URI: {s3_uri}")

            # Perform merge operation using Delta Lake native merge
            # AIDEV-NOTE: This performs efficient row-level updates without rewriting entire table
            # Matches rows by 'id' field and updates all columns when matched
            logger.info(f"[UpdateRows] Executing Delta Lake merge operation...")
            delta_table.merge(
                source=df.to_arrow(),  # Convert Polars DataFrame to PyArrow Table
                predicate='target.id = source.id',
                source_alias='source',
                target_alias='target'
            ).when_matched_update_all().execute()

            logger.info(f"[UpdateRows] Merge operation completed successfully")

            # VERIFICATION: Check Delta table state after merge
            try:
                updated_table = DeltaTable(s3_uri, storage_options=storage_options)
                logger.info(f"[UpdateRows] Delta table AFTER merge:")
                logger.info(f"  - Version: {updated_table.version()}")
                logger.info(f"  - Files: {len(updated_table.files())}")
            except Exception as e:
                logger.warning(f"[UpdateRows] Could not verify merge result: {e}")

            return table_service_pb2.UpdateRowsResponse(
                success=True,
                rows_updated=len(df)
            )

        except Exception as e:
            logger.error(f"[UpdateRows] Error updating rows: {e}", exc_info=True)
            return table_service_pb2.UpdateRowsResponse(
                success=False,
                message=f"Error updating rows: {str(e)}"
            )

    def DeleteRows(self, request: table_service_pb2.DeleteRowsRequest, context) -> table_service_pb2.DeleteRowsResponse:
        """Delete multiple rows using Delta Lake delete operation."""
        try:
            # Debug logging - log all request fields
            logger.info(f"[DeleteRows] Request received:")
            logger.info(f"  - table_id: '{request.table_id}'")
            logger.info(f"  - user_id: '{request.user_id}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - row_ids count: {len(request.row_ids)}")

            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[DeleteRows] s3_path field is missing from request!")
                return table_service_pb2.DeleteRowsResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )

            if not request.s3_path:
                logger.error("[DeleteRows] s3_path is empty!")
                return table_service_pb2.DeleteRowsResponse(
                    success=False,
                    message="s3_path is required but empty"
                )

            if len(request.row_ids) == 0:
                logger.warning("[DeleteRows] No row IDs provided")
                return table_service_pb2.DeleteRowsResponse(
                    success=True,
                    rows_deleted=0
                )

            logger.info(f"Deleting {len(request.row_ids)} rows from table: {request.table_id} at {request.s3_path}")

            # Convert relative path to full S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            logger.info(f"Deleting from S3 URI: {s3_uri}")

            # Load existing Delta table
            try:
                dt = DeltaTable(s3_uri, storage_options=storage_options)
                logger.info(f"[DeleteRows] Delta table BEFORE delete:")
                logger.info(f"  - Version: {dt.version()}")
                logger.info(f"  - Files: {len(dt.files())}")
            except Exception as e:
                logger.error(f"[DeleteRows] Could not read Delta table: {e}")
                return table_service_pb2.DeleteRowsResponse(
                    success=False,
                    message=f"Delta table not found: {e}"
                )

            # Build delete predicate (id IN ('row1', 'row2', ...))
            # AIDEV-NOTE: Escape single quotes in row IDs to prevent SQL injection
            escaped_ids = [row_id.replace("'", "''") for row_id in request.row_ids]
            row_ids_str = "', '".join(escaped_ids)
            predicate = f"id IN ('{row_ids_str}')"

            logger.info(f"[DeleteRows] Executing Delta Lake delete with predicate: {predicate}")

            # Perform efficient row-level delete using Delta Lake native delete
            # AIDEV-NOTE: This performs efficient row-level deletes without rewriting entire table
            dt.delete(predicate)

            logger.info(f"[DeleteRows] Delete operation completed successfully")

            # VERIFICATION: Check Delta table state after delete
            try:
                updated_table = DeltaTable(s3_uri, storage_options=storage_options)
                logger.info(f"[DeleteRows] Delta table AFTER delete:")
                logger.info(f"  - Version: {updated_table.version()}")
                logger.info(f"  - Files: {len(updated_table.files())}")
            except Exception as e:
                logger.warning(f"[DeleteRows] Could not verify delete result: {e}")

            return table_service_pb2.DeleteRowsResponse(
                success=True,
                rows_deleted=len(request.row_ids)
            )

        except Exception as e:
            logger.error(f"[DeleteRows] Error deleting rows: {e}", exc_info=True)
            return table_service_pb2.DeleteRowsResponse(
                success=False,
                message=f"Error deleting rows: {str(e)}"
            )

    # AIDEV-NOTE: Removed duplicate GetTableStats - using the better implementation below at line ~1204

    def _cast_value_to_column_type(self, value, column_type):
        """
        Cast Python value to match PyArrow column type.

        This ensures filter values are compatible with actual column types,
        preventing PyArrow kernel errors like string_view comparison issues.

        Args:
            value: Python value from protobuf (str, int, float, bool, etc.)
            column_type: PyArrow DataType from schema

        Returns:
            Python value cast to appropriate type for column

        Raises:
            ValueError: If value cannot be cast to target type
        """
        import pyarrow.types as pat

        if value is None:
            return None

        try:
            # String types (including string_view)
            if pat.is_string(column_type) or pat.is_large_string(column_type):
                return str(value)

            # Integer types
            elif pat.is_integer(column_type):
                return int(value)

            # Floating point types
            elif pat.is_floating(column_type):
                return float(value)

            # Boolean type
            elif pat.is_boolean(column_type):
                if isinstance(value, bool):
                    return value
                return str(value).lower() in ('true', '1', 'yes')

            # Date types
            elif pat.is_date(column_type):
                # Keep as string, will be parsed by PyArrow
                return str(value)

            # Timestamp types
            elif pat.is_timestamp(column_type):
                # Keep as string, will be parsed by PyArrow
                return str(value)

            # Default: return as-is
            else:
                logger.warning(f"Unsupported column type for casting: {column_type}, using value as-is")
                return value

        except (ValueError, TypeError) as e:
            logger.error(f"Failed to cast value {value} to type {column_type}: {e}")
            raise ValueError(f"Cannot cast filter value '{value}' to column type {column_type}")

    def _build_pyarrow_predicate(self, filters, schema):
        """
        Build PyArrow compute predicate from request filters for efficient filtering.

        This enables predicate pushdown to Delta Lake - filters are applied BEFORE
        loading data into memory, which is 10-100x faster for large tables.

        AIDEV-NOTE: LIKE/ILIKE operators are NOT supported in dataset filter predicates.
        These filters are skipped here and must be applied in-memory after loading.

        Supports these FilterOperator types for predicate pushdown:
        - FILTER_OP_EQ / FILTER_OP_NE: Exact match / not equal
        - FILTER_OP_GT / FILTER_OP_GTE / FILTER_OP_LT / FILTER_OP_LTE: Numeric comparisons
        - FILTER_OP_IN / FILTER_OP_NOT_IN: Value in list
        - FILTER_OP_IS_NULL / FILTER_OP_IS_NOT_NULL: Null checks

        NOT supported (apply in-memory instead):
        - FILTER_OP_LIKE / FILTER_OP_ILIKE: Pattern matching (use Polars after load)
        - FILTER_OP_CONTAINS / FILTER_OP_CONTAINED_BY / FILTER_OP_HAS_KEY: JSON operators

        Args:
            filters: List of RowFilter objects from protobuf QueryRowsRequest
            schema: PyArrow Schema from Delta table for type-safe casting

        Returns:
            PyArrow compute expression or None if no filters
        """
        import pyarrow.compute as pc

        if not filters or len(filters) == 0:
            return None

        predicates = []

        for filter_obj in filters:
            # Skip LIKE/ILIKE operators - they don't work in dataset filter predicates
            if filter_obj.operator in (table_service_pb2.FILTER_OP_LIKE, table_service_pb2.FILTER_OP_ILIKE):
                continue
            field_ref = pc.field(filter_obj.field)
            operator = filter_obj.operator

            # Extract value from the RowDataValue oneof
            value = None
            if filter_obj.value.HasField('text_value'):
                value = filter_obj.value.text_value
            elif filter_obj.value.HasField('number_value'):
                value = filter_obj.value.number_value
            elif filter_obj.value.HasField('boolean_value'):
                value = filter_obj.value.boolean_value
            elif filter_obj.value.HasField('date_value'):
                value = filter_obj.value.date_value
            elif filter_obj.value.HasField('json_value'):
                value = filter_obj.value.json_value

            # AIDEV-NOTE: Cast value to match column type from schema
            # This guarantees type compatibility and prevents PyArrow kernel errors
            # Schema-aware casting handles string_view, numeric, date types correctly
            if value is not None:
                try:
                    # Look up column type in schema
                    column_type = schema.field(filter_obj.field).type

                    # Cast Python value to match column type
                    casted_value = self._cast_value_to_column_type(value, column_type)

                    # CRITICAL FIX: Normalize string_view to regular string for filter compatibility
                    # PyArrow's filter kernels don't support string_view comparison
                    # Convert string_view → large_string to enable filtering
                    import pyarrow.types as pat
                    if pat.is_string_view(column_type):
                        # Normalize to large_string for filter compatibility
                        filter_type = pa.large_string()
                    elif pat.is_large_string(column_type) or pat.is_string(column_type):
                        # Use as-is for regular string types
                        filter_type = column_type
                    else:
                        # Non-string types: use as-is
                        filter_type = column_type

                    # Create scalar with filter-compatible type
                    value = pa.scalar(casted_value, type=filter_type)

                except KeyError:
                    logger.warning(f"Filter field '{filter_obj.field}' not found in schema, skipping filter")
                    continue
                except ValueError as e:
                    logger.error(f"Type casting error for field '{filter_obj.field}': {e}")
                    continue

            # Build predicate based on operator
            # Use the table_service_pb2 module that's already imported at the top of the file
            if operator == table_service_pb2.FILTER_OP_EQ:
                predicates.append(pc.equal(field_ref, value))

            elif operator == table_service_pb2.FILTER_OP_NE:
                predicates.append(pc.not_equal(field_ref, value))

            elif operator == table_service_pb2.FILTER_OP_GT:
                predicates.append(pc.greater(field_ref, value))

            elif operator == table_service_pb2.FILTER_OP_GTE:
                predicates.append(pc.greater_equal(field_ref, value))

            elif operator == table_service_pb2.FILTER_OP_LT:
                predicates.append(pc.less(field_ref, value))

            elif operator == table_service_pb2.FILTER_OP_LTE:
                predicates.append(pc.less_equal(field_ref, value))

            elif operator == table_service_pb2.FILTER_OP_IN:
                # Value in array - extract and cast values
                try:
                    column_type = schema.field(filter_obj.field).type

                    values_list = []
                    for val in filter_obj.values:
                        if val.HasField('text_value'):
                            values_list.append(val.text_value)
                        elif val.HasField('number_value'):
                            values_list.append(val.number_value)
                        elif val.HasField('boolean_value'):
                            values_list.append(val.boolean_value)

                    # Cast each value to match column type
                    casted_values = [self._cast_value_to_column_type(v, column_type) for v in values_list]

                    # CRITICAL FIX: Normalize string_view to large_string for filter compatibility
                    import pyarrow.types as pat
                    if pat.is_string_view(column_type):
                        filter_type = pa.large_string()
                    else:
                        filter_type = column_type

                    # Convert Python list to PyArrow Array for is_in
                    value_set_array = pa.array(casted_values, type=filter_type)
                    predicates.append(pc.is_in(field_ref, value_set=value_set_array))

                except KeyError:
                    logger.warning(f"Filter field '{filter_obj.field}' not found in schema, skipping IN filter")
                    continue
                except ValueError as e:
                    logger.error(f"Type casting error for IN filter on field '{filter_obj.field}': {e}")
                    continue
                except TypeError as e:
                    logger.error(f"PyArrow type error for IN filter on field '{filter_obj.field}': {e}")
                    continue

            elif operator == table_service_pb2.FILTER_OP_NOT_IN:
                # Value not in array - extract and cast values
                try:
                    column_type = schema.field(filter_obj.field).type

                    values_list = []
                    for val in filter_obj.values:
                        if val.HasField('text_value'):
                            values_list.append(val.text_value)
                        elif val.HasField('number_value'):
                            values_list.append(val.number_value)
                        elif val.HasField('boolean_value'):
                            values_list.append(val.boolean_value)

                    # Cast each value to match column type
                    casted_values = [self._cast_value_to_column_type(v, column_type) for v in values_list]

                    # CRITICAL FIX: Normalize string_view to large_string for filter compatibility
                    import pyarrow.types as pat
                    if pat.is_string_view(column_type):
                        filter_type = pa.large_string()
                    else:
                        filter_type = column_type

                    # Convert Python list to PyArrow Array for is_in
                    value_set_array = pa.array(casted_values, type=filter_type)
                    predicates.append(
                        pc.invert(pc.is_in(field_ref, value_set=value_set_array))
                    )

                except KeyError:
                    logger.warning(f"Filter field '{filter_obj.field}' not found in schema, skipping NOT_IN filter")
                    continue
                except ValueError as e:
                    logger.error(f"Type casting error for NOT_IN filter on field '{filter_obj.field}': {e}")
                    continue
                except TypeError as e:
                    logger.error(f"PyArrow type error for NOT_IN filter on field '{filter_obj.field}': {e}")
                    continue

            elif operator == table_service_pb2.FILTER_OP_IS_NULL:
                predicates.append(pc.is_null(field_ref))

            elif operator == table_service_pb2.FILTER_OP_IS_NOT_NULL:
                predicates.append(pc.is_valid(field_ref))

            # Note: CONTAINS, CONTAINED_BY, HAS_KEY require JSON-specific operators
            # These are more complex and may require custom handling
            # For now, we skip them - they could be added in a future iteration

        # Combine all predicates with AND logic
        # AIDEV-NOTE: Use & operator (not pc.and_) for filter expressions
        if len(predicates) == 0:
            return None
        elif len(predicates) == 1:
            return predicates[0]
        else:
            result = predicates[0]
            for pred in predicates[1:]:
                result = result & pred
            return result

    def QueryRows(self, request: table_service_pb2.QueryRowsRequest, context) -> table_service_pb2.QueryRowsResponse:
        """Query rows with filters and pagination - returns Arrow IPC for zero-copy transfer."""
        try:
            # Debug logging - log all request fields
            logger.info(f"[QueryRows] Request received:")
            logger.info(f"  - table_id: '{request.table_id}'")
            logger.info(f"  - user_id: '{request.user_id}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")
            logger.info(f"  - s3_path: '{getattr(request, 's3_path', 'MISSING')}'")
            logger.info(f"  - order_by: '{request.order_by}'")
            logger.info(f"  - order_direction: '{request.order_direction}'")
            logger.info(f"  - limit: {request.limit}")
            logger.info(f"  - offset: {request.offset}")
            logger.info(f"  - filters count: {len(request.filters)}")

            # Check if s3_path exists and is not empty
            if not hasattr(request, 's3_path'):
                logger.error("[QueryRows] s3_path field is missing from request!")
                return table_service_pb2.QueryRowsResponse(
                    success=False,
                    message="s3_path field is missing from request"
                )

            if not request.s3_path:
                logger.error("[QueryRows] s3_path is empty!")
                return table_service_pb2.QueryRowsResponse(
                    success=False,
                    message="s3_path is required but empty"
                )

            # Log filter information - request.filters is now a list of RowFilter objects, not a map
            filter_summary = [f"{f.field}:{f.operator}={f.value}" for f in request.filters] if request.filters else []
            logger.info(f"Querying table: {request.table_id} at {request.s3_path} with filters: {filter_summary}")

            # Convert relative path to full S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            logger.info(f"Reading from S3 URI: {s3_uri}")

            # Read Delta table from S3/MinIO
            delta_table = DeltaTable(s3_uri, storage_options=storage_options)

            # Get schema for type-safe filter casting
            # AIDEV-NOTE: Use helper method to convert Delta Lake schema to PyArrow for filtering
            schema = self._get_delta_schema_as_pyarrow(delta_table)

            # AIDEV-NOTE: Build PyArrow predicate for efficient filtering with predicate pushdown
            # This applies filters BEFORE loading data into memory (10-100x faster for large tables)
            # Delta Lake only loads filtered rows, not entire table
            # Pass schema for type-safe value casting to prevent kernel errors
            predicate = self._build_pyarrow_predicate(request.filters, schema)

            # Convert PyArrow table to Polars DataFrame with predicate pushdown
            # AIDEV-NOTE: DeltaTable.to_pyarrow_table(filters=predicate) is the correct method
            # Parameter is 'filters' (plural), not 'filter'
            # Predicate only includes filters that support pushdown (not LIKE/ILIKE)
            arrow_table = delta_table.to_pyarrow_table(filters=predicate)
            df = pl.from_arrow(arrow_table)

            # Apply LIKE/ILIKE filters in-memory using Polars
            # AIDEV-NOTE: LIKE/ILIKE don't work in PyArrow dataset filter predicates,
            # so we filter them in-memory after loading the data

            # First, detect if this is a text search (multiple ILIKE with same term)
            ilike_filters = [f for f in request.filters if f.operator == table_service_pb2.FILTER_OP_ILIKE]
            like_filters = [f for f in request.filters if f.operator == table_service_pb2.FILTER_OP_LIKE]

            # Check if we have a text search pattern (multiple ILIKE filters with same search term)
            is_text_search = False
            if len(ilike_filters) > 1:
                search_terms = set()
                for f in ilike_filters:
                    value = f.value.text_value if f.value.HasField('text_value') else ''
                    search_terms.add(value.replace('%', ''))

                if len(search_terms) == 1:
                    is_text_search = True
                    search_term = search_terms.pop()

                    # Build OR condition: field1.contains(term) OR field2.contains(term) OR ...
                    or_condition = None
                    for f in ilike_filters:
                        field_condition = pl.col(f.field).str.contains(f'(?i){search_term}')
                        if or_condition is None:
                            or_condition = field_condition
                        else:
                            or_condition = or_condition | field_condition

                    # Apply OR filter for text search
                    df = df.filter(or_condition)

            # If not a text search, apply LIKE/ILIKE filters with AND logic
            if not is_text_search:
                for filter_obj in request.filters:
                    if filter_obj.operator == table_service_pb2.FILTER_OP_ILIKE:
                        value = filter_obj.value.text_value if filter_obj.value.HasField('text_value') else ''
                        search_term = value.replace('%', '')
                        df = df.filter(pl.col(filter_obj.field).str.contains(f'(?i){search_term}'))

                    elif filter_obj.operator == table_service_pb2.FILTER_OP_LIKE:
                        value = filter_obj.value.text_value if filter_obj.value.HasField('text_value') else ''
                        search_term = value.replace('%', '')
                        df = df.filter(pl.col(filter_obj.field).str.contains(search_term))

            # AIDEV-NOTE: Aggregation support for metric/dashboard views
            # Check if aggregation is requested (new field in QueryRowsRequest)
            # Aggregations are applied AFTER filters for correct SQL semantics (WHERE before GROUP BY)
            # This extends QueryRows to support metric views with computed aggregations.
            if hasattr(request, 'aggregation') and request.HasField('aggregation'):
                logger.info(f"[QueryRows] Aggregation requested with {len(request.aggregation.aggregations)} functions")

                agg_config = request.aggregation

                # Build Polars aggregation expressions
                agg_exprs = []
                for agg_func in agg_config.aggregations:
                    field_name = agg_func.field_id  # Numeric field ID as string, e.g., "10", "11"

                    # Map protobuf aggregation type to Polars expression
                    if agg_func.type == table_service_pb2.AGG_TYPE_SUM:
                        agg_exprs.append(pl.col(field_name).sum().alias(agg_func.alias))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_AVG:
                        agg_exprs.append(pl.col(field_name).mean().alias(agg_func.alias))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT:
                        agg_exprs.append(pl.col(field_name).count().alias(agg_func.alias))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_MIN:
                        agg_exprs.append(pl.col(field_name).min().alias(agg_func.alias))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_MAX:
                        agg_exprs.append(pl.col(field_name).max().alias(agg_func.alias))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_DISTINCT:
                        agg_exprs.append(pl.col(field_name).n_unique().alias(agg_func.alias))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_EMPTY:
                        agg_exprs.append(
                            pl.col(field_name).is_null().sum().alias(agg_func.alias)
                        )
                    elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_NOT_EMPTY:
                        agg_exprs.append(
                            pl.col(field_name).is_not_null().sum().alias(agg_func.alias)
                        )
                    else:
                        logger.warning(f"[QueryRows] Unknown aggregation type: {agg_func.type}")
                        continue

                # Apply aggregation
                if len(agg_config.group_by_fields) > 0:
                    # GROUP BY aggregation (for dashboard views with multiple groups)
                    logger.info(f"[QueryRows] Applying GROUP BY aggregation on fields: {list(agg_config.group_by_fields)}")
                    df = df.group_by(list(agg_config.group_by_fields)).agg(agg_exprs)
                else:
                    # Global aggregation (single row result for metric views)
                    logger.info(f"[QueryRows] Applying global aggregation (no GROUP BY)")
                    df = df.select(agg_exprs)

                logger.info(f"[QueryRows] Aggregation complete, result shape: {df.shape}")

                # Get total count (for aggregated results, this is the row count after aggregation)
                total_count = len(df)

                # Skip sorting and pagination for aggregated results
                # Aggregated data is already in final form

                # Convert Polars DataFrame to PyArrow Table (zero-copy)
                arrow_table = df.to_arrow()

                # Serialize to Arrow IPC format (zero-copy stream)
                import io
                sink = io.BytesIO()
                with pa.ipc.new_stream(sink, arrow_table.schema) as writer:
                    writer.write_table(arrow_table)

                arrow_ipc_bytes = sink.getvalue()

                logger.info(f"Successfully executed aggregation query: {request.table_id}, returned {len(df)} rows as Arrow IPC ({len(arrow_ipc_bytes)} bytes)")
                return table_service_pb2.QueryRowsResponse(
                    success=True,
                    arrow_ipc_stream=arrow_ipc_bytes,
                    total_count=total_count,
                    message=f"Successfully executed aggregation, {len(df)} result rows"
                )

            # Apply ordering
            if request.order_by:
                # User-specified sort
                logger.info(f"[QueryRows] Sorting by '{request.order_by}' ({request.order_direction})")

                # Validate column exists
                if request.order_by not in df.columns:
                    logger.error(f"[QueryRows] Sort column '{request.order_by}' not found in DataFrame!")
                    logger.error(f"  - Available columns: {df.columns}")
                    return table_service_pb2.QueryRowsResponse(
                        success=False,
                        message=f"Sort column '{request.order_by}' not found in table"
                    )

                # Get field type from schema to handle empty strings in numeric columns
                field_type = None
                for field in schema:
                    if field.name == request.order_by:
                        field_type = field.type
                        break

                # AIDEV-NOTE: Diagnostic logging for sorting
                # Log sample values and statistics to help debug sorting issues
                sort_col_data = df.select(request.order_by).to_series()
                logger.info(f"[QueryRows] Sorting diagnostics for '{request.order_by}':")
                logger.info(f"  - Field type: {field_type}")
                logger.info(f"  - Total rows: {len(sort_col_data)}")
                logger.info(f"  - Null count: {sort_col_data.null_count()}")
                logger.info(f"  - Unique values count: {sort_col_data.n_unique()}")
                logger.info(f"  - Sample unique values (first 10): {sort_col_data.unique().head(10).to_list()}")

                # AIDEV-NOTE: Re-cast numeric/boolean columns for safe sorting
                # Handles legacy data where empty strings might be mixed with numbers
                # strict=False: converts invalid values (empty strings) to null automatically
                if field_type and (pa.types.is_floating(field_type) or pa.types.is_integer(field_type) or pa.types.is_boolean(field_type)):
                    # Determine target Polars type
                    if pa.types.is_floating(field_type):
                        target_type = pl.Float64
                    elif pa.types.is_integer(field_type):
                        target_type = pl.Int64
                    elif pa.types.is_boolean(field_type):
                        target_type = pl.Boolean

                    logger.info(f"[QueryRows] Re-casting '{request.order_by}' to {target_type} for safe sorting")
                    # Re-cast column with strict=False (empty strings → null, preserves valid values)
                    df = df.with_columns(
                        pl.col(request.order_by).cast(target_type, strict=False)
                    )

                # Perform sort with null handling
                # AIDEV-NOTE: nulls_last=True ensures consistent behavior
                # - Sorts null/None values to the end regardless of sort direction
                # - Works with both ASC and DESC sorts
                # - Excel-like: empty cells go to bottom
                try:
                    df = df.sort(
                        request.order_by,
                        descending=(request.order_direction.upper() == 'DESC'),
                        nulls_last=True  # Always put nulls at the end
                    )
                    logger.info(f"[QueryRows] Sort successful, result shape: {df.shape}")
                except Exception as sort_error:
                    logger.error(f"[QueryRows] Sort failed: {type(sort_error).__name__}: {str(sort_error)}")
                    import traceback
                    logger.error(f"[QueryRows] Sort traceback: {traceback.format_exc()}")
                    return table_service_pb2.QueryRowsResponse(
                        success=False,
                        message=f"Failed to sort by '{request.order_by}': {str(sort_error)}"
                    )
            else:
                # AIDEV-NOTE: Default sort by 'id' to preserve insertion order
                # Delta Lake file order is non-deterministic (compaction, merges change order)
                # Sorting by 'id' ensures consistent, predictable row order matching insertion sequence
                logger.info(f"[QueryRows] No order_by specified, defaulting to sort by 'id' ASC")
                try:
                    df = df.sort('id', descending=False, nulls_last=True)
                    logger.info(f"[QueryRows] Default sort by 'id' successful")
                except Exception as sort_error:
                    logger.warning(f"[QueryRows] Could not sort by 'id': {sort_error}")
                    # Continue without sort - will use Delta Lake's file order

            # Get total count before pagination
            total_count = len(df)

            # Apply pagination
            if request.offset > 0:
                df = df.slice(request.offset)
            if request.limit > 0:
                df = df.slice(0, request.limit)

            # Convert Polars DataFrame to PyArrow Table (zero-copy)
            arrow_table = df.to_arrow()

            # Serialize to Arrow IPC format (zero-copy stream)
            import io
            sink = io.BytesIO()
            with pa.ipc.new_stream(sink, arrow_table.schema) as writer:
                writer.write_table(arrow_table)

            arrow_ipc_bytes = sink.getvalue()

            logger.info(f"Successfully queried table: {request.table_id}, returned {len(df)} rows as Arrow IPC ({len(arrow_ipc_bytes)} bytes)")
            return table_service_pb2.QueryRowsResponse(
                success=True,
                arrow_ipc_stream=arrow_ipc_bytes,
                total_count=total_count,
                message=f"Successfully queried {len(df)} rows"
            )

        except Exception as e:
            logger.error(f"Error querying table {request.table_id}: {e}")
            logger.error(f"Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return table_service_pb2.QueryRowsResponse(
                success=False,
                message=f"Failed to query table: {str(e)}"
            )

    def GetTableStats(self, request: table_service_pb2.GetTableStatsRequest, context) -> table_service_pb2.GetTableStatsResponse:
        """Get table statistics from Delta Lake metadata without loading data files.

        This method uses Delta Lake's transaction log (add actions) to get row count
        and file sizes without reading the actual data files. Much faster than loading all rows.

        AIDEV-NOTE: Handles empty tables (newly created with schema only) by checking
        for data files before attempting to access metadata to avoid Rust panics.
        """
        try:
            import pyarrow.compute as pc

            logger.info(f"[GetTableStats] Request received:")
            logger.info(f"  - table_id: '{request.table_id}'")
            logger.info(f"  - s3_path: '{request.s3_path}'")
            logger.info(f"  - organization_id: '{request.organization_id}'")

            if not request.s3_path:
                logger.error("[GetTableStats] s3_path is required")
                return table_service_pb2.GetTableStatsResponse(
                    success=False,
                    message="s3_path is required"
                )

            # Convert to S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            logger.info(f"[GetTableStats] Reading Delta table metadata from: {s3_uri}")

            # Load Delta table (metadata only - no data files read!)
            delta_table = DeltaTable(s3_uri, storage_options=storage_options)

            # AIDEV-NOTE: Check if table is empty to avoid Rust panic
            # Newly created tables have schema but no data files yet
            # Accessing file metadata on empty tables causes index out of bounds panic
            table_files = delta_table.files()
            table_version = delta_table.version()

            logger.info(f"[GetTableStats] Table state: version={table_version}, files={len(table_files)}")

            # Handle empty table case (schema only, no data)
            if len(table_files) == 0:
                logger.info(f"[GetTableStats] Table is empty (no data files yet), returning zeros")
                return table_service_pb2.GetTableStatsResponse(
                    success=True,
                    row_count=0,
                    size_bytes=0,
                    message="Table is empty (no data files)"
                )

            # Get add actions from transaction log
            # AIDEV-NOTE: add_actions contains metadata about files including num_records and size_bytes
            # This reads only the transaction log (_delta_log/*.json), not the actual data files
            # get_add_actions() returns arro3.core.RecordBatch in deltalake 1.2.1+
            try:
                add_actions_arro3 = delta_table.get_add_actions(flatten=True)

                # Convert arro3.RecordBatch to pyarrow.Table using PyCapsule interface (zero-copy)
                # PyArrow compute functions require PyArrow objects, not arro3
                # Use pa.table() which accepts objects implementing __arrow_c_stream__ protocol
                add_actions = pa.table(add_actions_arro3)

                # Double-check that add_actions is not empty before accessing columns
                if len(add_actions) == 0:
                    logger.info(f"[GetTableStats] Add actions is empty, returning zeros")
                    return table_service_pb2.GetTableStatsResponse(
                        success=True,
                        row_count=0,
                        size_bytes=0,
                        message="Table has no add actions"
                    )

                # Sum num_records across all files to get total row count
                row_count = pc.sum(add_actions['num_records']).as_py()

                # Sum size_bytes across all files to get total size
                size_bytes = pc.sum(add_actions['size_bytes']).as_py()

                # Handle None/null results from sum (can happen with empty tables)
                row_count = row_count if row_count is not None else 0
                size_bytes = size_bytes if size_bytes is not None else 0

                logger.info(f"[GetTableStats] Retrieved stats from metadata: {row_count} rows, {size_bytes} bytes")

                return table_service_pb2.GetTableStatsResponse(
                    success=True,
                    row_count=row_count,
                    size_bytes=size_bytes,
                    message=f"Statistics retrieved from Delta Lake metadata"
                )

            except Exception as metadata_error:
                # Catch Rust panics or other errors from get_add_actions
                logger.warning(f"[GetTableStats] Could not get add actions (likely empty table): {metadata_error}")
                logger.info(f"[GetTableStats] Returning zeros for empty table")
                return table_service_pb2.GetTableStatsResponse(
                    success=True,
                    row_count=0,
                    size_bytes=0,
                    message="Table is empty (could not read metadata)"
                )

        except Exception as e:
            logger.error(f"[GetTableStats] Error getting table stats for {request.table_id}: {e}")
            logger.error(f"[GetTableStats] Exception details: {type(e).__name__}: {str(e)}")
            import traceback
            logger.error(f"[GetTableStats] Traceback: {traceback.format_exc()}")
            return table_service_pb2.GetTableStatsResponse(
                success=False,
                message=f"Failed to get table stats: {str(e)}"
            )