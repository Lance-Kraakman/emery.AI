"""
Strategy Accumulation Service - DSPy-based strategy ranking.

Records successful execution patterns and surfaces them to the planner.
Part of the ACE (Agentic Context Engineering) pattern.

Uses DSPy ChainOfThought with RankStrategies signature.
"""

import hashlib
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import dspy

from ..models.strategy_accumulation import (
    ExecutionPattern,
    StrategyOutcome,
    StrategyRecord,
    StrategyRegistry,
)
from emery_agents.models.plan import Plan
from emery_agents.dspy_modules.signatures.evaluation import (
    RankStrategies,
    StrategyRankingsResult,
)

logger = logging.getLogger(__name__)


class StrategyRankingModule(dspy.Module):
    """DSPy module for ranking strategies by relevance."""

    def __init__(self) -> None:
        super().__init__()
        self.ranker = dspy.ChainOfThought(RankStrategies)

    def forward(self, goal: str, strategies_json: str) -> StrategyRankingsResult:
        """Rank strategies by relevance to the goal."""
        result = self.ranker(goal=goal, strategies_json=strategies_json)
        return result.result


@dataclass
class StrategyAccumulationService:
    """
    DSPy-based strategy ranking and pattern accumulation.

    Records successful execution patterns and surfaces them to planner
    using semantic matching via DSPy.
    """

    registry: StrategyRegistry = field(default_factory=StrategyRegistry)
    lm: Optional[dspy.LM] = None

    def __post_init__(self) -> None:
        self._module = StrategyRankingModule()

    def record_execution(
        self,
        plan: Plan,
        outcome: StrategyOutcome,
        success_factors: Optional[List[str]] = None,
        failure_patterns: Optional[List[str]] = None,
    ) -> Optional[StrategyRecord]:
        """Record execution pattern from a completed plan."""
        if not plan or not plan.steps:
            logger.warning("Cannot record pattern from empty plan")
            return None

        pattern_id = self._generate_pattern_id(plan)
        step_sequence = tuple(s.description for s in plan.steps)
        agent_sequence = tuple(s.target_agent for s in plan.steps if s.target_agent)
        tool_sequence = self._extract_tool_sequence(plan)

        pattern = ExecutionPattern(
            pattern_id=pattern_id,
            goal_signature=plan.goal or "",
            step_sequence=step_sequence,
            agent_sequence=agent_sequence,
            tool_sequence=tool_sequence,
            success_factors=tuple(success_factors or []),
            failure_patterns=tuple(failure_patterns or []),
        )

        goal_keywords = self.registry.extract_keywords(plan.goal or "")
        record = self.registry.register_pattern(pattern, goal_keywords)
        record.record_outcome(outcome)

        logger.info(
            f"📊 Recorded execution pattern: {pattern_id[:8]}... "
            f"({outcome.value}, {len(step_sequence)} steps)"
        )
        return record

    def get_relevant_strategies(
        self,
        goal: str,
        max_results: int = 10,
        min_confidence: float = 0.3,
    ) -> List[StrategyRecord]:
        """
        Find strategies relevant to a goal using DSPy semantic matching.
        """
        # Filter by confidence first
        candidates = [
            r for r in self.registry.strategies.values()
            if r.confidence_score >= min_confidence
        ]

        if not candidates:
            logger.info("📊 No strategies above confidence threshold")
            return []

        # Use DSPy for semantic matching
        ranked = self._llm_rank_strategies(goal, candidates)
        if ranked:
            logger.info(f"📊 LLM ranked {len(ranked)} relevant strategies")
            return ranked[:max_results]

        logger.info("📊 LLM did not find relevant strategies")
        return []

    def _llm_rank_strategies(
        self,
        goal: str,
        candidates: List[StrategyRecord],
    ) -> List[StrategyRecord]:
        """Use DSPy to rank strategies by semantic relevance."""
        # Prepare strategy summaries as JSON
        strategy_summaries = []
        for record in candidates:
            pattern = record.pattern
            strategy_summaries.append({
                "pattern_id": pattern.pattern_id,
                "goal_signature": pattern.goal_signature[:200],
                "step_count": len(pattern.step_sequence),
                "agents": ", ".join(set(pattern.agent_sequence)) if pattern.agent_sequence else "none",
                "success_rate": f"{record.success_rate:.0%}",
            })

        strategies_json = json.dumps(strategy_summaries)

        try:
            # Use provided LM or global settings
            if self.lm:
                with dspy.context(lm=self.lm):
                    result = self._module(goal=goal, strategies_json=strategies_json)
            else:
                result = self._module(goal=goal, strategies_json=strategies_json)

            # Map rankings back to records
            id_to_record = {r.pattern.pattern_id: r for r in candidates}

            ranked_records = []
            for rank in result.rankings:
                pattern_id = rank.pattern_id
                if pattern_id and pattern_id in id_to_record:
                    ranked_records.append(id_to_record[pattern_id])

            return ranked_records

        except Exception as e:
            logger.warning(f"Strategy ranking failed: {e}")
            return []

    def format_for_planner(self, strategies: List[StrategyRecord]) -> str:
        """Format strategies as guidance text for the planner prompt."""
        if not strategies:
            return ""

        lines = ["## Proven Strategies", ""]
        lines.append("The following patterns have worked well for similar goals:")
        lines.append("")

        for i, record in enumerate(strategies, 1):
            pattern = record.pattern
            conf = record.confidence_score

            lines.append(f"### Strategy {i} (confidence: {conf:.0%})")
            lines.append(f"**Goal type:** {pattern.goal_signature[:100]}")
            lines.append("")
            lines.append("**Typical steps:**")
            for j, step in enumerate(pattern.step_sequence[:5], 1):
                lines.append(f"{j}. {step[:80]}")
            if len(pattern.step_sequence) > 5:
                lines.append(f"   ... and {len(pattern.step_sequence) - 5} more steps")
            lines.append("")

            if pattern.agent_sequence:
                agents = ", ".join(set(pattern.agent_sequence))
                lines.append(f"**Agents used:** {agents}")
                lines.append("")

            if pattern.success_factors:
                lines.append("**Success factors:**")
                for factor in pattern.success_factors[:3]:
                    lines.append(f"- {factor}")
                lines.append("")

            if pattern.failure_patterns:
                lines.append("**Avoid:**")
                for avoid in pattern.failure_patterns[:3]:
                    lines.append(f"- {avoid}")
                lines.append("")

        lines.append("---")
        lines.append("Consider these patterns when planning, but adapt to the specific context.")
        lines.append("")
        return "\n".join(lines)

    def record_outcome(self, pattern_id: str, outcome: StrategyOutcome) -> None:
        """Record the outcome of using a strategy."""
        self.registry.record_outcome(pattern_id, outcome)
        logger.info(f"📊 Updated outcome for pattern {pattern_id[:8]}...: {outcome.value}")

    def _generate_pattern_id(self, plan: Plan) -> str:
        """Generate a unique pattern ID from plan structure."""
        content = (plan.goal or "") + "|".join(s.description for s in plan.steps)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _extract_tool_sequence(self, plan: Plan) -> tuple[str, ...]:
        """Extract tool names from plan steps."""
        tools: List[str] = []
        for step in plan.steps:
            if step.tool_call:
                tools.append(step.tool_call)
            if step.parameters and "tool" in step.parameters:
                tools.append(str(step.parameters["tool"]))
        return tuple(tools)


def create_strategy_accumulation_service(
    registry: Optional[StrategyRegistry] = None,
    lm: Optional[dspy.LM] = None,
) -> StrategyAccumulationService:
    """Factory function to create StrategyAccumulationService."""
    return StrategyAccumulationService(
        registry=registry or StrategyRegistry(),
        lm=lm,
    )
