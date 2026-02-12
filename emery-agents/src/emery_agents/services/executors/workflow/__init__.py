"""
Workflow execution module.

This module exports only lightweight types at package level.
For executor classes, import directly from submodules:

    from emery_agents.services.executors.workflow.orchestrator import WorkflowOrchestrator
    from emery_agents.services.executors.workflow.loop import LoopExecutor
    from emery_agents.services.executors.workflow.handlers import StepHandlerRouter

Types available at package level:
- WorkflowStep: Step configuration
- StepProgress: Progress update for UI
- StepError: Error details for step context
"""

# Light imports only - types don't cause circular dependencies
from .types import StepError, StepProgress, WorkflowStep

__all__ = [
    "StepError",
    "StepProgress",
    "WorkflowStep",
]
