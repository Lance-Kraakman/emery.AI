"""
Field Validation

Utilities for validating field operations including type change compatibility,
metadata-only change detection, and comprehensive error messaging.
"""

import logging
from typing import Tuple, Optional, Set
from ..generated import table_service_pb2

logger = logging.getLogger(__name__)

# Type Conversion Compatibility Matrix
# Defines which field type conversions are allowed with data migration
ALLOWED_TYPE_CONVERSIONS: Set[Tuple[int, int]] = {
    # Text conversions
    (table_service_pb2.FIELD_TYPE_TEXT, table_service_pb2.FIELD_TYPE_NUMBER),
    (table_service_pb2.FIELD_TYPE_TEXT, table_service_pb2.FIELD_TYPE_BOOLEAN),
    (table_service_pb2.FIELD_TYPE_TEXT, table_service_pb2.FIELD_TYPE_EMAIL),
    (table_service_pb2.FIELD_TYPE_TEXT, table_service_pb2.FIELD_TYPE_PHONE),

    # Number conversions
    (table_service_pb2.FIELD_TYPE_NUMBER, table_service_pb2.FIELD_TYPE_TEXT),

    # Boolean conversions
    (table_service_pb2.FIELD_TYPE_BOOLEAN, table_service_pb2.FIELD_TYPE_TEXT),

    # Email conversions
    (table_service_pb2.FIELD_TYPE_EMAIL, table_service_pb2.FIELD_TYPE_TEXT),

    # Phone conversions
    (table_service_pb2.FIELD_TYPE_PHONE, table_service_pb2.FIELD_TYPE_TEXT),

    # Date/Timestamp conversions
    (table_service_pb2.FIELD_TYPE_DATE, table_service_pb2.FIELD_TYPE_LAST_UPDATED),
    (table_service_pb2.FIELD_TYPE_DATE, table_service_pb2.FIELD_TYPE_CREATED_AT),
    (table_service_pb2.FIELD_TYPE_LAST_UPDATED, table_service_pb2.FIELD_TYPE_DATE),
    (table_service_pb2.FIELD_TYPE_CREATED_AT, table_service_pb2.FIELD_TYPE_DATE),
}

# Complex field types that cannot be converted
COMPLEX_FIELD_TYPES: Set[int] = {
    table_service_pb2.FIELD_TYPE_SINGLE_SELECT,
    table_service_pb2.FIELD_TYPE_MULTI_SELECT,
    table_service_pb2.FIELD_TYPE_RELATION,
    table_service_pb2.FIELD_TYPE_FILE,
    table_service_pb2.FIELD_TYPE_DOCUMENT,
    table_service_pb2.FIELD_TYPE_EMBEDDING,
    table_service_pb2.FIELD_TYPE_AUTONUMBER,
}

# Field type names for error messages
FIELD_TYPE_NAMES = {
    table_service_pb2.FIELD_TYPE_UNSPECIFIED: "UNSPECIFIED",
    table_service_pb2.FIELD_TYPE_TEXT: "TEXT",
    table_service_pb2.FIELD_TYPE_NUMBER: "NUMBER",
    table_service_pb2.FIELD_TYPE_BOOLEAN: "BOOLEAN",
    table_service_pb2.FIELD_TYPE_DATE: "DATE",
    table_service_pb2.FIELD_TYPE_FILE: "FILE",
    table_service_pb2.FIELD_TYPE_RELATION: "RELATION",
    table_service_pb2.FIELD_TYPE_DOCUMENT: "DOCUMENT",
    table_service_pb2.FIELD_TYPE_EMBEDDING: "EMBEDDING",
    table_service_pb2.FIELD_TYPE_SINGLE_SELECT: "SINGLE_SELECT",
    table_service_pb2.FIELD_TYPE_MULTI_SELECT: "MULTI_SELECT",
    table_service_pb2.FIELD_TYPE_AUTONUMBER: "AUTONUMBER",
    table_service_pb2.FIELD_TYPE_LAST_UPDATED: "LAST_UPDATED",
    table_service_pb2.FIELD_TYPE_CREATED_AT: "CREATED_AT",
    table_service_pb2.FIELD_TYPE_EMAIL: "EMAIL",
    table_service_pb2.FIELD_TYPE_PHONE: "PHONE",
}


def validate_field_type_change(
    from_type: int,
    to_type: int
) -> Tuple[bool, Optional[str]]:
    """Validate if a field type change is allowed.

    Checks if the requested type conversion is in the allowed conversions set.
    Complex field types (single-select, multi-select, relation, etc.) cannot
    be converted and must be deleted and recreated.

    Args:
        from_type: Current field type (protobuf enum value)
        to_type: Desired field type (protobuf enum value)

    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if conversion is allowed, False otherwise
        - error_message: None if valid, error string if invalid

    Example:
        >>> validate_field_type_change(FIELD_TYPE_TEXT, FIELD_TYPE_NUMBER)
        (True, None)

        >>> validate_field_type_change(FIELD_TYPE_SINGLE_SELECT, FIELD_TYPE_TEXT)
        (False, "Cannot convert SINGLE_SELECT to TEXT. Complex field types ...")
    """
    # Same type is always valid (metadata-only change)
    if from_type == to_type:
        return True, None

    # Check if conversion is in allowed set
    if (from_type, to_type) in ALLOWED_TYPE_CONVERSIONS:
        logger.info(f"[validate_field_type_change] Allowed conversion: {FIELD_TYPE_NAMES.get(from_type)} → {FIELD_TYPE_NAMES.get(to_type)}")
        return True, None

    # Generate error message for blocked conversion
    error_msg = get_type_change_error_message(from_type, to_type)
    logger.warning(f"[validate_field_type_change] Blocked conversion: {FIELD_TYPE_NAMES.get(from_type)} → {FIELD_TYPE_NAMES.get(to_type)}")
    return False, error_msg


def is_metadata_only_change(
    current_field_type: int,
    updated_field_type: int
) -> bool:
    """Check if a field update is metadata-only (no data migration needed).

    Metadata-only changes include:
    - Field name changes
    - Required status changes
    - Field config changes (options, targetTableId, etc.)
    - No type change

    Args:
        current_field_type: Current field type
        updated_field_type: Updated field type

    Returns:
        True if metadata-only, False if data migration needed
    """
    return current_field_type == updated_field_type


def get_type_change_error_message(from_type: int, to_type: int) -> str:
    """Generate a user-friendly error message for blocked type conversions.

    Args:
        from_type: Current field type
        to_type: Desired field type

    Returns:
        Detailed error message explaining why conversion is blocked
    """
    from_name = FIELD_TYPE_NAMES.get(from_type, f"UNKNOWN({from_type})")
    to_name = FIELD_TYPE_NAMES.get(to_type, f"UNKNOWN({to_type})")

    # Check if either type is complex
    is_from_complex = from_type in COMPLEX_FIELD_TYPES
    is_to_complex = to_type in COMPLEX_FIELD_TYPES

    if is_from_complex or is_to_complex:
        return (
            f"Cannot convert {from_name} to {to_name}. "
            f"Complex field types (SINGLE_SELECT, MULTI_SELECT, RELATION, FILE, DOCUMENT, "
            f"EMBEDDING, AUTONUMBER) cannot be converted. "
            f"Please delete the field and recreate it with the desired type."
        )

    # Unsupported primitive conversion
    return (
        f"Cannot convert {from_name} to {to_name}. "
        f"This type conversion is not supported. "
        f"Supported conversions: TEXT ↔ NUMBER, TEXT ↔ BOOLEAN, DATE ↔ TIMESTAMP. "
        f"Please delete the field and recreate it with the desired type."
    )


def get_field_operation_description(
    current_field_type: int,
    updated_field_type: int,
    migrate_data: bool
) -> str:
    """Get a description of the field operation for logging.

    Args:
        current_field_type: Current field type
        updated_field_type: Updated field type
        migrate_data: Whether data migration is requested

    Returns:
        Human-readable description of the operation
    """
    if current_field_type == updated_field_type:
        return "Metadata-only update (no data migration)"

    from_name = FIELD_TYPE_NAMES.get(current_field_type, f"UNKNOWN({current_field_type})")
    to_name = FIELD_TYPE_NAMES.get(updated_field_type, f"UNKNOWN({updated_field_type})")

    if migrate_data:
        return f"Type conversion with data migration: {from_name} → {to_name}"
    else:
        return f"Type conversion WITHOUT data migration: {from_name} → {to_name} (data may be lost)"
