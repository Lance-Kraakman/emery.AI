"""
Table High-Level Operations

Handles high-level business logic orchestration for table operations.
Focuses on preparing data for different table operations.
"""

import logging
from functools import partial
from typing import Any

import polars as pl
import pyarrow as pa
from deltalake import DeltaTable, write_deltalake

from ..generated import table_service_pb2
from .filter_operations import extract_jsonb_target_ids, json_array_contains_id
from .query_operations import (
    apply_pagination,
    apply_type_aware_sorting,
    build_query_metadata,
    load_filtered_data,
)
from .schema import (
    create_dataframe_with_schema,
    evolve_schema,
    get_delta_schema_as_pyarrow,
)
from .transform import (
    convert_dataframe_to_arrow,
    create_empty_arrow_table,
    normalize_arrow_table_to_large_string,
)
from .validate import detect_data_anomalies, validate_sort_columns
from .write_buffer import WriteBuffer, merge_buffer_into_dataframe

logger = logging.getLogger(__name__)


def prepare_create_table(
    fields: list[table_service_pb2.TableField],
    s3_uri: str,
    storage_options: dict[str, str],
) -> None:
    """Create new Delta table with specified schema.

    Args:
        fields: List of TableField objects defining the schema
        s3_uri: S3 URI where to create the table
        storage_options: S3 storage options
    """
    logger.info(
        f"[prepare_create_table] Creating table with {len(fields)} fields at {s3_uri}"
    )

    # Build PyArrow schema from protobuf fields (includes field metadata)
    from .schema import build_schema_from_table_fields

    schema = build_schema_from_table_fields(fields)

    # Create empty PyArrow table with metadata-preserving utility
    # This preserves field metadata (e.g., field_type for autonumber sorting)
    empty_table = create_empty_arrow_table(schema)

    # Write with schema evolution
    write_with_schema_evolution(s3_uri, empty_table, "overwrite", storage_options)  # type: ignore

    logger.info(
        f"[prepare_create_table] Successfully created table with schema: {[f.name for f in fields]}"
    )


def prepare_rows_common(
    rows_data: list[table_service_pb2.RowData],
    delta_table: DeltaTable,
    operation_name: str,
) -> tuple[pl.DataFrame, pa.Table]:
    """Prepare row data for create or update operations.

    Args:
        rows_data: List of RowData protobuf messages
        delta_table: DeltaTable instance with existing schema
        operation_name: Operation name for logging (e.g., "CreateRows", "UpdateRows")

    Returns:
        Tuple of (polars_df, arrow_table) ready for writing
    """
    logger.info(f"[{operation_name}] Preparing {len(rows_data)} rows")

    # Get schema for data processing
    get_delta_schema_as_pyarrow(delta_table)

    # Create DataFrame with schema-aware conversion
    df = create_dataframe_with_schema(rows_data, delta_table)

    # Detect any data anomalies
    anomalies = detect_data_anomalies(df, operation_name)
    if anomalies:
        for anomaly in anomalies:
            logger.warning(anomaly)

    # Convert to Arrow with string normalization
    arrow_table = convert_dataframe_to_arrow(df, normalize_strings=True)

    logger.info(
        f"[{operation_name}] Prepared DataFrame: {df.shape}, Arrow: {arrow_table.shape}"
    )
    return df, arrow_table


def prepare_create_rows(
    rows_data: list[table_service_pb2.RowData],
    delta_table: DeltaTable,
    mode: str = "append",
) -> tuple[pl.DataFrame, pa.Table]:
    """Prepare data for CreateRows operation.

    Args:
        rows_data: List of RowData protobuf messages
        delta_table: DeltaTable instance with existing schema
        mode: Write mode ('append' or 'overwrite')

    Returns:
        Tuple of (polars_df, arrow_table) ready for writing
    """
    return prepare_rows_common(rows_data, delta_table, "CreateRows")


def prepare_update_rows(
    rows_data: list[table_service_pb2.RowData], delta_table: DeltaTable
) -> tuple[pl.DataFrame, pa.Table]:
    """Prepare data for UpdateRows operation.

    Args:
        rows_data: List of RowData protobuf messages
        delta_table: DeltaTable instance with existing schema

    Returns:
        Tuple of (polars_df, arrow_table) ready for writing
    """
    return prepare_rows_common(rows_data, delta_table, "UpdateRows")


def prepare_query_rows(
    delta_table: DeltaTable,
    filters: list[table_service_pb2.RowFilter],
    order_by: list[str],
    order_direction: str = "ASC",
    limit: int | None = None,
    offset: int = 0,
    aggregation: table_service_pb2.AggregationConfig | None = None,
    s3_uri: str | None = None,
    write_buffer: WriteBuffer | None = None,
) -> tuple[pl.DataFrame, dict[str, Any]]:
    """Prepare data for QueryRows operation.

    Args:
        delta_table: DeltaTable instance with schema
        filters: List of RowFilter objects
        order_by: List of column names to sort by
        order_direction: Sort direction ('ASC' or 'DESC')
        limit: Maximum number of rows to return
        offset: Number of rows to skip
        aggregation: Optional aggregation configuration

    Returns:
        Tuple of (filtered_df, metadata_dict)
    """
    logger.info(
        f"[prepare_query_rows] Preparing query with {len(filters)} filters, order_by={order_by}"
    )

    # Get schema for validation
    schema = get_delta_schema_as_pyarrow(delta_table)

    # Validate sort columns
    is_valid, error_msg = validate_sort_columns(order_by, schema, "QueryRows")
    if not is_valid:
        raise ValueError(f"Sort column validation failed: {error_msg}")

    # Load data with predicate pushdown
    df = load_filtered_data(delta_table, filters, schema)

    # Merge buffered writes for read consistency (before filters/sort/pagination)
    if write_buffer and s3_uri:
        buffered_ops = write_buffer.get_buffered_ops(s3_uri)
        if buffered_ops:
            df = merge_buffer_into_dataframe(df, buffered_ops, schema)
            logger.info(f"[prepare_query_rows] Merged {len(buffered_ops)} buffered ops")

    # Apply LIKE/ILIKE filters in-memory (these cannot be pushed down)
    if filters:
        df = apply_like_ilike_filters(df, filters)

    # Apply JSONB contains filters in-memory (for relation/file/document fields)
    if filters:
        df = apply_jsonb_contains_filters(df, filters)

    # Apply aggregation if requested
    if aggregation:
        df = apply_aggregations(df, aggregation)
        # Skip sorting and pagination for aggregated results
    else:
        # Apply sorting for non-aggregated queries
        if order_by:
            if len(order_by) == 1:
                # Single column: use type-aware sorting
                sort_column = order_by[0]
                field = next((f for f in schema if f.name == sort_column), None)
                df = apply_type_aware_sorting(df, sort_column, field, order_direction)
            else:
                # Multi-column: simple sort
                df = df.sort(order_by)

        # Apply pagination for non-aggregated queries
        df = apply_pagination(df, offset, limit)

    # Build and return metadata
    metadata = build_query_metadata(df, filters, order_by, limit, offset, aggregation)

    logger.info(f"[prepare_query_rows] Query result: {df.shape} rows")
    return df, metadata


def apply_field_additions(
    delta_table: DeltaTable,
    new_fields: list[table_service_pb2.TableField],
    s3_uri: str,
    storage_options: dict[str, str],
) -> pa.Schema:
    """Apply field additions to existing table schema and Delta Lake.

    Args:
        delta_table: DeltaTable instance with current schema
        new_fields: List of new TableField objects to add
        s3_uri: S3 URI of the Delta table
        storage_options: S3 storage options

    Returns:
        Updated PyArrow schema
    """
    logger.info(f"[apply_field_additions] Adding {len(new_fields)} fields to table")

    # Get current schema
    current_schema = get_delta_schema_as_pyarrow(delta_table)

    # Evolve schema to include new fields (includes field metadata)
    new_schema = evolve_schema(current_schema, new_fields)

    # Extract just the NEW fields from the evolved schema
    # This preserves field metadata (e.g., field_type for autonumber sorting)
    current_field_names = set(current_schema.names)
    new_field_schemas = [f for f in new_schema if f.name not in current_field_names]

    # Create empty PyArrow table for new fields using metadata-preserving utility
    if new_field_schemas:
        new_fields_schema = pa.schema(new_field_schemas)
        new_arrow_table = create_empty_arrow_table(new_fields_schema)

        # Write with schema evolution to add new columns to Delta Lake
        write_with_schema_evolution(s3_uri, new_arrow_table, "append", storage_options)

    logger.info(
        f"[apply_field_additions] Schema evolved from {len(current_schema)} to {len(new_schema)} fields"
    )
    return new_schema


def apply_field_updates(
    delta_table: DeltaTable,
    field_updates: list[tuple[str, table_service_pb2.TableField]],
) -> tuple[pa.Schema, list[str]]:
    """Apply field updates to existing table schema.

    Args:
        delta_table: DeltaTable instance with current schema
        field_updates: List of (field_name, new_field) tuples

    Returns:
        Tuple of (updated_schema, migration_messages)
    """
    logger.info(f"[apply_field_updates] Updating {len(field_updates)} fields")

    # Get current schema
    current_schema = get_delta_schema_as_pyarrow(delta_table)

    # For now, just return current schema (field updates are complex)
    # This would need full schema migration logic
    migration_messages = []
    for field_name, _new_field in field_updates:
        migration_messages.append(f"Field '{field_name}' update requested")

    logger.info(f"[apply_field_updates] Field updates prepared: {migration_messages}")
    return current_schema, migration_messages


def apply_filters_in_memory(
    df: pl.DataFrame, filters: list[table_service_pb2.RowFilter], schema: pa.Schema
) -> pl.DataFrame:
    """Apply filters to DataFrame in-memory.

    Args:
        df: Polars DataFrame to filter
        filters: List of RowFilter objects
        schema: PyArrow schema for type information

    Returns:
        Filtered Polars DataFrame
    """
    if not filters:
        return df

    logger.debug(
        f"[apply_filters_in_memory] Applying {len(filters)} filters to {len(df)} rows"
    )

    for filter_obj in filters:
        field_name = filter_obj.field
        operator = filter_obj.operator
        filter_value = filter_obj.value

        # Skip if field not in DataFrame
        if field_name not in df.columns:
            logger.warning(
                f"[apply_filters_in_memory] Field '{field_name}' not in DataFrame, skipping"
            )
            continue

        # Extract actual value from RowDataValue
        if filter_value.HasField("text_value"):
            raw_value = filter_value.text_value
        elif filter_value.HasField("number_value"):
            raw_value = filter_value.number_value
        elif filter_value.HasField("boolean_value"):
            raw_value = filter_value.boolean_value
        elif filter_value.HasField("date_value"):
            raw_value = filter_value.date_value
        else:
            raw_value = None

        # Apply filter based on operator
        try:
            if operator == table_service_pb2.FILTER_OP_EQ:
                df = df.filter(pl.col(field_name) == raw_value)
            elif operator == table_service_pb2.FILTER_OP_NE:
                df = df.filter(pl.col(field_name) != raw_value)
            elif operator == table_service_pb2.FILTER_OP_GT:
                df = df.filter(pl.col(field_name) > raw_value)
            elif operator == table_service_pb2.FILTER_OP_GTE:
                df = df.filter(pl.col(field_name) >= raw_value)
            elif operator == table_service_pb2.FILTER_OP_LT:
                df = df.filter(pl.col(field_name) < raw_value)
            elif operator == table_service_pb2.FILTER_OP_LTE:
                df = df.filter(pl.col(field_name) <= raw_value)
            elif operator == table_service_pb2.FILTER_OP_IS_NULL:
                df = df.filter(pl.col(field_name).is_null())
            elif operator == table_service_pb2.FILTER_OP_IS_NOT_NULL:
                df = df.filter(pl.col(field_name).is_not_null())
            elif operator == table_service_pb2.FILTER_OP_LIKE:
                df = df.filter(pl.col(field_name).str.contains(str(raw_value)))
            elif operator == table_service_pb2.FILTER_OP_ILIKE:
                df = df.filter(
                    pl.col(field_name)
                    .str.to_lowercase()
                    .str.contains(str(raw_value).lower())
                )
            else:
                logger.warning(
                    f"[apply_filters_in_memory] Unsupported operator {operator} for field '{field_name}'"
                )

        except Exception as e:
            logger.error(
                f"[apply_filters_in_memory] Error applying filter on field '{field_name}': {e}"
            )
            continue

    logger.debug(f"[apply_filters_in_memory] Filtered result: {len(df)} rows")
    return df


def apply_like_ilike_filters(
    df: pl.DataFrame, filters: list[table_service_pb2.RowFilter]
) -> pl.DataFrame:
    """Apply LIKE/ILIKE filters to DataFrame in-memory.

    These filters cannot be pushed down to Delta Lake and must be applied
    after loading data into memory.

    Args:
        df: Polars DataFrame to filter
        filters: List of RowFilter objects

    Returns:
        Filtered Polars DataFrame
    """
    if not filters:
        return df

    # Extract LIKE/ILIKE filters
    ilike_filters = [
        f for f in filters if f.operator == table_service_pb2.FILTER_OP_ILIKE
    ]

    # Check if we have a text search pattern (multiple ILIKE filters with same search term)
    is_text_search = False
    if len(ilike_filters) > 1:
        search_terms = set()
        for f in ilike_filters:
            value = f.value.text_value if f.value.HasField("text_value") else ""
            search_terms.add(value.replace("%", ""))

        if len(search_terms) == 1:
            is_text_search = True
            search_term = search_terms.pop()

            # Build OR condition: field1.contains(term) OR field2.contains(term) OR ...
            or_condition = None
            for f in ilike_filters:
                field_condition = pl.col(f.field).str.contains(f"(?i){search_term}")
                if or_condition is None:
                    or_condition = field_condition
                else:
                    or_condition = or_condition | field_condition

            # Apply OR filter for text search
            if or_condition is not None:
                df = df.filter(or_condition)

    # If not a text search, apply LIKE/ILIKE filters with AND logic
    if not is_text_search:
        for filter_obj in filters:
            if filter_obj.operator == table_service_pb2.FILTER_OP_ILIKE:
                value = (
                    filter_obj.value.text_value
                    if filter_obj.value.HasField("text_value")
                    else ""
                )
                search_term = value.replace("%", "")
                df = df.filter(
                    pl.col(filter_obj.field).str.contains(f"(?i){search_term}")
                )

            elif filter_obj.operator == table_service_pb2.FILTER_OP_LIKE:
                value = (
                    filter_obj.value.text_value
                    if filter_obj.value.HasField("text_value")
                    else ""
                )
                search_term = value.replace("%", "")
                df = df.filter(pl.col(filter_obj.field).str.contains(search_term))
    return df


def apply_jsonb_contains_filters(
    df: pl.DataFrame, filters: list[table_service_pb2.RowFilter]
) -> pl.DataFrame:
    """Apply JSONB contains filters for complex field types (relation/file/document).

    These filters check if a JSONB array column contains an element with matching 'id'.
    Cannot be pushed down to Delta Lake, must be applied in-memory after load.

    Complex field types store JSONB arrays:
    - relation: [{id: number|string, value: string}]
    - file:     [{id: string, name: string, size: number, ...}]
    - document: [{id: string, name: string, documentMetadata: {...}, ...}]

    Args:
        df: Polars DataFrame to filter
        filters: List of RowFilter protobuf objects

    Returns:
        Filtered DataFrame
    """
    if not filters:
        return df

    for filter_obj in filters:
        if filter_obj.operator != table_service_pb2.FILTER_OP_CONTAINS:
            continue

        field_name = filter_obj.field
        if field_name not in df.columns:
            logger.warning(
                f"[apply_jsonb_contains_filters] Field '{field_name}' not in DataFrame"
            )
            continue

        # Extract target IDs using type-safe function
        target_ids = extract_jsonb_target_ids(filter_obj.value)
        if not target_ids:
            logger.warning(
                f"[apply_jsonb_contains_filters] No target IDs for field '{field_name}'"
            )
            continue

        logger.info(
            f"[apply_jsonb_contains_filters] Filtering '{field_name}' for IDs: {target_ids}"
        )

        # Apply filter using map_elements with partial to avoid closure issues
        # NOTE: Using functools.partial ensures target_ids is bound correctly
        # Polars >= 0.20 uses map_elements (not deprecated apply)
        checker = partial(json_array_contains_id, target_ids=target_ids)
        df = df.filter(
            pl.col(field_name).map_elements(checker, return_dtype=pl.Boolean)
        )

        logger.info(
            f"[apply_jsonb_contains_filters] After filter: {len(df)} rows remaining"
        )

    return df


def apply_aggregations(
    df: pl.DataFrame, aggregation: table_service_pb2.AggregationConfig
) -> pl.DataFrame:
    """Apply aggregation operations to DataFrame.

    Args:
        df: Polars DataFrame to aggregate
        aggregation: AggregationConfig from protobuf

    Returns:
        Aggregated Polars DataFrame
    """
    logger.info(
        f"[apply_aggregations] Applying {len(aggregation.aggregations)} aggregation functions"
    )

    # Build Polars aggregation expressions
    # Null Handling in Aggregations:
    # - fill_null(0): Treats null values as zeros for numeric aggregations
    # - Why: User expectation is "average of 20 rows" not "average of 12 non-null rows"
    # - Example: AVG([10, 20, null, null]) = 7.5 (not 15)
    # - Applied to: SUM, AVG, MIN, MAX
    # - NOT applied to: COUNT (counts all rows), COUNT_EMPTY (counts nulls specifically)
    agg_exprs = []
    for agg_func in aggregation.aggregations:
        field_id = agg_func.field_id  # Numeric field ID as string, e.g., "10", "11"

        # Map protobuf aggregation type to Polars expression
        # Use field_id as alias to ensure column names match what TypeScript expects
        if agg_func.type == table_service_pb2.AGG_TYPE_SUM:
            agg_exprs.append(pl.col(field_id).fill_null(0).sum().alias(field_id))
        elif agg_func.type == table_service_pb2.AGG_TYPE_AVG:
            agg_exprs.append(pl.col(field_id).fill_null(0).mean().alias(field_id))
        elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT:
            agg_exprs.append(pl.col(field_id).count().alias(field_id))
        elif agg_func.type == table_service_pb2.AGG_TYPE_MIN:
            agg_exprs.append(pl.col(field_id).fill_null(0).min().alias(field_id))
        elif agg_func.type == table_service_pb2.AGG_TYPE_MAX:
            agg_exprs.append(pl.col(field_id).fill_null(0).max().alias(field_id))
        elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_DISTINCT:
            agg_exprs.append(pl.col(field_id).n_unique().alias(field_id))
        elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_EMPTY:
            agg_exprs.append(pl.col(field_id).is_null().sum().alias(field_id))
        elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_NOT_EMPTY:
            agg_exprs.append(pl.col(field_id).is_not_null().sum().alias(field_id))
        else:
            logger.warning(
                f"[apply_aggregations] Unknown aggregation type: {agg_func.type}"
            )
            continue

    # Apply aggregation
    if len(aggregation.group_by_fields) > 0:
        # GROUP BY aggregation (for dashboard views with multiple groups)
        logger.info(
            f"[apply_aggregations] Applying GROUP BY aggregation on fields: {list(aggregation.group_by_fields)}"
        )
        df = df.group_by(list(aggregation.group_by_fields)).agg(agg_exprs)
    else:
        # Global aggregation (single row result for metric views)
        logger.info("[apply_aggregations] Applying global aggregation (no GROUP BY)")
        df = df.select(agg_exprs)

    logger.info(f"[apply_aggregations] Aggregation complete, result shape: {df.shape}")
    return df


def write_with_schema_evolution(
    s3_uri: str, data: pa.Table, mode: str, storage_options: dict[str, str]
) -> None:
    """Write data to Delta Lake with schema evolution support.

    Args:
        s3_uri: S3 URI to write to
        data: Arrow table to write
        mode: Write mode ('append' or 'overwrite')
        storage_options: S3 storage options
    """
    logger.info("[write_with_schema_evolution] START")

    # Normalize strings to large_string before writing
    normalized_data = normalize_arrow_table_to_large_string(data)

    # Write with schema evolution
    write_deltalake(
        s3_uri,
        normalized_data,
        mode=mode,  # type: ignore
        schema_mode="merge",
        storage_options=storage_options,
    )

    logger.info("[write_with_schema_evolution] END")


def write_with_merge_operation(
    s3_uri: str, update_data: pa.Table, storage_options: dict[str, str]
) -> None:
    """Write data using Delta Lake native merge operation to update specific rows.

    Uses Delta Lake's built-in MERGE functionality which preserves field metadata
    and is more efficient than loading all data into memory.

    Args:
        s3_uri: S3 URI of the Delta table
        update_data: Arrow table with rows to update (must include 'id' column)
        storage_options: S3 storage options
    """
    logger.info(
        f"[write_with_merge_operation] Merging {len(update_data)} rows to {s3_uri}"
    )

    # Verify 'id' column exists
    if "id" not in update_data.schema.names:
        logger.error(
            "[write_with_merge_operation] No 'id' column in update data, cannot merge"
        )
        raise ValueError("Update data must contain 'id' column for merge operation")

    # Normalize strings before merge to ensure compatibility
    normalized_update = normalize_arrow_table_to_large_string(update_data)

    # Load existing Delta table
    delta_table = DeltaTable(s3_uri, storage_options=storage_options)

    # Use Delta Lake's native merge operation (preserves metadata)
    # This is more efficient than Pandas and preserves PyArrow field metadata
    (
        delta_table.merge(
            source=normalized_update,
            predicate="target.id = source.id",
            source_alias="source",
            target_alias="target",
        )
        .when_matched_update_all()  # Update all columns where id matches
        .when_not_matched_insert_all()  # Insert rows with new ids
        .execute()
    )

    logger.info(
        f"[write_with_merge_operation] Successfully merged {len(update_data)} rows"
    )


def prepare_table_stats(s3_uri: str, storage_options: dict[str, str]) -> dict[str, Any]:
    """Prepare table statistics.

    Args:
        s3_uri: S3 URI of the Delta table
        storage_options: S3 storage options

    Returns:
        Dictionary with table statistics
    """
    try:
        # Load DeltaTable from S3 URI
        delta_table = DeltaTable(s3_uri, storage_options=storage_options)

        # Read table data
        arrow_table = delta_table.to_pyarrow_table()
        df = pl.from_arrow(arrow_table)

        # Ensure we have a DataFrame, not a Series
        if isinstance(df, pl.Series):
            df = df.to_frame()

        # Calculate statistics
        stats = {
            "row_count": len(df),
            "column_count": len(df.columns),
            "size_bytes": arrow_table.nbytes,
            "columns": [],
        }

        # Column-level statistics
        for col_name in df.columns:
            col_stats = {
                "name": col_name,
                "dtype": str(df[col_name].dtype),
                "null_count": df[col_name].null_count(),
                "unique_count": df[col_name].n_unique(),
            }
            stats["columns"].append(col_stats)

        logger.info(
            f"[prepare_table_stats] Table stats: {stats['row_count']} rows, {stats['column_count']} columns"
        )
        return stats

    except Exception as e:
        logger.error(f"[prepare_table_stats] Error calculating stats: {e}")
        return {"row_count": 0, "column_count": 0, "size_bytes": 0, "error": str(e)}
