"""
Coordinator Executor for two-phase plan-execute execution.

Handles the LangGraph-based coordinator pattern:
1. Plan generation phase
2. User approval (auto-approve for autonomous mode)
3. Execution phase with evaluation

AIDEV-NOTE: Part of Phase 2.1 refactoring (Feb 2026).
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

from emery_agents.orchestrators import RuntimeContext, create_session_graph
from emery_agents.orchestrators.nodes.planning import (
    _build_workspace_context,
    generate_plan_node,
)
from emery_agents.orchestrators.state import DEFAULT_STATE, PlanExecuteState
from emery_agents.services.analysis.token_accumulator import TokenAccumulator
from emery_agents.tools.knowledge import get_knowledge_base
from emery_agents.tools.loader import UnifiedToolLoader

from ..agents.factory import AgentFactory
from ..models import ModelProvider
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

if TYPE_CHECKING:
    from emery_agents.entities.configs import AuthConfig, CoordinatorRequest
    from emery_agents.entities.models.plan import Plan

logger = logging.getLogger(__name__)


class CoordinatorExecutor:
    """Executes tasks using two-phase plan-execute pattern.

    Flow:
    1. Generate plan using LLM planner
    2. Auto-approve plan (for autonomous mode)
    3. Execute plan steps with evaluation
    4. Handle replanning if needed

    Replaces AgentExecutor._execute_with_coordinator() method.
    """

    def __init__(
        self,
        tool_loader: UnifiedToolLoader | None = None,
        agent_factory: AgentFactory | None = None,
    ):
        """Initialize coordinator executor.

        Args:
            tool_loader: UnifiedToolLoader for loading tools
            agent_factory: AgentFactory for creating DSPy modules
        """
        self.tool_loader = tool_loader or UnifiedToolLoader()
        self._agent_factory = agent_factory

    @property
    def agent_factory(self) -> AgentFactory:
        """Lazy-initialize AgentFactory with ModelProvider."""
        if self._agent_factory is None:
            self._agent_factory = AgentFactory(ModelProvider())
        return self._agent_factory

    async def execute(
        self,
        request: CoordinatorRequest,
    ) -> AsyncIterator[dict[str, Any]]:
        """Execute a coordinator request.

        Args:
            request: CoordinatorRequest with goal, tools, and auth

        Yields:
            Progress dicts with status, output, timestamp_ms, progress_percent
        """
        start_time = time.time()
        logger.info(f"🎯 Coordinator execution: {request.goal[:100]}...")

        # Load tools
        tools = []
        if request.tools:
            try:
                tools = self.tool_loader.load_tools_from_configs(
                    tool_configs=request.tools,
                    api_key=request.auth.api_key,
                    organization_id=request.auth.org_id,
                )
                logger.info(f"🔧 Loaded {len(tools)} tools for coordinator")
            except Exception as e:
                logger.warning(f"Failed to load some tools: {e}")

        yield {
            "status": "in_progress",
            "output": json.dumps({
                "execution_type": "coordinator",
                "message": "Starting plan-execute (planning → auto-approve → execution)",
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 15.0,
        }

        # Build runtime context
        runtime = RuntimeContext(
            tools=tools,
            managed_agents=[],
            api_key=request.auth.api_key,
            org_id=str(request.auth.org_id),
            org_model=request.auth.org_model,
            knowledge_base=get_knowledge_base(),
        )

        # Check for existing plan (resume case)
        if request.plan:
            plan = request.plan
            logger.info("📋 Resuming with existing plan")
        else:
            # Phase 1: Generate plan
            token_accumulator = TokenAccumulator()
            workspace = _build_workspace_context(
                request.auth.api_key,
                str(request.auth.org_id),
                token_accumulator,
            )
            plan_state: PlanExecuteState = {
                "task": request.goal,
                "org_model": request.auth.org_model,
                "api_key": request.auth.api_key,
                "org_id": str(request.auth.org_id),
                "workspace_context": workspace,
            }

            result = await generate_plan_node(plan_state, runtime)

            # Yield plan events
            for event in result.get("events", []):
                progress = self._event_to_progress(event, start_time)
                yield progress

            plan = result.get("plan")
            if not plan:
                yield {
                    "status": "failed",
                    "output": json.dumps({"error": "Plan creation failed"}),
                    "error_message": result.get("error", "Plan creation failed"),
                    "timestamp_ms": int(time.time() * 1000),
                    "progress_percent": 0.0,
                }
                return

        # Phase 2: Auto-approve and execute
        approved_plan = plan.approve().start_execution()

        yield {
            "status": "in_progress",
            "output": json.dumps({
                "message": "Plan approved, starting execution",
                "plan_steps": len(approved_plan.steps),
            }),
            "error_message": "",
            "timestamp_ms": int(time.time() * 1000),
            "progress_percent": 30.0,
        }

        # Phase 3: Execute via LangGraph
        async for progress in self._execute_plan(approved_plan, runtime, request, start_time):
            yield progress

    async def _execute_plan(
        self,
        plan: Plan,
        runtime: RuntimeContext,
        request: CoordinatorRequest,
        start_time: float,
    ) -> AsyncIterator[dict[str, Any]]:
        """Execute approved plan via LangGraph."""
        # Build initial state
        initial_state = {
            **DEFAULT_STATE,
            "task": request.goal,
            "plan": plan,
            "runtime": runtime,
            "api_key": request.auth.api_key,
            "org_id": str(request.auth.org_id),
            "org_model": request.auth.org_model,
        }

        # Create and run graph
        graph = create_session_graph(runtime)
        config = {"configurable": {"thread_id": f"coord_{int(time.time())}"}}

        try:
            async for state in graph.astream(initial_state, config):
                # Extract events from state
                events = state.get("events", [])
                for event in events:
                    progress = self._event_to_progress(event, start_time)
                    yield progress

                # Check for completion
                if state.get("is_complete"):
                    final_result = state.get("final_result", "")
                    yield {
                        "status": "completed",
                        "output": json.dumps({"result": final_result}),
                        "error_message": "",
                        "timestamp_ms": int(time.time() * 1000),
                        "progress_percent": 100.0,
                    }
                    return

        except Exception as e:
            logger.error(f"❌ Coordinator execution failed: {e}")
            yield {
                "status": "failed",
                "output": "",
                "error_message": str(e),
                "timestamp_ms": int(time.time() * 1000),
                "progress_percent": 100.0,
            }

    def _event_to_progress(
        self,
        event: Any,
        start_time: float,
    ) -> dict[str, Any]:
        """Convert coordinator event to progress dict."""
        elapsed = time.time() - start_time
        timestamp_ms = int(time.time() * 1000)

        if isinstance(event, PlanCreatedEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "type": "plan_created",
                    "plan_id": event.plan_id,
                    "goal": event.plan.goal,
                    "steps": len(event.plan.steps),
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 25.0,
            }
        elif isinstance(event, StepStartedEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "type": "step_started",
                    "step_id": event.step_id,
                    "description": event.step_description,
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 40.0,
            }
        elif isinstance(event, StepCompletedEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "type": "step_completed",
                    "step_id": event.step_id,
                    "result": event.result[:200] if event.result else "",
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 60.0,
            }
        elif isinstance(event, StepFailedEvent):
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "type": "step_failed",
                    "step_id": event.step_id,
                    "error": event.error,
                }),
                "error_message": event.error,
                "timestamp_ms": timestamp_ms,
                "progress_percent": 60.0,
            }
        elif isinstance(event, GoalAchievedEvent):
            return {
                "status": "completed",
                "output": json.dumps({
                    "type": "goal_achieved",
                    "plan_id": event.plan_id,
                    "reason": event.reason,
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 100.0,
            }
        elif isinstance(event, ExecutionCompletedEvent):
            return {
                "status": "completed" if event.success else "failed",
                "output": json.dumps({
                    "type": "execution_completed",
                    "plan_id": event.plan_id,
                    "success": event.success,
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 100.0,
            }
        else:
            # Generic event
            return {
                "status": "in_progress",
                "output": json.dumps({
                    "type": type(event).__name__,
                    "elapsed": elapsed,
                }),
                "error_message": "",
                "timestamp_ms": timestamp_ms,
                "progress_percent": 50.0,
            }


# Singleton instance
_default_executor: CoordinatorExecutor | None = None


def get_coordinator_executor() -> CoordinatorExecutor:
    """Get shared CoordinatorExecutor instance."""
    global _default_executor
    if _default_executor is None:
        _default_executor = CoordinatorExecutor()
    return _default_executor
