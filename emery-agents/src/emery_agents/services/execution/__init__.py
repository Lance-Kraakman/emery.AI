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
from .interrupt_handler import InterruptHandler
from .replan_handler import ReplanHandler, ReplanNeedsClarificationError
from .state import (
    Phase,
    ExecutionPhase,  # Backward compat alias
    InputType,
    ClarifyingQuestion,
    PendingInput,
    StepResult,
    ExecutionState,
)

__all__ = [
    "StepExecutor",
    "InterruptHandler",
    "ReplanHandler",
    "ReplanNeedsClarificationError",
    # State management
    "Phase",
    "ExecutionPhase",
    "InputType",
    "ClarifyingQuestion",
    "PendingInput",
    "StepResult",
    "ExecutionState",
]
