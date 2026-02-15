"""Graph-based retriever for record relationship context.

Unlike semantic retrievers (FAISS-based), this does direct
graph traversal using DuckPGQ over Delta Lake.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import polars as pl

from emery_agents.services.graph import GraphService

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class RelatedRecord:
    """A related record from graph traversal with row data."""

    record_id: str
    table_name: str
    data: dict[str, Any] = field(default_factory=dict)


class GraphRetriever:
    """Retrieve related records via graph traversal.

    Unlike semantic retrievers (FAISS-based), this does direct
    graph traversal using DuckPGQ over Delta Lake.

    Usage:
        retriever = GraphRetriever(graph_service)
        related = retriever(org_id=1, table="customers", record_id="abc123")
        context = retriever.format_for_planner(related)
    """

    __slots__ = ("_graph",)

    def __init__(self, graph: GraphService) -> None:
        self._graph = graph

    def __call__(
        self,
        org_id: int,
        table: str,
        record_id: str,
    ) -> list[RelatedRecord]:
        """Get related records with their row data.

        Args:
            org_id: Organization ID
            table: Starting table ID
            record_id: Starting record ID

        Returns:
            List of related records with full row data
        """
        try:
            df = self._graph.get_related(org_id, table, record_id)
            return self._to_records(df)
        except Exception as e:
            logger.warning(f"Graph retrieval failed: {e}")
            return []

    def _to_records(self, df: pl.DataFrame) -> list[RelatedRecord]:
        """Convert DataFrame to RelatedRecord list with row data."""
        if df.is_empty():
            return []

        # Columns from get_related: source_id, target_id, target_type, + all target fields
        reserved = {"source_id", "target_id", "target_type"}
        data_columns = [c for c in df.columns if c not in reserved]

        return [
            RelatedRecord(
                record_id=row["target_id"],
                table_name=row["target_type"],
                data={col: row[col] for col in data_columns},
            )
            for row in df.iter_rows(named=True)
        ]

    def format_for_planner(self, records: list[RelatedRecord]) -> str:
        """Format related records with row data for DSPy planner context.

        Groups records by table and formats as markdown tables.

        Args:
            records: List of related records from traversal

        Returns:
            Markdown-formatted context string (empty if no records)
        """
        if not records:
            return ""

        # Group by table
        by_table: dict[str, list[RelatedRecord]] = {}
        for r in records:
            by_table.setdefault(r.table_name, []).append(r)

        lines = ["## Related Records"]
        for table, recs in by_table.items():
            lines.append(f"\n### {table} ({len(recs)} records)")

            if not recs or not recs[0].data:
                # No data columns, just list IDs
                ids = [r.record_id for r in recs[:5]]
                lines.append(f"IDs: {', '.join(ids)}")
                if len(recs) > 5:
                    lines.append(f"... and {len(recs) - 5} more")
                continue

            # Build markdown table
            columns = list(recs[0].data.keys())[:6]  # Limit columns
            header = "| " + " | ".join(columns) + " |"
            sep = "| " + " | ".join(["---"] * len(columns)) + " |"
            lines.extend([header, sep])

            for r in recs[:10]:  # Limit rows
                vals = [str(r.data.get(c, ""))[:30] for c in columns]
                lines.append("| " + " | ".join(vals) + " |")

            if len(recs) > 10:
                lines.append(f"\n*... and {len(recs) - 10} more records*")

        return "\n".join(lines)
