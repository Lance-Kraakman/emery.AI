"""
Step Output Tool - Captures structured steps from domain planners.

Ported from tools/step_output_tool.py as DSPy-compatible function.
"""

from __future__ import annotations

import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


class StepCollector:
    """
    Stateful container for collecting steps during planning.

    Used by the output_steps tool function.
    """

    def __init__(self) -> None:
        self._steps: list[dict[str, Any]] = []
        self._analysis: str = ""

    def get_steps(self) -> list[dict[str, Any]]:
        """Get the captured steps."""
        return self._steps

    def get_analysis(self) -> str:
        """Get the captured analysis."""
        return self._analysis

    def reset(self) -> None:
        """Reset captured state for reuse."""
        self._steps = []
        self._analysis = ""


def create_step_output_tool(
    collector: StepCollector,
) -> Callable[[list[dict[str, Any]], str], str]:
    """
    Factory: Create output_steps function with collector captured in closure.

    Args:
        collector: StepCollector instance to store collected steps

    Returns:
        output_steps function that DSPy ReAct can use
    """

    def output_steps(
        steps: list[dict[str, Any]],
        analysis: str = "",
    ) -> str:
        """Output the generated plan steps for this domain.

        Use this tool to submit your steps:
        - steps: List of step objects with description and target_agent
        - analysis: Brief analysis of your approach

        Each step object should have:
        - description: What needs to be done (be specific, include details)
        - target_agent: Which agent will execute this step
        - phase_name: (optional) Phase grouping like "Discovery", "Schema", "App"
        - phase_order: (optional) Order within phases

        Args:
            steps: List of step objects with description and target_agent
            analysis: Brief analysis of the approach taken

        Returns:
            Confirmation message
        """
        # Normalize and store steps
        normalized_steps: list[dict[str, Any]] = []
        for step in steps:
            if isinstance(step, dict):
                normalized_steps.append({
                    "description": step.get("description", str(step)),
                    "target_agent": step.get("target_agent"),
                    "phase_name": step.get("phase_name"),
                    "phase_order": step.get("phase_order"),
                })
            else:
                logger.warning(f"Unexpected step format: {type(step).__name__}")
                normalized_steps.append({
                    "description": str(step),
                    "target_agent": None,
                })

        collector._steps = normalized_steps
        collector._analysis = analysis or ""

        logger.info(f"📋 Domain planner captured {len(normalized_steps)} steps")
        for i, step in enumerate(normalized_steps, 1):
            agent = step.get("target_agent", "?")
            desc = step.get("description", "")[:60]
            logger.debug(f"  Step {i} [{agent}]: {desc}...")

        return f"Captured {len(normalized_steps)} steps"

    return output_steps
