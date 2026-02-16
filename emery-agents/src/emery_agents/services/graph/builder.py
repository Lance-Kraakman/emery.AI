"""Graph builder for workspace schema.

Builds property graphs from workspace tables and their relation fields.
"""

from __future__ import annotations

import logging

from emery_agents.entities.workspace import WorkspaceData
from emery_agents.infrastructure.storage import build_table_s3_path, get_delta_bucket
from emery_agents.services.context.models import WorkspaceContext

from .service import GraphService
from .types import DeltaTableRef, EdgeDef

logger = logging.getLogger(__name__)


class GraphBuilder:
    """Build property graph from workspace schema.

    Extracts tables and relation edges from WorkspaceData,
    then builds a DuckPGQ property graph for traversal.

    Usage:
        builder = GraphBuilder(graph_service)
        graph_name = builder.build_from_workspace(org_id=1, workspace=workspace_data)
    """

    __slots__ = ("_graph", "_bucket")

    def __init__(self, graph: GraphService, bucket: str | None = None) -> None:
        """Initialize GraphBuilder.

        Args:
            graph: GraphService instance for building the graph
            bucket: Optional S3 bucket override (defaults to S3_BUCKET_NAME env var)
        """
        self._graph = graph
        self._bucket = bucket or get_delta_bucket()

    def build_from_workspace(
        self, org_id: int, workspace: WorkspaceData
    ) -> str:
        """Build graph from workspace tables with relations.

        Scans all tables for relation fields and builds edges.
        Returns the graph name for querying.

        Args:
            org_id: Organization ID
            workspace: WorkspaceData with databases and tables

        Returns:
            Graph name (e.g., "graph_1")
        """
        tables: list[DeltaTableRef] = []
        edges: list[EdgeDef] = []

        # Build table refs and extract relation edges
        for db in workspace.databases:
            for table in db.tables:
                s3_path = build_table_s3_path(org_id, db.id, table.id, self._bucket)
                tables.append(DeltaTableRef(str(table.id), s3_path))

                # Extract edges from relation fields
                for field in table.fields:
                    if field.type == "relation" and field.related_table_id:
                        edges.append(EdgeDef(
                            source_table=str(table.id),
                            target_table=str(field.related_table_id),
                            source_key=field.name,
                        ))

        if not tables:
            logger.warning(f"No tables found for org {org_id}")
            return f"graph_{org_id}"

        logger.info(
            f"Building graph for org {org_id}: {len(tables)} tables, {len(edges)} edges"
        )
        return self._graph.ensure_graph(org_id, tables, edges)

    def build_from_context(self, org_id: int, context: WorkspaceContext) -> str:
        """Build graph from WorkspaceContext (flat table list).

        Registers ALL tables from the workspace so graph traversal can
        follow any relation without hitting "view doesn't exist" errors.

        Args:
            org_id: Organization ID
            context: WorkspaceContext with existing_tables

        Returns:
            Graph name (e.g., "graph_4")
        """
        tables: list[DeltaTableRef] = []
        edges: list[EdgeDef] = []

        for table in context.existing_tables:
            if table.database_id is None:
                logger.warning(f"Table {table.id} has no database_id, skipping")
                continue

            s3_path = build_table_s3_path(org_id, table.database_id, table.id, self._bucket)
            tables.append(DeltaTableRef(str(table.id), s3_path))

            for field in table.fields:
                if field.type == "relation" and field.related_table_id is not None:
                    edges.append(EdgeDef(
                        source_table=str(table.id),
                        target_table=str(field.related_table_id),
                        source_key=field.name,
                    ))

        if not tables:
            logger.warning(f"No tables found for org {org_id}")
            return f"graph_{org_id}"

        logger.info(f"Building graph for org {org_id}: {len(tables)} tables, {len(edges)} edges")
        return self._graph.ensure_graph(org_id, tables, edges)
