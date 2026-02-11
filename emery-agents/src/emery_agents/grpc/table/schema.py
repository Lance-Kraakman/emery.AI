"""
Table Schema Management

Handles schema creation, evolution, and type conversions for Delta Lake tables.
Focuses on data structure management without infrastructure concerns.
"""

import logging
from datetime import UTC, datetime
from typing import Any

import polars as pl
import pyarrow as pa
import pyarrow.types as pat

from ..generated import table_service_pb2

logger = logging.getLogger(__name__)


# Metadata keys for PyArrow field metadata (must be bytes)
METADATA_KEY_FIELD_TYPE = b"field_type"


def _is_any_string_type(arrow_type: pa.DataType) -> bool:
    """Check if an Arrow type is any string variant (string, large_string, string_view)."""
    return (
        pat.is_string(arrow_type)
        or pat.is_large_string(arrow_type)
        or pat.is_string_view(arrow_type)
    )


def build_field_metadata(field_type: int) -> dict[bytes, bytes]:
    """Build metadata dict for PyArrow field with field type."""
    return {METADATA_KEY_FIELD_TYPE: str(field_type).encode("utf-8")}


def get_field_type_from_metadata(metadata: dict[bytes, bytes] | None) -> int | None:
    """Extract field type from PyArrow field metadata."""
    if not metadata:
        return None
    field_type_bytes = metadata.get(METADATA_KEY_FIELD_TYPE)
    if not field_type_bytes:
        return None
    try:
        return int(field_type_bytes.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return None


def convert_protobuf_field_to_arrow(field: table_service_pb2.TableField) -> pa.DataType:
    """Convert protobuf field type to PyArrow data type."""
    type_mapping = {
        table_service_pb2.FIELD_TYPE_TEXT: pa.large_string(),
        table_service_pb2.FIELD_TYPE_NUMBER: pa.float64(),
        table_service_pb2.FIELD_TYPE_BOOLEAN: pa.bool_(),
        table_service_pb2.FIELD_TYPE_DATE: pa.timestamp(
            "ms"
        ),  # milliseconds (JS getTime())
        table_service_pb2.FIELD_TYPE_FILE: pa.large_string(),
        table_service_pb2.FIELD_TYPE_RELATION: pa.large_string(),
        table_service_pb2.FIELD_TYPE_DOCUMENT: pa.large_string(),
        table_service_pb2.FIELD_TYPE_SINGLE_SELECT: pa.large_string(),
        table_service_pb2.FIELD_TYPE_MULTI_SELECT: pa.large_string(),
        table_service_pb2.FIELD_TYPE_AUTONUMBER: pa.large_string(),
        table_service_pb2.FIELD_TYPE_LAST_UPDATED: pa.timestamp(
            "ms"
        ),  # milliseconds (JS getTime())
        table_service_pb2.FIELD_TYPE_CREATED_AT: pa.timestamp(
            "ms"
        ),  # milliseconds (JS getTime())
        table_service_pb2.FIELD_TYPE_EMAIL: pa.large_string(),
        table_service_pb2.FIELD_TYPE_PHONE: pa.large_string(),
        table_service_pb2.FIELD_TYPE_JSON: pa.large_string(),  # JSON stored as string in Delta Lake
    }

    # Handle embedding fields with dynamic sizing
    if field.type == table_service_pb2.FIELD_TYPE_EMBEDDING:
        metadata = dict(field.metadata) if field.metadata else {}
        embedding_size_str = metadata.get("embeddingSize", "768")
        try:
            embedding_size = int(embedding_size_str)
            return pa.list_(pa.float32(), list_size=embedding_size)
        except (ValueError, TypeError):
            logger.warning(
                f"Invalid embeddingSize '{embedding_size_str}', defaulting to 768"
            )
            return pa.list_(pa.float32(), list_size=768)

    return type_mapping.get(field.type, pa.large_string())


def arrow_to_polars_type(arrow_type: pa.DataType) -> pl.DataType:
    """Convert PyArrow data type to Polars data type."""
    import pyarrow.types as pat

    if pat.is_string(arrow_type) or pat.is_large_string(arrow_type):
        return pl.Utf8()
    elif pat.is_floating(arrow_type):
        return pl.Float64()
    elif pat.is_integer(arrow_type):
        return pl.Int64()
    elif pat.is_boolean(arrow_type):
        return pl.Boolean()
    elif pat.is_timestamp(arrow_type):
        # Preserve time unit from Arrow schema (ms, us, ns, s)
        # Delta Lake uses timestamp('ms'); defaulting to pl.Datetime() uses 'us' which
        # causes precision mismatch → wrong values when JS reads Arrow IPC
        return pl.Datetime(time_unit=arrow_type.unit)
    elif pat.is_list(arrow_type) or pat.is_fixed_size_list(arrow_type):
        return pl.List(pl.Float32())
    else:
        return pl.Utf8()  # Default


def extract_protobuf_value(value: Any, is_datetime_column: bool = False) -> Any:
    """Extract Python value from a protobuf RowDataValue.

    Shared extraction logic used by both direct writes (create_dataframe_with_schema)
    and the Redis write buffer (buffer_creates/buffer_updates).

    Args:
        value: Protobuf RowDataValue message
        is_datetime_column: If True, parse text_value as datetime ISO string
    """
    if value.HasField("text_value"):
        if is_datetime_column and value.text_value:
            try:
                parsed = datetime.fromisoformat(value.text_value)
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=UTC)
                return parsed
            except ValueError:
                return None
        return value.text_value
    elif value.HasField("number_value"):
        return value.number_value
    elif value.HasField("boolean_value"):
        return value.boolean_value
    elif value.HasField("date_value"):
        return datetime.fromtimestamp(value.date_value / 1000, tz=UTC)
    elif value.HasField("json_value"):
        return value.json_value
    elif value.HasField("embedding_value"):
        return list(value.embedding_value.values)
    return None


def build_schema_from_table_fields(
    table_fields: list[table_service_pb2.TableField],
) -> pa.Schema:
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
        embedding_size_str = metadata.get("embeddingSize", "768")
        try:
            embedding_size = int(embedding_size_str)
            return pa.list_(pa.float32(), list_size=embedding_size)
        except (ValueError, TypeError):
            logger.warning(
                f"Invalid embeddingSize '{embedding_size_str}', defaulting to 768"
            )
            return pa.list_(pa.float32(), list_size=768)

    # Build PyArrow fields from protobuf TableField messages
    pyarrow_fields = []

    # Add required "id" column first (string type for row IDs)
    pyarrow_fields.append(pa.field("id", pa.large_string(), nullable=False))

    # Add data columns using numeric field IDs as column names
    for field in table_fields:
        # Skip the "id" field from table_fields - we already added it manually
        if field.name.lower() == "id":
            continue

        # Convert protobuf field type to PyArrow type
        if field.type == table_service_pb2.FIELD_TYPE_EMBEDDING:
            arrow_type = get_embedding_type(field)
        else:
            arrow_type = convert_protobuf_field_to_arrow(field)

        # Use field ID as column name (string representation)
        from .field_utils import field_to_column_name

        column_name = field_to_column_name(field)

        # Attach field type metadata for type-aware operations (e.g., autonumber sorting)
        field_metadata = build_field_metadata(field.type)
        pyarrow_fields.append(
            pa.field(column_name, arrow_type, nullable=True, metadata=field_metadata)
        )

    return pa.schema(pyarrow_fields)


def get_delta_schema_as_pyarrow(delta_table) -> pa.Schema:
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


def create_enhanced_schema(
    existing_fields: list[table_service_pb2.TableField],
    new_fields: list[table_service_pb2.TableField] | None = None,
) -> pa.Schema:
    """Build enhanced schema that includes both existing and new fields."""
    all_fields = existing_fields.copy()
    if new_fields:
        all_fields.extend(new_fields)

    return build_schema_from_table_fields(all_fields)


def evolve_schema(
    current_schema: pa.Schema, new_fields: list[table_service_pb2.TableField]
) -> pa.Schema:
    """Evolve schema to include new fields with proper type handling."""
    # Get existing field names
    existing_field_names = set(current_schema.names)

    # Start with current schema fields
    new_schema_fields = list(current_schema)

    # Add new fields that don't exist
    from .field_utils import field_to_column_name

    for field in new_fields:
        field_name = field_to_column_name(field)
        if field_name not in existing_field_names:
            arrow_type = convert_protobuf_field_to_arrow(field)
            field_metadata = build_field_metadata(field.type)
            new_schema_fields.append(
                pa.field(field_name, arrow_type, nullable=True, metadata=field_metadata)
            )
            logger.info(
                f"[evolve_schema] Added new field '{field_name}' ({arrow_type})"
            )

    return pa.schema(new_schema_fields)


def validate_schema_compatibility(
    old_type: pa.DataType, new_type: pa.DataType
) -> tuple[bool, str | None]:
    """Check if type conversion is safe and possible."""
    # Same type is always compatible
    if old_type == new_type:
        return True, None

    # String variants (string, large_string, string_view) are equivalent - no conversion needed
    if _is_any_string_type(old_type) and _is_any_string_type(new_type):
        return True, None

    # String to number conversion (with validation)
    if _is_any_string_type(old_type) and pat.is_floating(new_type):
        return True, "string_to_float"
    elif _is_any_string_type(old_type) and pat.is_integer(new_type):
        return True, "string_to_int"

    # Number to string conversion (always safe)
    if (pat.is_floating(old_type) or pat.is_integer(old_type)) and _is_any_string_type(
        new_type
    ):
        return True, "number_to_string"

    # Boolean to string conversion
    if pat.is_boolean(old_type) and _is_any_string_type(new_type):
        return True, "boolean_to_string"

    # String to boolean conversion (with validation)
    if _is_any_string_type(old_type) and pat.is_boolean(new_type):
        return True, "string_to_boolean"

    # Timestamp conversions
    if pat.is_timestamp(old_type) and _is_any_string_type(new_type):
        return True, "timestamp_to_string"
    elif _is_any_string_type(old_type) and pat.is_timestamp(new_type):
        return True, "string_to_timestamp"

    # Incompatible types
    return False, f"incompatible_conversion_{old_type}_to_{new_type}"


def migrate_column_type(
    df: pl.DataFrame, column_name: str, old_type: pa.DataType, new_type: pa.DataType
) -> pl.DataFrame:
    """Migrate data from old type to new type."""
    logger.info(
        f"[migrate_column_type] Migrating column '{column_name}' from {old_type} to {new_type}"
    )

    if column_name not in df.columns:
        logger.warning(
            f"[migrate_column_type] Column '{column_name}' not found in DataFrame"
        )
        return df

    # String variants (string, large_string, string_view) are equivalent - no migration needed
    if _is_any_string_type(old_type) and _is_any_string_type(new_type):
        logger.info(
            f"[migrate_column_type] String variant conversion {old_type} -> {new_type}, no data migration needed"
        )
        return df

    # Handle common type conversions
    if _is_any_string_type(old_type) and pat.is_floating(new_type):
        # String to float conversion
        df = df.with_columns(pl.col(column_name).cast(pl.Float64).alias(column_name))
    elif _is_any_string_type(old_type) and pat.is_integer(new_type):
        # String to int conversion
        df = df.with_columns(pl.col(column_name).cast(pl.Int64).alias(column_name))
    elif (
        pat.is_floating(old_type) or pat.is_integer(old_type)
    ) and _is_any_string_type(new_type):
        # Number to string conversion
        df = df.with_columns(pl.col(column_name).cast(pl.Utf8).alias(column_name))
    elif pat.is_boolean(old_type) and _is_any_string_type(new_type):
        # Boolean to string conversion
        df = df.with_columns(pl.col(column_name).cast(pl.Utf8).alias(column_name))
    elif _is_any_string_type(old_type) and pat.is_boolean(new_type):
        # String to boolean conversion
        df = df.with_columns(pl.col(column_name).cast(pl.Boolean).alias(column_name))
    elif pat.is_timestamp(old_type) and _is_any_string_type(new_type):
        # Timestamp to string conversion
        df = df.with_columns(pl.col(column_name).cast(pl.Utf8).alias(column_name))
    elif _is_any_string_type(old_type) and pat.is_timestamp(new_type):
        # String to timestamp conversion
        df = df.with_columns(pl.col(column_name).cast(pl.Datetime).alias(column_name))
    else:
        logger.warning(
            f"[migrate_column_type] Unsupported type conversion: {old_type} -> {new_type}"
        )

    return df


def create_dataframe_with_schema(
    rows_data: list[table_service_pb2.RowData], delta_table
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
    logger.info(
        f"[create_dataframe_with_schema] Delta Lake schema: {delta_schema_pyarrow}"
    )
    logger.info(
        f"[create_dataframe_with_schema] Delta Lake field names: {delta_field_names}"
    )

    # 2. Build Polars schema dict from PyArrow schema
    # AIDEV-NOTE: Inline type mapping (no separate helper needed)
    polars_schema = {}
    for field in delta_schema_pyarrow:
        polars_type = arrow_to_polars_type(field.type)
        polars_schema[field.name] = polars_type

    logger.info(f"[create_dataframe_with_schema] Polars schema: {polars_schema}")

    # 3. Pre-compute datetime columns for O(1) lookup in the row loop
    datetime_columns = {
        name
        for name, dtype in polars_schema.items()
        if isinstance(dtype, (pl.Datetime, pl.Date))
    }

    # 4. Extract records from protobuf with schema-aware field handling
    records = []
    for row_data in rows_data:
        record = {}

        # Always include 'id' field (row identifier)
        record["id"] = row_data.id

        # Process data fields using field IDs as column names
        for key, value in row_data.data.items():
            field_name = key  # Use field ID as column name (already a string)

            if field_name in delta_field_names:
                record[field_name] = extract_protobuf_value(
                    value, is_datetime_column=(field_name in datetime_columns)
                )
            else:
                logger.warning(
                    f"[create_dataframe_with_schema] Field '{field_name}' not in Delta Lake schema, skipping"
                )

        records.append(record)

    # 5. Create Polars DataFrame with explicit schema
    df = pl.DataFrame(records, schema=polars_schema)

    logger.info(
        f"[create_dataframe_with_schema] Created DataFrame: {df.shape} with schema {df.schema}"
    )
    logger.info(f"[create_dataframe_with_schema] DataFrame columns: {df.columns}")

    return df
