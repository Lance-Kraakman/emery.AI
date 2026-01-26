"""
Execution Module

Extracted components from ExecutionCoordinator for maintainability.

- StepExecutor: Executes individual plan steps
- InterruptHandler: Manages interrupt queue and classification
- ReplanHandler: Handles diff-based replanning
- ExecutionState: Unified state management
- Phase: Simplified phase enum (IDLE, WORKING, AWAITING_INPUT, COMPLETE, FAILED)
"""

from .step_executor import StepExecutor
from .interrupt_handler import InterruptHandler, QueuedInterrupt
from .replan_handler import ReplanHandler, ReplanNeedsClarificationError
from .state import (
    Phase,
    InputType,
    WorkMode,
    ClarifyingQuestion,
    PendingInput,
    StepResult,
    ExecutionState,
)

class TaskBuilder:
    """Utility for composing task strings with various feedback types."""

    @staticmethod
    def with_clarification(original: str, response: str) -> str:
        """Compose task with user clarification."""
        return f"{original}\n\nUser's clarification: {response}"

    @staticmethod
    def with_feedback(original: str, feedback: str) -> str:
        """Compose task with user feedback on plan."""
        return f"{original}\n\nUser feedback on plan: {feedback}"

    @staticmethod
    def with_interrupt(goal: str, interrupt: str) -> str:
        """Compose task with user interrupt/update."""
        return f"{goal}\n\nUser feedback: {interrupt}"


__all__ = [
    "StepExecutor",
    "InterruptHandler",
    "QueuedInterrupt",
    "ReplanHandler",
    "ReplanNeedsClarificationError",
    "TaskBuilder",
    # State management
    "Phase",
    "InputType",
    "WorkMode",
    "ClarifyingQuestion",
    "PendingInput",
    "StepResult",
    "ExecutionState",
]
