"""
Type Conversion Utilities

Pure utility functions for converting values between Python and PyArrow types.
This module has no dependencies on other table modules to avoid circular imports.
"""

import logging
from datetime import UTC, datetime
from typing import Any

import pyarrow as pa
import pyarrow.types as pat

logger = logging.getLogger(__name__)


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
                return value.lower() in ("true", "1", "yes", "on")
            return bool(value)

        # Timestamp types
        elif pat.is_timestamp(column_type):
            if isinstance(value, (int, float)):
                return value  # Unix timestamp
            elif isinstance(value, str):
                try:
                    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=UTC)
                    return dt
                except ValueError:
                    return value
            return value

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
        logger.warning(
            f"[cast_value_to_column_type] Cannot cast {value} to {column_type}: {e}"
        )
        # Return original value and let operation handle the error
        return value
