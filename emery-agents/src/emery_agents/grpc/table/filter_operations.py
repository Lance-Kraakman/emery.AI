"""
Filter Operations

Module-level functions for building PyArrow filter predicates from protobuf
filter specifications. Enables predicate pushdown to Delta Lake.
"""

import logging
from typing import List, Any, Optional
import pyarrow as pa
import pyarrow.types as pat
import pyarrow.compute as pc

from ..generated import table_service_pb2
from .transform import cast_value_to_column_type

logger = logging.getLogger(__name__)


def extract_filter_value(filter_value: table_service_pb2.RowDataValue) -> Any:
    """
    Extract Python value from protobuf RowDataValue oneof.

    Args:
        filter_value: RowDataValue protobuf with oneof field

    Returns:
        Extracted Python value (str, float, bool, etc.) or None
    """
    if filter_value.HasField('text_value'):
        return filter_value.text_value
    elif filter_value.HasField('number_value'):
        return filter_value.number_value
    elif filter_value.HasField('boolean_value'):
        return filter_value.boolean_value
    elif filter_value.HasField('date_value'):
        return filter_value.date_value
    elif filter_value.HasField('json_value'):
        return filter_value.json_value
    return None


def extract_filter_values_list(filter_values: List[table_service_pb2.RowDataValue]) -> List[Any]:
    """
    Extract Python values from list of protobuf RowDataValue oneofs.

    Args:
        filter_values: List of RowDataValue protobuf objects

    Returns:
        List of extracted Python values
    """
    values_list = []
    for val in filter_values:
        if val.HasField('text_value'):
            values_list.append(val.text_value)
        elif val.HasField('number_value'):
            values_list.append(val.number_value)
        elif val.HasField('boolean_value'):
            values_list.append(val.boolean_value)
    return values_list


def cast_and_normalize_value(
    value: Any,
    column_type: pa.DataType,
    field_name: str
) -> Optional[pa.Scalar]:
    """
    Cast Python value to PyArrow scalar matching column type.

    Normalizes all string types to large_string for filter compatibility.

    Args:
        value: Python value to cast
        column_type: PyArrow type from schema
        field_name: Field name for error logging

    Returns:
        PyArrow scalar with appropriate type, or None if cast fails
    """
    try:
        # Cast Python value to match column type
        casted_value = cast_value_to_column_type(value, column_type)

        # Normalize ALL string types to large_string for filter compatibility
        # PyArrow's filter kernels don't support string_view comparison
        if pat.is_string(column_type) or pat.is_large_string(column_type) or pat.is_string_view(column_type):
            filter_type = pa.large_string()
        else:
            filter_type = column_type

        # Create scalar with filter-compatible type
        return pa.scalar(casted_value, type=filter_type)

    except KeyError:
        logger.warning(f"[cast_and_normalize_value] Field '{field_name}' not found in schema")
        return None
    except ValueError as e:
        logger.error(f"[cast_and_normalize_value] Type casting error for field '{field_name}': {e}")
        return None


def build_comparison_predicate(
    field_ref: Any,
    operator: int,
    value: pa.Scalar
) -> Optional[Any]:
    """
    Build comparison predicate (EQ, NE, GT, GTE, LT, LTE).

    Args:
        field_ref: PyArrow field reference
        operator: Filter operator enum value
        value: PyArrow scalar value to compare against

    Returns:
        PyArrow compute expression or None
    """
    if operator == table_service_pb2.FILTER_OP_EQ:
        return pc.equal(field_ref, value)
    elif operator == table_service_pb2.FILTER_OP_NE:
        return pc.not_equal(field_ref, value)
    elif operator == table_service_pb2.FILTER_OP_GT:
        return pc.greater(field_ref, value)
    elif operator == table_service_pb2.FILTER_OP_GTE:
        return pc.greater_equal(field_ref, value)
    elif operator == table_service_pb2.FILTER_OP_LT:
        return pc.less(field_ref, value)
    elif operator == table_service_pb2.FILTER_OP_LTE:
        return pc.less_equal(field_ref, value)
    return None


def build_in_predicate(
    field_ref: Any,
    values_list: List[Any],
    column_type: pa.DataType,
    field_name: str,
    not_in: bool = False
) -> Optional[Any]:
    """
    Build IN or NOT_IN predicate.

    Args:
        field_ref: PyArrow field reference
        values_list: List of Python values to check membership
        column_type: PyArrow type from schema
        field_name: Field name for error logging
        not_in: If True, build NOT_IN predicate; if False, build IN predicate

    Returns:
        PyArrow compute expression or None if build fails
    """
    try:
        # Cast each value to match column type
        casted_values = [cast_value_to_column_type(v, column_type) for v in values_list]

        # Normalize ALL string types to large_string for filter compatibility
        if pat.is_string(column_type) or pat.is_large_string(column_type) or pat.is_string_view(column_type):
            filter_type = pa.large_string()
        else:
            filter_type = column_type

        # Convert Python list to PyArrow Array for is_in
        value_set_array = pa.array(casted_values, type=filter_type)

        # Build IN or NOT_IN predicate
        if not_in:
            return pc.invert(pc.is_in(field_ref, value_set=value_set_array))
        else:
            return pc.is_in(field_ref, value_set=value_set_array)

    except KeyError:
        op_name = "NOT_IN" if not_in else "IN"
        logger.warning(f"[build_in_predicate] Field '{field_name}' not found in schema, skipping {op_name} filter")
        return None
    except ValueError as e:
        op_name = "NOT_IN" if not_in else "IN"
        logger.error(f"[build_in_predicate] Type casting error for {op_name} filter on field '{field_name}': {e}")
        return None
    except TypeError as e:
        op_name = "NOT_IN" if not_in else "IN"
        logger.error(f"[build_in_predicate] PyArrow type error for {op_name} filter on field '{field_name}': {e}")
        return None


def build_null_predicate(field_ref: Any, is_null: bool = True) -> Any:
    """
    Build IS_NULL or IS_NOT_NULL predicate.

    Args:
        field_ref: PyArrow field reference
        is_null: If True, build IS_NULL; if False, build IS_NOT_NULL

    Returns:
        PyArrow compute expression
    """
    if is_null:
        return pc.is_null(field_ref)
    else:
        return pc.is_valid(field_ref)


def combine_predicates(predicates: List[Any]) -> Optional[Any]:
    """
    Combine multiple predicates with AND logic.

    Args:
        predicates: List of PyArrow compute expressions

    Returns:
        Combined predicate expression or None if list is empty
    """
    if len(predicates) == 0:
        return None
    elif len(predicates) == 1:
        return predicates[0]
    else:
        # Use & operator (not pc.and_) for filter expressions
        result = predicates[0]
        for pred in predicates[1:]:
            result = result & pred
        return result
