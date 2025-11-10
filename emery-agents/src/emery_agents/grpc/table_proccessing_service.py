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

import polars as pl
import pyarrow as pa
import pyarrow.compute as pc
from deltalake import write_deltalake, DeltaTable
from google.protobuf.json_format import Parse, MessageToJson
from google.protobuf.struct_pb2 import ListValue
from .generated import table_service_pb2, table_service_pb2_grpc

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
        logger.info(f"[{method}] Request: {field_str}")

    def _log_dataframe(self, df: pl.DataFrame, context: str, show_sample: bool = True) -> None:
        """Log DataFrame details in compact format.

        Args:
            df: Polars DataFrame to log
            context: Context string for logging
            show_sample: Whether to show sample row
        """
        sample = f", sample={df.head(1).to_dicts()[0]}" if show_sample and len(df) > 0 else ""
        logger.info(f"[{context}] DataFrame: shape={df.shape}, cols={df.columns}{sample}")

    def _log_delta_state(self, delta_table: DeltaTable, context: str) -> None:
        """Log Delta table state in compact format.

        Args:
            delta_table: Delta table instance
            context: Context string for logging
        """
        logger.info(f"[{context}] Delta: version={delta_table.version()}, files={len(delta_table.files())}")

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

    def _validate_s3_path(self, request: Any, method: str) -> Tuple[bool, Optional[str], Optional[table_service_pb2.TableResponse]]:
        """Validate s3_path field exists and is not empty.

        Args:
            request: Request object with s3_path field
            method: Method name for error messages

        Returns:
            Tuple of (success: bool, s3_uri: str, error_response: Optional[Response])
            If success=False, error_response should be returned immediately
        """
        if not hasattr(request, 's3_path'):
            logger.error(f"[{method}] s3_path field missing from request!")
            return False, None, table_service_pb2.TableResponse(
                success=False, message="s3_path field is missing from request"
            )

        if not request.s3_path:
            logger.error(f"[{method}] s3_path is empty!")
            return False, None, table_service_pb2.TableResponse(
                success=False, message="s3_path is required but empty"
            )

        s3_uri = self._to_s3_uri(request.s3_path)
        return True, s3_uri, None

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

    def _extract_protobuf_values(self, values: List[table_service_pb2.RowDataValue]) -> List[Any]:
        """Extract Python values from list of RowDataValue protobuf objects.

        Args:
            values: List of RowDataValue protobuf objects

        Returns:
            List of extracted Python values
        """
        result = []
        for val in values:
            if val.HasField('text_value'):
                result.append(val.text_value)
            elif val.HasField('number_value'):
                result.append(val.number_value)
            elif val.HasField('boolean_value'):
                result.append(val.boolean_value)
            elif val.HasField('date_value'):
                result.append(val.date_value)
            elif val.HasField('json_value'):
                result.append(val.json_value)
            else:
                result.append(None)
        return result

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
        def get_embedding_type(field) -> pa.DataType:
            """
            Extract embedding size from metadata and create fixed-size list type.

            AIDEV-NOTE: Embedding fields use fixed-size float32 lists for efficient storage.
            The embedding dimension is extracted from field metadata (embeddingSize).
            Default to 768 dimensions (all-mpnet-base-v2 standard) if not specified.
            """
            metadata = dict(field.metadata) if field.metadata else {}
            embedding_size_str = metadata.get('embeddingSize', '768')

            try:
                embedding_size = int(embedding_size_str)
            except (ValueError, TypeError):
                logger.warning(f"Invalid embeddingSize '{embedding_size_str}' for field {field.name}, defaulting to 768")
                embedding_size = 768

            # Validate dimension is one of the supported sizes
            valid_sizes = [384, 768, 1536, 3072]
            if embedding_size not in valid_sizes:
                logger.warning(f"Embedding size {embedding_size} not in valid sizes {valid_sizes} for field {field.name}, defaulting to 768")
                embedding_size = 768

            return pa.list_(pa.float32(), list_size=embedding_size)

        try:
            # Map protobuf field types to PyArrow types
            # CRITICAL FIX: Use large_string instead of string to prevent string_view in parquet
            # This enables predicate pushdown to work correctly with PyArrow filters
            type_mapping = {
                table_service_pb2.FIELD_TYPE_TEXT: pa.large_string(),
                table_service_pb2.FIELD_TYPE_NUMBER: pa.float64(),
                table_service_pb2.FIELD_TYPE_BOOLEAN: pa.bool_(),
                table_service_pb2.FIELD_TYPE_DATE: pa.timestamp('us'),
                table_service_pb2.FIELD_TYPE_FILE: pa.large_string(),    # Store as JSON
                table_service_pb2.FIELD_TYPE_RELATION: pa.large_string(), # Store as JSON
                table_service_pb2.FIELD_TYPE_DOCUMENT: pa.large_string(), # Store as JSON
                # AIDEV-NOTE: Select fields store option IDs (single) or arrays (multi) as JSON/text
                table_service_pb2.FIELD_TYPE_SINGLE_SELECT: pa.large_string(), # Store option ID as text/number
                table_service_pb2.FIELD_TYPE_MULTI_SELECT: pa.large_string(),  # Store array of option IDs as JSON
                # AIDEV-NOTE: Auto-fields for system-managed values
                table_service_pb2.FIELD_TYPE_AUTONUMBER: pa.large_string(),    # Formatted strings like "INV-00001"
                table_service_pb2.FIELD_TYPE_LAST_UPDATED: pa.timestamp('us'), # Auto-updated timestamp
                table_service_pb2.FIELD_TYPE_CREATED_AT: pa.timestamp('us'),   # Auto-set timestamp on creation
                # EMBEDDING handled separately due to dynamic sizing
            }

            arrow_fields = []

            # CRITICAL: Always add "id" column first for Delta Lake merge compatibility
            # This column stores the row UUID and is required for merge operations
            arrow_fields.append(pa.field("id", pa.large_string(), nullable=False))
            logger.debug(f"[_build_schema_from_table_fields] Added 'id' column (string, required)")

            # Add data fields with numeric column names
            for field in table_fields:
                # Skip the special "id" field - we've already added it
                if field.name == 'id':
                    logger.debug(f"[_build_schema_from_table_fields] Skipping field 'id' (field_id={field.field_id}) - already added as system column")
                    continue

                # Handle embedding fields with dynamic sizing
                if field.type == table_service_pb2.FIELD_TYPE_EMBEDDING:
                    dtype = get_embedding_type(field)
                    logger.debug(f"[_build_schema_from_table_fields] Embedding field: id={field.field_id}, name={field.name}, type={dtype}")
                else:
                    dtype = type_mapping.get(field.type, pa.large_string())

                # Use numeric field ID as column name (immutable identifier)
                column_name = str(field.field_id)
                arrow_fields.append(pa.field(column_name, dtype, nullable=not field.required))
                logger.debug(f"[_build_schema_from_table_fields] Field: id={field.field_id}, name={field.name}, column={column_name}, type={dtype}")

            return pa.schema(arrow_fields)
        except Exception as e:
            logger.error(f"Error building schema from table fields: {e}")
            raise ValueError(f"Invalid table fields: {e}")

    def _normalize_arrow_table_to_large_string(self, arrow_table: pa.Table) -> pa.Table:
        """
        Normalize all string columns in Arrow table to large_string type.

        This prevents string_view from being written to parquet files, which enables
        predicate pushdown to work correctly with PyArrow filters.

        AIDEV-NOTE: This is the proper fix for string_view issues.
        - Polars may use string_view internally for efficiency
        - Parquet writers may encode strings as string_view
        - But PyArrow filter kernels don't support string_view
        - Solution: Cast all strings to large_string before writing
        """
        import pyarrow.types as pat

        # Build new schema with string columns normalized to large_string
        new_fields = []
        for field in arrow_table.schema:
            if pat.is_string(field.type) or pat.is_string_view(field.type):
                # Normalize to large_string
                new_fields.append(pa.field(field.name, pa.large_string(), nullable=field.nullable))
            else:
                # Keep original type
                new_fields.append(field)

        target_schema = pa.schema(new_fields)

        # Cast table to target schema
        normalized_table = arrow_table.cast(target_schema)

        logger.debug(f"[_normalize_arrow_table_to_large_string] Normalized {len(arrow_table.schema)} columns")

        return normalized_table

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

        delta_field_names = [f.name for f in delta_schema_pyarrow]
        logger.info(f"[_create_dataframe_with_schema] Delta Lake schema: {delta_schema_pyarrow}")
        logger.info(f"[_create_dataframe_with_schema] Delta Lake field names: {delta_field_names}")

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
            elif pa.types.is_list(field.type) or pa.types.is_fixed_size_list(field.type):
                # Embedding fields are fixed-size lists of float32
                # Polars List type with Float32 inner type
                polars_schema[field.name] = pl.List(pl.Float32)
                logger.info(f"[_create_dataframe_with_schema] List field '{field.name}': {field.type} → pl.List(pl.Float32)")
            else:
                # Fallback to string for unknown types
                logger.warning(f"Unknown Arrow type for '{field.name}': {field.type}, using Utf8")
                polars_schema[field.name] = pl.Utf8

        polars_field_names = list(polars_schema.keys())
        logger.info(f"[_create_dataframe_with_schema] Polars schema: {polars_schema}")
        logger.info(f"[_create_dataframe_with_schema] Polars field names: {polars_field_names}")

        # 3. Convert protobuf to Python dicts (type-agnostic conversion)
        # AIDEV-NOTE: Keys are numeric field IDs, matching Delta Lake column names
        records = []
        for row_data in rows_data:
            record = {'id': row_data.id}

            for key, value in row_data.data.items():
                # Log detailed field value information for debugging
                field_info = {
                    'field_id': key,
                    'has_text': value.HasField('text_value'),
                    'has_number': value.HasField('number_value'),
                    'has_boolean': value.HasField('boolean_value'),
                    'has_date': value.HasField('date_value'),
                    'has_json': value.HasField('json_value'),
                    'has_embedding': value.HasField('embedding_value')
                }

                if value.HasField('text_value'):
                    record[key] = value.text_value
                    logger.debug(f"[UpdateRows] Field {key}: TEXT_VALUE = {value.text_value}")
                elif value.HasField('number_value'):
                    record[key] = value.number_value
                    logger.debug(f"[UpdateRows] Field {key}: NUMBER_VALUE = {value.number_value}")
                elif value.HasField('boolean_value'):
                    record[key] = value.boolean_value
                    logger.debug(f"[UpdateRows] Field {key}: BOOLEAN_VALUE = {value.boolean_value}")
                elif value.HasField('date_value'):
                    record[key] = value.date_value
                    logger.debug(f"[UpdateRows] Field {key}: DATE_VALUE = {value.date_value}")
                elif value.HasField('json_value'):
                    record[key] = value.json_value
                    # ❌ This is where corrupted select fields end up!
                    logger.warning(f"[UpdateRows] ⚠️ Field {key}: JSON_VALUE (should this be NUMBER for select fields?) = {value.json_value}")
                elif value.HasField('embedding_value'):
                    # Convert protobuf repeated float to Python list for Polars
                    record[key] = list(value.embedding_value.values)
                    logger.info(f"[_create_dataframe_with_schema] Extracted embedding: field={key}, dimensions={len(record[key])}")
                else:
                    record[key] = None  # Empty protobuf oneof = None
                    logger.debug(f"[UpdateRows] Field {key}: NONE (empty protobuf oneof)")

            records.append(record)

        # Log first record for debugging and detect field mismatches
        if records:
            first_record_keys = list(records[0].keys())
            logger.info(f"[_create_dataframe_with_schema] First record: keys={first_record_keys}, sample={records[0]}")

            # CRITICAL: Detect fields in input that are NOT in Delta Lake schema
            input_fields = set(first_record_keys)
            schema_fields = set(polars_field_names)
            self._log_field_mismatch(input_fields, schema_fields, "_create_dataframe_with_schema")

            # DEFENSIVE: Filter records to only include fields that exist in schema
            missing_in_schema = input_fields - schema_fields
            if missing_in_schema:
                logger.warning(f"[_create_dataframe_with_schema] Filtering {len(missing_in_schema)} unknown fields...")
                records = [{k: v for k, v in record.items() if k in schema_fields} for record in records]

        # 4. Create DataFrame with EXPLICIT schema (no inference, no casting)
        # AIDEV-NOTE: Zero-copy friendly - types match Delta Lake from creation
        # IMPORTANT: Polars DataFrame with explicit schema will ONLY include fields in polars_schema
        # Any extra fields in records will be silently dropped by Polars
        df = pl.DataFrame(records, schema=polars_schema)

        # Log final DataFrame state
        logger.info(f"[_create_dataframe_with_schema] Created DataFrame: shape={df.shape}, cols={df.columns}")

        # Final validation: confirm what was dropped
        if records and len(first_record_keys) != len(df.columns):
            dropped = len(first_record_keys) - len(df.columns)
            logger.error(f"[_create_dataframe_with_schema] ❌ DATA LOSS: {dropped} fields dropped (input={len(first_record_keys)}, output={len(df.columns)})")

        return df

    def _json_to_row_data(self, row_json: str) -> Dict[str, Any]:
        """Convert JSON string to row data dictionary."""
        try:
            return json.loads(row_json)
        except Exception as e:
            logger.error(f"Error parsing row JSON: {e}")
            raise ValueError(f"Invalid row JSON: {e}")

    def CreateTable(self, request: table_service_pb2.CreateTableRequest, context) -> table_service_pb2.TableResponse:
        """Create a new Delta table with the specified schema."""
        try:
            # Compact logging
            self._log_request("CreateTable", name=request.name, organization_id=request.organization_id,
                            user_id=request.user_id, s3_path=request.s3_path)

            # Validate s3_path
            valid, s3_uri, error_response = self._validate_s3_path(request, "CreateTable")
            if not valid:
                return error_response

            storage_options = self._get_storage_options()
            logger.info(f"[CreateTable] Writing to {s3_uri}")

            # Build schema from structured table fields
            schema = self._build_schema_from_table_fields(request.schema.fields)

            # Create empty DataFrame with the schema
            # Create empty Arrow table from schema
            if len(schema) == 0:
                # Empty schema - create completely empty table
                empty_table = pa.table({})
            else:
                # Create empty table from PyArrow schema
                empty_table = pa.table({field.name: pa.array([], type=field.type) for field in schema})
                # CRITICAL FIX: Normalize to large_string before writing to prevent string_view
                # Write Arrow table directly - don't convert to Polars (Polars uses string_view)
                empty_table = self._normalize_arrow_table_to_large_string(empty_table)

            # Write Arrow table directly to S3/MinIO as Delta Lake table
            # AIDEV-NOTE: Passing PyArrow table directly preserves large_string type
            write_deltalake(
                s3_uri,
                empty_table,
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

    def CreateRows(self, request: table_service_pb2.CreateRowsRequest, context) -> table_service_pb2.CreateRowsResponse:
        """Efficiently create multiple rows in a Delta table."""
        try:
            # Compact logging
            self._log_request("CreateRows", table_id=request.table_id, organization_id=request.organization_id,
                            rows_count=len(request.rows_data), s3_path=request.s3_path)

            # Validate s3_path
            valid, s3_uri, error_response = self._validate_s3_path(request, "CreateRows")
            if not valid:
                # Convert TableResponse to CreateRowsResponse
                return table_service_pb2.CreateRowsResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()

            # AIDEV-NOTE: Delta table MUST exist (created by CreateTable)
            # Fail fast if table doesn't exist - this indicates a bug in the call sequence
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "CreateRows", must_exist=True)
            if not delta_table:
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message=f"Delta table not found. Call CreateTable before CreateRows: {error_msg}"
                )

            # Always use schema-aware method (prevents Null type errors)
            df = self._create_dataframe_with_schema(request.rows_data, delta_table)
            self._log_dataframe(df, "CreateRows", show_sample=True)

            # Write to Delta table with S3 storage
            # AIDEV-NOTE: schema_mode="merge" allows schema evolution (new columns added automatically)
            write_mode = request.mode if request.mode else "append"
            logger.info(f"[CreateRows] Writing {len(df)} rows (mode={write_mode}, schema_mode=merge)")

            # CRITICAL FIX: Normalize to large_string before writing to prevent string_view
            arrow_table = df.to_arrow()
            arrow_table = self._normalize_arrow_table_to_large_string(arrow_table)

            # AIDEV-NOTE: Passing PyArrow table directly preserves large_string type
            write_deltalake(s3_uri, arrow_table, mode=write_mode, schema_mode="merge", storage_options=storage_options)

            # Verify write succeeded
            if not self._verify_write_operation(s3_uri, storage_options, "CreateRows", expected_min_rows=1):
                return table_service_pb2.CreateRowsResponse(
                    success=False,
                    message="Verification failed: Table is empty after write"
                )
            
            # Create row entities for response
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

            logger.info(f"[CreateRows] ✅ Created {len(df)} rows in '{request.table_id}'")
            return table_service_pb2.CreateRowsResponse(
                success=True,
                rows=rows,
                rows_created=len(df),
                message=f"Successfully created {len(df)} rows"
            )

        except Exception as e:
            logger.error(f"[CreateRows] Error: {type(e).__name__}: {e}", exc_info=True)
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

            # Validate s3_path
            valid, s3_uri, error_response = self._validate_s3_path(request, "UpdateTable")
            if not valid:
                return error_response

            storage_options = self._get_storage_options()

            # Read existing Delta table to check current schema
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "UpdateTable", must_exist=False)
            if not delta_table:
                # Table might not exist yet - that's ok, it will be created on first row insert
                return table_service_pb2.TableResponse(
                    success=True,
                    message="Table schema update queued (table will be created on first data insert)"
                )

            # AIDEV-NOTE: Use helper method to convert Delta Lake schema to PyArrow
            current_schema = self._get_delta_schema_as_pyarrow(delta_table)
            current_columns = [field.name for field in current_schema]
            logger.info(f"[UpdateTable] Current columns: {current_columns}")

            # Build new schema from request and find columns to add
            new_schema = self._build_schema_from_table_fields(request.schema.fields)
            new_columns = [field.name for field in new_schema]
            columns_to_add = [col for col in new_columns if col not in current_columns]

            logger.info(f"[UpdateTable] Schema change: new={new_columns}, to_add={columns_to_add}")

            if not columns_to_add:
                return table_service_pb2.TableResponse(success=True, message="Schema is already up to date")

            # AIDEV-NOTE: Schema evolution via empty DataFrame write
            # Delta Lake's schema_mode="merge" will add new columns automatically
            # Map PyArrow types to Polars types for new columns only
            schema_dict = {}
            for field in new_schema:
                if field.name in columns_to_add:
                    if field.type == pa.float64():
                        schema_dict[field.name] = pl.Float64
                    elif field.type == pa.bool_():
                        schema_dict[field.name] = pl.Boolean
                    elif field.type == pa.timestamp('us'):
                        schema_dict[field.name] = pl.Datetime('us')
                    else:
                        schema_dict[field.name] = pl.Utf8

            # Create empty DataFrame and trigger schema evolution
            logger.info(f"[UpdateTable] Adding columns: {list(schema_dict.keys())}")
            df_schema = pl.DataFrame(schema=schema_dict)
            arrow_table = self._normalize_arrow_table_to_large_string(df_schema.to_arrow())

            # AIDEV-NOTE: Passing PyArrow table directly preserves large_string type
            write_deltalake(s3_uri, arrow_table, mode="append", schema_mode="merge", storage_options=storage_options)

            # Verify schema evolution succeeded
            updated_table = DeltaTable(s3_uri, storage_options=storage_options)
            updated_schema = self._get_delta_schema_as_pyarrow(updated_table)
            updated_columns = [field.name for field in updated_schema]

            self._log_delta_state(updated_table, "UpdateTable AFTER evolution")
            logger.info(f"[UpdateTable] Updated columns: {updated_columns}")

            # Verify all new columns were added
            missing = [col for col in columns_to_add if col not in updated_columns]
            if missing:
                return table_service_pb2.TableResponse(success=False, message=f"Failed to add columns: {missing}")

            # AIDEV-NOTE: Backfill boolean columns with false (not null)
            # Matches user expectations: unchecked checkbox = false, not null
            boolean_cols = [f.name for f in new_schema if f.name in columns_to_add and f.type == pa.bool_()]

            if boolean_cols:
                logger.info(f"[UpdateTable] Backfilling {len(boolean_cols)} boolean columns: {boolean_cols}")
                try:
                    for col_name in boolean_cols:
                        updated_table.update(predicate=f"`{col_name}` IS NULL", updates={col_name: "false"})
                    logger.info(f"[UpdateTable] ✅ Backfilled {len(boolean_cols)} boolean columns")
                except Exception as e:
                    logger.warning(f"[UpdateTable] Backfill failed (non-critical): {e}")

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

    def UpdateRows(self, request: table_service_pb2.UpdateRowsRequest, context) -> table_service_pb2.UpdateRowsResponse:
        """Update multiple rows using Delta Lake merge operation."""
        try:
            # Compact logging
            self._log_request("UpdateRows", table_id=request.table_id, organization_id=request.organization_id,
                            rows_count=len(request.rows_data), s3_path=request.s3_path)

            # Validate s3_path
            valid, s3_uri, error_response = self._validate_s3_path(request, "UpdateRows")
            if not valid:
                return table_service_pb2.UpdateRowsResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()

            # AIDEV-NOTE: Delta table MUST exist (we're updating existing rows)
            delta_table, error_msg = self._get_delta_table_safe(s3_uri, storage_options, "UpdateRows", must_exist=True)
            if not delta_table:
                return table_service_pb2.UpdateRowsResponse(
                    success=False,
                    message=f"Cannot update rows in non-existent table: {error_msg}"
                )

            # Validate input fields match schema
            if request.rows_data:
                first_row = request.rows_data[0]
                input_fields = set(['id'] + list(first_row.data.keys()))
                delta_schema = pa.schema(delta_table.schema().to_arrow(as_large_types=True))
                schema_fields = set([f.name for f in delta_schema])

                self._log_field_mismatch(input_fields, schema_fields, "UpdateRows")

                # VALIDATION: Reject update to prevent silent data loss
                missing = input_fields - schema_fields
                if missing:
                    return table_service_pb2.UpdateRowsResponse(
                        success=False,
                        message=f"Cannot update rows: Fields {sorted(missing)} not in table schema. Refresh page."
                    )
            df = self._create_dataframe_with_schema(request.rows_data, delta_table)
            self._log_dataframe(df, "UpdateRows", show_sample=True)

            # Perform merge operation using Delta Lake native merge
            # AIDEV-NOTE: Efficient row-level updates without rewriting entire table
            logger.info(f"[UpdateRows] Merging {len(df)} rows...")
            source_arrow = self._normalize_arrow_table_to_large_string(df.to_arrow())

            delta_table.merge(
                source=source_arrow,
                predicate='target.id = source.id',
                source_alias='source',
                target_alias='target'
            ).when_matched_update_all().execute()

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

            # Validate s3_path
            valid, s3_uri, error_response = self._validate_s3_path(request, "DeleteRows")
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

    def _cast_value_to_column_type(self, value: Any, column_type: pa.DataType) -> Any:
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

    def _build_pyarrow_predicate(self, filters: List[table_service_pb2.RowFilter], schema: pa.Schema) -> Optional[pc.Expression]:
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

            # Get field reference for filter (no casting needed - data will be large_string)
            # AIDEV-NOTE: We ensure all string data is large_string at write time,
            # so predicate pushdown works correctly without casting
            try:
                field_ref = pc.field(filter_obj.field)
            except KeyError:
                # Field not in schema, skip
                logger.warning(f"Filter field '{filter_obj.field}' not found in schema")
                continue

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

                    # CRITICAL FIX: Normalize ALL string types to large_string for filter compatibility
                    # PyArrow's filter kernels don't support string_view comparison
                    # AIDEV-NOTE: Schema may report large_string but parquet data is string_view
                    # Always normalize string values to large_string to match field casting
                    import pyarrow.types as pat
                    if pat.is_string(column_type) or pat.is_large_string(column_type) or pat.is_string_view(column_type):
                        # Normalize all string variants to large_string for filter compatibility
                        filter_type = pa.large_string()
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

                    # CRITICAL FIX: Normalize ALL string types to large_string for filter compatibility
                    # AIDEV-NOTE: Schema may report large_string but parquet data is string_view
                    # Always normalize string values to large_string to match field casting
                    import pyarrow.types as pat
                    if pat.is_string(column_type) or pat.is_large_string(column_type) or pat.is_string_view(column_type):
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

                    # CRITICAL FIX: Normalize ALL string types to large_string for filter compatibility
                    # AIDEV-NOTE: Schema may report large_string but parquet data is string_view
                    # Always normalize string values to large_string to match field casting
                    import pyarrow.types as pat
                    if pat.is_string(column_type) or pat.is_large_string(column_type) or pat.is_string_view(column_type):
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
            # Compact logging
            self._log_request("QueryRows", table_id=request.table_id, s3_path=request.s3_path,
                            order_by=request.order_by, direction=request.order_direction,
                            limit=request.limit, offset=request.offset, filters=len(request.filters))

            # Validate s3_path
            valid, s3_uri, error_response = self._validate_s3_path(request, "QueryRows")
            if not valid:
                return table_service_pb2.QueryRowsResponse(success=False, message=error_response.message)

            storage_options = self._get_storage_options()

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
                # AIDEV-NOTE: Null Handling in Aggregations
                # - fill_null(0): Treats null values as zeros for numeric aggregations
                # - Why: User expectation is "average of 20 rows" not "average of 12 non-null rows"
                # - Example: AVG([10, 20, null, null]) = 7.5 (not 15)
                # - Applied to: SUM, AVG, MIN, MAX
                # - NOT applied to: COUNT (counts all rows), COUNT_EMPTY (counts nulls specifically)
                agg_exprs = []
                for agg_func in agg_config.aggregations:
                    field_id = agg_func.field_id  # Numeric field ID as string, e.g., "10", "11"

                    # Map protobuf aggregation type to Polars expression
                    # AIDEV-NOTE: Use field_id as alias to ensure column names match what TypeScript expects
                    if agg_func.type == table_service_pb2.AGG_TYPE_SUM:
                        agg_exprs.append(pl.col(field_id).fill_null(0).sum().alias(field_id))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_AVG:
                        agg_exprs.append(pl.col(field_id).fill_null(0).mean().alias(field_id))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT:
                        agg_exprs.append(pl.col(field_id).count().alias(field_id))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_MIN:
                        agg_exprs.append(pl.col(field_id).fill_null(0).min().alias(field_id))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_MAX:
                        agg_exprs.append(pl.col(field_id).fill_null(0).max().alias(field_id))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_DISTINCT:
                        agg_exprs.append(pl.col(field_id).n_unique().alias(field_id))
                    elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_EMPTY:
                        agg_exprs.append(
                            pl.col(field_id).is_null().sum().alias(field_id)
                        )
                    elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_NOT_EMPTY:
                        agg_exprs.append(
                            pl.col(field_id).is_not_null().sum().alias(field_id)
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
                # Validate column exists
                if request.order_by not in df.columns:
                    logger.error(f"[QueryRows] Sort column '{request.order_by}' not found! Available: {df.columns}")
                    return table_service_pb2.QueryRowsResponse(
                        success=False,
                        message=f"Sort column '{request.order_by}' not found in table"
                    )

                # Get field type from schema to handle empty strings in numeric columns
                field_type = next((f.type for f in schema if f.name == request.order_by), None)

                # AIDEV-NOTE: Diagnostic logging for sorting (compact)
                sort_col = df.select(request.order_by).to_series()
                logger.info(f"[QueryRows] Sort: col={request.order_by}, type={field_type}, rows={len(sort_col)}, "
                          f"nulls={sort_col.null_count()}, unique={sort_col.n_unique()}")

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

            # Convert Polars DataFrame to PyArrow Table (zero-copy) and serialize to Arrow IPC
            import io
            arrow_table = df.to_arrow()
            sink = io.BytesIO()
            with pa.ipc.new_stream(sink, arrow_table.schema) as writer:
                writer.write_table(arrow_table)

            arrow_ipc_bytes = sink.getvalue()
            logger.info(f"[QueryRows] ✅ Returned {len(df)}/{total_count} rows ({len(arrow_ipc_bytes)} bytes)")
            return table_service_pb2.QueryRowsResponse(
                success=True,
                arrow_ipc_stream=arrow_ipc_bytes,
                total_count=total_count,
                message=f"Successfully queried {len(df)} rows"
            )

        except Exception as e:
            logger.error(f"[QueryRows] Error: {type(e).__name__}: {e}", exc_info=True)
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

            # Compact logging
            self._log_request("GetTableStats", table_id=request.table_id, s3_path=request.s3_path,
                            organization_id=request.organization_id)

            if not request.s3_path:
                return table_service_pb2.GetTableStatsResponse(success=False, message="s3_path is required")

            # Convert to S3 URI and load Delta table (metadata only - no data files read!)
            s3_uri = self._to_s3_uri(request.s3_path)
            storage_options = self._get_storage_options()
            delta_table = DeltaTable(s3_uri, storage_options=storage_options)

            # AIDEV-NOTE: Check if table is empty to avoid Rust panic
            table_files = delta_table.files()
            self._log_delta_state(delta_table, "GetTableStats")

            # Handle empty table case (schema only, no data)
            if len(table_files) == 0:
                return table_service_pb2.GetTableStatsResponse(
                    success=True, row_count=0, size_bytes=0, message="Table is empty (no data files)"
                )

            # Get add actions from transaction log
            # AIDEV-NOTE: Reads only transaction log (_delta_log/*.json), not data files
            try:
                add_actions = pa.table(delta_table.get_add_actions(flatten=True))

                if len(add_actions) == 0:
                    return table_service_pb2.GetTableStatsResponse(
                        success=True, row_count=0, size_bytes=0, message="Table has no add actions"
                    )

                # Sum stats from metadata
                row_count = pc.sum(add_actions['num_records']).as_py() or 0
                size_bytes = pc.sum(add_actions['size_bytes']).as_py() or 0

                logger.info(f"[GetTableStats] ✅ Stats: {row_count} rows, {size_bytes} bytes")
                return table_service_pb2.GetTableStatsResponse(
                    success=True,
                    row_count=row_count,
                    size_bytes=size_bytes,
                    message="Statistics retrieved from Delta Lake metadata"
                )

            except Exception as e:
                # Catch Rust panics or other errors from get_add_actions
                logger.warning(f"[GetTableStats] Could not get add actions (empty table?): {e}")
                return table_service_pb2.GetTableStatsResponse(
                    success=True, row_count=0, size_bytes=0, message="Table is empty (could not read metadata)"
                )

        except Exception as e:
            logger.error(f"[GetTableStats] Error: {type(e).__name__}: {e}", exc_info=True)
            return table_service_pb2.GetTableStatsResponse(
                success=False,
                message=f"Failed to get table stats: {str(e)}"
            )