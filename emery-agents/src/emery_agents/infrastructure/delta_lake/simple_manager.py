"""
Simplified Delta Lake implementation using deltalake library without Spark.
Provides Delta Lake operations backed by PostgreSQL for metadata and local storage for data.
"""

import os
import json
import time
from typing import Optional, Dict, Any, List
from deltalake import DeltaTable, write_deltalake
import pandas as pd
import logging

logger = logging.getLogger(__name__)

class SimpleDeltaLakeConfig:
    """Configuration for simplified Delta Lake setup."""
    
    def __init__(self):
        # PostgreSQL configuration (for metadata tracking)
        # SECURITY: Password must be provided via environment variable
        self.postgres_host = os.getenv("POSTGRES_HOST", "localhost")
        self.postgres_port = int(os.getenv("POSTGRES_PORT", "5433"))
        self.postgres_db = os.getenv("POSTGRES_DB", "emery")
        self.postgres_user = os.getenv("POSTGRES_USER", "postgres")
        self.postgres_password = os.environ.get("POSTGRES_PASSWORD")
        if not self.postgres_password:
            raise ValueError("POSTGRES_PASSWORD environment variable is required")
        
        # Local storage for Delta tables
        self.delta_storage_path = os.getenv("DELTA_STORAGE_PATH", "/tmp/emery_delta_lake")
        
        # Ensure storage directory exists
        os.makedirs(self.delta_storage_path, exist_ok=True)
        
    @property
    def tables_path(self) -> str:
        """Get path for table metadata Delta tables."""
        return os.path.join(self.delta_storage_path, "tables")
    
    @property
    def rows_path(self) -> str:
        """Get path for row data Delta tables."""
        return os.path.join(self.delta_storage_path, "rows")

class SimpleDeltaLakeManager:
    """Simplified Delta Lake manager using pandas and deltalake library."""
    
    def __init__(self, config: Optional[SimpleDeltaLakeConfig] = None):
        self.config = config or SimpleDeltaLakeConfig()
        self._ensure_directories()
        
    def _ensure_directories(self) -> None:
        """Ensure storage directories exist."""
        os.makedirs(self.config.tables_path, exist_ok=True)
        os.makedirs(self.config.rows_path, exist_ok=True)
        logger.info(f"Delta Lake storage directories created at: {self.config.delta_storage_path}")
    
    def create_table_delta(self, table_data: Dict[str, Any]) -> str:
        """Create a Delta table for table metadata."""
        try:
            table_path = os.path.join(self.config.tables_path, table_data["table_id"])
            
            # Create DataFrame with table data
            df = pd.DataFrame([table_data])
            
            # Convert timestamp columns
            if "created_at_ms" in df.columns:
                df["created_at_ms"] = pd.to_datetime(df["created_at_ms"], unit="ms")
            if "updated_at_ms" in df.columns:
                df["updated_at_ms"] = pd.to_datetime(df["updated_at_ms"], unit="ms")
            
            # Write as Delta table
            write_deltalake(table_path, df, mode="overwrite")
            
            logger.info(f"✅ Created Delta table for table: {table_data['table_id']}")
            return table_path
            
        except Exception as e:
            logger.error(f"❌ Failed to create Delta table for {table_data.get('table_id', 'unknown')}: {str(e)}")
            raise
    
    def get_table_delta(self, table_id: str) -> Optional[DeltaTable]:
        """Get Delta table for table metadata."""
        try:
            table_path = os.path.join(self.config.tables_path, table_id)
            
            # Check if table exists
            if DeltaTable.is_deltatable(table_path):
                return DeltaTable(table_path)
            else:
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get Delta table for {table_id}: {str(e)}")
            return None
    
    def update_table_delta(self, table_id: str, update_data: Dict[str, Any]) -> None:
        """Update table metadata in Delta table."""
        try:
            table_path = os.path.join(self.config.tables_path, table_id)
            delta_table = DeltaTable(table_path)
            
            # Convert update data to DataFrame
            df = pd.DataFrame([update_data])
            
            # Convert timestamp columns
            if "created_at_ms" in df.columns:
                df["created_at_ms"] = pd.to_datetime(df["created_at_ms"], unit="ms")
            if "updated_at_ms" in df.columns:
                df["updated_at_ms"] = pd.to_datetime(df["updated_at_ms"], unit="ms")
            
            # Update Delta table (overwrite for simplicity)
            write_deltalake(table_path, df, mode="overwrite", schema_mode="overwrite")
            
            logger.info(f"✅ Updated Delta table for table: {table_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to update Delta table for {table_id}: {str(e)}")
            raise
    
    def create_row_delta(self, table_id: str, row_data: Dict[str, Any]) -> str:
        """Create/add a row in the Delta table for a specific table."""
        try:
            rows_table_path = os.path.join(self.config.rows_path, table_id)
            
            # Create DataFrame with row data
            df = pd.DataFrame([row_data])
            
            # Convert timestamp columns
            if "created_at_ms" in df.columns:
                df["created_at_ms"] = pd.to_datetime(df["created_at_ms"], unit="ms")
            if "updated_at_ms" in df.columns:
                df["updated_at_ms"] = pd.to_datetime(df["updated_at_ms"], unit="ms")
            
            # Write as Delta table (append if exists, overwrite if new)
            mode = "append" if DeltaTable.is_deltatable(rows_table_path) else "overwrite"
            write_deltalake(rows_table_path, df, mode=mode)
            
            logger.info(f"✅ Created row {row_data['row_id']} in Delta table for table: {table_id}")
            return rows_table_path
            
        except Exception as e:
            logger.error(f"❌ Failed to create row in Delta table for {table_id}: {str(e)}")
            raise
    
    def get_row_delta(self, table_id: str) -> Optional[DeltaTable]:
        """Get Delta table for row data."""
        try:
            rows_table_path = os.path.join(self.config.rows_path, table_id)
            
            # Check if table exists
            if DeltaTable.is_deltatable(rows_table_path):
                return DeltaTable(rows_table_path)
            else:
                return None
                
        except Exception as e:
            logger.error(f"❌ Failed to get Delta table for rows in {table_id}: {str(e)}")
            return None
    
    def get_rows(self, table_id: str, limit: Optional[int] = None, offset: Optional[int] = None, 
                 filter_json: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get rows from Delta table with pagination and filtering."""
        try:
            rows_table_path = os.path.join(self.config.rows_path, table_id)
            
            if not DeltaTable.is_deltatable(rows_table_path):
                return []
            
            delta_table = DeltaTable(rows_table_path)
            
            # Read data as pandas DataFrame
            df = delta_table.to_pandas()
            
            # Filter out deleted rows
            df = df[df["is_deleted"] != True]
            
            # Apply filtering if provided
            if filter_json:
                try:
                    filter_criteria = json.loads(filter_json)
                    for key, value in filter_criteria.items():
                        # Parse JSON data and filter
                        df["data_parsed"] = df["data_json"].apply(json.loads)
                        mask = df["data_parsed"].apply(lambda x: x.get(key) == value)
                        df = df[mask]
                        df = df.drop("data_parsed", axis=1)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid filter JSON: {filter_json}")
            
            # Apply sorting (simple by updated_at_ms for now)
            df = df.sort_values("updated_at_ms", ascending=False)
            
            # Apply pagination
            if offset:
                df = df.iloc[offset:]
            if limit:
                df = df.head(limit)
            
            # Convert timestamps back to milliseconds and datetime to string
            if "created_at_ms" in df.columns:
                df["created_at_ms"] = df["created_at_ms"].astype("int64") // 1000000
            if "updated_at_ms" in df.columns:
                df["updated_at_ms"] = df["updated_at_ms"].astype("int64") // 1000000
            
            # Convert to list of dictionaries
            rows = df.to_dict("records")
            
            logger.info(f"✅ Retrieved {len(rows)} rows from Delta table for table: {table_id}")
            return rows
            
        except Exception as e:
            logger.error(f"❌ Failed to get rows from Delta table for {table_id}: {str(e)}")
            return []
    
    def get_row_by_id(self, table_id: str, row_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific row by ID."""
        try:
            rows_table_path = os.path.join(self.config.rows_path, table_id)
            
            if not DeltaTable.is_deltatable(rows_table_path):
                return None
            
            delta_table = DeltaTable(rows_table_path)
            
            # Read data as pandas DataFrame
            df = delta_table.to_pandas()
            
            # Filter by row_id and not deleted
            row = df[(df["row_id"] == row_id) & (df["is_deleted"] != True)]
            
            if row.empty:
                return None
            
            # Convert timestamps back to milliseconds
            row_dict = row.iloc[0].to_dict()
            if "created_at_ms" in row_dict:
                row_dict["created_at_ms"] = int(row_dict["created_at_ms"].timestamp() * 1000)
            if "updated_at_ms" in row_dict:
                row_dict["updated_at_ms"] = int(row_dict["updated_at_ms"].timestamp() * 1000)
            
            logger.info(f"✅ Retrieved row {row_id} from Delta table for table: {table_id}")
            return row_dict
            
        except Exception as e:
            logger.error(f"❌ Failed to get row {row_id} from Delta table for {table_id}: {str(e)}")
            return None
    
    def update_row_delta(self, table_id: str, row_id: str, update_data: Dict[str, Any]) -> None:
        """Update a row in the Delta table."""
        try:
            rows_table_path = os.path.join(self.config.rows_path, table_id)
            
            if not DeltaTable.is_deltatable(rows_table_path):
                raise ValueError(f"Delta table for table {table_id} does not exist")
            
            # Read existing data
            delta_table = DeltaTable(rows_table_path)
            df = delta_table.to_pandas()
            
            # Find and update the row
            mask = (df["row_id"] == row_id) & (df["is_deleted"] != True)
            if not mask.any():
                raise ValueError(f"Row {row_id} not found in table {table_id}")
            
            # Update row data
            for key, value in update_data.items():
                df.loc[mask, key] = value
            
            # Convert timestamp columns
            if "created_at_ms" in df.columns:
                df["created_at_ms"] = pd.to_datetime(df["created_at_ms"], unit="ms")
            if "updated_at_ms" in df.columns:
                df["updated_at_ms"] = pd.to_datetime(df["updated_at_ms"], unit="ms")
            
            # Write back to Delta table
            write_deltalake(rows_table_path, df, mode="overwrite", schema_mode="overwrite")
            
            logger.info(f"✅ Updated row {row_id} in Delta table for table: {table_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to update row {row_id} in Delta table for {table_id}: {str(e)}")
            raise
    
    def delete_row_delta(self, table_id: str, row_id: str, soft_delete: bool = True) -> None:
        """Delete a row from the Delta table."""
        try:
            rows_table_path = os.path.join(self.config.rows_path, table_id)
            
            if not DeltaTable.is_deltatable(rows_table_path):
                raise ValueError(f"Delta table for table {table_id} does not exist")
            
            # Read existing data
            delta_table = DeltaTable(rows_table_path)
            df = delta_table.to_pandas()
            
            # Find and mark as deleted (soft delete) or remove (hard delete)
            mask = (df["row_id"] == row_id) & (df["is_deleted"] != True)
            if not mask.any():
                raise ValueError(f"Row {row_id} not found in table {table_id}")
            
            if soft_delete:
                df.loc[mask, "is_deleted"] = True
                df.loc[mask, "updated_at_ms"] = pd.Timestamp.now()
            else:
                df = df[~mask]
            
            # Convert timestamp columns
            if "created_at_ms" in df.columns:
                df["created_at_ms"] = pd.to_datetime(df["created_at_ms"], unit="ms")
            if "updated_at_ms" in df.columns:
                df["updated_at_ms"] = pd.to_datetime(df["updated_at_ms"], unit="ms")
            
            # Write back to Delta table
            write_deltalake(rows_table_path, df, mode="overwrite", schema_mode="overwrite")
            
            logger.info(f"✅ {'Soft deleted' if soft_delete else 'Hard deleted'} row {row_id} in Delta table for table: {table_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to delete row {row_id} in Delta table for {table_id}: {str(e)}")
            raise
    
    def list_tables(self, organization_id: str, limit: Optional[int] = None, 
                   offset: Optional[int] = None, search_term: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all tables for an organization."""
        try:
            # Get all table directories
            table_dirs = [d for d in os.listdir(self.config.tables_path) 
                         if os.path.isdir(os.path.join(self.config.tables_path, d))]
            
            tables = []
            for table_id in table_dirs:
                try:
                    delta_table = DeltaTable(os.path.join(self.config.tables_path, table_id))
                    df = delta_table.to_pandas()
                    
                    # Filter by organization and not deleted
                    df = df[(df["organization_id"] == organization_id) & (df["is_deleted"] != True)]
                    
                    if not df.empty:
                        table_dict = df.iloc[0].to_dict()
                        
                        # Convert timestamps back to milliseconds
                        if "created_at_ms" in table_dict:
                            table_dict["created_at_ms"] = int(table_dict["created_at_ms"].timestamp() * 1000)
                        if "updated_at_ms" in table_dict:
                            table_dict["updated_at_ms"] = int(table_dict["updated_at_ms"].timestamp() * 1000)
                        
                        # Apply search filter
                        if search_term:
                            search_lower = search_term.lower()
                            if (search_lower in table_dict.get("name", "").lower() or 
                                search_lower in table_dict.get("description", "").lower()):
                                tables.append(table_dict)
                        else:
                            tables.append(table_dict)
                            
                except Exception as e:
                    logger.warning(f"Failed to read table {table_id}: {str(e)}")
                    continue
            
            # Sort by updated_at_ms
            tables.sort(key=lambda x: x.get("updated_at_ms", 0), ascending=True)
            
            # Apply pagination
            if offset:
                tables = tables[offset:]
            if limit:
                tables = tables[:limit]
            
            logger.info(f"✅ Listed {len(tables)} tables for organization: {organization_id}")
            return tables
            
        except Exception as e:
            logger.error(f"❌ Failed to list tables for organization {organization_id}: {str(e)}")
            return []

# Global Delta Lake manager instance
_delta_manager: Optional[SimpleDeltaLakeManager] = None

def get_delta_manager() -> SimpleDeltaLakeManager:
    """Get global Delta Lake manager instance."""
    global _delta_manager
    if _delta_manager is None:
        _delta_manager = SimpleDeltaLakeManager()
    return _delta_manager