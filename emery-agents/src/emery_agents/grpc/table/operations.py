"""
Table High-Level Operations

Handles high-level business logic orchestration for table operations.
Focuses on preparing data for different table operations.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
import pyarrow as pa
import polars as pl
import pandas as pd
from deltalake import write_deltalake, DeltaTable

from .schema import (
    create_enhanced_schema,
    evolve_schema,
    create_dataframe_with_schema,
    get_delta_schema_as_pyarrow
)
from .transform import (
    convert_dataframe_to_arrow,
    normalize_arrow_table_to_large_string,
)
from .validate import (
    validate_row_data,
    validate_sort_columns,
    detect_data_anomalies
)
from ..generated import table_service_pb2
from .transform import build_pyarrow_predicate

logger = logging.getLogger(__name__)


def prepare_create_table(
    fields: List[table_service_pb2.TableField],
    s3_uri: str,
    storage_options: Dict[str, str]
) -> None:
    """Create new Delta table with specified schema.

    Args:
        fields: List of TableField objects defining the schema
        s3_uri: S3 URI where to create the table
        storage_options: S3 storage options
    """
    logger.info(f"[prepare_create_table] Creating table with {len(fields)} fields at {s3_uri}")

    # Build PyArrow schema from protobuf fields
    from .schema import build_schema_from_table_fields
    schema = build_schema_from_table_fields(fields)
    
    # Convert PyArrow schema to Polars schema format
    polars_schema = {}
    for field in schema:
        if field.type == pa.large_string():
            polars_schema[field.name] = pl.Utf8()
        elif field.type == pa.float64():
            polars_schema[field.name] = pl.Float64()
        elif field.type == pa.bool_():
            polars_schema[field.name] = pl.Boolean()
        elif field.type == pa.timestamp('us'):
            polars_schema[field.name] = pl.Datetime()
        elif pa.types.is_list(field.type):
            polars_schema[field.name] = pl.List(pl.Float32())
        else:
            polars_schema[field.name] = pl.Utf8()
    
    # Create empty DataFrame with the schema
    empty_df = pl.DataFrame(schema=polars_schema)
    
    # Convert to Arrow and write with schema evolution
    from .transform import convert_dataframe_to_arrow
    empty_table = convert_dataframe_to_arrow(empty_df)
    write_with_schema_evolution(s3_uri, empty_table, "overwrite", storage_options)  # type: ignore

    logger.info(f"[prepare_create_table] Successfully created table with schema: {[f.name for f in fields]}")


def prepare_create_rows(
    rows_data: List[table_service_pb2.RowData],
    delta_table: DeltaTable,
    mode: str = "append"
) -> Tuple[pl.DataFrame, pa.Table]:
    """Prepare data for CreateRows operation.

    Args:
        rows_data: List of RowData protobuf messages
        delta_table: DeltaTable instance with existing schema
        mode: Write mode ('append' or 'overwrite')

    Returns:
        Tuple of (polars_df, arrow_table) ready for writing
    """
    logger.info(f"[prepare_create_rows] Preparing {len(rows_data)} rows for mode={mode}")

    # Get schema for data processing
    schema = get_delta_schema_as_pyarrow(delta_table)

    # Create DataFrame with schema-aware conversion
    df = create_dataframe_with_schema(rows_data, delta_table)
    
    # Detect any data anomalies
    anomalies = detect_data_anomalies(df, "CreateRows")
    if anomalies:
        for anomaly in anomalies:
            logger.warning(anomaly)

    # Convert to Arrow with string normalization
    arrow_table = convert_dataframe_to_arrow(df, normalize_strings=True)

    logger.info(f"[prepare_create_rows] Prepared DataFrame: {df.shape}, Arrow: {arrow_table.shape}")
    return df, arrow_table


def prepare_update_rows(
    rows_data: List[table_service_pb2.RowData],
    delta_table: DeltaTable
) -> Tuple[pl.DataFrame, pa.Table]:
    """Prepare data for UpdateRows operation.

    Args:
        rows_data: List of RowData protobuf messages
        delta_table: DeltaTable instance with existing schema

    Returns:
        Tuple of (polars_df, arrow_table) ready for writing
    """
    logger.info(f"[prepare_update_rows] Preparing {len(rows_data)} rows for update")

    # Get schema for data processing
    schema = get_delta_schema_as_pyarrow(delta_table)

    # Create DataFrame with schema-aware conversion
    df = create_dataframe_with_schema(rows_data, delta_table)
    
    # Detect any data anomalies
    anomalies = detect_data_anomalies(df, "UpdateRows")
    if anomalies:
        for anomaly in anomalies:
            logger.warning(anomaly)

    # Convert to Arrow with string normalization
    arrow_table = convert_dataframe_to_arrow(df, normalize_strings=True)

    logger.info(f"[prepare_update_rows] Prepared DataFrame: {df.shape}, Arrow: {arrow_table.shape}")
    return df, arrow_table


def prepare_query_rows(
    delta_table: DeltaTable,
    filters: List[table_service_pb2.RowFilter],
    order_by: List[str],
    limit: Optional[int] = None,
    offset: int = 0,
    aggregation: Optional[table_service_pb2.AggregationConfig] = None
) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Prepare data for QueryRows operation.

    Args:
        delta_table: DeltaTable instance with schema
        filters: List of RowFilter objects
        order_by: List of column names to sort by
        limit: Maximum number of rows to return
        offset: Number of rows to skip
        aggregation: Optional aggregation configuration

    Returns:
        Tuple of (filtered_df, metadata_dict)
    """
    logger.info(f"[prepare_query_rows] Preparing query with {len(filters)} filters, order_by={order_by}")

    # Get schema for validation
    schema = get_delta_schema_as_pyarrow(delta_table)

    # Validate sort columns
    is_valid, error_msg = validate_sort_columns(order_by, schema, "QueryRows")
    if not is_valid:
        raise ValueError(f"Sort column validation failed: {error_msg}")

    # Build PyArrow predicate for efficient filtering with predicate pushdown
    # This applies filters BEFORE loading data into memory (10-100x faster for large tables)
    predicate = build_pyarrow_predicate(filters, schema)

    # Load data from Delta table with predicate pushdown
    # Delta Lake only loads filtered rows, not entire table
    arrow_table = delta_table.to_pyarrow_table(filters=predicate)
    df = pl.from_arrow(arrow_table)

    # Ensure we have a DataFrame, not a Series
    if isinstance(df, pl.Series):
        df = df.to_frame()

    # Apply LIKE/ILIKE filters in-memory (these cannot be pushed down)
    if filters:
        df = apply_like_ilike_filters(df, filters)

    # Apply aggregation if requested
    if aggregation:
        df = apply_aggregations(df, aggregation)
        
        # For aggregated results, total_count is the number of aggregated rows
        total_count = len(df)
        
        # Skip sorting and pagination for aggregated results
        # Aggregated data is already in final form
    else:
        # Apply sorting (only for non-aggregated queries)
        if order_by:
            df = df.sort(order_by)

        # Apply pagination (only for non-aggregated queries)
        if offset > 0:
            df = df.slice(offset, len(df))
        
        if limit is not None and limit > 0:
            df = df.slice(0, min(limit, len(df)))

        # Get total count for non-aggregated queries
        total_count = len(df)

    # Prepare metadata
    metadata = {
        'total_count': total_count,
        'filters_applied': len(filters),
        'sort_columns': order_by if not aggregation else [],  # No sorting for aggregated results
        'limit': limit if not aggregation else None,
        'offset': offset if not aggregation else None,
        'aggregation_applied': aggregation is not None
    }

    logger.info(f"[prepare_query_rows] Query result: {df.shape} rows")
    return df, metadata


def apply_field_additions(
    delta_table: DeltaTable,
    new_fields: List[table_service_pb2.TableField],
    s3_uri: str,
    storage_options: Dict[str, str]
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
    
    # Evolve schema to include new fields
    new_schema = evolve_schema(current_schema, new_fields)

    # Create empty data with new schema to trigger schema evolution in Delta Lake
    import polars as pl
    from .transform import convert_dataframe_to_arrow
    
    # Build Polars schema for new fields only - create EMPTY DataFrames to avoid unwanted row creation
    new_field_data = {}
    for field in new_fields:
        field_column_name = str(field.field_id)  # Use field ID as column name (temporary fix)
        if field.type == table_service_pb2.FIELD_TYPE_TEXT:
            new_field_data[field_column_name] = pl.Series([], dtype=pl.Utf8)
        elif field.type == table_service_pb2.FIELD_TYPE_NUMBER:
            new_field_data[field_column_name] = pl.Series([], dtype=pl.Float64)
        elif field.type == table_service_pb2.FIELD_TYPE_BOOLEAN:
            new_field_data[field_column_name] = pl.Series([], dtype=pl.Boolean)
        elif field.type == table_service_pb2.FIELD_TYPE_DATE:
            new_field_data[field_column_name] = pl.Series([], dtype=pl.Datetime)
        elif field.type == table_service_pb2.FIELD_TYPE_EMBEDDING:
            new_field_data[field_column_name] = pl.Series([], dtype=pl.List(pl.Float32))
        else:
            new_field_data[field_column_name] = pl.Series([], dtype=pl.Utf8)
    
    # Create DataFrame with just new fields and convert to Arrow
    if new_field_data:
        new_df = pl.DataFrame(new_field_data)
        new_arrow_table = convert_dataframe_to_arrow(new_df)
        
        # Write with schema evolution to add new columns to Delta Lake
        write_with_schema_evolution(s3_uri, new_arrow_table, "append", storage_options)

    logger.info(f"[apply_field_additions] Schema evolved from {len(current_schema)} to {len(new_schema)} fields")
    return new_schema


def apply_field_updates(
    delta_table: DeltaTable,
    field_updates: List[Tuple[str, table_service_pb2.TableField]]
) -> Tuple[pa.Schema, List[str]]:
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
    for field_name, new_field in field_updates:
        migration_messages.append(f"Field '{field_name}' update requested")

    logger.info(f"[apply_field_updates] Field updates prepared: {migration_messages}")
    return current_schema, migration_messages


def apply_filters_in_memory(
    df: pl.DataFrame,
    filters: List[table_service_pb2.RowFilter],
    schema: pa.Schema
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

    logger.debug(f"[apply_filters_in_memory] Applying {len(filters)} filters to {len(df)} rows")

    for filter_obj in filters:
        field_name = filter_obj.field
        operator = filter_obj.operator
        filter_value = filter_obj.value

        # Skip if field not in DataFrame
        if field_name not in df.columns:
            logger.warning(f"[apply_filters_in_memory] Field '{field_name}' not in DataFrame, skipping")
            continue

        # Extract actual value from RowDataValue
        if filter_value.HasField('text_value'):
            raw_value = filter_value.text_value
        elif filter_value.HasField('number_value'):
            raw_value = filter_value.number_value
        elif filter_value.HasField('boolean_value'):
            raw_value = filter_value.boolean_value
        elif filter_value.HasField('date_value'):
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
                df = df.filter(pl.col(field_name).str.to_lowercase().str.contains(str(raw_value).lower()))
            else:
                logger.warning(f"[apply_filters_in_memory] Unsupported operator {operator} for field '{field_name}'")

        except Exception as e:
            logger.error(f"[apply_filters_in_memory] Error applying filter on field '{field_name}': {e}")
            continue

    logger.debug(f"[apply_filters_in_memory] Filtered result: {len(df)} rows")
    return df


def apply_like_ilike_filters(
    df: pl.DataFrame,
    filters: List[table_service_pb2.RowFilter]
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
    ilike_filters = [f for f in filters if f.operator == table_service_pb2.FILTER_OP_ILIKE]
    
    # Check if we have a text search pattern (multiple ILIKE filters with same search term)
    is_text_search = False
    if len(ilike_filters) > 1:
        search_terms = set()
        for f in ilike_filters:
            value = f.value.text_value if f.value.HasField('text_value') else ''
            search_terms.add(value.replace('%', ''))
        
        if len(search_terms) == 1:
            is_text_search = True
            search_term = search_terms.pop()
            
            # Build OR condition: field1.contains(term) OR field2.contains(term) OR ...
            or_condition = None
            for f in ilike_filters:
                field_condition = pl.col(f.field).str.contains(f'(?i){search_term}')
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
                value = filter_obj.value.text_value if filter_obj.value.HasField('text_value') else ''
                search_term = value.replace('%', '')
                df = df.filter(pl.col(filter_obj.field).str.contains(f'(?i){search_term}'))
            
            elif filter_obj.operator == table_service_pb2.FILTER_OP_LIKE:
                value = filter_obj.value.text_value if filter_obj.value.HasField('text_value') else ''
                search_term = value.replace('%', '')
                df = df.filter(pl.col(filter_obj.field).str.contains(search_term))
    return df

def apply_aggregations(
    df: pl.DataFrame,
    aggregation: table_service_pb2.AggregationConfig
) -> pl.DataFrame:
    """Apply aggregation operations to DataFrame.
    
    Args:
        df: Polars DataFrame to aggregate
        aggregation: AggregationConfig from protobuf
        
    Returns:
        Aggregated Polars DataFrame
    """
    logger.info(f"[apply_aggregations] Applying {len(aggregation.aggregations)} aggregation functions")
    
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
            logger.warning(f"[apply_aggregations] Unknown aggregation type: {agg_func.type}")
            continue
    
    # Apply aggregation
    if len(aggregation.group_by_fields) > 0:
        # GROUP BY aggregation (for dashboard views with multiple groups)
        logger.info(f"[apply_aggregations] Applying GROUP BY aggregation on fields: {list(aggregation.group_by_fields)}")
        df = df.group_by(list(aggregation.group_by_fields)).agg(agg_exprs)
    else:
        # Global aggregation (single row result for metric views)
        logger.info(f"[apply_aggregations] Applying global aggregation (no GROUP BY)")
        df = df.select(agg_exprs)
    
    logger.info(f"[apply_aggregations] Aggregation complete, result shape: {df.shape}")
    return df


def write_with_schema_evolution(
    s3_uri: str,
    data: pa.Table,
    mode: str,
    storage_options: Dict[str, str]
) -> None:
    """Write data to Delta Lake with schema evolution support.

    Args:
        s3_uri: S3 URI to write to
        data: Arrow table to write
        mode: Write mode ('append' or 'overwrite')
        storage_options: S3 storage options
    """
    logger.info(f"[write_with_schema_evolution] Writing {len(data)} rows with mode={mode}, schema_evolution=enabled")

    # Normalize strings to large_string before writing
    normalized_data = normalize_arrow_table_to_large_string(data)

    # Write with schema evolution
    write_deltalake(
        s3_uri, 
        normalized_data, 
        mode=mode,  # type: ignore
        schema_mode="merge", 
        storage_options=storage_options
    )

    logger.info(f"[write_with_schema_evolution] Successfully wrote {len(data)} rows to {s3_uri}")


def write_with_merge_operation(
    s3_uri: str,
    update_data: pa.Table,
    storage_options: Dict[str, str]
) -> None:
    """Write data using Delta Lake merge operation to update specific rows only.

    Args:
        s3_uri: S3 URI of the Delta table
        update_data: Arrow table with rows to update (must include 'id' column)
        storage_options: S3 storage options
    """
    logger.info(f"[write_with_merge_operation] Merging {len(update_data)} rows to {s3_uri}")
    
    # Load existing Delta table
    delta_table = DeltaTable(s3_uri, storage_options=storage_options)
    
    # Convert update data to pandas for merge operation
    update_df = update_data.to_pandas()
    
    # Get current data
    current_data = delta_table.to_pyarrow_table().to_pandas()
    
    # Perform merge: update rows where id matches, keep others unchanged
    # This is a simplified merge - for production, use Delta Lake's native merge when available
    if 'id' in update_df.columns and 'id' in current_data.columns:
        # Debug logging
        logger.info(f"[write_with_merge_operation] Before merge: current_rows={len(current_data)}, update_rows={len(update_df)}")
        
        # Remove rows that will be updated from current data
        current_ids = set(current_data['id'].astype(str))
        update_ids = set(update_df['id'].astype(str))
        rows_to_remove = current_ids.intersection(update_ids)
        
        logger.info(f"[write_with_merge_operation] ID analysis: current_ids={current_ids}, update_ids={update_ids}, rows_to_remove={rows_to_remove}")
        
        # Filter out rows that will be updated
        current_data = current_data[~current_data['id'].astype(str).isin(list(rows_to_remove))]
        
        # Append updated rows
        merged_data = pd.concat([current_data, update_df], ignore_index=True)
        
        logger.info(f"[write_with_merge_operation] After merge: final_rows={len(merged_data)}")
    else:
        # Fallback: just append if no id column
        logger.warning("[write_with_merge_operation] No 'id' column found, falling back to append")
        merged_data = pd.concat([current_data, update_df], ignore_index=True)
    
    # Convert back to Arrow and write with overwrite
    merged_arrow = pa.Table.from_pandas(merged_data)
    normalized_data = normalize_arrow_table_to_large_string(merged_arrow)
    
    # Write merged data
    write_deltalake(
        s3_uri,
        normalized_data,
        mode="overwrite",  # type: ignore
        storage_options=storage_options
    )
    
    logger.info(f"[write_with_merge_operation] Successfully merged {len(update_data)} rows")


def prepare_table_stats(s3_uri: str, storage_options: Dict[str, str]) -> Dict[str, Any]:
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
            'row_count': len(df),
            'column_count': len(df.columns),
            'size_bytes': arrow_table.nbytes,
            'columns': []
        }

        # Column-level statistics
        for col_name in df.columns:
            col_stats = {
                'name': col_name,
                'dtype': str(df[col_name].dtype),
                'null_count': df[col_name].null_count(),
                'unique_count': df[col_name].n_unique()
            }
            stats['columns'].append(col_stats)

        logger.info(f"[prepare_table_stats] Table stats: {stats['row_count']} rows, {stats['column_count']} columns")
        return stats

    except Exception as e:
        logger.error(f"[prepare_table_stats] Error calculating stats: {e}")
        return {
            'row_count': 0,
            'column_count': 0,
            'size_bytes': 0,
            'error': str(e)
        }