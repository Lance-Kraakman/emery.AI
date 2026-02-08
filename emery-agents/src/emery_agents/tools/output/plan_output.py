"""
Plan Output Tool - Captures structured plan from planner agent.

Ported from tools/plan_output_tool.py as DSPy-compatible function.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class NormalizedStepData:
    """Normalized step data captured from planner output."""

    description: str
    target_agent: str | None = None
    prompt_template: str | None = None
    required_context: list[str] = field(default_factory=list)
    phase_name: str | None = None
    phase_order: int | None = None
    replan_after: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for captured_plan storage."""
        return {
            "description": self.description,
            "target_agent": self.target_agent,
            "prompt_template": self.prompt_template,
            "required_context": self.required_context,
            "phase_name": self.phase_name,
            "phase_order": self.phase_order,
            "replan_after": self.replan_after,
        }


@dataclass
class CapturedPlan:
    """Captured plan structure."""

    goal: str = ""
    steps: list[dict[str, Any]] = field(default_factory=list)
    context: str | None = None
    analysis: str | None = None
    captured: bool = False


class PlanCollector:
    """Stateful container for collecting plans."""

    def __init__(self) -> None:
        self.plan: CapturedPlan = CapturedPlan()

    def get_plan(self) -> dict[str, Any] | None:
        """Get the captured plan as dict."""
        if not self.plan.captured:
            return None
        return {
            "goal": self.plan.goal,
            "steps": self.plan.steps,
            "context": self.plan.context,
            "analysis": self.plan.analysis,
        }

    def has_plan(self) -> bool:
        """Check if a plan has been captured."""
        return self.plan.captured

    def reset(self) -> None:
        """Reset for reuse."""
        self.plan = CapturedPlan()


def create_plan_output_tool(
    collector: PlanCollector,
) -> Callable[..., str]:
    """
    Factory: Create submit_plan function with collector captured in closure.

    Args:
        collector: PlanCollector instance to store captured plans

    Returns:
        submit_plan function that DSPy ReAct can use
    """

    def submit_plan(
        goal: str,
        steps: list[Any],
        context: str | None = None,
        analysis: str | None = None,
    ) -> str:
        """Submit a structured execution plan with context and analysis.

        IMPORTANT: Only call this AFTER you have gathered context using
        database_list() and table_list().

        Args:
            goal: Clear statement of what will be achieved
            steps: List of step objects with description and optional target_agent.
                Each step object should have:
                - description: Human-readable description of what will be done
                - target_agent: (optional) Name of managed agent to handle this step
                - phase_name: (optional) Logical phase grouping
                - phase_order: (optional) Order of this phase (1, 2, 3...)
                - replan_after: (optional) If true, replan after this step
            context: What you discovered from listing databases/tables
            analysis: Your analysis of what needs to change and why

        Returns:
            Confirmation message
        """
        # Normalize steps to ensure consistent structure
        normalized_steps: list[NormalizedStepData] = []
        for step in steps:
            if isinstance(step, dict):
                normalized_steps.append(
                    NormalizedStepData(
                        description=step.get("description", str(step)),
                        target_agent=step.get("target_agent"),
                        prompt_template=step.get("prompt_template"),
                        required_context=step.get("required_context", []),
                        phase_name=step.get("phase_name"),
                        phase_order=step.get("phase_order"),
                        replan_after=step.get("replan_after", False),
                    )
                )
            else:
                # Unexpected format - handle gracefully
                logger.warning(
                    f"Unexpected step format (expected dict): {type(step).__name__}. "
                    f"String steps are deprecated."
                )
                normalized_steps.append(NormalizedStepData(description=str(step)))

        # Apply phase defaults
        for step in normalized_steps:
            if not step.phase_name:
                step.phase_name = "Execution"
            if step.phase_order is None:
                step.phase_order = 1

        # If LLM explicitly set Discovery/Analysis, default replan_after to true
        for step in normalized_steps:
            if step.phase_name in ("Discovery", "Analysis") and not step.replan_after:
                step.replan_after = True

        collector.plan = CapturedPlan(
            goal=goal,
            steps=[s.to_dict() for s in normalized_steps],
            context=context,
            analysis=analysis,
            captured=True,
        )

        logger.info(f"Plan captured: {goal} ({len(normalized_steps)} steps)")
        if context:
            logger.debug(f"  Context: {context[:100]}...")
        if analysis:
            logger.debug(f"  Analysis: {analysis[:100]}...")
        for i, step in enumerate(normalized_steps, 1):
            agent_info = f" [{step.target_agent}]" if step.target_agent else ""
            desc = step.description or ""
            logger.debug(f"  Step {i}{agent_info}: {desc[:80]}...")

        return f"Plan submitted: {goal} with {len(normalized_steps)} steps"

    return submit_plan
