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