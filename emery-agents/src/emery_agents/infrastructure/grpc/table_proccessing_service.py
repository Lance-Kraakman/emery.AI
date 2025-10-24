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

    def _build_schema_from_table_fields(self, table_fields: List[table_service_pb2.TableField]) -> pa.Schema:
        """Convert protobuf TableField messages to PyArrow schema for Delta Lake."""
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
            for field in table_fields:
                dtype = type_mapping.get(field.type, pa.string())
                arrow_fields.append(pa.field(field.name, dtype, nullable=not field.required))

            return pa.schema(arrow_fields)
        except Exception as e:
            logger.error(f"Error building schema from table fields: {e}")
            raise ValueError(f"Invalid table fields: {e}")

    def _row_data_to_dataframe(self, rows_data: List[table_service_pb2.RowData]) -> pl.DataFrame:
        """Convert protobuf RowData messages to Polars DataFrame.

        Polars will infer types from the data, and Delta Lake will handle schema matching during write.
        """
        try:
            data = []
            for row_data in rows_data:
                record = {'id': row_data.id}

                # Convert protobuf RowDataValue to Python types
                for key, value in row_data.data.items():
                    # AIDEV-NOTE: Debug logging for relation/document fields
                    if key in ['relation', 'docs', 'document']:
                        logger.info(f"[_row_data_to_dataframe] Processing field '{key}':")
                        logger.info(f"  - HasField('text_value'): {value.HasField('text_value')}")
                        logger.info(f"  - HasField('json_value'): {value.HasField('json_value')}")
                        if value.HasField('text_value'):
                            logger.info(f"  - text_value: {value.text_value[:100] if value.text_value else 'EMPTY'}")
                        if value.HasField('json_value'):
                            logger.info(f"  - json_value: {value.json_value[:100] if value.json_value else 'EMPTY'}")

                    if value.HasField('text_value'):
                        record[key] = value.text_value
                    elif value.HasField('number_value'):
                        record[key] = value.number_value
                    elif value.HasField('boolean_value'):
                        record[key] = value.boolean_value
                    elif value.HasField('date_value'):
                        record[key] = value.date_value
                    elif value.HasField('json_value'):
                        # AIDEV-NOTE: Store JSON as string in Delta Lake (schema expects pa.string())
                        # TypeScript will parse the JSON string when deserializing from storage
                        record[key] = value.json_value
                    else:
                        record[key] = None  # Default for unset values

                # Log the complete record for first row
                if len(data) == 0:
                    logger.info(f"[_row_data_to_dataframe] First record: {record}")

                data.append(record)

            # Create Polars DataFrame - Polars will infer types
            # Schema matching happens during write_deltalake()
            return pl.DataFrame(data)
        except Exception as e:
            logger.error(f"Error converting row data to DataFrame: {e}")
            raise ValueError(f"Invalid row data: {e}")

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

            # Convert to DataFrame (Polars infers types, Delta Lake handles schema matching)
            df = self._row_data_to_dataframe(request.rows_data)

            # DIAGNOSTIC: Log DataFrame details before write
            logger.info(f"[CreateRows] DataFrame details:")
            logger.info(f"  - Shape: {len(df)} rows x {len(df.columns)} columns")
            logger.info(f"  - Columns: {df.columns}")
            logger.info(f"  - Schema: {df.schema}")
            logger.info(f"  - Sample data (first row): {df.head(1)}")

            # Convert relative path to full S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            logger.info(f"Appending {len(df)} rows to S3 URI: {s3_uri}")

            # Check existing Delta table state before write
            try:
                existing_table = DeltaTable(s3_uri, storage_options=storage_options)
                logger.info(f"[CreateRows] Delta table BEFORE write:")
                logger.info(f"  - Version: {existing_table.version()}")
                logger.info(f"  - Files: {len(existing_table.files())}")
                logger.info(f"  - Schema: {existing_table.schema()}")
            except Exception as e:
                logger.warning(f"[CreateRows] Could not read existing table (might be first write): {e}")

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
        """Update table metadata."""
        return table_service_pb2.TableResponse(
            success=False,
            message="UpdateTable not yet implemented"
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

            # Convert to DataFrame (Polars infers types, Delta Lake handles schema matching)
            df = self._row_data_to_dataframe(request.rows_data)

            # DIAGNOSTIC: Log DataFrame details before merge
            logger.info(f"[UpdateRows] DataFrame details:")
            logger.info(f"  - Shape: {len(df)} rows x {len(df.columns)} columns")
            logger.info(f"  - Columns: {df.columns}")
            logger.info(f"  - Schema: {df.schema}")
            logger.info(f"  - Sample data (first row): {df.head(1)}")

            # Convert relative path to full S3 URI
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()

            logger.info(f"Merging {len(df)} rows to S3 URI: {s3_uri}")

            # Load existing Delta table
            try:
                dt = DeltaTable(s3_uri, storage_options=storage_options)
                logger.info(f"[UpdateRows] Delta table BEFORE merge:")
                logger.info(f"  - Version: {dt.version()}")
                logger.info(f"  - Files: {len(dt.files())}")
            except Exception as e:
                logger.error(f"[UpdateRows] Could not read Delta table: {e}")
                return table_service_pb2.UpdateRowsResponse(
                    success=False,
                    message=f"Delta table not found: {e}"
                )

            # Perform merge operation using Delta Lake native merge
            # AIDEV-NOTE: This performs efficient row-level updates without rewriting entire table
            # Matches rows by 'id' field and updates all columns when matched
            logger.info(f"[UpdateRows] Executing Delta Lake merge operation...")
            dt.merge(
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

    def _build_pyarrow_predicate(self, filters):
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
                # Value in array - extract values from repeated values field
                values_list = []
                for val in filter_obj.values:
                    if val.HasField('text_value'):
                        values_list.append(val.text_value)
                    elif val.HasField('number_value'):
                        values_list.append(val.number_value)
                    elif val.HasField('boolean_value'):
                        values_list.append(val.boolean_value)
                predicates.append(pc.is_in(field_ref, value_set=values_list))

            elif operator == table_service_pb2.FILTER_OP_NOT_IN:
                # Value not in array
                values_list = []
                for val in filter_obj.values:
                    if val.HasField('text_value'):
                        values_list.append(val.text_value)
                    elif val.HasField('number_value'):
                        values_list.append(val.number_value)
                    elif val.HasField('boolean_value'):
                        values_list.append(val.boolean_value)
                predicates.append(
                    pc.invert(pc.is_in(field_ref, value_set=values_list))
                )

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

            # AIDEV-NOTE: Build PyArrow predicate for efficient filtering with predicate pushdown
            # This applies filters BEFORE loading data into memory (10-100x faster for large tables)
            # Delta Lake only loads filtered rows, not entire table
            predicate = self._build_pyarrow_predicate(request.filters)

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

            # Apply ordering
            if request.order_by:
                if request.order_direction.upper() == 'DESC':
                    df = df.sort(request.order_by, descending=True)
                else:
                    df = df.sort(request.order_by, descending=False)

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

            # Get add actions from transaction log
            # AIDEV-NOTE: add_actions contains metadata about files including num_records and size_bytes
            # This reads only the transaction log (_delta_log/*.json), not the actual data files
            # get_add_actions() returns arro3.core.RecordBatch in deltalake 1.2.1+
            add_actions_arro3 = delta_table.get_add_actions(flatten=True)

            # Convert arro3.RecordBatch to pyarrow.Table using PyCapsule interface (zero-copy)
            # PyArrow compute functions require PyArrow objects, not arro3
            # Use pa.table() which accepts objects implementing __arrow_c_stream__ protocol
            add_actions = pa.table(add_actions_arro3)

            # Sum num_records across all files to get total row count
            row_count = pc.sum(add_actions['num_records']).as_py()

            # Sum size_bytes across all files to get total size
            size_bytes = pc.sum(add_actions['size_bytes']).as_py()

            logger.info(f"[GetTableStats] Retrieved stats from metadata: {row_count} rows, {size_bytes} bytes")

            return table_service_pb2.GetTableStatsResponse(
                success=True,
                row_count=row_count,
                size_bytes=size_bytes,
                message=f"Statistics retrieved from Delta Lake metadata"
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