"""Graph service for relationship traversal over Delta Lake tables.

Uses DuckDB with DuckPGQ extension for SQL/PGQ graph queries.
"""

from __future__ import annotations

import logging
from typing import Any, Sequence

import duckdb
import polars as pl

from .cache import GraphCache
from .types import DeltaTableRef, EdgeDef, S3Config, validate_identifier

logger = logging.getLogger(__name__)


class GraphService:
    """Graph over Delta Lake user data.

    Builds property graphs from Delta Lake tables using DuckDB + DuckPGQ.
    Graph structure is cached per-org and invalidated on schema changes.

    Note: Postgres system tables (agents, tasks) are NOT in this graph.
    They have static structure. Use record_history tool for provenance.
    """

    __slots__ = ("_conn", "_cache", "_s3")

    def __init__(self, s3_config: S3Config | None = None) -> None:
        """Initialize GraphService.

        Args:
            s3_config: S3/MinIO config. If None, reads from env vars.
        """
        self._s3 = s3_config or S3Config.from_env()
        self._conn = duckdb.connect()
        # Set extension directory to match Dockerfile install location
        # Extensions are at: HOME/.duckdb/extensions/VERSION/PLATFORM/*.duckdb_extension
        self._conn.execute("SET extension_directory = '/usr/local/share/.duckdb/extensions'")
        self._cache = GraphCache()
        self._setup()

    def _setup(self) -> None:
        """Load required DuckDB extensions (pre-installed in Docker image)."""
        self._conn.load_extension("delta")
        self._conn.load_extension("duckpgq")
        self._configure_s3()

    def _configure_s3(self) -> None:
        """Configure S3 credentials for Delta Lake access.

        In production (ECS), credentials come from IAM task role (automatic).
        In development (MinIO), credentials come from explicit env vars.
        """
        # Only set explicit credentials if provided (local MinIO)
        # For IAM role auth, let DuckDB use default credential chain
        if self._s3.has_explicit_credentials:
            self._conn.execute("SET s3_access_key_id = $k", {"k": self._s3.access_key})
            self._conn.execute("SET s3_secret_access_key = $s", {"s": self._s3.secret_key})

        if self._s3.endpoint:
            self._conn.execute("SET s3_endpoint = $e", {"e": self._s3.endpoint})
        self._conn.execute("SET s3_region = $r", {"r": self._s3.region})

    # -------------------------------------------------------------------------
    # Query
    # -------------------------------------------------------------------------

    def query(self, sql: str, params: dict[str, Any] | None = None) -> pl.DataFrame:
        """Execute a SQL query and return results as Polars DataFrame."""
        return self._conn.execute(sql, params or {}).pl()

    # -------------------------------------------------------------------------
    # Delta Table Registration
    # -------------------------------------------------------------------------

    def _view_name(self, org_id: int, table_id: str) -> str:
        """Generate a unique view name for a table within an org."""
        return f"t_{org_id}_{validate_identifier(table_id)}"

    def _register_table(self, org_id: int, ref: DeltaTableRef) -> str:
        """Register a Delta Lake table as a DuckDB view.

        Returns the view name for use in graph queries.
        """
        view = self._view_name(org_id, ref.table_id)
        self._conn.execute(
            f"CREATE OR REPLACE VIEW {view} AS SELECT * FROM delta_scan($uri)",
            {"uri": ref.s3_path},
        )
        return view

    # -------------------------------------------------------------------------
    # Graph Building
    # -------------------------------------------------------------------------

    def ensure_graph(
        self,
        org_id: int,
        tables: Sequence[DeltaTableRef],
        edges: Sequence[EdgeDef],
    ) -> str:
        """Ensure graph exists for org, building if necessary.

        Returns the graph name. Uses cached graph if available and valid.
        """
        if cached := self._cache.get(org_id):
            return cached
        return self._build_graph(org_id, tables, edges)

    def _build_graph(
        self,
        org_id: int,
        tables: Sequence[DeltaTableRef],
        edges: Sequence[EdgeDef],
    ) -> str:
        """Build a property graph from Delta Lake tables.

        Creates DuckDB views for each table and a property graph
        with edges defined by FIELD_TYPE_RELATION fields.
        """
        # Register all tables as views
        views = [self._register_table(org_id, ref) for ref in tables]

        if not views:
            raise ValueError("Cannot build graph with no tables")

        # Build edge clauses (convert table names to view names)
        edge_clauses = [
            f"{self._view_name(org_id, e.source_table)} "
            f"SOURCE KEY ({validate_identifier(e.source_key)}) "
            f"REFERENCES {self._view_name(org_id, e.target_table)}({validate_identifier(e.target_key)})"
            for e in edges
        ]

        graph_name = f"graph_{org_id}"
        vertex_sql = ", ".join(views)
        edge_sql = f"EDGE TABLES ({', '.join(edge_clauses)})" if edge_clauses else ""

        self._conn.execute(f"""
            CREATE OR REPLACE PROPERTY GRAPH {graph_name}
            VERTEX TABLES ({vertex_sql})
            {edge_sql}
        """)

        logger.info(f"Built {graph_name}: {len(views)} tables, {len(edges)} edges")
        self._cache.set(org_id, graph_name)
        return graph_name

    def invalidate(self, org_id: int) -> None:
        """Invalidate cached graph for an org.

        Call after schema changes (AddField, DeleteField, CreateTable, etc.)
        """
        self._cache.invalidate(org_id)

    # -------------------------------------------------------------------------
    # Graph Queries
    # -------------------------------------------------------------------------

    def traverse(
        self, org_id: int, table: str, record_id: str, hops: int = 1
    ) -> pl.DataFrame:
        """Traverse graph from a starting record.

        Args:
            org_id: Organization ID
            table: Starting table ID
            record_id: Starting record ID
            hops: Number of hops to traverse (default 1)

        Returns:
            DataFrame with columns: start_id, end_id, end_type
        """
        graph = f"graph_{org_id}"
        view = self._view_name(org_id, validate_identifier(table))
        hop_pattern = "-[]->" * hops

        return self.query(
            f"""
            FROM GRAPH_TABLE({graph}
                MATCH (start:{view} WHERE start.id = $id){hop_pattern}(end)
                COLUMNS (start.id AS start_id, end.id AS end_id, labels(end) AS end_type)
            )
        """,
            {"id": record_id},
        )

    def get_related(
        self, org_id: int, table: str, record_id: str
    ) -> pl.DataFrame:
        """Get all records directly related to a given record.

        Args:
            org_id: Organization ID
            table: Table ID of the source record
            record_id: Record ID to find relations for

        Returns:
            DataFrame with columns: source_id, target_id, target_type, plus all target fields
        """
        graph = f"graph_{org_id}"
        view = self._view_name(org_id, validate_identifier(table))

        return self.query(
            f"""
            FROM GRAPH_TABLE({graph}
                MATCH (a:{view} WHERE a.id = $id)-[]->(b)
                COLUMNS (a.id AS source_id, b.id AS target_id, labels(b) AS target_type, b.*)
            )
        """,
            {"id": record_id},
        )

    def find_by_name(
        self, org_id: int, table_id: str, name: str, limit: int = 5
    ) -> list[str]:
        """Find record IDs by searching name-like columns.

        Args:
            org_id: Organization ID
            table_id: Table ID to search in
            name: Name pattern to search for (case-insensitive)
            limit: Maximum number of results

        Returns:
            List of matching record IDs
        """
        view = self._view_name(org_id, validate_identifier(table_id))

        try:
            # Get column names from view
            cols_df = self.query(f"DESCRIBE {view}")
            columns = cols_df["column_name"].to_list()

            # Find name-like columns
            name_cols = [c for c in columns if "name" in c.lower() or "title" in c.lower()]
            if not name_cols:
                return []

            # Build ILIKE conditions for case-insensitive search
            conditions = " OR ".join(f"{c} ILIKE $pattern" for c in name_cols)
            result = self.query(
                f"SELECT id FROM {view} WHERE {conditions} LIMIT {limit}",
                {"pattern": f"%{name}%"},
            )

            return result["id"].to_list() if not result.is_empty() else []

        except Exception as e:
            logger.warning(f"find_by_name failed for table {table_id}: {e}")
            return []
