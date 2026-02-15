"""
Execution Router - Single entry point for all execution modes.

Routes execution requests to the appropriate executor based on request type.

AIDEV-NOTE: Part of Phase 3.1 refactoring (Feb 2026).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any, Union

from emery_agents.types import SkillExecutionResult

from .agentic import AgenticExecutor, get_agentic_executor
from .coordinator import CoordinatorExecutor, get_coordinator_executor
from .interactive import InteractiveExecutor, get_interactive_executor
from .shared.human_skill import HumanSkillHandler, get_human_skill_handler
from .workflow.orchestrator import WorkflowOrchestrator, get_workflow_orchestrator
from .workflow.handlers.router import StepHandlerRouter, get_step_handler_router

if TYPE_CHECKING:
    from emery_agents.entities.configs import (
        CoordinatorRequest,
        InteractiveRequest,
        SkillRequest,
        WorkflowRequest,
    )
    from emery_agents.planning.registry import PlanningRegistry
    from emery_agents.tools.capability_registry import CapabilityRegistry

logger = logging.getLogger(__name__)

# Union type for all request types
ExecutionRequest = Union[
    "InteractiveRequest",
    "SkillRequest",
    "WorkflowRequest",
    "CoordinatorRequest",
]


class ExecutionRouter:
    """Routes execution requests to appropriate executors.

    Single entry point that replaces:
    - AgentExecutor routing logic
    - SkillExecutorService routing logic

    Routes based on request type:
    - InteractiveRequest → InteractiveExecutor
    - SkillRequest → AgenticExecutor (or HumanSkillHandler for human skills)
    - WorkflowRequest → WorkflowOrchestrator
    - CoordinatorRequest → CoordinatorExecutor
    """

    def __init__(
        self,
        interactive_executor: InteractiveExecutor | None = None,
        agentic_executor: AgenticExecutor | None = None,
        workflow_orchestrator: WorkflowOrchestrator | None = None,
        coordinator_executor: CoordinatorExecutor | None = None,
        human_skill_handler: HumanSkillHandler | None = None,
        step_handler_router: StepHandlerRouter | None = None,
    ):
        """Initialize router with executors.

        Args:
            interactive_executor: Executor for direct chat commands
            agentic_executor: Executor for skill-based LLM orchestration
            workflow_orchestrator: Orchestrator for DAG workflows
            coordinator_executor: Executor for two-phase plan-execute
            human_skill_handler: Handler for human skills
            step_handler_router: Router for workflow step handling
        """
        self.interactive = interactive_executor or get_interactive_executor()
        self.agentic = agentic_executor or get_agentic_executor()
        self.workflow = workflow_orchestrator or get_workflow_orchestrator()
        self.coordinator = coordinator_executor or get_coordinator_executor()
        self.human_handler = human_skill_handler or get_human_skill_handler()
        self.step_handler = step_handler_router or get_step_handler_router()

    async def execute_interactive(
        self,
        request: InteractiveRequest,
    ) -> AsyncIterator[dict[str, Any]]:
        """Execute an interactive request (direct chat command).

        Args:
            request: InteractiveRequest with task, tools, auth

        Yields:
            Progress dicts with status, output, timestamp_ms, progress_percent
        """
        logger.info("🎯 Routing to InteractiveExecutor")
        async for progress in self.interactive.execute(request):
            yield progress

    def execute_skill(
        self,
        request: SkillRequest,
        progress_callback: Any | None = None,
    ) -> str | SkillExecutionResult:
        """Execute a skill request (sync path).

        Args:
            request: SkillRequest with skill config, inputs, auth
            progress_callback: Optional callback for streaming progress

        Returns:
            SkillExecutionResult if capture_outputs=True, else result string
        """
        skill = request.skill

        # Handle human skills
        if skill.is_human_skill():
            logger.info("👤 Routing to HumanSkillHandler")
            return self.human_handler.emit_sync(
                skill=skill,
                runtime_inputs=request.inputs,
                progress_callback=progress_callback,
                capture_outputs=request.capture_outputs,
            )

        # Handle workflow skills
        if skill.is_workflow():
            logger.info("🔗 Routing to WorkflowOrchestrator")
            return self._execute_workflow_sync(request)

        # Handle agentic skills
        logger.info("🤖 Routing to AgenticExecutor")
        return self.agentic.execute(request, progress_callback)

    async def execute_workflow(
        self,
        request: WorkflowRequest,
    ) -> AsyncIterator[dict[str, Any]]:
        """Execute a workflow request (DAG steps).

        Args:
            request: WorkflowRequest with steps, inputs, auth

        Yields:
            StepProgress updates as each step executes
        """
        logger.info("🔗 Routing to WorkflowOrchestrator")

        # Configure workflow with step handler
        async for progress in self.workflow.execute(
            request=request,
            step_handler=self.step_handler.handle_step,
        ):
            yield {
                "status": progress.status,
                "step": progress.step,
                "total": progress.total,
                "step_id": progress.id,
                "step_name": progress.name,
                "result": progress.result,
                "error": progress.error,
            }

    async def execute_coordinator(
        self,
        request: CoordinatorRequest,
        capability_registry: "CapabilityRegistry | None" = None,
        planning_registry: "PlanningRegistry | None" = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Execute a coordinator request (two-phase plan-execute).

        Args:
            request: CoordinatorRequest with goal, tools, auth
            capability_registry: Pre-initialized capability registry (from gRPC handler)
            planning_registry: Pre-initialized planning registry (from gRPC handler)

        Yields:
            Progress dicts with status, output, timestamp_ms, progress_percent
        """
        logger.info("📋 Routing to CoordinatorExecutor")
        async for progress in self.coordinator.execute(
            request,
            capability_registry=capability_registry,
            planning_registry=planning_registry,
        ):
            yield progress

    def _execute_workflow_sync(
        self,
        request: SkillRequest,
    ) -> SkillExecutionResult:
        """Execute workflow skill synchronously.

        Converts SkillRequest to WorkflowRequest and runs via async wrapper.
        """
        from emery_agents.entities.configs import WorkflowRequest
        from emery_agents.utils import run_async_in_thread

        # Convert to WorkflowRequest
        workflow_request = WorkflowRequest(
            steps=list(request.skill.steps),
            initial_inputs=request.inputs,
            auth=request.auth,
            available_skills={s.id: s for s in request.available_skills},
            skill_model=request.skill_model,
        )

        # Run async workflow synchronously
        async def collect_results():
            results = []
            final_result = None
            async for progress in self.workflow.execute(
                request=workflow_request,
                step_handler=self.step_handler.handle_step,
            ):
                results.append(progress)
                if progress.status == "completed" and progress.result:
                    final_result = progress.result
            return results, final_result

        results, final_result = run_async_in_thread(collect_results())

        # Build captured outputs from step results
        captured_outputs: dict[str, Any] = {}
        for progress in results:
            if progress.captured_data:
                captured_outputs.update(progress.captured_data)

        return SkillExecutionResult(
            result=final_result or "Workflow completed",
            captured_outputs=captured_outputs if captured_outputs else None,
        )


# Singleton instance
_default_router: ExecutionRouter | None = None


def get_execution_router() -> ExecutionRouter:
    """Get shared ExecutionRouter instance."""
    global _default_router
    if _default_router is None:
        _default_router = ExecutionRouter()
    return _default_router
