"""Graph retrieval helper for orchestrator nodes.

Provides a shared function for retrieving related records via graph traversal,
used by both direct.py and planning.py to enrich execution context.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from emery_agents.reasoning.modules.graph_retriever import GraphRetriever

if TYPE_CHECKING:
    from emery_agents.services.graph import GraphService

logger = logging.getLogger(__name__)


def retrieve_graph_context(
    record_context: dict[str, Any] | None,
    graph_service: "GraphService | None",
    org_id: int | str | None,
    max_records: int = 3,
) -> str:
    """Retrieve related records via graph traversal.

    Traverses the Delta Lake graph to find records related to the given
    record_context. Returns a formatted string suitable for inclusion in
    execution context.

    Args:
        record_context: Dict with table_id/table_name and record_ids from triage
        graph_service: GraphService instance for Delta Lake traversal
        org_id: Organization ID for RLS context
        max_records: Maximum number of starting records to traverse from

    Returns:
        Formatted string of related records, or empty string if unavailable
    """
    if not record_context or not graph_service or not org_id:
        return ""

    try:
        graph_retriever = GraphRetriever(graph_service)
        table_id = record_context.get("table_id") or record_context.get(
            "table_name", ""
        )
        record_ids = record_context.get("record_ids", [])

        all_related: list[Any] = []
        for rid in record_ids[:max_records]:
            related = graph_retriever(
                org_id=int(org_id),
                table=table_id,
                record_id=rid,
            )
            all_related.extend(related)

        if all_related:
            context = graph_retriever.format_for_planner(all_related)
            logger.info(f"Retrieved {len(all_related)} related records via graph")
            return context

    except Exception as e:
        logger.warning(f"Graph retrieval failed: {e}")

    return ""
