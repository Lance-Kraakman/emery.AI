"""
Query Operations

Module-level functions for query execution operations including data loading,
sorting, pagination, and metadata building.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
import pyarrow as pa
import pyarrow.types as pat
import polars as pl
from deltalake import DeltaTable

from ..generated import table_service_pb2
from .schema import get_field_type_from_metadata
from .transform import build_pyarrow_predicate

logger = logging.getLogger(__name__)


def load_filtered_data(
    delta_table: DeltaTable,
    filters: List[table_service_pb2.RowFilter],
    schema: pa.Schema
) -> pl.DataFrame:
    """
    Load data from Delta table with predicate pushdown filtering.

    Args:
        delta_table: DeltaTable instance
        filters: List of RowFilter objects
        schema: PyArrow schema for filter building

    Returns:
        Polars DataFrame with filtered data
    """
    # Build PyArrow predicate for efficient filtering with predicate pushdown
    predicate = build_pyarrow_predicate(filters, schema)

    # Load data from Delta table with predicate pushdown
    arrow_table = delta_table.to_pyarrow_table(filters=predicate)
    df = pl.from_arrow(arrow_table)

    # Ensure we have a DataFrame, not a Series
    if isinstance(df, pl.Series):
        df = df.to_frame()

    return df


def apply_type_aware_sorting(
    df: pl.DataFrame,
    sort_column: str,
    field: Optional[pa.Field],
    order_direction: str = 'ASC'
) -> pl.DataFrame:
    """
    Apply type-aware sorting to a single column.

    Handles special cases like autonumber fields that are stored as strings
    but need numeric sorting.

    Args:
        df: Polars DataFrame to sort
        sort_column: Column name to sort by
        field: PyArrow field with type and metadata
        order_direction: Sort direction ('ASC' or 'DESC')

    Returns:
        Sorted Polars DataFrame
    """
    if not field:
        # No field metadata, use simple sort
        return df.sort(
            sort_column,
            descending=(order_direction.upper() == 'DESC'),
            nulls_last=True
        )

    field_type = field.type

    # Check if this is an autonumber field via metadata
    field_type_enum = get_field_type_from_metadata(field.metadata)
    is_autonumber = field_type_enum == table_service_pb2.FIELD_TYPE_AUTONUMBER

    # Diagnostic logging for sorting
    sort_col = df.select(sort_column).to_series()
    logger.info(f"[apply_type_aware_sorting] Sort: col={sort_column}, type={field_type}, is_autonumber={is_autonumber}, "
              f"rows={len(sort_col)}, nulls={sort_col.null_count()}, unique={sort_col.n_unique()}")

    # Re-cast numeric/boolean/autonumber columns for safe sorting
    should_cast = field_type and (
        pat.is_floating(field_type) or
        pat.is_integer(field_type) or
        pat.is_boolean(field_type) or
        is_autonumber
    )

    if should_cast:
        # Determine target Polars type
        if pat.is_floating(field_type):
            target_type = pl.Float64
        elif pat.is_integer(field_type):
            target_type = pl.Int64
        elif pat.is_boolean(field_type):
            target_type = pl.Boolean
        elif is_autonumber:
            target_type = pl.Int64
        else:
            target_type = pl.Utf8

        logger.info(f"[apply_type_aware_sorting] Re-casting '{sort_column}' to {target_type} for safe sorting")
        # Re-cast column with strict=False (empty strings → null, preserves valid values)
        df = df.with_columns(
            pl.col(sort_column).cast(target_type, strict=False)
        )

    # Perform sort with null handling
    df = df.sort(
        sort_column,
        descending=(order_direction.upper() == 'DESC'),
        nulls_last=True
    )
    logger.info(f"[apply_type_aware_sorting] Sort successful, result shape: {df.shape}")
    return df


def apply_pagination(
    df: pl.DataFrame,
    offset: int = 0,
    limit: Optional[int] = None
) -> pl.DataFrame:
    """
    Apply pagination (offset and limit) to DataFrame.

    Args:
        df: Polars DataFrame
        offset: Number of rows to skip
        limit: Maximum number of rows to return

    Returns:
        Paginated Polars DataFrame
    """
    if offset > 0:
        df = df.slice(offset, len(df))

    if limit is not None and limit > 0:
        df = df.slice(0, min(limit, len(df)))

    return df


def build_query_metadata(
    df: pl.DataFrame,
    filters: List[table_service_pb2.RowFilter],
    order_by: List[str],
    limit: Optional[int],
    offset: int,
    aggregation: Optional[table_service_pb2.AggregationConfig]
) -> Dict[str, Any]:
    """
    Build query metadata dictionary.

    Args:
        df: Result DataFrame (for row count)
        filters: List of filters applied
        order_by: List of sort columns
        limit: Limit parameter
        offset: Offset parameter
        aggregation: Aggregation config if applied

    Returns:
        Metadata dictionary
    """
    return {
        'total_count': len(df),
        'filters_applied': len(filters),
        'sort_columns': order_by if not aggregation else [],
        'limit': limit if not aggregation else None,
        'offset': offset if not aggregation else None,
        'aggregation_applied': aggregation is not None
    }
