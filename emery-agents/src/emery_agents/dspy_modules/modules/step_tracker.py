"""
Step Tracker - Custom step tracking for DSPy modules.

Replaces smolagents ActionStep, PlanningStep, FinalAnswerStep with
DSPy-compatible step tracking for metrics and progress reporting.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class StepType(str, Enum):
    """Types of execution steps."""

    ACTION = "action"
    PLANNING = "planning"
    THINKING = "thinking"
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    FINAL = "final"
    ERROR = "error"


@dataclass
class TokenUsage:
    """Token usage for a step."""

    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    model_name: str = ""


@dataclass
class ToolCall:
    """A tool call made during execution."""

    tool_name: str
    arguments: dict[str, Any]
    result: Any = None
    error: str | None = None
    duration_ms: int = 0


@dataclass
class TrackedStep:
    """A tracked execution step.

    Replaces smolagents ActionStep/PlanningStep/FinalAnswerStep.
    """

    step_type: StepType
    content: str
    step_index: int = 0
    timestamp: datetime = field(default_factory=datetime.now)
    tool_calls: list[ToolCall] = field(default_factory=list)
    token_usage: TokenUsage | None = None
    reasoning: str | None = None  # For ReAct thought/observation
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "step_type": self.step_type.value,
            "content": self.content,
            "step_index": self.step_index,
            "timestamp": self.timestamp.isoformat(),
            "tool_calls": [
                {
                    "tool_name": tc.tool_name,
                    "arguments": tc.arguments,
                    "result": str(tc.result) if tc.result else None,
                    "error": tc.error,
                    "duration_ms": tc.duration_ms,
                }
                for tc in self.tool_calls
            ],
            "token_usage": {
                "input_tokens": self.token_usage.input_tokens,
                "output_tokens": self.token_usage.output_tokens,
                "total_tokens": self.token_usage.total_tokens,
            }
            if self.token_usage
            else None,
            "reasoning": self.reasoning,
            "metadata": self.metadata,
        }


class StepTracker:
    """Tracks execution steps for a DSPy module run.

    Provides step collection and metrics similar to smolagents agent.memory.steps.
    """

    def __init__(self) -> None:
        """Initialize step tracker."""
        self.steps: list[TrackedStep] = []
        self.start_time: datetime | None = None
        self.end_time: datetime | None = None

    def start(self) -> None:
        """Mark the start of execution."""
        self.start_time = datetime.now()
        self.steps = []

    def end(self) -> None:
        """Mark the end of execution."""
        self.end_time = datetime.now()

    def add_step(
        self,
        step_type: StepType,
        content: str,
        *,
        tool_calls: list[ToolCall] | None = None,
        token_usage: TokenUsage | None = None,
        reasoning: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> TrackedStep:
        """Add a step to the tracker.

        Args:
            step_type: Type of step
            content: Main content/output of the step
            tool_calls: Any tool calls made in this step
            token_usage: Token usage for this step
            reasoning: ReAct thought/observation
            metadata: Additional metadata

        Returns:
            The created TrackedStep
        """
        step = TrackedStep(
            step_type=step_type,
            content=content,
            step_index=len(self.steps),
            tool_calls=tool_calls or [],
            token_usage=token_usage,
            reasoning=reasoning,
            metadata=metadata or {},
        )
        self.steps.append(step)
        return step

    def add_action(
        self,
        content: str,
        tool_calls: list[ToolCall] | None = None,
        **kwargs: Any,
    ) -> TrackedStep:
        """Add an action step (convenience method)."""
        return self.add_step(StepType.ACTION, content, tool_calls=tool_calls, **kwargs)

    def add_planning(self, content: str, **kwargs: Any) -> TrackedStep:
        """Add a planning step (convenience method)."""
        return self.add_step(StepType.PLANNING, content, **kwargs)

    def add_final(self, content: str, **kwargs: Any) -> TrackedStep:
        """Add a final answer step (convenience method)."""
        return self.add_step(StepType.FINAL, content, **kwargs)

    def get_total_tokens(self) -> TokenUsage:
        """Get total token usage across all steps."""
        total = TokenUsage()
        for step in self.steps:
            if step.token_usage:
                total.input_tokens += step.token_usage.input_tokens
                total.output_tokens += step.token_usage.output_tokens
                total.total_tokens += step.token_usage.total_tokens
                total.cost_usd += step.token_usage.cost_usd
        return total

    def get_duration_ms(self) -> int:
        """Get total execution duration in milliseconds."""
        if not self.start_time:
            return 0
        end = self.end_time or datetime.now()
        return int((end - self.start_time).total_seconds() * 1000)

    def to_dict(self) -> dict[str, Any]:
        """Convert tracker state to dictionary."""
        return {
            "steps": [s.to_dict() for s in self.steps],
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "duration_ms": self.get_duration_ms(),
            "total_steps": len(self.steps),
            "total_tokens": self.get_total_tokens().__dict__,
        }


# Type aliases for backward compatibility with smolagents-style code
ActionStep = TrackedStep
PlanningStep = TrackedStep
FinalAnswerStep = TrackedStep
