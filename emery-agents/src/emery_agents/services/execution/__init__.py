"""
Execution Module

This module exports lightweight components that don't cause circular imports:
- Events: All coordinator event types for UI feedback
- State: ExecutionState, Phase, WorkMode, etc.
- Handlers: InterruptHandler, ReplanHandler
- TaskBuilder: Utility for composing task strings

For executors, import directly from services.executors to avoid cycles:
- from emery_agents.services.executors.agentic import AgenticExecutor
- from emery_agents.services.executors.interactive import InteractiveExecutor
- from emery_agents.services.executors.coordinator import CoordinatorExecutor
- from emery_agents.services.executors.router import ExecutionRouter
- from emery_agents.services.executors.shared.output_pipeline import OutputPipeline
- from emery_agents.services.executors.shared.human_skill import HumanSkillHandler

Other submodules (import directly):
- StepExecutor: from .step_executor
- PlanStepExecutor: from .plan_step_executor
- CoordinatorMode, ExecutionCoordinatorConfig: from .config
"""

from .events import (
    AutoFixCompletedEvent,
    AutoFixStartedEvent,
    AwaitingClarificationEvent,
    ContextInjectedEvent,
    ErrorEvent,
    EvaluationCompletedEvent,
    EvaluationResult,
    ExecutionBlockedEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    GoalAchievedEvent,
    InterruptProcessingEvent,
    InterruptQueuedEvent,
    InterruptReceivedEvent,
    PendingContext,
    PhaseCompletedEvent,
    PhaseStartedEvent,
    PlanApprovedEvent,
    PlanCancelledEvent,
    PlanCreatedEvent,
    PlanFeedbackEvent,
    PlanningStartedEvent,
    PlanRejectedEvent,
    PlanUpdatedEvent,
    RecoveryAnalysisEvent,
    RecoveryPlanProposedEvent,
    ReplanTriggeredEvent,
    StepCompletedEvent,
    StepFailedEvent,
    StepStartedEvent,
)
from .events import (
    ClarifyingQuestion as EventClarifyingQuestion,  # More detailed version for events
)
from .interrupt_handler import InterruptHandler, QueuedInterrupt
from .replan_handler import ReplanHandler, ReplanNeedsClarificationError
from .state import (
    ClarifyingQuestion,
    ExecutionState,
    InputType,
    PendingInput,
    Phase,
    StepResult,
    WorkMode,
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
    # Interrupt handling
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
    # Config: import directly from .config
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
