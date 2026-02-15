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
        self._cache = GraphCache()
        self._setup()

    def _setup(self) -> None:
        """Install and load required DuckDB extensions."""
        self._conn.execute("INSTALL delta; LOAD delta")
        self._conn.execute("INSTALL duckpgq; LOAD duckpgq")
        self._configure_s3()

    def _configure_s3(self) -> None:
        """Configure S3 credentials for Delta Lake access."""
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
