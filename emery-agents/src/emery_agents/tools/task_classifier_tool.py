"""
Task Classifier Tool - Structured output for LLM-based task classification.

AIDEV-NOTE: Uses tool-based structured output pattern (like EvaluatorAgent).
The LLM calls this tool to report classification results instead of returning
unstructured text. This ensures reliable parsing and type safety.

The classifier determines execution MODE only - capability discovery happens
in the chat planner, not here.
"""

from typing import List, Optional, Dict, Any, TypedDict
from smolagents import Tool


class ClassificationResult(TypedDict):
    """Structured result from TaskClassifierTool for type safety."""

    mode: str  # "DIRECT" or "PLAN_AND_APPROVE"
    needs_clarification: bool
    clarification_questions: List[str]
    reasoning: str


class TaskClassifierTool(Tool):  # type: ignore[misc]
    """
    Tool for LLM to report task classification results.

    The classifier LLM calls this tool with structured results:
    - mode: DIRECT or PLAN_AND_APPROVE
    - needs_clarification: whether questions should be asked first
    - clarification_questions: questions to ask the user
    - reasoning: explanation of the classification

    NOTE: This tool does NOT route to specific agents - that's handled by
    capability discovery in the chat planner.
    """

    name = "report_task_classification"
    description = """Report your classification of the user's task.

You MUST call this tool with your analysis. Include:
- mode: Whether this is DIRECT (simple command) or PLAN_AND_APPROVE (needs planning)
- needs_clarification: True if questions should be asked before proceeding
- clarification_questions: List of specific questions to ask the user
- reasoning: Brief explanation of your decision"""

    inputs = {
        "mode": {
            "type": "string",
            "description": "DIRECT (simple, clear command) or PLAN_AND_APPROVE (complex, needs planning/approval)",
        },
        "needs_clarification": {
            "type": "boolean",
            "description": "True if the task is vague or ambiguous and questions should be asked before proceeding",
        },
        "clarification_questions": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Specific questions to ask the user to clarify their request. Keep minimal and actionable.",
        },
        "reasoning": {
            "type": "string",
            "description": "Brief explanation of why you classified the task this way",
        },
    }

    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self._result: Optional[ClassificationResult] = None

    def forward(
        self,
        mode: str,
        needs_clarification: bool,
        clarification_questions: List[str],
        reasoning: str,
    ) -> str:
        """
        Capture the classification result.

        Args:
            mode: DIRECT or PLAN_AND_APPROVE
            needs_clarification: Whether questions should be asked
            clarification_questions: Questions to ask user
            reasoning: Explanation of classification

        Returns:
            Confirmation message
        """
        # Normalize mode
        mode_upper = mode.upper() if mode else "PLAN_AND_APPROVE"
        if mode_upper not in ("DIRECT", "PLAN_AND_APPROVE"):
            mode_upper = "PLAN_AND_APPROVE"

        self._result = {
            "mode": mode_upper,
            "needs_clarification": bool(needs_clarification),
            "clarification_questions": clarification_questions or [],
            "reasoning": reasoning or "",
        }

        return f"Classification recorded: mode={mode_upper}, needs_clarification={needs_clarification}"

    def get_result(self) -> Optional[ClassificationResult]:
        """Get the captured classification result."""
        return self._result

    def reset(self) -> None:
        """Reset the tool for reuse."""
        self._result = None
