"""
Schema Operations

Module-level functions for schema-related operations including schema evolution,
column detection, type mapping, and backfilling operations.
"""

import logging
from typing import List, Dict, Optional
import pyarrow as pa
import polars as pl
from deltalake import write_deltalake, DeltaTable

from .schema import get_delta_schema_as_pyarrow, build_schema_from_table_fields
from .transform import normalize_arrow_table_to_large_string

logger = logging.getLogger(__name__)


def detect_new_columns(current_schema: pa.Schema, new_schema: pa.Schema) -> List[str]:
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

    logger.info(f"[detect_new_columns] Current: {current_columns}, New: {new_columns}, To add: {columns_to_add}")
    return columns_to_add


def build_column_type_mappings(new_schema: pa.Schema, columns_to_add: List[str]) -> Dict[str, pl.DataType]:
    """
    Build Polars type mappings for new columns being added.

    Maps PyArrow types to Polars types for schema evolution. Only includes
    columns that are being added (not existing columns).

    Args:
        new_schema: PyArrow schema containing field definitions
        columns_to_add: List of column names to create type mappings for

    Returns:
        Dictionary mapping column names to Polars data types
    """
    schema_dict = {}
    for field in new_schema:
        if field.name in columns_to_add:
            if field.type == pa.float64():
                schema_dict[field.name] = pl.Float64
            elif field.type == pa.bool_():
                schema_dict[field.name] = pl.Boolean
            elif field.type == pa.timestamp('us'):
                schema_dict[field.name] = pl.Datetime('us')
            else:
                schema_dict[field.name] = pl.Utf8

    logger.info(f"[build_column_type_mappings] Type mappings for {len(schema_dict)} columns")
    return schema_dict


def evolve_table_schema(
    s3_uri: str,
    schema_dict: Dict[str, pl.DataType],
    storage_options: Dict[str, str]
) -> None:
    """
    Evolve Delta Lake table schema by adding new columns.

    Uses Delta Lake's schema_mode="merge" to add new columns. Creates an empty
    DataFrame with the new columns and writes it to trigger schema evolution.

    Args:
        s3_uri: S3 URI of the Delta table
        schema_dict: Dictionary mapping new column names to Polars types
        storage_options: S3 storage configuration (credentials, region, etc.)
    """
    logger.info(f"[evolve_table_schema] Adding {len(schema_dict)} columns: {list(schema_dict.keys())}")

    # Create empty DataFrame with new column schema
    df_schema = pl.DataFrame(schema=schema_dict)
    arrow_table = normalize_arrow_table_to_large_string(df_schema.to_arrow())

    # Write empty table to trigger schema evolution
    write_deltalake(
        s3_uri,
        arrow_table,
        mode="append",
        schema_mode="merge",
        storage_options=storage_options
    )

    logger.info(f"[evolve_table_schema] ✅ Schema evolution triggered")


def verify_schema_update(
    s3_uri: str,
    expected_columns: List[str],
    storage_options: Dict[str, str]
) -> Optional[str]:
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

    logger.info(f"[verify_schema_update] ✅ All {len(expected_columns)} columns added successfully")
    return None


def backfill_boolean_columns(
    s3_uri: str,
    new_schema: pa.Schema,
    columns_to_add: List[str],
    storage_options: Dict[str, str]
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
        field.name for field in new_schema
        if field.name in columns_to_add and field.type == pa.bool_()
    ]

    if not boolean_cols:
        logger.info("[backfill_boolean_columns] No boolean columns to backfill")
        return

    logger.info(f"[backfill_boolean_columns] Backfilling {len(boolean_cols)} columns: {boolean_cols}")

    try:
        table = DeltaTable(s3_uri, storage_options=storage_options)
        for col_name in boolean_cols:
            table.update(predicate=f"`{col_name}` IS NULL", updates={col_name: "false"})
        logger.info(f"[backfill_boolean_columns] ✅ Backfilled {len(boolean_cols)} boolean columns")
    except Exception as e:
        logger.warning(f"[backfill_boolean_columns] Backfill failed (non-critical): {e}")
