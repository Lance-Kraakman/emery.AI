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
from .type_conversion import cast_value_to_column_type
from .filter_operations import (
    extract_filter_value,
    extract_filter_values_list,
    cast_and_normalize_value,
    build_comparison_predicate,
    build_in_predicate,
    build_null_predicate,
    combine_predicates
)

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

        # Skip if field not in schema
        if field_name not in schema.names:
            logger.warning(f"[build_pyarrow_predicate] Field '{field_name}' not in schema, skipping filter")
            continue

        # Get field reference and column type
        try:
            field_ref = pc.field(field_name)
            column_type = schema.field(field_name).type
        except KeyError:
            logger.warning(f"[build_pyarrow_predicate] Filter field '{field_name}' not found in schema")
            continue

        # Build predicate based on operator type
        pred = None

        if operator in (table_service_pb2.FILTER_OP_EQ, table_service_pb2.FILTER_OP_NE,
                       table_service_pb2.FILTER_OP_GT, table_service_pb2.FILTER_OP_GTE,
                       table_service_pb2.FILTER_OP_LT, table_service_pb2.FILTER_OP_LTE):
            # Comparison operators
            value = extract_filter_value(filter_obj.value)
            if value is not None:
                scalar_value = cast_and_normalize_value(value, column_type, field_name)
                if scalar_value is not None:
                    pred = build_comparison_predicate(field_ref, operator, scalar_value)

        elif operator in (table_service_pb2.FILTER_OP_IN, table_service_pb2.FILTER_OP_NOT_IN):
            # IN/NOT_IN operators
            values_list = extract_filter_values_list(filter_obj.values)
            if values_list:
                is_not_in = (operator == table_service_pb2.FILTER_OP_NOT_IN)
                pred = build_in_predicate(field_ref, values_list, column_type, field_name, not_in=is_not_in)

        elif operator in (table_service_pb2.FILTER_OP_IS_NULL, table_service_pb2.FILTER_OP_IS_NOT_NULL):
            # NULL check operators
            is_null_check = (operator == table_service_pb2.FILTER_OP_IS_NULL)
            pred = build_null_predicate(field_ref, is_null=is_null_check)

        # Add predicate to list if successfully built
        if pred is not None:
            predicates.append(pred)

    # Combine all predicates with AND logic
    return combine_predicates(predicates)


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