"""
Strategy Accumulation Service

Records successful execution patterns and surfaces them to the planner.
Part of the ACE (Agentic Context Engineering) pattern.

Used in BOTH phases:
- Planning: get_relevant_strategies() surfaces proven patterns
- Execution: record_execution() captures successful patterns
"""

import hashlib
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from ..models.strategy_accumulation import (
    ExecutionPattern,
    StrategyOutcome,
    StrategyRecord,
    StrategyRegistry,
)
from ..models.plan import Plan

logger = logging.getLogger(__name__)


@dataclass
class StrategyAccumulationService:
    """
    Records successful execution patterns and surfaces them to planner.

    Used in BOTH planning (get strategies) and execution (record patterns).

    The service maintains a registry of patterns indexed by goal keywords,
    allowing efficient lookup of relevant strategies during planning.
    """

    registry: StrategyRegistry = field(default_factory=StrategyRegistry)

    def record_execution(
        self,
        plan: Plan,
        outcome: StrategyOutcome,
        success_factors: Optional[List[str]] = None,
        failure_patterns: Optional[List[str]] = None,
    ) -> Optional[StrategyRecord]:
        """
        Record the execution pattern from a completed plan.

        Called at the end of plan execution to capture the pattern
        for future reference.

        Args:
            plan: The completed plan
            outcome: SUCCESS, PARTIAL, or FAILURE
            success_factors: What made this execution successful
            failure_patterns: What to avoid (from errors encountered)

        Returns:
            The recorded StrategyRecord, or None if pattern invalid
        """
        if not plan or not plan.steps:
            logger.warning("Cannot record pattern from empty plan")
            return None

        # Generate pattern ID from goal + step sequence
        pattern_id = self._generate_pattern_id(plan)

        # Extract step sequence
        step_sequence = tuple(s.description for s in plan.steps)
        agent_sequence = tuple(s.target_agent for s in plan.steps if s.target_agent)
        tool_sequence = self._extract_tool_sequence(plan)

        # Create pattern
        pattern = ExecutionPattern(
            pattern_id=pattern_id,
            goal_signature=self._normalize_goal(plan.goal or ""),
            step_sequence=step_sequence,
            agent_sequence=agent_sequence,
            tool_sequence=tool_sequence,
            success_factors=tuple(success_factors or []),
            failure_patterns=tuple(failure_patterns or []),
        )

        # Extract keywords from goal
        goal_keywords = self.registry.extract_keywords(plan.goal or "")

        # Register pattern
        record = self.registry.register_pattern(pattern, goal_keywords)

        # Record outcome
        record.record_outcome(outcome)

        logger.info(
            f"📊 Recorded execution pattern: {pattern_id[:8]}... "
            f"({outcome.value}, {len(step_sequence)} steps)"
        )

        return record

    def get_relevant_strategies(
        self,
        goal: str,
        max_results: int = 3,
        min_confidence: float = 0.3,
    ) -> List[StrategyRecord]:
        """
        Find strategies relevant to a goal.

        Called during planning to surface proven patterns that might
        guide the planner.

        Args:
            goal: The goal to find strategies for
            max_results: Maximum number of strategies to return
            min_confidence: Minimum confidence score to include

        Returns:
            List of relevant StrategyRecords sorted by relevance
        """
        strategies = self.registry.find_matching_strategies(
            goal=goal,
            min_confidence=min_confidence,
        )

        if strategies:
            logger.info(
                f"📊 Found {len(strategies)} relevant strategies for goal, "
                f"returning top {min(len(strategies), max_results)}"
            )
        else:
            logger.info(f"📊 No matching strategies found for goal")

        return strategies[:max_results]

    def format_for_planner(
        self,
        strategies: List[StrategyRecord],
    ) -> str:
        """
        Format strategies as guidance text for the planner prompt.

        Generates concise markdown that can be injected into the
        planner prompt as strategy_guidance.

        Args:
            strategies: List of relevant strategies to format

        Returns:
            Markdown-formatted strategy guidance
        """
        if not strategies:
            return ""

        lines = ["## Proven Strategies", ""]
        lines.append(
            "The following patterns have worked well for similar goals:"
        )
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
        lines.append(
            "Consider these patterns when planning, but adapt to the specific context."
        )
        lines.append("")

        return "\n".join(lines)

    def record_outcome(
        self,
        pattern_id: str,
        outcome: StrategyOutcome,
    ) -> None:
        """
        Record the outcome of using a strategy.

        Called when a plan using a known pattern completes,
        to update success/failure statistics.

        Args:
            pattern_id: ID of the pattern
            outcome: SUCCESS, PARTIAL, or FAILURE
        """
        self.registry.record_outcome(pattern_id, outcome)
        logger.info(f"📊 Updated outcome for pattern {pattern_id[:8]}...: {outcome.value}")

    def get_registry_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the strategy registry.

        Returns:
            Dictionary with registry statistics
        """
        return {
            "total_strategies": len(self.registry.strategies),
            "total_keywords": len(self.registry.keyword_index),
            "top_strategies": [
                {
                    "pattern_id": r.pattern.pattern_id[:8],
                    "goal": r.pattern.goal_signature[:50],
                    "uses": r.total_uses,
                    "success_rate": f"{r.success_rate:.0%}",
                    "confidence": f"{r.confidence_score:.0%}",
                }
                for r in self.registry.get_top_strategies(5)
            ],
        }

    def _generate_pattern_id(self, plan: Plan) -> str:
        """Generate a unique pattern ID from plan structure."""
        # Hash the goal + step descriptions
        content = (plan.goal or "") + "|".join(s.description for s in plan.steps)
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def _normalize_goal(self, goal: str) -> str:
        """
        Normalize goal text for matching.

        Extracts key concepts while removing noise.
        """
        # Extract keywords
        keywords = self.registry.extract_keywords(goal)
        # Sort for consistency
        return " ".join(sorted(keywords))

    def _extract_tool_sequence(self, plan: Plan) -> tuple[str, ...]:
        """Extract tool names from plan steps."""
        tools: List[str] = []
        for step in plan.steps:
            # Check tool_call field
            if step.tool_call:
                tools.append(step.tool_call)
            # Check parameters for tool hints
            if step.parameters:
                if "tool" in step.parameters:
                    tools.append(str(step.parameters["tool"]))
        return tuple(tools)


def create_strategy_accumulation_service(
    registry: Optional[StrategyRegistry] = None,
) -> StrategyAccumulationService:
    """
    Factory function to create StrategyAccumulationService.

    Args:
        registry: Optional existing registry to use

    Returns:
        Configured StrategyAccumulationService
    """
    return StrategyAccumulationService(
        registry=registry or StrategyRegistry(),
    )
