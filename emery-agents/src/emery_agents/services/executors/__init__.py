"""
Executors module for skill and workflow execution.

This module exports only lightweight types and events at package level.
For executor classes, import directly from submodules:

    from emery_agents.services.executors.agentic import AgenticExecutor
    from emery_agents.services.executors.interactive import InteractiveExecutor
    from emery_agents.services.executors.coordinator import CoordinatorExecutor
    from emery_agents.services.executors.router import ExecutionRouter
    from emery_agents.services.executors.shared.output_pipeline import OutputPipeline
    from emery_agents.services.executors.shared.human_skill import HumanSkillHandler
    from emery_agents.services.executors.workflow.orchestrator import WorkflowOrchestrator

This avoids circular imports that occur when heavy modules are loaded at package init time.
"""

# Light imports only - events and types don't cause circular dependencies
from .events import (
    EvaluationCompletedEvent,
    ExecutionBlockedEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    GoalAchievedEvent,
    PlanCreatedEvent,
    ReplanTriggeredEvent,
    StepCompletedEvent,
    StepFailedEvent,
    StepStartedEvent,
)
from .workflow.types import StepError, StepProgress, WorkflowStep

__all__ = [
    # Types (safe to import at package level)
    "StepError",
    "StepProgress",
    "WorkflowStep",
    # Events (safe to import at package level)
    "EvaluationCompletedEvent",
    "ExecutionBlockedEvent",
    "ExecutionCompletedEvent",
    "FinalSynthesisEvent",
    "GoalAchievedEvent",
    "PlanCreatedEvent",
    "ReplanTriggeredEvent",
    "StepCompletedEvent",
    "StepFailedEvent",
    "StepStartedEvent",
]
