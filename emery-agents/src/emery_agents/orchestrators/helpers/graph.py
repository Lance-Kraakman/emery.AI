"""Graph retrieval helper for orchestrator nodes.

Provides a shared function for retrieving related records via graph traversal,
used by both direct.py and planning.py to enrich execution context.
"""

from __future__ import annotations

import logging
import os
from typing import Any

from emery_agents.reasoning.modules.graph_retriever import GraphRetriever
from emery_agents.reasoning.signatures.planning.models import RecordContext
from emery_agents.services.context.models import WorkspaceContext
from emery_agents.services.graph import GraphBuilder, GraphService

logger = logging.getLogger(__name__)


def retrieve_graph_context(
    record_context: RecordContext | None,
    graph_service: GraphService | None,
    org_id: int | str | None,
    workspace_context: WorkspaceContext | None = None,
    max_records: int = 3,
) -> str:
    """Retrieve related records via graph traversal.

    Builds the graph from workspace_context (ALL tables) before querying.
    Graph is cached per-org, so subsequent calls skip the build step.

    Args:
        record_context: RecordContext with table_id and record_ids
        graph_service: GraphService instance for Delta Lake traversal
        org_id: Organization ID for RLS context
        workspace_context: WorkspaceContext with ALL tables for graph building
        max_records: Maximum number of starting records to traverse from

    Returns:
        Formatted string of related records, or empty string if unavailable
    """
    if not record_context:
        logger.debug("Graph retrieval skipped: no record_context")
        return ""
    if not graph_service:
        logger.warning("Graph retrieval skipped: GraphService not available")
        return ""
    if not org_id:
        logger.warning("Graph retrieval skipped: no org_id")
        return ""

    if not record_context.table_id or not record_context.record_ids:
        logger.debug(
            f"Graph retrieval skipped: missing table_id={record_context.table_id} "
            f"or record_ids={record_context.record_ids}"
        )
        return ""

    # Build graph from workspace before querying
    if workspace_context and workspace_context.existing_tables:
        try:
            bucket = os.environ.get("S3_BUCKET_NAME", "enhancd-files")
            builder = GraphBuilder(graph_service, bucket)
            graph_name = builder.build_from_context(int(org_id), workspace_context)
            logger.info(f"Graph '{graph_name}' ready ({len(workspace_context.existing_tables)} tables)")
        except Exception as e:
            logger.warning(f"Graph build failed: {e}")

    logger.info(
        f"Starting graph retrieval: table={record_context.table_id}, "
        f"records={record_context.record_ids}"
    )

    try:
        graph_retriever = GraphRetriever(graph_service)
        all_related: list[Any] = []

        for rid in record_context.record_ids[:max_records]:
            # Try as ID first
            related = graph_retriever(
                org_id=int(org_id),
                table=record_context.table_id,
                record_id=rid,
            )

            # Fallback: try name search if no results
            if not related:
                found_ids = graph_service.find_by_name(int(org_id), record_context.table_id, rid, limit=1)
                if found_ids:
                    logger.info(f"Resolved '{rid}' to ID '{found_ids[0]}' via name search")
                    related = graph_retriever(
                        org_id=int(org_id),
                        table=record_context.table_id,
                        record_id=found_ids[0],
                    )

            all_related.extend(related)

        if all_related:
            context = graph_retriever.format_for_planner(all_related)
            logger.info(f"Retrieved {len(all_related)} related records via graph")
            return context
        else:
            logger.info(
                f"Graph retrieval returned no related records for "
                f"table={record_context.table_id}, records={record_context.record_ids}"
            )

    except Exception as e:
        logger.warning(f"Graph retrieval failed: {e}", exc_info=True)

    return ""
