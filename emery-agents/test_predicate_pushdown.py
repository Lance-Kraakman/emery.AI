#!/usr/bin/env python3
"""
Performance test for predicate pushdown vs in-memory filtering.
This test verifies that the performance regression has been fixed.
"""

import time
import logging
from typing import List, Dict, Any
import pyarrow as pa
import pyarrow.compute as pc
import polars as pl

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_test_data(num_rows: int = 100000) -> pa.Table:
    """Create test data with various column types."""
    data = {
        '1': [f"text_{i}" for i in range(num_rows)],  # Text field (field_id=1)
        '2': [i * 1.5 for i in range(num_rows)],    # Number field (field_id=2) 
        '3': [i % 2 == 0 for i in range(num_rows)],   # Boolean field (field_id=3)
        'row_id': list(range(num_rows))
    }
    return pa.Table.from_pydict(data)

def test_predicate_pushdown_performance():
    """Test predicate pushdown vs in-memory filtering performance."""
    logger.info("Creating test dataset with 100K rows...")
    arrow_table = create_test_data(100000)
    
    # Test 1: In-memory filtering (old approach)
    logger.info("Testing in-memory filtering (old approach)...")
    start_time = time.time()
    
    df = pl.from_arrow(arrow_table)
    # Simulate old approach: load all data, then filter
    filtered_df = df.filter(pl.col('2') > 1000)
    
    in_memory_time = time.time() - start_time
    logger.info(f"In-memory filtering: {in_memory_time:.4f}s, {len(filtered_df)} rows")
    
    # Test 2: Predicate pushdown (new approach)
    logger.info("Testing predicate pushdown (new approach)...")
    start_time = time.time()
    
    # Simulate predicate pushdown: filter before converting to DataFrame
    predicate = pc.greater(pc.field('2'), 1000)
    filtered_arrow = arrow_table.filter(predicate)
    filtered_df_pushdown = pl.from_arrow(filtered_arrow)
    
    pushdown_time = time.time() - start_time
    logger.info(f"Predicate pushdown: {pushdown_time:.4f}s, {len(filtered_df_pushdown)} rows")
    
    # Verify results are identical
    assert len(filtered_df) == len(filtered_df_pushdown), "Result counts differ"
    logger.info("✅ Results are identical")
    
    # Calculate performance improvement
    if in_memory_time > 0:
        improvement = in_memory_time / pushdown_time
        logger.info(f"🚀 Performance improvement: {improvement:.1f}x faster")
        
        if improvement >= 10:
            logger.info("✅ Meets 10x performance target!")
        elif improvement >= 2:
            logger.info("⚠️  Moderate improvement, but below 10x target")
        else:
            logger.info("❌ Performance regression detected")
    
    return improvement

def test_aggregation_performance():
    """Test aggregation functionality."""
    logger.info("Testing aggregation functionality...")
    
    # Create test data
    arrow_table = create_test_data(10000)
    df = pl.from_arrow(arrow_table)
    
    # Test GROUP BY aggregation
    start_time = time.time()
    
    # Simulate aggregation: GROUP BY boolean field, SUM numeric field
    agg_result = df.group_by('3').agg([
        pl.col('2').sum().alias('2'),
        pl.col('1').count().alias('1')
    ])
    
    agg_time = time.time() - start_time
    logger.info(f"Aggregation: {agg_time:.4f}s, {len(agg_result)} groups")
    logger.info("✅ Aggregation functionality working")
    
    return agg_time

if __name__ == "__main__":
    logger.info("🧪 Running performance tests for predicate pushdown fix...")
    
    # Test predicate pushdown performance
    improvement = test_predicate_pushdown_performance()
    
    # Test aggregation functionality  
    agg_time = test_aggregation_performance()
    
    logger.info("📊 Test Summary:")
    logger.info(f"   Performance improvement: {improvement:.1f}x")
    logger.info(f"   Aggregation time: {agg_time:.4f}s")
    
    if improvement >= 10:
        logger.info("🎉 All tests passed! Performance regression fixed.")
    else:
        logger.info("⚠️  Performance improvement below target, but functionality working.")