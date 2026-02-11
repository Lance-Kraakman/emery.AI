"""
Schema Operations

Module-level functions for schema-related operations including schema evolution,
column detection, type mapping, and backfilling operations.
"""

import logging

import pyarrow as pa
from deltalake import DeltaTable, write_deltalake

from .schema import get_delta_schema_as_pyarrow
from .transform import create_empty_arrow_table, normalize_arrow_table_to_large_string

logger = logging.getLogger(__name__)


def detect_new_columns(current_schema: pa.Schema, new_schema: pa.Schema) -> list[str]:
    """
    Detect which columns in new_schema don't exist in current_schema.

    Args:
        current_schema: Current table schema from Delta Lake
        new_schema: Proposed new schema with potential new columns

    Returns:
        List of column names that need to be added
    """
    current_columns = [field.name for field in current_schema]
    new_columns = [field.name for field in new_schema]
    columns_to_add = [col for col in new_columns if col not in current_columns]

    logger.info(
        f"[detect_new_columns] Current: {current_columns}, New: {new_columns}, To add: {columns_to_add}"
    )
    return columns_to_add


def evolve_table_schema(
    s3_uri: str, new_fields_schema: pa.Schema, storage_options: dict[str, str]
) -> None:
    """
    Evolve Delta Lake table schema by adding new columns with metadata.

    Uses Delta Lake's schema_mode="merge" to add new columns. Creates an empty
    PyArrow table with the new columns (preserving metadata) and writes it to
    trigger schema evolution.

    Args:
        s3_uri: S3 URI of the Delta table
        new_fields_schema: PyArrow schema containing new fields with metadata
        storage_options: S3 storage configuration (credentials, region, etc.)
    """
    logger.info(
        f"[evolve_table_schema] Adding {len(new_fields_schema)} columns: {list(new_fields_schema.names)}"
    )

    # Create empty PyArrow table using metadata-preserving utility
    # This preserves field metadata (e.g., field_type for autonumber sorting)
    arrow_table = create_empty_arrow_table(new_fields_schema)

    # Normalize strings to large_string for filter compatibility
    arrow_table = normalize_arrow_table_to_large_string(arrow_table)

    # Write empty table to trigger schema evolution
    write_deltalake(
        s3_uri,
        arrow_table,
        mode="append",
        schema_mode="merge",
        storage_options=storage_options,
    )

    logger.info("[evolve_table_schema] ✅ Schema evolution triggered")


def verify_schema_update(
    s3_uri: str, expected_columns: list[str], storage_options: dict[str, str]
) -> str | None:
    """
    Verify that schema evolution succeeded and all expected columns were added.

    Args:
        s3_uri: S3 URI of the Delta table
        expected_columns: List of column names that should have been added
        storage_options: S3 storage configuration

    Returns:
        Error message if verification failed, None if successful
    """
    updated_table = DeltaTable(s3_uri, storage_options=storage_options)
    updated_schema = get_delta_schema_as_pyarrow(updated_table)
    updated_columns = [field.name for field in updated_schema]

    logger.info(f"[verify_schema_update] Updated columns: {updated_columns}")

    missing = [col for col in expected_columns if col not in updated_columns]
    if missing:
        error_msg = f"Failed to add columns: {missing}"
        logger.error(f"[verify_schema_update] ❌ {error_msg}")
        return error_msg

    logger.info(
        f"[verify_schema_update] ✅ All {len(expected_columns)} columns added successfully"
    )
    return None


def backfill_boolean_columns(
    s3_uri: str,
    new_schema: pa.Schema,
    columns_to_add: list[str],
    storage_options: dict[str, str],
) -> None:
    """
    Backfill boolean columns with false (not null).

    When adding new boolean columns, backfill existing rows with false instead
    of null to match user expectations (unchecked checkbox = false, not null).

    Args:
        s3_uri: S3 URI of the Delta table
        new_schema: PyArrow schema containing field definitions
        columns_to_add: List of newly added column names
        storage_options: S3 storage configuration
    """
    # Find boolean columns among the newly added columns
    boolean_cols = [
        field.name
        for field in new_schema
        if field.name in columns_to_add and field.type == pa.bool_()
    ]

    if not boolean_cols:
        logger.info("[backfill_boolean_columns] No boolean columns to backfill")
        return

    logger.info(
        f"[backfill_boolean_columns] Backfilling {len(boolean_cols)} columns: {boolean_cols}"
    )

    try:
        table = DeltaTable(s3_uri, storage_options=storage_options)
        for col_name in boolean_cols:
            table.update(predicate=f"`{col_name}` IS NULL", updates={col_name: "false"})
        logger.info(
            f"[backfill_boolean_columns] ✅ Backfilled {len(boolean_cols)} boolean columns"
        )
    except Exception as e:
        logger.warning(
            f"[backfill_boolean_columns] Backfill failed (non-critical): {e}"
        )
