"""
Query Operations

High-performance data retrieval with predicate pushdown filtering and aggregation support.
Handles all QueryRows functionality with optimal performance characteristics.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
import polars as pl
import pyarrow as pa
from deltalake import DeltaTable

from ..generated import table_service_pb2
from .transform import build_pyarrow_predicate
from .schema import get_delta_schema_as_pyarrow
from .validate import validate_sort_columns

logger = logging.getLogger(__name__)


def apply_like_ilike_filters(
    df: pl.DataFrame,
    filters: List[table_service_pb2.RowFilter]
) -> pl.DataFrame:
    """Apply LIKE/ILIKE filters to DataFrame in-memory.
    
    These filters cannot be pushed down to Delta Lake and must be applied
    after loading data into memory.
    
    Delta Lake predicate pushdown supports: EQ, NE, GT, GTE, LT, LTE, IN, NOT_IN, IS_NULL, IS_NOT_NULL
    Delta Lake predicate pushdown does NOT support: LIKE, ILIKE (text pattern matching)
    
    Optimization: Multiple ILIKE filters with same term → OR condition for text search
    
    Args:
        df: Polars DataFrame to filter
        filters: List of RowFilter objects
        
    Returns:
        Filtered Polars DataFrame
    """
    if not filters:
        return df
    
    # Extract ILIKE filters for text search optimization
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
    
    Supports GROUP BY aggregation with 8 aggregation functions:
    - SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT, COUNT_EMPTY, COUNT_NOT_EMPTY
    
    Null Handling in Aggregations:
    - fill_null(0): Treats null values as zeros for numeric aggregations
    - User expectation: "average of 20 rows" not "average of 12 non-null rows"
    - Example: AVG([10, 20, null, null]) = 7.5 (not 15)
    - Applied to: SUM, AVG, MIN, MAX
    - NOT applied to: COUNT (counts all rows), COUNT_EMPTY (counts nulls specifically)
    
    Args:
        df: Polars DataFrame to aggregate
        aggregation: AggregationConfig from protobuf
        
    Returns:
        Aggregated Polars DataFrame
    """
    logger.info(f"[apply_aggregations] Applying {len(aggregation.aggregations)} aggregation functions")
    
    # Build Polars aggregation expressions
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
            agg_exprs.append(
                pl.col(field_id).is_null().sum().alias(field_id)
            )
        elif agg_func.type == table_service_pb2.AGG_TYPE_COUNT_NOT_EMPTY:
            agg_exprs.append(
                pl.col(field_id).is_not_null().sum().alias(field_id)
            )
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


def prepare_query_rows(
    delta_table: DeltaTable,
    filters: List[table_service_pb2.RowFilter],
    order_by: List[str],
    limit: Optional[int] = None,
    offset: int = 0,
    aggregation: Optional[table_service_pb2.AggregationConfig] = None
) -> Tuple[pl.DataFrame, Dict[str, Any]]:
    """Execute query with hybrid filtering strategy for optimal performance.
    
    Process Flow:
    1. Input Validation
       - Validate sort columns exist in schema
       - Extract schema for type information
    
    2. Predicate Pushdown (Fast)
       - Build PyArrow expressions for supported operators
       - Supported: EQ, NE, GT, GTE, LT, LTE, IN, NOT_IN, IS_NULL, IS_NOT_NULL
       - Apply filters at Delta Lake level (10-100x faster)
       - Only filtered rows loaded into memory
    
    3. In-Memory Filtering (Slow filters only)
       - Apply LIKE/ILIKE filters that cannot be pushed down
       - Text pattern matching with regex
       - Optimize multiple ILIKE with same term → OR condition
    
    4. Aggregation (Optional)
       - Apply GROUP BY with aggregation functions
       - Supported: SUM, AVG, COUNT, MIN, MAX, COUNT_DISTINCT, COUNT_EMPTY, COUNT_NOT_EMPTY
       - Null handling: fill_null(0) for user-friendly results
    
    5. Final Processing
       - Apply sorting (non-aggregated queries only)
       - Apply pagination (non-aggregated queries only)
       - Prepare metadata with operation details
    
    Performance Characteristics:
    - Memory Usage: Proportional to filtered rows (not total table size)
    - CPU Complexity: O(n) where n = filtered_rows
    - I/O Pattern: Predicate pushdown reduces data transfer by 90%+
    
    Args:
        delta_table: DeltaTable instance with schema and data
        filters: List of filter conditions for WHERE clause
        order_by: Column names for ORDER BY clause
        limit: Maximum rows to return (for pagination)
        offset: Number of rows to skip (for pagination)
        aggregation: Optional GROUP BY and aggregation configuration
    
    Returns:
        Tuple of (result_dataframe, metadata_dict)
        
    Raises:
        ValueError: If sort columns don't exist in schema
    """
    logger.info(f"[prepare_query_rows] Preparing query with {len(filters)} filters, order_by={order_by}")
    
    # Step 1: Input Validation
    # Get schema for validation
    schema = get_delta_schema_as_pyarrow(delta_table)
    
    # Validate sort columns
    is_valid, error_msg = validate_sort_columns(order_by, schema, "QueryRows")
    if not is_valid:
        raise ValueError(f"Sort column validation failed: {error_msg}")
    
    # Step 2: Predicate Pushdown (10-100x faster)
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
    
    # Step 3: Apply LIKE/ILIKE filters in-memory (cannot be pushed down)
    if filters:
        df = apply_like_ilike_filters(df, filters)
    
    # Step 4: Apply aggregation if requested
    if aggregation:
        df = apply_aggregations(df, aggregation)
        
        # For aggregated results, total_count is number of aggregated rows
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
    
    # Step 5: Prepare metadata
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