"""
Re-export events from executors module for backwards compatibility.

AIDEV-NOTE: Events were moved to services/executors/events.py during Phase 2.5.
This file re-exports them so existing imports from services.execution.events work.

IMPORTANT: Import from the specific events file, not from the executors package
__init__.py to avoid circular imports.
"""

# Re-export everything from the new location (import from specific file, not package)
from emery_agents.services.executors.events import (
    AutoFixCompletedEvent,
    AutoFixStartedEvent,
    AwaitingClarificationEvent,
    AwaitingHumanSkillEvent,
    ClarifyingQuestion,
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
    ReflectionCompletedEvent,
    ReplanTriggeredEvent,
    StepCompletedEvent,
    StepFailedEvent,
    StepStartedEvent,
    ToolLoadedEvent,
)

__all__ = [
    "AutoFixCompletedEvent",
    "AutoFixStartedEvent",
    "AwaitingClarificationEvent",
    "AwaitingHumanSkillEvent",
    "ClarifyingQuestion",
    "ContextInjectedEvent",
    "ErrorEvent",
    "EvaluationCompletedEvent",
    "EvaluationResult",
    "ExecutionBlockedEvent",
    "ExecutionCompletedEvent",
    "FinalSynthesisEvent",
    "GoalAchievedEvent",
    "InterruptProcessingEvent",
    "InterruptQueuedEvent",
    "InterruptReceivedEvent",
    "PendingContext",
    "PhaseCompletedEvent",
    "PhaseStartedEvent",
    "PlanApprovedEvent",
    "PlanCancelledEvent",
    "PlanCreatedEvent",
    "PlanFeedbackEvent",
    "PlanningStartedEvent",
    "PlanRejectedEvent",
    "PlanUpdatedEvent",
    "RecoveryAnalysisEvent",
    "RecoveryPlanProposedEvent",
    "ReflectionCompletedEvent",
    "ReplanTriggeredEvent",
    "StepCompletedEvent",
    "StepFailedEvent",
    "StepStartedEvent",
    "ToolLoadedEvent",
]
