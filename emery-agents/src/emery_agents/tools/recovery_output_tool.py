"""
Recovery Output Tool - Captures structured recovery analysis from LLM.

AIDEV-NOTE: This follows the same pattern as PlanOutputTool.
The recovery analyzer LLM calls submit_recovery with corrected_parameters
and confidence, which are captured for use in step recovery.
"""

import logging
from typing import Any, Dict, List, Optional

from smolagents import Tool

logger = logging.getLogger(__name__)


class RecoveryOutputTool(Tool):  # type: ignore[misc]
    """
    Tool for recovery analyzer to submit structured recovery analysis.

    The analyzer calls this tool with:
    - confidence: How certain the fix will work (0.0-1.0)
    - corrected_parameters: Parameters to add/change for retry
    - reasoning: Explanation of the analysis
    - questions: Questions to ask user if low confidence
    """

    name = "submit_recovery"
    description = """Submit your recovery analysis for the failed step.

You MUST call this tool after gathering context and analyzing the error.

Include:
- confidence: 0.0-1.0 how certain you are the fix will work
- corrected_parameters: The actual parameter values to add/change for retry
- reasoning: Brief explanation of your analysis
- questions: If confidence < 0.5, what questions should we ask the user?

Example for missing databaseId error:
{
    "confidence": 0.95,
    "corrected_parameters": {"database_id": "abc123"},
    "reasoning": "Found database 'CRM' with ID abc123 in context",
    "questions": []
}

Example for ambiguous error:
{
    "confidence": 0.3,
    "corrected_parameters": {},
    "reasoning": "Error mentions 'table not found' but context shows 5 tables with similar names",
    "questions": ["Which table did you mean?", "Should we create a new table instead?"]
}
"""

    inputs = {
        "confidence": {
            "type": "number",
            "description": "0.0-1.0 confidence in the fix. >=0.8 auto-executes, 0.5-0.8 proposes, <0.5 asks questions",
        },
        "corrected_parameters": {
            "type": "object",
            "description": "Parameters to add/change for retry (e.g., {\"database_id\": \"abc123\"})",
        },
        "reasoning": {
            "type": "string",
            "description": "Brief explanation of your analysis and why you chose these parameters",
        },
        "questions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Questions to ask user if confidence is low. Keep minimal and actionable.",
        },
    }

    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self._result: Optional[Dict[str, Any]] = None

    def forward(
        self,
        confidence: float,
        corrected_parameters: Dict[str, Any],
        reasoning: str,
        questions: Optional[List[str]] = None,
    ) -> str:
        """
        Capture the recovery analysis result.

        Args:
            confidence: 0.0-1.0 confidence in the fix
            corrected_parameters: Parameters to add/change for retry
            reasoning: Explanation of analysis
            questions: Questions to ask user if low confidence

        Returns:
            Confirmation message
        """
        # Clamp confidence to 0.0-1.0
        confidence_clamped = max(0.0, min(1.0, float(confidence)))

        self._result = {
            "confidence": confidence_clamped,
            "corrected_parameters": corrected_parameters or {},
            "reasoning": reasoning or "",
            "questions": questions or [],
        }

        confidence_pct = f"{confidence_clamped:.0%}"
        param_count = len(corrected_parameters) if corrected_parameters else 0

        logger.info(
            f"🔧 Recovery analysis captured: "
            f"confidence={confidence_pct}, {param_count} corrected parameters"
        )
        if corrected_parameters:
            logger.debug(f"  Parameters: {corrected_parameters}")

        return f"Recovery submitted: {confidence_pct} confidence, {param_count} parameters"

    def get_result(self) -> Optional[Dict[str, Any]]:
        """Get the captured recovery result."""
        return self._result

    def reset(self) -> None:
        """Reset the tool for reuse."""
        self._result = None
