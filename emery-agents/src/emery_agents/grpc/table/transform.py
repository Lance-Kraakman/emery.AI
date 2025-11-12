"""
Table Data Transformation

Handles data format conversions, normalization, and type transformations.
Focuses on converting between different data formats and types.
"""

import logging
from typing import List, Dict, Any, Optional, Union
import pyarrow as pa
import pyarrow.compute as pc
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


def build_pyarrow_predicate(filters: List[table_service_pb2.RowFilter], schema: pa.Schema) -> Optional[Any]:
    """Build PyArrow compute predicate from request filters for efficient filtering.

    This enables predicate pushdown to Delta Lake - filters are applied BEFORE
    loading data into memory, which is 10-100x faster for large tables.

    NOTE: LIKE/ILIKE operators are NOT supported in dataset filter predicates.
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

        field_name = filter_obj.field
        operator = filter_obj.operator
        filter_value = filter_obj.value

        # Skip if field not in schema
        if field_name not in schema.names:
            logger.warning(f"[build_pyarrow_predicate] Field '{field_name}' not in schema, skipping filter")
            continue

        # Get field reference for filter
        try:
            field_ref = pc.field(field_name)
        except KeyError:
            logger.warning(f"[build_pyarrow_predicate] Filter field '{field_name}' not found in schema")
            continue

        # Extract value from the RowDataValue oneof
        value = None
        if filter_value.HasField('text_value'):
            value = filter_value.text_value
        elif filter_value.HasField('number_value'):
            value = filter_value.number_value
        elif filter_value.HasField('boolean_value'):
            value = filter_value.boolean_value
        elif filter_value.HasField('date_value'):
            value = filter_value.date_value
        elif filter_value.HasField('json_value'):
            value = filter_value.json_value

        # Cast value to match column type from schema
        if value is not None:
            try:
                # Look up column type in schema
                column_type = schema.field(field_name).type

                # Cast Python value to match column type
                casted_value = cast_value_to_column_type(value, column_type)

                # Normalize ALL string types to large_string for filter compatibility
                # PyArrow's filter kernels don't support string_view comparison
                if pat.is_string(column_type) or pat.is_large_string(column_type) or pat.is_string_view(column_type):
                    filter_type = pa.large_string()
                else:
                    filter_type = column_type

                # Create scalar with filter-compatible type
                value = pa.scalar(casted_value, type=filter_type)

            except KeyError:
                logger.warning(f"[build_pyarrow_predicate] Filter field '{field_name}' not found in schema, skipping filter")
                continue
            except ValueError as e:
                logger.error(f"[build_pyarrow_predicate] Type casting error for field '{field_name}': {e}")
                continue

        # Build predicate based on operator
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
                column_type = schema.field(field_name).type

                values_list = []
                for val in filter_obj.values:
                    if val.HasField('text_value'):
                        values_list.append(val.text_value)
                    elif val.HasField('number_value'):
                        values_list.append(val.number_value)
                    elif val.HasField('boolean_value'):
                        values_list.append(val.boolean_value)

                # Cast each value to match column type
                casted_values = [cast_value_to_column_type(v, column_type) for v in values_list]

                # Normalize ALL string types to large_string for filter compatibility
                if pat.is_string(column_type) or pat.is_large_string(column_type) or pat.is_string_view(column_type):
                    filter_type = pa.large_string()
                else:
                    filter_type = column_type

                # Convert Python list to PyArrow Array for is_in
                value_set_array = pa.array(casted_values, type=filter_type)
                predicates.append(pc.is_in(field_ref, value_set=value_set_array))

            except KeyError:
                logger.warning(f"[build_pyarrow_predicate] Filter field '{field_name}' not found in schema, skipping IN filter")
                continue
            except ValueError as e:
                logger.error(f"[build_pyarrow_predicate] Type casting error for IN filter on field '{field_name}': {e}")
                continue
            except TypeError as e:
                logger.error(f"[build_pyarrow_predicate] PyArrow type error for IN filter on field '{field_name}': {e}")
                continue

        elif operator == table_service_pb2.FILTER_OP_NOT_IN:
            # Value not in array - extract and cast values
            try:
                column_type = schema.field(field_name).type

                values_list = []
                for val in filter_obj.values:
                    if val.HasField('text_value'):
                        values_list.append(val.text_value)
                    elif val.HasField('number_value'):
                        values_list.append(val.number_value)
                    elif val.HasField('boolean_value'):
                        values_list.append(val.boolean_value)

                # Cast each value to match column type
                casted_values = [cast_value_to_column_type(v, column_type) for v in values_list]

                # Normalize ALL string types to large_string for filter compatibility
                if pat.is_string(column_type) or pat.is_large_string(column_type) or pat.is_string_view(column_type):
                    filter_type = pa.large_string()
                else:
                    filter_type = column_type

                # Convert Python list to PyArrow Array for is_in
                value_set_array = pa.array(casted_values, type=filter_type)
                predicates.append(pc.invert(pc.is_in(field_ref, value_set=value_set_array)))

            except KeyError:
                logger.warning(f"[build_pyarrow_predicate] Filter field '{field_name}' not found in schema, skipping NOT_IN filter")
                continue
            except ValueError as e:
                logger.error(f"[build_pyarrow_predicate] Type casting error for NOT_IN filter on field '{field_name}': {e}")
                continue
            except TypeError as e:
                logger.error(f"[build_pyarrow_predicate] PyArrow type error for NOT_IN filter on field '{field_name}': {e}")
                continue

        elif operator == table_service_pb2.FILTER_OP_IS_NULL:
            predicates.append(pc.is_null(field_ref))

        elif operator == table_service_pb2.FILTER_OP_IS_NOT_NULL:
            predicates.append(pc.is_valid(field_ref))

        # Note: CONTAINS, CONTAINED_BY, HAS_KEY require JSON-specific operators
        # These are more complex and may require custom handling
        # For now, we skip them - they could be added in a future iteration

    # Combine all predicates with AND logic
    # Use & operator (not pc.and_) for filter expressions
    if len(predicates) == 0:
        return None
    elif len(predicates) == 1:
        return predicates[0]
    else:
        result = predicates[0]
        for pred in predicates[1:]:
            result = result & pred
        return result


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