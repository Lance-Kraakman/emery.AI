"""
Mutation Operations

Data creation, update, and deletion operations for Delta Lake tables.
Handles all CRUD operations with proper validation and error handling.
"""

import logging
from typing import List, Dict, Any, Tuple
import polars as pl
import pyarrow as pa
from deltalake import write_deltalake, DeltaTable

from ..generated import table_service_pb2
from .transform import (
    convert_dataframe_to_arrow, 
    normalize_arrow_table_to_large_string
)
from .schema import get_delta_schema_as_pyarrow, create_dataframe_with_schema
from .validate import validate_row_data

logger = logging.getLogger(__name__)


def prepare_create_rows(
    rows_data: List[table_service_pb2.RowData],
    delta_table: DeltaTable
) -> Tuple[pl.DataFrame, pa.Table]:
    """Prepare data for CreateRows operation.
    
    Process:
    1. Validate row data against table schema
    2. Create DataFrame with schema-aware conversion
    3. Detect data anomalies
    4. Convert DataFrame to Arrow Table with proper types
    5. Normalize strings to large_string for Delta Lake compatibility
    
    Args:
        rows_data: List of RowData protobuf objects
        delta_table: DeltaTable instance with existing schema
        
    Returns:
        Tuple of (polars_dataframe, arrow_table)
        
    Raises:
        ValueError: If row data validation fails
    """
    logger.info(f"[prepare_create_rows] Preparing {len(rows_data)} rows for creation")
    
    # Step 1: Validate row data against schema
    schema = get_delta_schema_as_pyarrow(delta_table)
    is_valid, error_msg = validate_row_data(rows_data, schema, "CreateRows")
    if not is_valid:
        raise ValueError(f"Row data validation failed: {error_msg}")

    # Step 2: Create DataFrame with schema-aware conversion
    df = create_dataframe_with_schema(rows_data, delta_table)
    
    # Step 3: Detect any data anomalies
    from .validate import detect_data_anomalies
    anomalies = detect_data_anomalies(df, "CreateRows")
    if anomalies:
        for anomaly in anomalies:
            logger.warning(anomaly)

    # Step 4: Convert to Arrow Table with proper types
    arrow_table = convert_dataframe_to_arrow(df, normalize_strings=True)
    
    logger.info(f"[prepare_create_rows] Prepared DataFrame: {df.shape}, Arrow: {arrow_table.shape}")
    return df, arrow_table


def prepare_update_rows(
    rows_data: List[table_service_pb2.RowData],
    delta_table: DeltaTable
) -> Tuple[pl.DataFrame, pa.Table]:
    """Prepare data for UpdateRows operation.
    
    Process:
    1. Validate row data against table schema
    2. Create DataFrame with schema-aware conversion
    3. Detect data anomalies
    4. Convert DataFrame to Arrow Table with proper types
    5. Normalize strings to large_string for Delta Lake compatibility
    
    Args:
        rows_data: List of RowData protobuf objects
        delta_table: DeltaTable instance with existing schema
        
    Returns:
        Tuple of (polars_dataframe, arrow_table)
        
    Raises:
        ValueError: If row data validation fails
    """
    logger.info(f"[prepare_update_rows] Preparing {len(rows_data)} rows for update")
    
    # Step 1: Validate row data against schema
    schema = get_delta_schema_as_pyarrow(delta_table)
    is_valid, error_msg = validate_row_data(rows_data, schema, "UpdateRows")
    if not is_valid:
        raise ValueError(f"Row data validation failed: {error_msg}")

    # Step 2: Create DataFrame with schema-aware conversion
    df = create_dataframe_with_schema(rows_data, delta_table)
    
    # Step 3: Detect any data anomalies
    from .validate import detect_data_anomalies
    anomalies = detect_data_anomalies(df, "UpdateRows")
    if anomalies:
        for anomaly in anomalies:
            logger.warning(anomaly)

    # Step 4: Convert to Arrow Table with proper types
    arrow_table = convert_dataframe_to_arrow(df, normalize_strings=True)
    
    logger.info(f"[prepare_update_rows] Prepared DataFrame: {df.shape}, Arrow: {arrow_table.shape}")
    return df, arrow_table