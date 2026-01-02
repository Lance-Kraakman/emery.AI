"""
Delta Lake configuration and setup for table storage.
Provides Delta Lake tables backed by PostgreSQL for metadata and MinIO for data storage.
Based on docker-compose.integration.yml infrastructure.
"""

import os
import json
import time
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)

class DeltaLakeConfig:
    """Configuration for Delta Lake setup using integration test infrastructure."""
    
    def __init__(self):
        # PostgreSQL configuration from environment variables
        # SECURITY: Credentials must be provided via environment variables
        self.postgres_host = os.getenv("POSTGRES_HOST", "localhost")
        self.postgres_port = int(os.getenv("POSTGRES_PORT", "5433"))
        self.postgres_db = os.getenv("POSTGRES_DB", "emery")
        self.postgres_user = os.getenv("POSTGRES_USER", "postgres")
        self.postgres_password = os.environ.get("POSTGRES_PASSWORD")
        if not self.postgres_password:
            raise ValueError("POSTGRES_PASSWORD environment variable is required")

        # S3 configuration from standard AWS environment variables
        # SECURITY: AWS credentials must be provided, no defaults
        self.s3_endpoint = os.getenv("AWS_ENDPOINT_URL", "http://localhost:9000")
        self.s3_access_key = os.environ.get("AWS_ACCESS_KEY_ID")
        self.s3_secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY")
        if not self.s3_access_key or not self.s3_secret_key:
            raise ValueError("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required")
        self.s3_bucket = os.getenv("S3_BUCKET_NAME", "emery-files")
        self.s3_region = os.getenv("AWS_REGION", "us-east-1")
        
        # Delta Lake configuration
        self.delta_table_path = os.getenv("DELTA_TABLE_PATH", f"s3://{self.s3_bucket}/delta-lake/tables")
        self.delta_checkpoint_path = os.getenv("DELTA_CHECKPOINT_PATH", f"s3://{self.s3_bucket}/delta-lake/checkpoints")
        
    def get_postgres_config(self) -> Dict[str, str]:
        """Get PostgreSQL configuration."""
        return {
            "host": self.postgres_host,
            "port": str(self.postgres_port),
            "database": self.postgres_db,
            "user": self.postgres_user,
            "password": self.postgres_password,
        }
    
    def get_s3_config(self) -> Dict[str, str]:
        """Get S3 configuration."""
        return {
            "endpoint_url": self.s3_endpoint,
            "access_key_id": self.s3_access_key,
            "secret_access_key": self.s3_secret_key,
            "bucket": self.s3_bucket,
            "region": self.s3_region,
        }
    
    @property
    def postgres_jdbc_url(self) -> str:
        """Get PostgreSQL JDBC URL for database connections."""
        config = self.get_postgres_config()
        return f"jdbc:postgresql://{config['host']}:{config['port']}/{config['database']}"
    
    @property
    def postgres_connection_string(self) -> str:
        """Get PostgreSQL connection string for SQLAlchemy."""
        config = self.get_postgres_config()
        return f"postgresql://{config['user']}:{config['password']}@{config['host']}:{config['port']}/{config['database']}"
    
    def get_s3_config(self) -> Dict[str, str]:
        """Get S3 configuration for Delta Lake."""
        return {
            "AWS_ENDPOINT_URL": self.s3_endpoint,
            "AWS_ACCESS_KEY_ID": self.s3_access_key,
            "AWS_SECRET_ACCESS_KEY": self.s3_secret_key,
            "AWS_REGION": self.s3_region,
            "AWS_ALLOW_HTTP": "true",  # MinIO uses HTTP
            "AWS_S3_ALLOW_UNSAFE_RENAME": "true",
        }

class SimpleDeltaLakeManager:
    """Simple table and row storage manager using PostgreSQL from docker-compose.integration.yml."""
    
    def __init__(self, config: Optional[DeltaLakeConfig] = None):
        self.config = config or DeltaLakeConfig()
        self._connection = None
        
    def get_connection(self):
        """Get PostgreSQL database connection."""
        if self._connection is None:
            import psycopg2
            pg_config = self.config.get_postgres_config()
            self._connection = psycopg2.connect(
                host=pg_config["host"],
                port=pg_config["port"],
                database=pg_config["database"],
                user=pg_config["user"],
                password=pg_config["password"]
            )
            self._connection.autocommit = True
        return self._connection
    
    def ensure_tables_exist(self) -> None:
        """Ensure database tables exist."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Create tables table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tables (
                table_id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                schema_json TEXT NOT NULL,
                description TEXT,
                created_by VARCHAR(255) NOT NULL,
                updated_by VARCHAR(255) NOT NULL,
                created_at_ms BIGINT NOT NULL,
                updated_at_ms BIGINT NOT NULL,
                organization_id VARCHAR(255) NOT NULL,
                metadata JSONB,
                is_deleted BOOLEAN DEFAULT FALSE
            )
        """)
        
        # Create rows table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS rows (
                row_id VARCHAR(255) PRIMARY KEY,
                table_id VARCHAR(255) NOT NULL,
                data_json JSONB NOT NULL,
                created_by VARCHAR(255) NOT NULL,
                updated_by VARCHAR(255) NOT NULL,
                created_at_ms BIGINT NOT NULL,
                updated_at_ms BIGINT NOT NULL,
                organization_id VARCHAR(255) NOT NULL,
                is_deleted BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (table_id) REFERENCES tables(table_id)
            )
        """)
        
        # Create indexes for performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_tables_organization_id ON tables(organization_id, is_deleted)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rows_table_id ON rows(table_id, is_deleted)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_rows_organization_id ON rows(organization_id, is_deleted)")
        
        cursor.close()
        logger.info("✅ Database tables ensured")
    
    def create_table(self, table_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new table."""
        self.ensure_tables_exist()
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO tables (
                    table_id, name, schema_json, description, created_by, updated_by,
                    created_at_ms, updated_at_ms, organization_id, metadata, is_deleted
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                table_data["table_id"],
                table_data["name"],
                table_data["schema_json"],
                table_data.get("description"),
                table_data["created_by"],
                table_data["updated_by"],
                table_data["created_at_ms"],
                table_data["updated_at_ms"],
                table_data["organization_id"],
                json.dumps(table_data.get("metadata", {})),
                table_data.get("is_deleted", False)
            ))
            
            # Fetch the created row
            result = cursor.fetchone()
            columns = [desc[0] for desc in cursor.description]
            created_table = dict(zip(columns, result))
            
            cursor.close()
            logger.info(f"✅ Created table: {table_data['table_id']}")
            return created_table
            
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to create table: {str(e)}")
            raise
    
    def get_table(self, table_id: str, organization_id: str) -> Optional[Dict[str, Any]]:
        """Get a table by ID."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT * FROM tables 
                WHERE table_id = %s AND organization_id = %s AND is_deleted = FALSE
            """, (table_id, organization_id))
            
            result = cursor.fetchone()
            if result:
                columns = [desc[0] for desc in cursor.description]
                table_dict = dict(zip(columns, result))
                cursor.close()
                logger.info(f"✅ Retrieved table: {table_id}")
                return table_dict
            else:
                cursor.close()
                return None
                
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to get table {table_id}: {str(e)}")
            return None
    
    def update_table(self, table_id: str, organization_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a table."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Build dynamic update query
            set_clauses = []
            values = []
            
            for key, value in update_data.items():
                if key != "table_id" and key != "organization_id":  # Don't update primary keys
                    set_clauses.append(f"{key} = %s")
                    if key == "metadata":
                        values.append(json.dumps(value))
                    else:
                        values.append(value)
            
            if not set_clauses:
                return None
            
            # Add updated_at_ms if not provided
            if "updated_at_ms" not in update_data:
                set_clauses.append("updated_at_ms = %s")
                values.append(int(time.time() * 1000))
            
            values.extend([table_id, organization_id])
            
            cursor.execute(f"""
                UPDATE tables 
                SET {', '.join(set_clauses)}
                WHERE table_id = %s AND organization_id = %s AND is_deleted = FALSE
                RETURNING *
            """, values)
            
            result = cursor.fetchone()
            if result:
                columns = [desc[0] for desc in cursor.description]
                updated_table = dict(zip(columns, result))
                cursor.close()
                logger.info(f"✅ Updated table: {table_id}")
                return updated_table
            else:
                cursor.close()
                return None
                
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to update table {table_id}: {str(e)}")
            return None
    
    def delete_table(self, table_id: str, organization_id: str, soft_delete: bool = True) -> bool:
        """Delete a table."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if soft_delete:
                cursor.execute("""
                    UPDATE tables 
                    SET is_deleted = TRUE, updated_at_ms = %s
                    WHERE table_id = %s AND organization_id = %s AND is_deleted = FALSE
                """, (int(time.time() * 1000), table_id, organization_id))
            else:
                cursor.execute("""
                    DELETE FROM tables 
                    WHERE table_id = %s AND organization_id = %s
                """, (table_id, organization_id))
            
            success = cursor.rowcount > 0
            cursor.close()
            logger.info(f"✅ {'Soft deleted' if soft_delete else 'Hard deleted'} table: {table_id}")
            return success
            
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to delete table {table_id}: {str(e)}")
            return False
    
    def list_tables(self, organization_id: str, limit: Optional[int] = None, 
                   offset: Optional[int] = None, search_term: Optional[str] = None) -> List[Dict[str, Any]]:
        """List tables for an organization."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT * FROM tables 
                WHERE organization_id = %s AND is_deleted = FALSE
            """
            params = [organization_id]
            
            if search_term:
                query += " AND (name ILIKE %s OR description ILIKE %s)"
                search_param = f"%{search_term}%"
                params.extend([search_param, search_param])
            
            query += " ORDER BY updated_at_ms DESC"
            
            if limit:
                query += f" LIMIT {limit}"
            if offset:
                query += f" OFFSET {offset}"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            if results:
                columns = [desc[0] for desc in cursor.description]
                tables = [dict(zip(columns, row)) for row in results]
            else:
                tables = []
            
            cursor.close()
            logger.info(f"✅ Listed {len(tables)} tables for organization: {organization_id}")
            return tables
            
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to list tables: {str(e)}")
            return []
    
    def create_row(self, table_id: str, row_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new row in a table."""
        self.ensure_tables_exist()
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO rows (
                    row_id, table_id, data_json, created_by, updated_by,
                    created_at_ms, updated_at_ms, organization_id, is_deleted
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                row_data["row_id"],
                row_data["table_id"],
                row_data["data_json"],
                row_data["created_by"],
                row_data["updated_by"],
                row_data["created_at_ms"],
                row_data["updated_at_ms"],
                row_data["organization_id"],
                row_data.get("is_deleted", False)
            ))
            
            # Fetch the created row
            result = cursor.fetchone()
            columns = [desc[0] for desc in cursor.description]
            created_row = dict(zip(columns, result))
            
            cursor.close()
            logger.info(f"✅ Created row: {row_data['row_id']} in table: {table_id}")
            return created_row
            
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to create row: {str(e)}")
            raise
    
    def get_row(self, row_id: str, table_id: str, organization_id: str) -> Optional[Dict[str, Any]]:
        """Get a row by ID."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT * FROM rows 
                WHERE row_id = %s AND table_id = %s AND organization_id = %s AND is_deleted = FALSE
            """, (row_id, table_id, organization_id))
            
            result = cursor.fetchone()
            if result:
                columns = [desc[0] for desc in cursor.description]
                row_dict = dict(zip(columns, result))
                cursor.close()
                logger.info(f"✅ Retrieved row: {row_id}")
                return row_dict
            else:
                cursor.close()
                return None
                
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to get row {row_id}: {str(e)}")
            return None
    
    def update_row(self, row_id: str, table_id: str, organization_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update a row."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Build dynamic update query
            set_clauses = []
            values = []
            
            for key, value in update_data.items():
                if key not in ["row_id", "table_id", "organization_id"]:  # Don't update primary keys
                    set_clauses.append(f"{key} = %s")
                    if key == "data_json":
                        values.append(json.dumps(value) if isinstance(value, dict) else value)
                    else:
                        values.append(value)
            
            if not set_clauses:
                return None
            
            # Add updated_at_ms if not provided
            if "updated_at_ms" not in update_data:
                set_clauses.append("updated_at_ms = %s")
                values.append(int(time.time() * 1000))
            
            values.extend([row_id, table_id, organization_id])
            
            cursor.execute(f"""
                UPDATE rows 
                SET {', '.join(set_clauses)}
                WHERE row_id = %s AND table_id = %s AND organization_id = %s AND is_deleted = FALSE
                RETURNING *
            """, values)
            
            result = cursor.fetchone()
            if result:
                columns = [desc[0] for desc in cursor.description]
                updated_row = dict(zip(columns, result))
                cursor.close()
                logger.info(f"✅ Updated row: {row_id}")
                return updated_row
            else:
                cursor.close()
                return None
                
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to update row {row_id}: {str(e)}")
            return None
    
    def delete_row(self, row_id: str, table_id: str, organization_id: str, soft_delete: bool = True) -> bool:
        """Delete a row."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            if soft_delete:
                cursor.execute("""
                    UPDATE rows 
                    SET is_deleted = TRUE, updated_at_ms = %s
                    WHERE row_id = %s AND table_id = %s AND organization_id = %s AND is_deleted = FALSE
                """, (int(time.time() * 1000), row_id, table_id, organization_id))
            else:
                cursor.execute("""
                    DELETE FROM rows 
                    WHERE row_id = %s AND table_id = %s AND organization_id = %s
                """, (row_id, table_id, organization_id))
            
            success = cursor.rowcount > 0
            cursor.close()
            logger.info(f"✅ {'Soft deleted' if soft_delete else 'Hard deleted'} row: {row_id}")
            return success
            
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to delete row {row_id}: {str(e)}")
            return False
    
    def list_rows(self, table_id: str, organization_id: str, limit: Optional[int] = None, 
                  offset: Optional[int] = None, filter_json: Optional[str] = None,
                  sort_by: Optional[str] = None, sort_order: Optional[str] = "asc") -> List[Dict[str, Any]]:
        """List rows from a table with pagination, filtering, and sorting."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT * FROM rows 
                WHERE table_id = %s AND organization_id = %s AND is_deleted = FALSE
            """
            params = [table_id, organization_id]
            
            # Apply filtering if provided
            if filter_json:
                try:
                    filter_criteria = json.loads(filter_json)
                    for key, value in filter_criteria.items():
                        query += f" AND data_json->>'{key}' = %s"
                        params.append(str(value))
                except json.JSONDecodeError:
                    logger.warning(f"Invalid filter JSON: {filter_json}")
            
            # Apply sorting
            if sort_by:
                # For simplicity, sort by basic columns or JSON data keys
                if sort_by in ["row_id", "created_at_ms", "updated_at_ms"]:
                    query += f" ORDER BY {sort_by}"
                else:
                    query += f" ORDER BY data_json->>'{sort_by}'"
                
                query += f" {'DESC' if sort_order.lower() == 'desc' else 'ASC'}"
            else:
                query += " ORDER BY updated_at_ms DESC"
            
            # Apply pagination
            if limit:
                query += f" LIMIT {limit}"
            if offset:
                query += f" OFFSET {offset}"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            if results:
                columns = [desc[0] for desc in cursor.description]
                rows = [dict(zip(columns, row)) for row in results]
            else:
                rows = []
            
            cursor.close()
            logger.info(f"✅ Listed {len(rows)} rows for table: {table_id}")
            return rows
            
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to list rows: {str(e)}")
            return []
    
    def count_rows(self, table_id: str, organization_id: str, filter_json: Optional[str] = None) -> int:
        """Count rows in a table with optional filtering."""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            query = """
                SELECT COUNT(*) FROM rows 
                WHERE table_id = %s AND organization_id = %s AND is_deleted = FALSE
            """
            params = [table_id, organization_id]
            
            # Apply filtering if provided
            if filter_json:
                try:
                    filter_criteria = json.loads(filter_json)
                    for key, value in filter_criteria.items():
                        query += f" AND data_json->>'{key}' = %s"
                        params.append(str(value))
                except json.JSONDecodeError:
                    logger.warning(f"Invalid filter JSON: {filter_json}")
            
            cursor.execute(query, params)
            result = cursor.fetchone()
            count = result[0] if result else 0
            
            cursor.close()
            return count
            
        except Exception as e:
            cursor.close()
            logger.error(f"❌ Failed to count rows: {str(e)}")
            return 0

# Global manager instance
_delta_manager: Optional[SimpleDeltaLakeManager] = None

def get_delta_manager() -> SimpleDeltaLakeManager:
    """Get global Delta Lake manager instance."""
    global _delta_manager
    if _delta_manager is None:
        _delta_manager = SimpleDeltaLakeManager()
    return _delta_manager