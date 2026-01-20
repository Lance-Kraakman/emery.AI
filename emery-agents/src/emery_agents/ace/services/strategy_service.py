"""
Strategy Accumulation Service

Records successful execution patterns and surfaces them to the planner.
Part of the ACE (Agentic Context Engineering) pattern.

Used in BOTH phases:
- Planning: get_relevant_strategies() uses LLM for semantic matching
- Execution: record_execution() captures successful patterns
"""

import hashlib
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from jinja2 import Environment, FileSystemLoader
from smolagents import Tool, ToolCallingAgent
from smolagents.monitoring import LogLevel

from ..models.strategy_accumulation import (
    ExecutionPattern,
    StrategyOutcome,
    StrategyRecord,
    StrategyRegistry,
)
from emery_agents.models.plan import Plan
from emery_agents.services.protocols import ModelProvider

logger = logging.getLogger(__name__)

# Load Jinja environment for templates
_PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts" / "ace"
_jinja_env = Environment(loader=FileSystemLoader(str(_PROMPTS_DIR)))


class StrategyRankingTool(Tool):  # type: ignore[misc]
    """Tool for LLM to rank strategies by relevance to a goal."""

    skip_forward_signature_validation = True
    name = "rank_strategies"
    description = """Rank strategies by relevance to the goal.

Provide a list of strategy IDs in order of relevance (most relevant first).
Only include strategies that are actually relevant - omit irrelevant ones.

Example:
{
    "rankings": [
        {"pattern_id": "abc123", "relevance": 0.9, "reason": "Same domain and action type"},
        {"pattern_id": "def456", "relevance": 0.6, "reason": "Similar entity manipulation"}
    ]
}
"""

    inputs = {
        "rankings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "pattern_id": {"type": "string", "description": "Strategy pattern ID"},
                    "relevance": {"type": "number", "description": "Relevance score 0.0-1.0"},
                    "reason": {"type": "string", "description": "Brief reason for ranking"},
                },
                "required": ["pattern_id", "relevance"],
            },
            "description": "Strategies ranked by relevance",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self.rankings: List[Dict[str, Any]] = []

    def forward(self, rankings: List[Dict[str, Any]]) -> str:
        self.rankings = rankings
        return f"Ranked {len(rankings)} strategies"

    def get_rankings(self) -> List[Dict[str, Any]]:
        return self.rankings


@dataclass
class StrategyAccumulationService:
    """
    Records successful execution patterns and surfaces them to planner.

    Uses LLM for semantic matching when finding relevant strategies.
    """

    registry: StrategyRegistry = field(default_factory=StrategyRegistry)
    model_provider: Optional[ModelProvider] = None
    org_model: Optional[str] = None

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
        Find strategies relevant to a goal using LLM semantic matching.

        Falls back to keyword matching if no model_provider available.
        """
        # Filter by confidence first
        candidates = [
            r for r in self.registry.strategies.values()
            if r.confidence_score >= min_confidence
        ]

        if not candidates:
            logger.info("📊 No strategies above confidence threshold")
            return []

        # Use LLM for semantic matching if available
        ranked = []
        if self.model_provider and len(candidates) > 0:
            ranked = self._llm_rank_strategies(goal, candidates)
            if ranked:
                logger.info(f"📊 LLM ranked {len(ranked)} relevant strategies")
                return ranked[:max_results]
        else:
            logger.info("📊 LLM did not find relevant strategies")
            return []

        return ranked[:max_results]

    def _llm_rank_strategies(
        self,
        goal: str,
        candidates: List[StrategyRecord],
    ) -> List[StrategyRecord]:
        """Use LLM to rank strategies by semantic relevance."""
        if not self.model_provider:
            return []

        # Prepare strategy summaries for LLM
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

        # Build prompt
        template = _jinja_env.get_template("strategy_matching.j2")
        prompt = template.render(goal=goal, strategies=strategy_summaries)

        # Get model and run ranking
        model_id = self.model_provider.resolve_model_selection(org_model=self.org_model)
        model = self.model_provider.get_model(model_id=model_id)

        ranking_tool = StrategyRankingTool()
        ranker = ToolCallingAgent(
            tools=[ranking_tool],
            model=model,
            max_steps=2,
            verbosity_level=LogLevel.OFF,
        )
        ranker.run(task=prompt, reset=True)  # reset=True for context isolation

        # Map rankings back to records
        rankings = ranking_tool.get_rankings()
        id_to_record = {r.pattern.pattern_id: r for r in candidates}

        ranked_records = []
        for rank in rankings:
            pattern_id = rank.get("pattern_id")
            if pattern_id and pattern_id in id_to_record:
                ranked_records.append(id_to_record[pattern_id])

        return ranked_records

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
    model_provider: Optional[ModelProvider] = None,
    org_model: Optional[str] = None,
) -> StrategyAccumulationService:
    """Factory function to create StrategyAccumulationService."""
    return StrategyAccumulationService(
        registry=registry or StrategyRegistry(),
        model_provider=model_provider,
        org_model=org_model,
    )
