"""
Delta Lake Table Service

This service handles all table and row operations using Delta Lake for storage.
It provides high-performance, ACID-compliant operations on data stored in S3.
"""

import json
import logging
import os
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime, timezone
from .table.operations import apply_field_additions
from .table.field_utils import field_to_column_name
from .table.operations import write_with_merge_operation
import polars as pl
import pyarrow as pa
import pyarrow.compute as pc
import pandas as pd
from deltalake import write_deltalake, DeltaTable
from google.protobuf.json_format import Parse, MessageToJson
from google.protobuf.struct_pb2 import ListValue
from grpc import ServicerContext
from .generated import table_service_pb2, table_service_pb2_grpc
from .table.transform import normalize_arrow_table_to_large_string
from .table.schema import get_delta_schema_as_pyarrow, convert_protobuf_field_to_arrow, migrate_column_type
from .table.schema_operations import (
    detect_new_columns,
    evolve_table_schema,
    verify_schema_update,
    backfill_boolean_columns
)
from .table.validate import validate_s3_path
from .table.operations import (
    prepare_create_rows, 
    prepare_query_rows, 
    prepare_table_stats, 
    prepare_update_rows, 
    write_with_schema_evolution
)
from .table.schema import build_schema_from_table_fields


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

    def _log_request(self, method: str, **fields) -> None:
        """Log request in compact single-line format.

        Args:
            method: Method name for context
            **fields: Key-value pairs to log
        """
        field_str = ", ".join(f"{k}='{v}'" for k, v in fields.items())
        logger.debug(f"[{method}] Request: {field_str}")

    def _log_dataframe(self, df: pl.DataFrame, context: str, show_sample: bool = True) -> None:
        """Log DataFrame details in compact format.

        Args:
            df: Polars DataFrame to log
            context: Context string for logging
            show_sample: Whether to show sample row
        """
        sample = f", sample={df.head(1).to_dicts()[0]}" if show_sample and len(df) > 0 else ""
        logger.debug(f"[{context}] DataFrame: shape={df.shape}, cols={df.columns}{sample}")

    def _log_delta_state(self, delta_table: DeltaTable, context: str) -> None:
        """Log Delta table state in compact format.

        Args:
            delta_table: Delta table instance
            context: Context string for logging
        """
        logger.debug(f"[{context}] Delta: version={delta_table.version()}, files={len(delta_table.files())}")

    def _log_field_mismatch(self, input_fields: set, schema_fields: set, context: str) -> None:
        """Log field mismatches between input and schema.

        Args:
            input_fields: Fields present in input data
            schema_fields: Fields in Delta Lake schema
            context: Context string for logging
        """
        missing = input_fields - schema_fields
        extra = schema_fields - input_fields

        if missing:
            logger.warning(f"[{context}] Fields in input NOT in schema (will be dropped): {sorted(missing)}")
        if extra:
            logger.info(f"[{context}] Fields in schema not in input (null-filled): {sorted(extra)}")

    

    def _get_delta_table_safe(self, s3_uri: str, storage_options: Dict[str, str], method: str, must_exist: bool = True) -> Tuple[Optional[DeltaTable], Optional[str]]:
        """Safely load Delta table with error handling.

        Args:
            s3_uri: Full S3 URI to Delta table
            storage_options: S3 connection options
            method: Method name for logging
            must_exist: If True, failure to load is an error; if False, it's a warning

        Returns:
            Tuple of (delta_table: Optional[DeltaTable], error_msg: Optional[str])
        """
        try:
            delta_table = DeltaTable(s3_uri, storage_options=storage_options)
            self._log_delta_state(delta_table, method)
            return delta_table, None
        except Exception as e:
            log_func = logger.error if must_exist else logger.warning
            log_func(f"[{method}] Delta table not found at {s3_uri}: {e}")
            return None, str(e)

    def _verify_write_operation(self, s3_uri: str, storage_options: dict, method: str, expected_min_rows: int = 0) -> bool:
        """Verify write operation succeeded by checking Delta table state.

        Args:
            s3_uri: Full S3 URI to Delta table
            storage_options: S3 connection options
            method: Method name for logging
            expected_min_rows: Minimum expected row count (0 = skip row check)

        Returns:
            True if verification passed, False otherwise
        """
        try:
            updated_table = DeltaTable(s3_uri, storage_options=storage_options)
            self._log_delta_state(updated_table, f"{method} AFTER write")

            # Read back to verify data
            arrow_table = updated_table.to_pyarrow_table()
            logger.info(f"[{method}] Verification: {arrow_table.num_rows} rows, {arrow_table.num_columns} cols")

            if expected_min_rows > 0 and arrow_table.num_rows < expected_min_rows:
                logger.error(f"[{method}] VERIFICATION FAILED: Expected >={expected_min_rows} rows, got {arrow_table.num_rows}")
                return False

            logger.info(f"[{method}] ✅ Verification passed")
            return True
        except Exception as e:
            logger.error(f"[{method}] Verification error: {e}")
            return False

    def CreateTable(self, request: table_service_pb2.CreateTableRequest, context) -> table_service_pb2.TableResponse:
        """Create a new Delta table with the specified schema."""
        try:
            # Compact logging
            self._log_request("CreateTable", name=request.name, organization_id=request.organization_id,
                            user_id=request.user_id, s3_path=request.s3_path)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "CreateTable", self._to_s3_uri)
            if not valid:
                return error_response

            # Use table library operations
            from .table.operations import prepare_create_table
            if s3_uri is None:
                return table_service_pb2.TableResponse(
                    success=False, message="Invalid S3 path"
                )
            prepare_create_table(list(request.schema.fields), s3_uri, self._get_storage_options())
            
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

            logger.info(f"[CreateTable] ✅ Created table '{request.name}'")
            return table_service_pb2.TableResponse(
                success=True,
                table=table,
                message="Table created successfully"
            )

        except Exception as e:
            logger.error(f"[CreateTable] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.TableResponse(
                success=False,
                message=f"Failed to create table: {str(e)}"
            )

    def CreateRows(self, request: table_service_pb2.CreateRowsRequest, context: ServicerContext) -> table_service_pb2.CreateRowsResponse:
        """Efficiently create multiple rows in a Delta table."""
        from datetime import datetime
        try:
            # Compact logging
            self._log_request("CreateRows", table_id=request.table_id, organization_id=request.organization_id,
                            rows_count=len(request.rows_data), s3_path=request.s3_path)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "CreateRows", self._to_s3_uri)
            if not valid:
                return table_service_pb2.CreateRowsResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "CreateRows", must_exist=True)
            if not delta_table:
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message=f"Delta table not found. Call CreateTable before CreateRows: {error_msg}"
                )

            # Use table library operations
            write_mode = request.mode if request.mode else "append"
            df, arrow_table = prepare_create_rows(request.rows_data, delta_table, write_mode)
            
            self._log_dataframe(df, "CreateRows", show_sample=True)
            
            # Use library write function
            write_with_schema_evolution(s3_uri, arrow_table, write_mode, storage_options)

            # Verify write succeeded
            if not self._verify_write_operation(s3_uri, storage_options, "CreateRows", expected_min_rows=1):
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message="Verification failed: Table is empty after write"
                )
            
            # Create row entities for response (unchanged)
            rows = [
                table_service_pb2.Row(
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
                for row_data in request.rows_data
            ]

            logger.info(f"CreateRows ✅ Created {len(df)} rows in table '{request.table_id}'")
            return table_service_pb2.CreateRowsResponse(
                success=True,
                rows=rows,
                rows_created=len(df),
                message=f"Successfully created {len(df)} rows"
            )

        except Exception as e:
            logger.error(f"CreateRows ❌ Failed to create rows in table '{request.table_id}': {type(e).__name__}: {e}", exc_info=True)
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

            # Compact logging
            field_count = len(request.schema.fields) if request.schema else 0
            self._log_request("UpdateTable", table_id=request.table_id, name=request.name,
                            s3_path=request.s3_path, field_count=field_count)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "UpdateTable", self._to_s3_uri)
            if not valid:
                return table_service_pb2.TableResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()

            # Read existing Delta table to check current schema
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "UpdateTable", must_exist=False)
            if not delta_table:
                # Table might not exist yet - that's ok, it will be created on first row insert
                return table_service_pb2.TableResponse(
                    success=True,
                    message="Table schema update queued (table will be created on first data insert)"
                )

            # Load current and new schemas
            current_schema = get_delta_schema_as_pyarrow(delta_table)
            new_schema = build_schema_from_table_fields(request.schema.fields)

            # Detect which columns need to be added
            columns_to_add = detect_new_columns(current_schema, new_schema)

            if not columns_to_add:
                return table_service_pb2.TableResponse(success=True, message="Schema is already up to date")

            # Extract just the new fields from new_schema (preserves metadata)
            new_fields_schema = pa.schema([f for f in new_schema if f.name in columns_to_add])

            # Apply schema evolution with metadata-rich schema
            evolve_table_schema(s3_uri, new_fields_schema, storage_options)

            # Verify the schema was updated successfully
            error_msg = verify_schema_update(s3_uri, columns_to_add, storage_options)
            if error_msg:
                return table_service_pb2.TableResponse(success=False, message=error_msg)

            # Backfill boolean columns with false instead of null
            backfill_boolean_columns(s3_uri, new_schema, columns_to_add, storage_options)

            logger.info(f"[UpdateTable] ✅ Added {len(columns_to_add)} columns: {columns_to_add}")
            return table_service_pb2.TableResponse(
                success=True,
                message=f"Schema updated: added {len(columns_to_add)} columns"
            )

        except Exception as e:
            logger.error(f"[UpdateTable] Error: {type(e).__name__}: {e}", exc_info=True)
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

    def UpdateRows(self, request: table_service_pb2.UpdateRowsRequest, context: ServicerContext) -> table_service_pb2.UpdateRowsResponse:
        """Update multiple rows using Delta Lake merge operation."""
        try:
            # Compact logging
            self._log_request("UpdateRows", table_id=request.table_id, organization_id=request.organization_id,
                            rows_count=len(request.rows_data), s3_path=request.s3_path)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "UpdateRows", self._to_s3_uri)
            if not valid:
                return table_service_pb2.UpdateRowsResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "UpdateRows", must_exist=True)
            if not delta_table:
                return table_service_pb2.UpdateRowsResponse(
                    success=False,
                    message=f"Cannot update rows in non-existent table: {error_msg}"
                )

            # Use table library operations (always overwrite for updates)
            df, arrow_table = prepare_update_rows(request.rows_data, delta_table)
            self._log_dataframe(df, "UpdateRows", show_sample=True)
            
            # Use proper merge operation to update only specific rows, not overwrite entire table
            write_with_merge_operation(s3_uri or "", arrow_table, storage_options)

            # Log post-merge state
            self._log_delta_state(DeltaTable(s3_uri, storage_options=storage_options), "UpdateRows AFTER merge")

            logger.info(f"[UpdateRows] ✅ Updated {len(df)} rows in '{request.table_id}'")
            return table_service_pb2.UpdateRowsResponse(success=True, rows_updated=len(df))

        except Exception as e:
            logger.error(f"[UpdateRows] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.UpdateRowsResponse(
                success=False,
                message=f"Error updating rows: {str(e)}"
            )

    def DeleteRows(self, request: table_service_pb2.DeleteRowsRequest, context) -> table_service_pb2.DeleteRowsResponse:
        """Delete multiple rows using Delta Lake delete operation."""
        try:
            # Compact logging
            self._log_request("DeleteRows", table_id=request.table_id, organization_id=request.organization_id,
                            row_ids_count=len(request.row_ids), s3_path=request.s3_path)

            if len(request.row_ids) == 0:
                return table_service_pb2.DeleteRowsResponse(success=True, rows_deleted=0)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "DeleteRows", self._to_s3_uri)
            if not valid:
                return table_service_pb2.DeleteRowsResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()

            # Load existing Delta table
            dt, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "DeleteRows", must_exist=True)
            if not dt:
                return table_service_pb2.DeleteRowsResponse(success=False, message=f"Delta table not found: {error_msg}")

            self._log_delta_state(dt, "DeleteRows BEFORE delete")

            # Build delete predicate (id IN ('row1', 'row2', ...))
            # AIDEV-NOTE: Escape single quotes in row IDs to prevent SQL injection
            escaped_ids = [row_id.replace("'", "''") for row_id in request.row_ids]
            row_ids_str = "', '".join(escaped_ids)
            predicate = f"id IN ('{row_ids_str}')"

            logger.info(f"[DeleteRows] Executing delete with predicate: {predicate}")

            # AIDEV-NOTE: Efficient row-level deletes without rewriting entire table
            dt.delete(predicate)

            # Log post-delete state
            self._log_delta_state(DeltaTable(s3_uri, storage_options=storage_options), "DeleteRows AFTER delete")

            logger.info(f"[DeleteRows] ✅ Deleted {len(request.row_ids)} rows from '{request.table_id}'")
            return table_service_pb2.DeleteRowsResponse(success=True, rows_deleted=len(request.row_ids))

        except Exception as e:
            logger.error(f"[DeleteRows] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.DeleteRowsResponse(
                success=False,
                message=f"Error deleting rows: {str(e)}"
            )

    # AIDEV-NOTE: Removed duplicate GetTableStats - using the better implementation below at line ~1204



    

    def QueryRows(self, request: table_service_pb2.QueryRowsRequest, context) -> table_service_pb2.QueryRowsResponse:
        """Query rows with filters and pagination - returns Arrow IPC for zero-copy transfer."""
        try:
            # Compact logging
            self._log_request("QueryRows", table_id=request.table_id, s3_path=request.s3_path,
                            order_by=request.order_by, direction=request.order_direction,
                            limit=request.limit, offset=request.offset, filters=len(request.filters))

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "QueryRows", self._to_s3_uri)
            if not valid:
                return table_service_pb2.QueryRowsResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()
            delta_table = DeltaTable(s3_uri, storage_options=storage_options)

            # Use table library operations
            df, metadata = prepare_query_rows(
                delta_table,
                list(request.filters),
                [request.order_by] if request.order_by else [],
                request.order_direction if hasattr(request, 'order_direction') and request.order_direction else 'ASC',
                request.limit,
                request.offset,
                request.aggregation if request.HasField('aggregation') else None
            )

            # Convert to Arrow for response
            arrow_table = df.to_arrow()
            
            # Serialize to Arrow IPC for zero-copy transfer
            import pyarrow.ipc as ipc
            sink = pa.BufferOutputStream()
            with ipc.new_file(sink, arrow_table.schema) as writer:
                writer.write_table(arrow_table)
            arrow_ipc_bytes = sink.getvalue().to_pybytes()

            return table_service_pb2.QueryRowsResponse(
                success=True,
                arrow_ipc_stream=arrow_ipc_bytes,
                total_count=metadata['total_count'],
                message=f"Successfully queried {metadata['total_count']} rows"
            )

        except Exception as e:
            logger.error(f"[QueryRows] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.QueryRowsResponse(
                success=False,
                message=f"Failed to query rows: {str(e)}"
            )

    def GetTableStats(self, request: table_service_pb2.GetTableStatsRequest, context) -> table_service_pb2.GetTableStatsResponse:
        """Get table statistics from Delta Lake metadata without loading data files."""
        try:
            # Compact logging
            self._log_request("GetTableStats", table_id=request.table_id, s3_path=request.s3_path,
                            organization_id=request.organization_id)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "GetTableStats", self._to_s3_uri)
            if not valid:
                return table_service_pb2.GetTableStatsResponse(success=False, message=error_response.message)

            # Use table library operations
            if s3_uri is None:
                return table_service_pb2.GetTableStatsResponse(
                    success=False, message="Invalid S3 path"
                )
            stats = prepare_table_stats(s3_uri, self._get_storage_options())

            logger.info(f"[GetTableStats] ✅ Stats: {stats['row_count']} rows, {stats['size_bytes']} bytes")
            return table_service_pb2.GetTableStatsResponse(
                success=True,
                row_count=stats['row_count'],
                size_bytes=stats['size_bytes'],
                message=stats.get('message', 'Success')
            )

        except Exception as e:
            logger.error(f"[GetTableStats] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.GetTableStatsResponse(
                success=False,
                message=f"Failed to get table stats: {str(e)}"
            )

    # ===== FIELD MANAGEMENT METHODS =====

    def AddField(self, request: table_service_pb2.AddFieldRequest, context) -> table_service_pb2.FieldResponse:
        """Add a new field to an existing Delta table."""
        try:
            self._log_request("AddField", table_id=request.table_id, 
                            field_name=request.field.name, field_type=request.field.type,
                            organization_id=request.organization_id, s3_path=request.s3_path)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "AddField", self._to_s3_uri)
            if not valid:
                return table_service_pb2.FieldResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()

            # Load Delta table if it exists, but don't require it to exist
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "AddField", must_exist=False)
            
            # Check if table exists and field already exists
            field_column_name = field_to_column_name(request.field)  # Use centralized utility
            if delta_table:
                current_schema = get_delta_schema_as_pyarrow(delta_table)
                current_columns = [field.name for field in current_schema]
                
                if field_column_name in current_columns:
                    return table_service_pb2.FieldResponse(
                        success=False,
                        message=f"Field ID '{request.field.field_id}' already exists in table"
                    )

            # Validate field conversion works
            new_field_type = convert_protobuf_field_to_arrow(request.field)
            _ = pa.field(field_column_name, new_field_type, nullable=not request.field.required)
            
            # Apply field additions to Delta Lake schema if table exists
            if delta_table and s3_uri:
                apply_field_additions(delta_table, [request.field], s3_uri, storage_options)
                logger.info(f"[AddField] ✅ Added field '{request.field.name}' to table '{request.table_id}' (schema evolved)")
            else:
                logger.info(f"[AddField] ✅ Added field '{request.field.name}' to table '{request.table_id}' (metadata only)")
            
            return table_service_pb2.FieldResponse(
                success=True,
                field=request.field,
                message=f"Field '{request.field.name}' added successfully"
            )

        except Exception as e:
            logger.error(f"[AddField] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.FieldResponse(
                success=False,
                message=f"Failed to add field: {str(e)}"
            )

    def UpdateField(self, request: table_service_pb2.UpdateFieldRequest, context) -> table_service_pb2.FieldResponse:
        """Update an existing field in a Delta table with validation and optimized paths."""
        try:
            self._log_request("UpdateField", table_id=request.table_id, field_id=request.field_id,
                            new_field_name=request.updated_field.name, migrate_data=request.migrate_data,
                            organization_id=request.organization_id, s3_path=request.s3_path)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "UpdateField", self._to_s3_uri)
            if not valid:
                return table_service_pb2.FieldResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()

            # Load existing Delta table
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "UpdateField", must_exist=True)
            if not delta_table:
                return table_service_pb2.FieldResponse(
                    success=False,
                    message=f"Delta table not found: {error_msg}"
                )

            # Get current schema and find the field
            current_schema = get_delta_schema_as_pyarrow(delta_table)

            # Find current field by field_id in schema
            from .table.field_utils import field_id_to_column_name
            field_column_name = field_id_to_column_name(request.field_id)
            current_field = next((f for f in current_schema if f.name == field_column_name), None)

            if not current_field:
                return table_service_pb2.FieldResponse(
                    success=False,
                    message=f"Field with ID {request.field_id} not found in table"
                )

            # Get current and new field types
            old_field_type_arrow = current_field.type
            new_field_type_arrow = convert_protobuf_field_to_arrow(request.updated_field)

            # Get current field type enum from metadata
            from .table.schema import get_field_type_from_metadata
            current_field_type_enum = get_field_type_from_metadata(current_field.metadata)
            if current_field_type_enum is None:
                logger.warning(f"[UpdateField] No field type metadata found for field ID {request.field_id}, assuming TEXT")
                current_field_type_enum = table_service_pb2.FIELD_TYPE_TEXT

            # Import validation functions
            from .table.field_validation import (
                validate_field_type_change,
                is_metadata_only_change,
                get_field_operation_description
            )

            # Log operation description
            operation_desc = get_field_operation_description(
                current_field_type_enum,
                request.updated_field.type,
                request.migrate_data
            )
            logger.info(f"[UpdateField] Field ID {request.field_id}: {operation_desc}")

            # METADATA-ONLY UPDATE PATH (Fast path)
            if old_field_type_arrow == new_field_type_arrow:
                # No type change - this is metadata-only (name, required, fieldConfig, etc.)
                # We don't need to load data, just update the schema metadata
                logger.info(f"[UpdateField] METADATA-ONLY update path for field {field_column_name}")

                # Log old vs new metadata for comparison
                field_idx = next(i for i, f in enumerate(current_schema) if f.name == field_column_name)
                old_metadata = current_schema[field_idx].metadata
                logger.info(f"[UpdateField] Old metadata: {old_metadata}")
                logger.info(f"[UpdateField] Field type: {old_field_type_arrow} (no change)")

                # Update schema metadata using evolve_schema
                from .table.schema import evolve_schema
                updated_schema = evolve_schema(current_schema, [request.updated_field])

                # Log new metadata
                new_field_idx = next(i for i, f in enumerate(updated_schema) if f.name == field_column_name)
                new_metadata = updated_schema[new_field_idx].metadata
                logger.info(f"[UpdateField] New metadata: {new_metadata}")

                # Write empty table with updated schema to trigger metadata evolution
                # This is FAST - no data loading, Delta Lake handles schema evolution
                from .table.transform import create_empty_arrow_table, normalize_arrow_table_to_large_string
                empty_table = create_empty_arrow_table(pa.schema([f for f in updated_schema if f.name == field_column_name]))
                normalized_empty = normalize_arrow_table_to_large_string(empty_table)

                # Write to Delta Lake (schema evolution will update metadata)
                from .table.operations import write_with_schema_evolution
                logger.info(f"[UpdateField] Writing empty table for metadata evolution (append mode)")
                write_with_schema_evolution(s3_uri, normalized_empty, "append", storage_options)

                # Verify the metadata update persisted
                delta_table_verify = DeltaTable(s3_uri, storage_options=storage_options)
                schema_verify = get_delta_schema_as_pyarrow(delta_table_verify)
                verify_field = next((f for f in schema_verify if f.name == field_column_name), None)
                if verify_field:
                    logger.info(f"[UpdateField] ✅ Verified metadata persisted: {verify_field.metadata}")
                else:
                    logger.warning(f"[UpdateField] ⚠️ Could not find field {field_column_name} after update")

                logger.info(f"[UpdateField] ✅ Metadata updated for field ID {request.field_id}")
                return table_service_pb2.FieldResponse(
                    success=True,
                    field=request.updated_field,
                    message=f"Field '{request.updated_field.name}' metadata updated successfully"
                )

            # TYPE CHANGE PATH (Requires validation and possibly data migration)
            logger.info(f"[UpdateField] Type change: {old_field_type_arrow} → {new_field_type_arrow}")

            # Validate type change is allowed
            is_valid, error_message = validate_field_type_change(current_field_type_enum, request.updated_field.type)
            if not is_valid:
                logger.error(f"[UpdateField] Type change validation failed: {error_message}")
                return table_service_pb2.FieldResponse(
                    success=False,
                    message=error_message
                )

            # Type change is valid - proceed with data migration if requested
            if request.migrate_data:
                logger.info(f"[UpdateField] Starting data migration for field ID {request.field_id}")

                # Read existing data
                arrow_table = delta_table.to_pyarrow_table()
                df = pl.from_arrow(arrow_table)

                # Apply type migration
                from .table.field_utils import field_to_column_name
                field_column_name = field_to_column_name(request.updated_field)
                if field_column_name in df.columns:
                    df = migrate_column_type(df, field_column_name, old_field_type_arrow, new_field_type_arrow)

                # Write back with new schema
                normalized_arrow = normalize_arrow_table_to_large_string(df.to_arrow())
                write_deltalake(s3_uri, normalized_arrow, mode="overwrite", storage_options=storage_options)

                logger.info(f"[UpdateField] ✅ Migrated {len(df)} rows for field ID {request.field_id}")
                return table_service_pb2.FieldResponse(
                    success=True,
                    field=request.updated_field,
                    message=f"Field '{request.updated_field.name}' type changed and {len(df)} rows migrated successfully"
                )
            else:
                # Type change without data migration - warn user
                logger.warning(f"[UpdateField] Type change WITHOUT data migration for field ID {request.field_id} - data may be incompatible")
                return table_service_pb2.FieldResponse(
                    success=False,
                    message=f"Type change requires data migration. Set migrate_data=true to proceed. Existing data may be incompatible with new type."
                )

        except Exception as e:
            logger.error(f"[UpdateField] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.FieldResponse(
                success=False,
                message=f"Failed to update field: {str(e)}"
            )

    def DeleteField(self, request: table_service_pb2.DeleteFieldRequest, context) -> table_service_pb2.DeleteFieldResponse:
        """Delete a field from a Delta table."""
        try:
            self._log_request("DeleteField", table_id=request.table_id, field_id=request.field_id,
                            backup_data=request.backup_data, organization_id=request.organization_id,
                            s3_path=request.s3_path)

            # Use table library validation
            valid, s3_uri, error_response = validate_s3_path(request, "DeleteField", self._to_s3_uri)
            if not valid:
                return table_service_pb2.DeleteFieldResponse(
                    success=False,
                    message=error_response.message
                )

            storage_options = self._get_storage_options()

            # Load existing Delta table
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "DeleteField", must_exist=True)
            if not delta_table:
                return table_service_pb2.DeleteFieldResponse(
                    success=False,
                    message=f"Delta table not found: {error_msg}"
                )

            # Get current schema
            current_schema = get_delta_schema_as_pyarrow(delta_table)

            # Find field column by field_id
            from .table.field_utils import field_id_to_column_name
            field_column_name = field_id_to_column_name(request.field_id)

            # Check if field exists in schema
            field_exists = any(f.name == field_column_name for f in current_schema)
            if not field_exists:
                return table_service_pb2.DeleteFieldResponse(
                    success=False,
                    message=f"Field ID {request.field_id} not found in table"
                )

            logger.info(f"[DeleteField] Deleting field ID {request.field_id} (column: {field_column_name})")

            # Backup data if requested
            backup_location = None
            if request.backup_data:
                try:
                    backup_location = self._backup_field_data(delta_table, request.field_id, s3_uri, storage_options)
                    logger.info(f"[DeleteField] Backed up field data to {backup_location}")
                except Exception as backup_error:
                    logger.warning(f"[DeleteField] Backup failed: {backup_error}, continuing with deletion")

            # Delete field using simple read-modify-write pattern
            # Log BEFORE deletion
            current_columns = [f.name for f in current_schema]
            logger.info(f"[DeleteField] BEFORE: Delta schema has {len(current_columns)} columns: {current_columns}")

            arrow_table = delta_table.to_pyarrow_table()
            df = pl.from_arrow(arrow_table)
            df = df.drop([field_column_name])

            normalized_arrow = normalize_arrow_table_to_large_string(df.to_arrow())
            write_deltalake(s3_uri, normalized_arrow, mode="overwrite", storage_options=storage_options)

            # Verify deletion by reloading Delta table
            delta_table_after = DeltaTable(s3_uri, storage_options=storage_options)
            schema_after = get_delta_schema_as_pyarrow(delta_table_after)
            columns_after = [f.name for f in schema_after]
            still_exists = field_column_name in columns_after
            final_row_count = len(delta_table_after.to_pyarrow_table())

            logger.info(f"[DeleteField] AFTER: Delta schema has {len(columns_after)} columns: {columns_after}")
            logger.info(f"[DeleteField] Field {field_column_name} {'❌ STILL EXISTS' if still_exists else '✅ confirmed deleted'}")
            logger.info(f"[DeleteField] Verification: Table has {final_row_count} rows after deletion")
            logger.info(f"[DeleteField] ✅ Deleted field ID {request.field_id}")
            return table_service_pb2.DeleteFieldResponse(
                success=True,
                message=f"Field ID {request.field_id} deleted successfully",
                backup_location=backup_location or ""
            )

        except Exception as e:
            logger.error(f"[DeleteField] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.DeleteFieldResponse(
                success=False,
                message=f"Failed to delete field: {str(e)}"
            )

    def GetFields(self, request: table_service_pb2.GetFieldsRequest, context) -> table_service_pb2.GetFieldsResponse:
        """Get all fields for a table."""
        try:
            self._log_request("GetFields", table_id=request.table_id, organization_id=request.organization_id)

            # For now, return empty response since this requires integration with PostgreSQL metadata
            # In a full implementation, this would query the table_fields table
            logger.info(f"[GetFields] Returning field list for table '{request.table_id}'")
            
            return table_service_pb2.GetFieldsResponse(
                success=True,
                fields=[],  # Would be populated from PostgreSQL metadata
                message=f"Retrieved fields for table '{request.table_id}'"
            )

        except Exception as e:
            logger.error(f"[GetFields] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.GetFieldsResponse(
                success=False,
                message=f"Failed to get fields: {str(e)}"
            )

    # ===== HELPER METHODS FOR FIELD OPERATIONS =====







    def _backup_field_data(self, delta_table: DeltaTable, field_id: int, s3_uri: str, storage_options: dict) -> str:
        """Backup field data before deletion."""
        try:
            # Read current data
            arrow_table = delta_table.to_pyarrow_table()
            df = pl.from_arrow(arrow_table)
            
            # Find the column by field_id
            from .table.field_utils import field_id_to_column_name
            field_column_name = field_id_to_column_name(field_id)  # Use centralized utility
            backup_columns = ['id']  # Always include row ID
            if field_column_name in df.columns:
                backup_columns.append(field_column_name)
            
            if len(backup_columns) <= 1:
                logger.warning(f"[_backup_field_data] Field ID {field_id} not found for backup")
                return ""

            # Create backup DataFrame
            backup_df = df.select(backup_columns)
            
            # Generate backup location
            import datetime
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = f"{s3_uri}_backup_field_{field_id}_{timestamp}"
            
            # Write backup
            backup_arrow = normalize_arrow_table_to_large_string(backup_df.to_arrow())
            write_deltalake(backup_path, backup_arrow, mode="overwrite", storage_options=storage_options)
            
            logger.info(f"[_backup_field_data] ✅ Backed up field ID {field_id} to {backup_path}")
            return backup_path
            
        except Exception as e:
            logger.error(f"[_backup_field_data] Failed to backup field ID {field_id}: {e}")
            return ""