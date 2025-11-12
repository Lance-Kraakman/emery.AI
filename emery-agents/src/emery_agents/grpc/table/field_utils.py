"""
Field Column Name Utilities

Centralized utilities for converting field IDs to Delta Lake column names.
This provides a single source of truth for field ID to column name mapping.

Architecture:
- Field IDs (int) → Column names (str) for Delta Lake
- Ensures consistency across all table operations
- Provides type safety and validation

Usage:
    column_name = field_id_to_column_name(123)  # "123"
    column_name = field_to_column_name(field_obj)  # "123"
"""

import logging
from typing import Union
from ..generated import table_service_pb2

logger = logging.getLogger(__name__)


def field_id_to_column_name(field_id: int) -> str:
    """
    Convert field ID to Delta Lake column name.
    
    This is the single source of truth for converting field IDs to column names.
    Delta Lake columns use field IDs as string column names for consistency
    with frontend data mapping and schema operations.
    
    Args:
        field_id: Integer field ID from database
        
    Returns:
        String column name for Delta Lake
        
    Examples:
        >>> field_id_to_column_name(1)
        '1'
        >>> field_id_to_column_name(123)
        '123'
    """
    if not isinstance(field_id, int):
        raise TypeError(f"field_id must be int, got {type(field_id)}")
    
    if field_id < 0:
        raise ValueError(f"field_id must be non-negative, got {field_id}")
    
    return str(field_id)


def field_to_column_name(field: table_service_pb2.TableField) -> str:
    """
    Extract field ID from TableField and convert to column name.
    
    Convenience function that extracts field_id from TableField protobuf
    and converts it to column name using the standard conversion.
    
    Args:
        field: TableField protobuf message
        
    Returns:
        String column name for Delta Lake
        
    Examples:
        >>> field = TableField(field_id=1, name="name", ...)
        >>> field_to_column_name(field)
        '1'
    """
    if not hasattr(field, 'field_id'):
        raise AttributeError("TableField object missing required 'field_id' attribute")
    
    return field_id_to_column_name(field.field_id)


def create_column_name_from_field_id(field_id: int) -> str:
    """
    Alias for field_id_to_column_name for semantic clarity.
    
    This function provides a more descriptive name for the same operation,
    useful in contexts where the purpose is explicitly "creating" column names.
    
    Args:
        field_id: Integer field ID from database
        
    Returns:
        String column name for Delta Lake
    """
    return field_id_to_column_name(field_id)


def validate_field_column_name(column_name: str) -> bool:
    """
    Validate that a column name follows field ID naming convention.
    
    Checks if the column name is a valid string representation of a field ID.
    Useful for validation and debugging purposes.
    
    Args:
        column_name: Column name to validate
        
    Returns:
        True if column name is valid field ID format, False otherwise
        
    Examples:
        >>> validate_field_column_name("123")
        True
        >>> validate_field_column_name("name")
        False
        >>> validate_field_column_name("-1")
        False
    """
    if not isinstance(column_name, str):
        return False
    
    if not column_name.isdigit():
        return False
    
    # Convert to int and check non-negative
    try:
        field_id = int(column_name)
        return field_id >= 0
    except ValueError:
        return False


def extract_field_id_from_column_name(column_name: str) -> int:
    """
    Extract field ID from Delta Lake column name.
    
    Reverse operation of field_id_to_column_name.
    Useful when working with existing Delta Lake schemas.
    
    Args:
        column_name: Column name from Delta Lake schema
        
    Returns:
        Integer field ID
        
    Raises:
        ValueError: If column name is not a valid field ID format
        
    Examples:
        >>> extract_field_id_from_column_name("123")
        123
    """
    if not validate_field_column_name(column_name):
        raise ValueError(f"Invalid column name format: '{column_name}'. Expected numeric field ID.")
    
    return int(column_name)


def is_field_column_name(column_name: str) -> bool:
    """
    Check if a column name represents a field ID (not the 'id' column).
    
    Delta Lake tables have an 'id' column for row identifiers and
    numeric columns for field data. This function distinguishes between them.
    
    Args:
        column_name: Column name to check
        
    Returns:
        True if column name is a field ID (numeric), False if it's 'id' or invalid
        
    Examples:
        >>> is_field_column_name("123")
        True
        >>> is_field_column_name("id")
        False
        >>> is_field_column_name("name")
        False
    """
    return column_name != "id" and validate_field_column_name(column_name)


# Constants for clarity
ROW_ID_COLUMN_NAME = "id"  # Column name for row identifiers (not field data)

logger.info("Field column name utilities initialized")