"""Graph builder for workspace schema.

Builds property graphs from workspace tables and their relation fields.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from .types import DeltaTableRef, EdgeDef

if TYPE_CHECKING:
    from emery_agents.entities.workspace import WorkspaceData
    from .service import GraphService

logger = logging.getLogger(__name__)


class GraphBuilder:
    """Build property graph from workspace schema.

    Extracts tables and relation edges from WorkspaceData,
    then builds a DuckPGQ property graph for traversal.

    Usage:
        builder = GraphBuilder(graph_service, bucket="emery-bucket")
        graph_name = builder.build_from_workspace(org_id=1, workspace=workspace_data)
    """

    __slots__ = ("_graph", "_bucket")

    def __init__(self, graph: GraphService, bucket: str) -> None:
        """Initialize GraphBuilder.

        Args:
            graph: GraphService instance for building the graph
            bucket: S3 bucket name containing Delta Lake tables
        """
        self._graph = graph
        self._bucket = bucket

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
                # Path format: s3://{bucket}/org_{org_id}/db_{db_id}/table_{table_id}/
                s3_path = f"s3://{self._bucket}/org_{org_id}/db_{db.id}/table_{table.id}/"
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
