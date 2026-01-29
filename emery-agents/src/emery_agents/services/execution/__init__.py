"""
Execution Module

Extracted components from ExecutionCoordinator for maintainability.

- StepExecutor: Executes individual plan steps
- InterruptHandler: Manages interrupt queue and classification
- ReplanHandler: Handles diff-based replanning
- ExecutionState: Unified state management
- Phase: Simplified phase enum (IDLE, WORKING, AWAITING_INPUT, COMPLETE, FAILED)
- Events: All coordinator event types for UI feedback
- Config: Coordinator configuration classes
"""

from .step_executor import StepExecutor
from .plan_step_executor import PlanStepExecutor
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
from .config import (
    CoordinatorMode,
    ExecutionCoordinatorConfig,
)
from .events import (
    PendingContext,
    PlanCreatedEvent,
    PlanApprovedEvent,
    PlanRejectedEvent,
    PlanFeedbackEvent,
    StepStartedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    EvaluationResult,
    EvaluationCompletedEvent,
    ReplanTriggeredEvent,
    PlanUpdatedEvent,
    PhaseStartedEvent,
    PhaseCompletedEvent,
    GoalAchievedEvent,
    ExecutionBlockedEvent,
    RecoveryAnalysisEvent,
    AutoFixStartedEvent,
    AutoFixCompletedEvent,
    RecoveryPlanProposedEvent,
    ErrorEvent,
    InterruptQueuedEvent,
    InterruptReceivedEvent,
    InterruptProcessingEvent,
    PlanCancelledEvent,
    ContextInjectedEvent,
    ClarifyingQuestion as EventClarifyingQuestion,  # More detailed version for events
    AwaitingClarificationEvent,
    PlanningStartedEvent,
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
    "PlanStepExecutor",
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
    # Config
    "CoordinatorMode",
    "ExecutionCoordinatorConfig",
    # Events
    "PendingContext",
    "PlanCreatedEvent",
    "PlanApprovedEvent",
    "PlanRejectedEvent",
    "PlanFeedbackEvent",
    "StepStartedEvent",
    "StepCompletedEvent",
    "StepFailedEvent",
    "ExecutionCompletedEvent",
    "FinalSynthesisEvent",
    "EvaluationResult",
    "EvaluationCompletedEvent",
    "ReplanTriggeredEvent",
    "PlanUpdatedEvent",
    "PhaseStartedEvent",
    "PhaseCompletedEvent",
    "GoalAchievedEvent",
    "ExecutionBlockedEvent",
    "RecoveryAnalysisEvent",
    "AutoFixStartedEvent",
    "AutoFixCompletedEvent",
    "RecoveryPlanProposedEvent",
    "ErrorEvent",
    "InterruptQueuedEvent",
    "InterruptReceivedEvent",
    "InterruptProcessingEvent",
    "PlanCancelledEvent",
    "ContextInjectedEvent",
    "EventClarifyingQuestion",
    "AwaitingClarificationEvent",
    "PlanningStartedEvent",
]
