"""
Table Data Validation

Handles data validation, error checking, and field mapping validation.
Focuses on ensuring data quality and integrity.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple, Set
import pyarrow as pa
import polars as pl
from ..generated import table_service_pb2

logger = logging.getLogger(__name__)


def validate_s3_path(request: Any, method: str, to_s3_uri_func) -> Tuple[bool, Optional[str], Optional[table_service_pb2.TableResponse]]:
    """Validate s3_path field exists and is not empty.

    Args:
        request: Request object with s3_path field
        method: Method name for error messages
        to_s3_uri_func: Function to convert path to S3 URI

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

    s3_uri = to_s3_uri_func(request.s3_path)
    return True, s3_uri, None


def validate_field_mappings(input_fields: Set[str], schema_fields: Set[str], context: str) -> None:
    """Validate and log field mappings between input and schema.

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


def validate_sort_columns(order_by: List[str], schema: pa.Schema, context: str) -> Tuple[bool, Optional[str]]:
    """Validate that sort columns exist in the schema.

    Args:
        order_by: List of column names to sort by
        schema: PyArrow schema to validate against
        context: Context string for error messages

    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    if not order_by:
        return True, None

    schema_fields = set(schema.names)
    invalid_fields = []

    for field_name in order_by:
        if field_name not in schema_fields:
            invalid_fields.append(field_name)

    if invalid_fields:
        error_msg = f"[{context}] Invalid sort columns: {invalid_fields}. Available columns: {sorted(schema_fields)}"
        logger.error(error_msg)
        return False, error_msg

    return True, None


def validate_type_conversions(
    old_type: pa.DataType,
    new_type: pa.DataType,
    field_name: str
) -> Tuple[bool, Optional[str]]:
    """Validate that type conversion is safe and possible.

    Args:
        old_type: Current PyArrow data type
        new_type: Target PyArrow data type
        field_name: Name of the field for error messages

    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    import pyarrow.types as pat

    # Same type is always valid
    if old_type == new_type:
        return True, None

    # String to number conversion (with validation)
    if pat.is_string(old_type) and pat.is_floating(new_type):
        return True, None
    elif pat.is_string(old_type) and pat.is_integer(new_type):
        return True, None

    # Number to string conversion (always safe)
    if (pat.is_floating(old_type) or pat.is_integer(old_type)) and pat.is_string(new_type):
        return True, None

    # Boolean to string conversion
    if pat.is_boolean(old_type) and pat.is_string(new_type):
        return True, None

    # String to boolean conversion (with validation)
    if pat.is_string(old_type) and pat.is_boolean(new_type):
        return True, None

    # Timestamp conversions
    if pat.is_timestamp(old_type) and pat.is_string(new_type):
        return True, None
    elif pat.is_string(old_type) and pat.is_timestamp(new_type):
        return True, None

    # Incompatible types
    error_msg = f"[validate_type_conversions] Field '{field_name}': Cannot convert {old_type} to {new_type}"
    logger.error(error_msg)
    return False, error_msg


def validate_row_data(
    rows_data: List[table_service_pb2.RowData],
    schema: pa.Schema,
    context: str
) -> Tuple[bool, Optional[str]]:
    """Validate row data against schema.

    Args:
        rows_data: List of RowData protobuf messages
        schema: PyArrow schema to validate against
        context: Context string for error messages

    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    if not rows_data:
        return True, None

    schema_fields = set(schema.names)
    
    for i, row_data in enumerate(rows_data):
        # Check required 'id' field
        if not row_data.id:
            error_msg = f"[{context}] Row {i}: Missing required 'id' field"
            logger.error(error_msg)
            return False, error_msg

        # Check data fields
        row_fields = set(row_data.data.keys())
        row_fields.add('id')  # Include the id field

        # Validate field types
        for field_name, field_value in row_data.data.items():
            if field_name not in schema_fields:
                logger.warning(f"[{context}] Row {i}: Field '{field_name}' not in schema, skipping")
                continue

            # Validate value based on schema type
            field_type = schema.field(field_name).type
            is_valid, error_msg = validate_field_value(field_value, field_type, field_name, f"{context}_row_{i}")
            if not is_valid:
                return False, error_msg

    return True, None


def validate_field_value(
    field_value: table_service_pb2.RowDataValue,
    field_type: pa.DataType,
    field_name: str,
    context: str
) -> Tuple[bool, Optional[str]]:
    """Validate a single field value against its expected type.

    Args:
        field_value: RowDataValue protobuf message
        field_type: Expected PyArrow data type
        field_name: Name of the field
        context: Context string for error messages

    Returns:
        Tuple of (is_valid: bool, error_message: Optional[str])
    """
    import pyarrow.types as pat

    # Check if value is set
    if not field_value.WhichOneof('value'):
        return True, None  # Null values are valid

    # Validate based on expected type
    if pat.is_string(field_type) or pat.is_large_string(field_type):
        if not field_value.HasField('text_value'):
            error_msg = f"[{context}] Field '{field_name}': Expected string value"
            return False, error_msg

    elif pat.is_floating(field_type):
        if not field_value.HasField('number_value'):
            error_msg = f"[{context}] Field '{field_name}': Expected number value"
            return False, error_msg

    elif pat.is_integer(field_type):
        if not field_value.HasField('number_value'):
            error_msg = f"[{context}] Field '{field_name}': Expected integer value"
            return False, error_msg

    elif pat.is_boolean(field_type):
        if not field_value.HasField('boolean_value'):
            error_msg = f"[{context}] Field '{field_name}': Expected boolean value"
            return False, error_msg

    elif pat.is_timestamp(field_type):
        if not field_value.HasField('date_value'):
            error_msg = f"[{context}] Field '{field_name}': Expected timestamp value"
            return False, error_msg

    elif pat.is_list(field_type) or pat.is_fixed_size_list(field_type):
        if not field_value.HasField('embedding_value'):
            error_msg = f"[{context}] Field '{field_name}': Expected embedding value"
            return False, error_msg

    return True, None


def detect_data_anomalies(
    df,
    context: str
) -> List[str]:
    """Detect common data quality issues.

    Args:
        df: Polars DataFrame to analyze
        context: Context string for logging

    Returns:
        List of anomaly descriptions
    """
    anomalies = []

    try:
        # Check for completely null columns
        for col_name in df.columns:
            if df[col_name].null_count() == len(df):
                anomalies.append(f"[{context}] Column '{col_name}' is completely null")

        # Check for duplicate IDs
        if 'id' in df.columns:
            duplicate_ids = df['id'].is_duplicated().sum()
            if duplicate_ids > 0:
                anomalies.append(f"[{context}] Found {duplicate_ids} duplicate row IDs")

        # Check for empty strings in string columns
        for col_name in df.columns:
            if df[col_name].dtype == pl.Utf8:
                empty_strings = (df[col_name] == '').sum()
                if empty_strings > 0:
                    anomalies.append(f"[{context}] Column '{col_name}' has {empty_strings} empty strings")

    except Exception as e:
        logger.error(f"[{context}] Error detecting anomalies: {e}")
        anomalies.append(f"[{context}] Error during anomaly detection: {e}")

    return anomalies