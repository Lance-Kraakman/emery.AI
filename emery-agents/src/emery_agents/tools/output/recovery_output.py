"""
Recovery Output Tool - Captures structured recovery analysis from LLM.

Ported from tools/recovery_output_tool.py as DSPy-compatible function.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class RecoveryResult:
    """Captured recovery analysis result."""

    confidence: float = 0.0
    corrected_parameters: dict[str, Any] = field(default_factory=dict)
    reasoning: str = ""
    questions: list[str] = field(default_factory=list)
    captured: bool = False


class RecoveryCollector:
    """Stateful container for collecting recovery analysis."""

    def __init__(self) -> None:
        self.result: RecoveryResult = RecoveryResult()

    def get_result(self) -> RecoveryResult | None:
        """Get the captured recovery result."""
        return self.result if self.result.captured else None

    def has_result(self) -> bool:
        """Check if a result has been captured."""
        return self.result.captured

    def reset(self) -> None:
        """Reset for reuse."""
        self.result = RecoveryResult()


def create_recovery_output_tool(
    collector: RecoveryCollector,
) -> Callable[..., str]:
    """
    Factory: Create submit_recovery function with collector captured in closure.

    Args:
        collector: RecoveryCollector instance to store captured results

    Returns:
        submit_recovery function that DSPy ReAct can use
    """

    def submit_recovery(
        confidence: float,
        corrected_parameters: dict[str, Any],
        reasoning: str,
        questions: list[str] | None = None,
    ) -> str:
        """Submit your recovery analysis for the failed step.

        You MUST call this tool after gathering context and analyzing the error.

        Args:
            confidence: 0.0-1.0 how certain you are the fix will work.
                >=0.8 auto-executes, 0.5-0.8 proposes, <0.5 asks questions
            corrected_parameters: Parameters to add/change for retry
                (e.g., {"database_id": "abc123"})
            reasoning: Brief explanation of your analysis and why you chose
                these parameters
            questions: Questions to ask user if confidence is low.
                Keep minimal and actionable.

        Returns:
            Confirmation message
        """
        # Clamp confidence to 0.0-1.0
        confidence_clamped = max(0.0, min(1.0, float(confidence)))

        collector.result = RecoveryResult(
            confidence=confidence_clamped,
            corrected_parameters=corrected_parameters or {},
            reasoning=reasoning or "",
            questions=questions or [],
            captured=True,
        )

        confidence_pct = f"{confidence_clamped:.0%}"
        param_count = len(corrected_parameters) if corrected_parameters else 0

        logger.info(
            f"Recovery analysis captured: "
            f"confidence={confidence_pct}, {param_count} corrected parameters"
        )
        if corrected_parameters:
            logger.debug(f"  Parameters: {corrected_parameters}")

        return (
            f"Recovery submitted: {confidence_pct} confidence, {param_count} parameters"
        )

    return submit_recovery
