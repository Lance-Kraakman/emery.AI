"""
Task Classifier Tool - Structured output for LLM-based task classification.

Ported from tools/task_classifier_tool.py - removes smolagents.Tool dependency.

Uses tool-based structured output pattern. The LLM calls this tool to report
classification results instead of returning unstructured text.
"""

from __future__ import annotations

from typing import Any, TypedDict


class ClassificationResult(TypedDict):
    """Structured result from TaskClassifierTool for type safety."""

    mode: str  # "DIRECT" or "PLAN_AND_APPROVE"
    needs_clarification: bool
    clarification_questions: list[str]
    reasoning: str


class TaskClassifierTool:
    """
    Tool for LLM to report task classification results.

    The classifier LLM calls this tool with structured results:
    - mode: DIRECT or PLAN_AND_APPROVE
    - needs_clarification: whether questions should be asked first
    - clarification_questions: questions to ask the user
    - reasoning: explanation of the classification

    Attributes:
        name: Tool name for LLM
        description: Tool description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type
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
        self._result: ClassificationResult | None = None

    def __call__(self, **kwargs: Any) -> str:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def forward(
        self,
        mode: str,
        needs_clarification: bool,
        clarification_questions: list[str],
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

    def get_result(self) -> ClassificationResult | None:
        """Get the captured classification result."""
        return self._result

    def reset(self) -> None:
        """Reset the tool for reuse."""
        self._result = None


def create_task_classifier_tool() -> TaskClassifierTool:
    """
    Create task classifier tool.

    Returns:
        TaskClassifierTool instance
    """
    return TaskClassifierTool()
