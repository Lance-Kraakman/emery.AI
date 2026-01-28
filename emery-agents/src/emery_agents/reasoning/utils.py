"""
DSPy reasoning utilities.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def extract_dspy_result(prediction_or_str: Any) -> str:
    """
    Extract the result string from a DSPy Prediction object.

    DSPy modules (ReAct, ChainOfThought) return Prediction objects whose
    str() includes internal trajectory data. This helper extracts just
    the result field, or falls back to str() for non-Prediction values.
    """
    if isinstance(prediction_or_str, str):
        return prediction_or_str
    if hasattr(prediction_or_str, "result"):
        return str(prediction_or_str.result)
    return str(prediction_or_str)


# ---------------------------------------------------------------------------
# Structured step outcomes — carries raw tool call results alongside LLM text
# ---------------------------------------------------------------------------


@dataclass
class ToolCallOutcome:
    """Result of a single tool call within a step execution."""

    tool_name: str
    success: bool
    output: str

    def to_dict(self) -> dict[str, Any]:
        return {"tool_name": self.tool_name, "success": self.success, "output": self.output}


@dataclass
class StepOutcome:
    """Structured result from executing a plan step.

    Carries both the LLM's text interpretation (summary) and
    parsed tool call outcomes from the DSPy ReAct trajectory.
    """

    summary: str
    success: bool
    tool_calls: list[ToolCallOutcome] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "success": self.success,
            "tool_calls": [tc.to_dict() for tc in self.tool_calls],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> StepOutcome:
        return cls(
            summary=d["summary"],
            success=d["success"],
            tool_calls=[ToolCallOutcome(**tc) for tc in d.get("tool_calls", [])],
        )

    def format_evidence(self) -> str:
        """Format tool outcomes as structured evidence text for the evaluator."""
        if not self.tool_calls:
            return "No tool calls made."
        lines = []
        for tc in self.tool_calls:
            status = "SUCCESS" if tc.success else "FAILED"
            preview = tc.output[:200] + "..." if len(tc.output) > 200 else tc.output
            lines.append(f"- {tc.tool_name}: {status} → {preview}")
        return "\n".join(lines)


def build_step_outcome(result_text: str, trajectory: dict[str, Any] | None) -> StepOutcome:
    """Build StepOutcome from DSPy ReAct result text and trajectory.

    Parses trajectory keys (tool_name_N, observation_N) to extract
    raw tool outcomes. Classifies success/failure based on output prefix.
    """
    tool_calls: list[ToolCallOutcome] = []
    if trajectory:
        idx = 0
        while f"tool_name_{idx}" in trajectory:
            tool_name = str(trajectory.get(f"tool_name_{idx}", "unknown"))
            observation = str(trajectory.get(f"observation_{idx}", ""))

            success = not (
                observation.startswith("ERROR:")
                or observation.startswith("Execution error")
                or observation.startswith("BLOCKED:")
            )

            truncated = observation[:500] if len(observation) > 500 else observation
            tool_calls.append(ToolCallOutcome(
                tool_name=tool_name,
                success=success,
                output=truncated,
            ))
            idx += 1

    # Determine step success:
    # If the ReAct agent explicitly called "finish" successfully, it saw any
    # intermediate errors and decided the step was complete — trust its judgment.
    # Otherwise fall back to strict all-or-nothing check.
    finished_explicitly = any(
        tc.tool_name == "finish" and tc.success for tc in tool_calls
    )
    if finished_explicitly:
        step_success = True
    else:
        step_success = all(tc.success for tc in tool_calls) if tool_calls else True

    return StepOutcome(
        summary=result_text,
        success=step_success,
        tool_calls=tool_calls,
    )
