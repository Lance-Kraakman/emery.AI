"""
Statistics Operations

Table statistics and metadata operations including row counts, 
table sizes, and other analytical information.
"""

import logging
from typing import Dict, Any, Optional
import pyarrow as pa
from deltalake import DeltaTable

logger = logging.getLogger(__name__)


def prepare_table_stats(
    delta_table: DeltaTable
) -> Dict[str, Any]:
    """Prepare comprehensive table statistics.
    
    Process:
    1. Get row count from Delta table metadata
    2. Calculate table size in bytes
    3. Get schema information
    4. Collect file-level statistics
    5. Return comprehensive stats dictionary
    
    Args:
        delta_table: DeltaTable instance to analyze
        
    Returns:
        Dictionary containing table statistics
    """
    logger.info("[prepare_table_stats] Collecting table statistics")
    
    try:
        # Step 1: Get basic table info
        table_uri = delta_table.table_uri()
        version = delta_table.version()
        
        # Step 2: Get row count (efficient method)
        try:
            # Use Delta Lake's optimized count if available
            row_count = len(delta_table.to_pyarrow_table(columns=[]))
        except Exception as e:
            logger.warning(f"[prepare_table_stats] Could not get accurate row count: {e}")
            row_count = 0
        
        # Step 3: Get table size
        try:
            # Get size from Delta table files
            size_bytes = sum(
                file.get('size', 0) 
                for file in delta_table.files()
            )
        except Exception as e:
            logger.warning(f"[prepare_table_stats] Could not calculate table size: {e}")
            size_bytes = 0
        
        # Step 4: Get schema information
        schema = delta_table.schema().to_arrow()
        field_count = len(schema.names)
        field_types = {
            field.name: str(field.type) 
            for field in schema
        }
        
        # Step 5: Get file statistics
        try:
            files = delta_table.files()
            file_count = len(files)
            file_stats = {
                'file_count': file_count,
                'avg_file_size': size_bytes / file_count if file_count > 0 else 0
            }
        except Exception as e:
            logger.warning(f"[prepare_table_stats] Could not get file stats: {e}")
            file_stats = {'file_count': 0, 'avg_file_size': 0}
        
        # Step 6: Compile comprehensive stats
        stats = {
            'table_uri': table_uri,
            'version': version,
            'row_count': row_count,
            'size_bytes': size_bytes,
            'size_mb': round(size_bytes / (1024 * 1024), 2),
            'field_count': field_count,
            'field_types': field_types,
            'file_stats': file_stats,
            'metadata': {
                'partition_columns': delta_table.metadata().partition_columns,
                'configuration': dict(delta_table.metadata().configuration)
            }
        }
        
        logger.info(f"[prepare_table_stats] Collected stats: {row_count} rows, {size_bytes} bytes, {field_count} fields")
        return stats
        
    except Exception as e:
        logger.error(f"[prepare_table_stats] Error collecting table stats: {e}")
        return {
            'error': str(e),
            'row_count': 0,
            'size_bytes': 0,
            'field_count': 0
        }


def prepare_field_stats(
    delta_table: DeltaTable,
    field_name: str
) -> Dict[str, Any]:
    """Prepare statistics for a specific field.
    
    Process:
    1. Validate field exists in table
    2. Load field data efficiently
    3. Calculate field-specific statistics
    4. Return field statistics dictionary
    
    Args:
        delta_table: DeltaTable instance
        field_name: Name of the field to analyze
        
    Returns:
        Dictionary containing field statistics
        
    Raises:
        ValueError: If field does not exist in table
    """
    logger.info(f"[prepare_field_stats] Collecting statistics for field '{field_name}'")
    
    try:
        # Step 1: Validate field exists
        schema = delta_table.schema().to_arrow()
        if field_name not in schema.names:
            raise ValueError(f"Field '{field_name}' not found in table")
        
        field_type = schema.field(field_name).type
        
        # Step 2: Load field data (just this column for efficiency)
        try:
            arrow_table = delta_table.to_pyarrow_table(columns=[field_name])
            column = arrow_table.column(field_name)
        except Exception as e:
            logger.warning(f"[prepare_field_stats] Could not load field data: {e}")
            return {
                'field_name': field_name,
                'field_type': str(field_type),
                'error': str(e)
            }
        
        # Step 3: Calculate basic statistics
        total_count = len(column)
        null_count = column.null_count
        valid_count = total_count - null_count
        
        # Step 4: Type-specific statistics (simplified)
        if pa.types.is_string(field_type) or pa.types.is_large_string(field_type):
            data_type = 'string'
        elif pa.types.is_integer(field_type) or pa.types.is_floating(field_type):
            data_type = 'numeric'
        elif pa.types.is_boolean(field_type):
            data_type = 'boolean'
        else:
            data_type = 'other'
        
        # Step 5: Compile stats
        stats = {
            'field_name': field_name,
            'field_type': str(field_type),
            'data_type': data_type,
            'total_count': total_count,
            'null_count': null_count,
            'valid_count': valid_count,
            'null_percentage': round((null_count / total_count * 100), 2) if total_count > 0 else 0
        }
        
        logger.info(f"[prepare_field_stats] Collected field stats for '{field_name}': {valid_count} valid values")
        return stats
        
    except Exception as e:
        logger.error(f"[prepare_field_stats] Error collecting field stats: {e}")
        return {
            'field_name': field_name,
            'error': str(e)
        }


def prepare_query_stats(
    delta_table: DeltaTable,
    filters: list = None,
    limit: Optional[int] = None
) -> Dict[str, Any]:
    """Prepare query execution statistics.
    
    Process:
    1. Execute query with timing
    2. Measure data processed
    3. Calculate filter effectiveness
    4. Return performance statistics
    
    Args:
        delta_table: DeltaTable instance
        filters: List of filters applied (optional)
        limit: Query limit (optional)
        
    Returns:
        Dictionary containing query statistics
    """
    import time
    
    logger.info("[prepare_query_stats] Collecting query statistics")
    
    start_time = time.time()
    
    try:
        # Step 1: Get total table size for comparison
        total_stats = prepare_table_stats(delta_table)
        total_rows = total_stats.get('row_count', 0)
        
        # Step 2: Execute query
        if filters:
            from .transform import build_pyarrow_predicate
            schema = delta_table.schema().to_arrow()
            predicate = build_pyarrow_predicate(filters, schema)
            arrow_table = delta_table.to_pyarrow_table(filters=predicate)
        else:
            arrow_table = delta_table.to_pyarrow_table()
        
        # Step 3: Apply limit if specified
        if limit:
            arrow_table = arrow_table.slice(0, limit)
        
        # Step 4: Calculate statistics
        execution_time = time.time() - start_time
        result_rows = len(arrow_table)
        
        stats = {
            'execution_time_seconds': round(execution_time, 3),
            'total_table_rows': total_rows,
            'result_rows': result_rows,
            'filter_effectiveness': round((1 - result_rows / total_rows) * 100, 2) if total_rows > 0 else 0,
            'rows_processed_per_second': round(result_rows / execution_time, 0) if execution_time > 0 else 0,
            'filters_applied': len(filters) if filters else 0,
            'limit_applied': limit
        }
        
        logger.info(f"[prepare_query_stats] Query completed: {result_rows} rows in {execution_time:.3f}s")
        return stats
        
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(f"[prepare_query_stats] Query error after {execution_time:.3f}s: {e}")
        return {
            'execution_time_seconds': round(execution_time, 3),
            'error': str(e),
            'result_rows': 0
        }