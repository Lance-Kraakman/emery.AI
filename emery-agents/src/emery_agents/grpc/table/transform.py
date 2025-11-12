"""
Table Data Transformation

Handles data format conversions, normalization, and type transformations.
Focuses on converting between different data formats and types.
"""

import logging
from typing import List, Dict, Any, Optional, Union
import pyarrow as pa
import pyarrow.types as pat
import polars as pl
from ..generated import table_service_pb2

logger = logging.getLogger(__name__)


def normalize_arrow_table_to_large_string(arrow_table: pa.Table) -> pa.Table:
    """Normalize all string columns in Arrow table to large_string type.

    This prevents string_view from being written to parquet files, which enables
    predicate pushdown to work correctly with PyArrow filters.

    AIDEV-NOTE: This is the proper fix for string_view issues.
    - Polars may use string_view internally for efficiency
    - Parquet writers may encode strings as string_view
    - But PyArrow filter kernels don't support string_view
    - Solution: Cast all strings to large_string before writing
    """
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

    logger.debug(f"[normalize_arrow_table_to_large_string] Normalized {len(arrow_table.schema)} columns")
    return normalized_table


def cast_value_to_column_type(value: Any, column_type: pa.DataType) -> Any:
    """Cast Python value to match PyArrow column type.

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

        # Boolean types
        elif pat.is_boolean(column_type):
            if isinstance(value, str):
                return value.lower() in ('true', '1', 'yes', 'on')
            return bool(value)

        # Timestamp types
        elif pat.is_timestamp(column_type):
            if isinstance(value, (int, float)):
                return value  # Assume Unix timestamp
            return str(value)  # Convert to string for parsing

        # List types (embeddings)
        elif pat.is_list(column_type) or pat.is_fixed_size_list(column_type):
            if isinstance(value, str):
                # Try to parse as JSON list
                import json
                return json.loads(value)
            elif isinstance(value, (list, tuple)):
                return list(value)
            else:
                return [value]

        # Default: convert to string
        else:
            return str(value)

    except (ValueError, TypeError) as e:
        logger.warning(f"[cast_value_to_column_type] Cannot cast {value} to {column_type}: {e}")
        # Return original value and let operation handle the error
        return value


def build_pyarrow_predicate(filters: List[table_service_pb2.RowFilter], schema: pa.Schema) -> Optional[str]:
    """Build filter description for logging (simplified version).
    
    NOTE: This is a simplified version that returns a description string
    instead of a PyArrow compute expression due to version compatibility.
    The actual filtering will be done in-memory using Polars.
    
    Args:
        filters: List of RowFilter objects from protobuf QueryRowsRequest
        schema: PyArrow Schema from Delta table for type-safe casting
        
    Returns:
        Filter description string or None if no filters
    """
    if not filters or len(filters) == 0:
        return None

    filter_descriptions = []

    for filter_obj in filters:
        field_name = filter_obj.field
        operator = filter_obj.operator
        filter_value = filter_obj.value

        # Skip if field not in schema
        if field_name not in schema.names:
            logger.warning(f"[build_pyarrow_predicate] Field '{field_name}' not in schema, skipping filter")
            continue

        # Get field type for type-safe casting
        field_type = schema.field(field_name).type

        # Cast filter value to match column type
        if filter_value is not None:
            # Extract actual value from RowDataValue
            if filter_value.HasField('text_value'):
                raw_value = filter_value.text_value
            elif filter_value.HasField('number_value'):
                raw_value = filter_value.number_value
            elif filter_value.HasField('boolean_value'):
                raw_value = filter_value.boolean_value
            elif filter_value.HasField('date_value'):
                raw_value = filter_value.date_value
            else:
                raw_value = None

            cast_value = cast_value_to_column_type(raw_value, field_type)
        else:
            cast_value = None

        # Build filter description
        op_name = table_service_pb2.FilterOperator.Name(operator)
        filter_desc = f"{field_name} {op_name} {cast_value}"
        filter_descriptions.append(filter_desc)

    # Combine all filter descriptions
    if filter_descriptions:
        return " AND ".join(filter_descriptions)
    else:
        return None


def convert_protobuf_to_dataframe(rows_data: List[table_service_pb2.RowData]) -> List[Dict[str, Any]]:
    """Convert protobuf RowData messages to Python dictionaries.
    
    Args:
        rows_data: List of RowData protobuf messages
        
    Returns:
        List of dictionaries with field IDs as keys
    """
    records = []
    
    for row_data in rows_data:
        record: Dict[str, Any] = {'id': row_data.id}
        
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
            elif value.HasField('embedding_value'):
                # Convert protobuf repeated float to Python list
                record[key] = list(value.embedding_value.values)
            else:
                record[key] = None  # Empty protobuf oneof = None
        
        records.append(record)
    
    return records


def convert_dataframe_to_arrow(df, normalize_strings: bool = True) -> pa.Table:
    """Convert Polars DataFrame to Arrow table with optional string normalization.
    
    Args:
        df: Polars DataFrame
        normalize_strings: Whether to normalize strings to large_string
        
    Returns:
        PyArrow Table
    """
    arrow_table = df.to_arrow()
    
    if normalize_strings:
        arrow_table = normalize_arrow_table_to_large_string(arrow_table)
    
    return arrow_table