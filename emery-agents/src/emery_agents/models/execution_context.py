"""
Execution Context

Curated context from plan step execution (ACE-inspired pattern).
Source: PlanStepExecutor._step_results (NOT chat messages).

Used to:
- Distill step results into actionable insights
- Prevent context degradation during long executions
- Provide relevant context to evaluator and subsequent steps
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid


class InsightType(Enum):
    """Types of insights extracted from step execution results."""
    DISCOVERY = "discovery"      # Found something new (table, pattern, entity)
    DECISION = "decision"        # Made a choice affecting future steps
    ARTIFACT = "artifact"        # Created something (table, field, record)
    CONSTRAINT = "constraint"    # Learned a limitation or requirement
    ERROR_RECOVERY = "error_recovery"  # How an error was resolved


@dataclass(frozen=True)
class ExecutionInsight:
    """
    Single actionable insight extracted from step execution results.

    Unlike raw results, insights are:
    - Actionable: Tell future steps what to do/avoid
    - Deduplicated: Similar insights are merged
    - Prioritized: Relevance score for context window management
    """
    insight_id: str
    insight_type: InsightType
    summary: str                  # 1-2 sentence actionable summary
    key_facts: tuple[str, ...]    # Bullet points of essential facts (tuple for frozen)
    source_step_ids: tuple[str, ...]  # Steps that contributed to this insight
    relevance_score: float        # 0.0-1.0, decays over time
    created_at: datetime = field(default_factory=datetime.utcnow)

    def decay_relevance(self, factor: float = 0.9) -> "ExecutionInsight":
        """Return new insight with decayed relevance score."""
        return ExecutionInsight(
            insight_id=self.insight_id,
            insight_type=self.insight_type,
            summary=self.summary,
            key_facts=self.key_facts,
            source_step_ids=self.source_step_ids,
            relevance_score=self.relevance_score * factor,
            created_at=self.created_at,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "insight_id": self.insight_id,
            "insight_type": self.insight_type.value,
            "summary": self.summary,
            "key_facts": list(self.key_facts),
            "source_step_ids": list(self.source_step_ids),
            "relevance_score": self.relevance_score,
            "created_at": self.created_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExecutionInsight":
        """Create from dictionary."""
        return cls(
            insight_id=data["insight_id"],
            insight_type=InsightType(data["insight_type"]),
            summary=data["summary"],
            key_facts=tuple(data.get("key_facts", [])),
            source_step_ids=tuple(data.get("source_step_ids", [])),
            relevance_score=data.get("relevance_score", 1.0),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.utcnow(),
        )


@dataclass
class ExecutionContext:
    """
    Curated context from plan step execution.

    Source: PlanStepExecutor._step_results (NOT chat messages)

    Maintains both:
    - Curated insights: Token-efficient for LLM consumption
    - Full results archive: For recovery when needed
    """
    task_id: str
    insights: List[ExecutionInsight] = field(default_factory=list)
    full_results_archive: Dict[str, Any] = field(default_factory=dict)
    last_curation_at: Optional[datetime] = None
    curation_count: int = 0

    def add_insight(self, insight: ExecutionInsight) -> None:
        """
        Add insight, merging if similar exists.

        Two insights are considered similar if they have:
        - Same insight type
        - Overlapping key facts
        """
        for i, existing in enumerate(self.insights):
            if self._should_merge(existing, insight):
                self.insights[i] = self._merge_insights(existing, insight)
                return
        self.insights.append(insight)

    def get_relevant_context(self, max_tokens: int = 2000) -> str:
        """
        Get token-budgeted context string for LLM consumption.

        Args:
            max_tokens: Approximate token budget (assumes ~4 chars/token)

        Returns:
            Formatted string with most relevant insights
        """
        if not self.insights:
            return ""

        # Sort by relevance descending
        sorted_insights = sorted(
            self.insights,
            key=lambda i: i.relevance_score,
            reverse=True
        )

        # Build context within budget
        context_parts = []
        estimated_chars = 0
        max_chars = max_tokens * 4

        for insight in sorted_insights:
            insight_str = f"[{insight.insight_type.value.upper()}] {insight.summary}"
            if insight.key_facts:
                insight_str += "\n  - " + "\n  - ".join(insight.key_facts[:3])

            if estimated_chars + len(insight_str) > max_chars:
                break

            context_parts.append(insight_str)
            estimated_chars += len(insight_str)

        return "\n".join(context_parts)

    def decay_all_relevance(self, factor: float = 0.9) -> None:
        """Decay relevance of all insights (call after evaluation cycles)."""
        self.insights = [i.decay_relevance(factor) for i in self.insights]

    def archive_raw_result(self, step_id: str, result: Any) -> None:
        """Store full result for recovery if needed."""
        self.full_results_archive[step_id] = {
            "result": result,
            "archived_at": datetime.utcnow().isoformat(),
        }

    def get_archived_result(self, step_id: str) -> Optional[Any]:
        """Retrieve archived raw result."""
        archived = self.full_results_archive.get(step_id)
        return archived.get("result") if archived else None

    def _should_merge(self, a: ExecutionInsight, b: ExecutionInsight) -> bool:
        """Check if two insights should be merged."""
        if a.insight_type != b.insight_type:
            return False
        # Merge if they share any key facts
        return bool(set(a.key_facts) & set(b.key_facts))

    def _merge_insights(
        self,
        existing: ExecutionInsight,
        new: ExecutionInsight
    ) -> ExecutionInsight:
        """Merge two similar insights into one."""
        merged_facts = list(set(existing.key_facts) | set(new.key_facts))[:10]
        merged_steps = list(set(existing.source_step_ids) | set(new.source_step_ids))

        return ExecutionInsight(
            insight_id=existing.insight_id,
            insight_type=existing.insight_type,
            summary=new.summary,  # Use newer summary
            key_facts=tuple(merged_facts),
            source_step_ids=tuple(merged_steps),
            relevance_score=max(existing.relevance_score, new.relevance_score),
            created_at=existing.created_at,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "task_id": self.task_id,
            "insights": [i.to_dict() for i in self.insights],
            "last_curation_at": self.last_curation_at.isoformat() if self.last_curation_at else None,
            "curation_count": self.curation_count,
            "archived_step_count": len(self.full_results_archive),
        }


def create_insight(
    insight_type: InsightType,
    summary: str,
    key_facts: List[str],
    source_step_ids: List[str],
) -> ExecutionInsight:
    """
    Factory function to create a new ExecutionInsight.

    Args:
        insight_type: Type of insight
        summary: 1-2 sentence actionable summary
        key_facts: Bullet points of essential facts
        source_step_ids: Steps that contributed to this insight

    Returns:
        New ExecutionInsight with generated ID and full relevance
    """
    return ExecutionInsight(
        insight_id=str(uuid.uuid4())[:8],
        insight_type=insight_type,
        summary=summary,
        key_facts=tuple(key_facts),
        source_step_ids=tuple(source_step_ids),
        relevance_score=1.0,
    )
