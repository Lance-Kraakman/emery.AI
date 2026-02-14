"""
Coordinator Executor - Delegates to LangGraph for plan-execute flow.

The graph handles ALL phases:
- Planning (triage → generate_plan)
- Approval (await_approval or auto-approve for autonomous mode)
- Execution (execute_step → replan loop)

This executor just:
1. Loads tools and builds RuntimeContext
2. Invokes the graph with task (or existing plan for resume)
3. Streams events back to caller

AIDEV-NOTE: Refactored Feb 2026 - graph handles all planning (Option A).
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any, Literal, TypedDict, cast

from emery_agents.engine import AgentEngine
from emery_agents.infrastructure.storage import WORKSPACE_STORAGE_PATH
from emery_agents.orchestrators import RuntimeContext, create_session_graph
from emery_agents.orchestrators.nodes.planning import _build_workspace_context
from emery_agents.orchestrators.state import DEFAULT_STATE, PlanExecuteState
from emery_agents.services.analysis.token_accumulator import TokenAccumulator
from emery_agents.services.tools.tool_preparation import get_tool_preparation_service
from emery_agents.tools.capability_bootstrap import (
    populate_integration_services,
    populate_system_agents,
)
from emery_agents.tools.capability_registry import CapabilityRegistry
from emery_agents.tools.knowledge import get_knowledge_base
from emery_agents.tools.loader import UnifiedToolLoader

from ..agents.factory import AgentFactory
from ..models import ModelProvider
from .events import (
    ExecutionCompletedEvent,
    GoalAchievedEvent,
    PlanCreatedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    StepStartedEvent,
)


class ProgressDict(TypedDict):
    """Typed progress update yielded to callers."""

    status: Literal["in_progress", "completed", "failed"]
    output: str  # JSON-encoded progress data
    error_message: str
    timestamp_ms: int
    progress_percent: float

if TYPE_CHECKING:
    from emery_agents.entities.configs import AuthConfig, CoordinatorRequest
    from emery_agents.entities.models.plan import Plan
    from emery_agents.planning.registry import PlanningRegistry

logger = logging.getLogger(__name__)


class CoordinatorExecutor:
    """Delegates task execution to LangGraph plan-execute flow.

    The graph handles the full flow:
    - triage → generate_plan → await_approval → execute_step → replan

    This executor just sets up RuntimeContext and invokes the graph.
    For autonomous mode, the graph auto-approves low-risk plans.
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
        capability_registry: CapabilityRegistry | None = None,
        planning_registry: "PlanningRegistry | None" = None,
    ) -> AsyncIterator[ProgressDict]:
        """Execute a coordinator request.

        Args:
            request: CoordinatorRequest with goal, tools, and auth
            capability_registry: Pre-initialized capability registry (from gRPC handler).
                If None, creates a new one (fallback for backwards compat).
            planning_registry: Pre-initialized planning registry (from gRPC handler).

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

        # Inject workspace tools if workspace_path available
        # This enables write_file, bash, read_file, etc. for agent tasks
        if request.workspace_path:
            try:
                prep = get_tool_preparation_service()
                workspace_tools = prep.prepare_workspace_tools(request.workspace_path)
                tools = tools + workspace_tools
                logger.info(
                    f"🔧 Added {len(workspace_tools)} workspace tools for {request.workspace_path}"
                )
            except Exception as e:
                logger.warning(f"Failed to add workspace tools: {e}")

        yield ProgressDict(
            status="in_progress",
            output=json.dumps({
                "execution_type": "coordinator",
                "message": "Starting plan-execute flow",
            }),
            error_message="",
            timestamp_ms=int(time.time() * 1000),
            progress_percent=15.0,
        )

        # Create token accumulator for tracking LLM usage
        token_accumulator = TokenAccumulator()

        # Use injected capability_registry or create fallback (with warning)
        if capability_registry is None:
            logger.warning(
                "capability_registry not injected - creating new instance. "
                "This is inefficient; inject from gRPC handler for better performance."
            )
            capability_registry = CapabilityRegistry()
            populate_system_agents(capability_registry)
            populate_integration_services(capability_registry)
            capability_registry.enable_all_system_agents(str(request.auth.org_id))

        # Build workspace context for planner (avoids duplicate API call in generate_plan_node)
        workspace_context = _build_workspace_context(
            request.auth.api_key,
            str(request.auth.org_id),
            token_accumulator,
        )

        # Create engine for task execution
        org_id_str = str(request.auth.org_id)
        thread_id = f"coord_{int(time.time())}"

        # Use workspace_path if provided, otherwise session-based
        if request.workspace_path:
            # workspace_path is already the full path (e.g., /storage/org/agents/agent_id)
            workspace_base = request.workspace_path.parent
            workspace_type = request.workspace_path.parent.name
            workspace_id = request.workspace_path.name
        else:
            workspace_base = WORKSPACE_STORAGE_PATH / org_id_str / "sessions"
            workspace_type = "sessions"
            workspace_id = thread_id

        try:
            engine = AgentEngine(
                workspace_id=workspace_id,
                workspace_type=workspace_type,
                base_path=workspace_base,
            )
            engine.initialize()
        except Exception as e:
            logger.error(f"Failed to initialize AgentEngine: {e}")
            raise RuntimeError(f"Cannot execute task: engine initialization failed: {e}")

        # Build runtime context
        runtime = RuntimeContext(
            engine=engine,
            tools=tools,
            managed_agents=[],
            api_key=request.auth.api_key,
            org_id=str(request.auth.org_id),
            org_model=request.auth.org_model,
            knowledge_base=get_knowledge_base(),
            token_accumulator=token_accumulator,
            autonomous_mode=request.autonomous_mode,
            capability_registry=capability_registry,
            planning_registry=planning_registry,
        )

        # Build initial state - graph handles planning, approval, and execution
        initial_state: PlanExecuteState = cast(PlanExecuteState, {
            **DEFAULT_STATE,
            "task": request.goal,
            "api_key": request.auth.api_key,
            "org_id": str(request.auth.org_id),
            "org_model": request.auth.org_model,
            "workspace_context": workspace_context,
            # For resume case: pass existing plan directly to execution
            "plan": request.plan if request.plan else None,
        })

        if request.plan:
            logger.info("📋 Resuming with existing plan - routing to execute_step")
        else:
            logger.info("📋 New task - graph will handle triage → plan → execute")

        # Create and run graph - graph handles ALL phases
        graph = create_session_graph(runtime)
        config = {"configurable": {"thread_id": f"coord_{int(time.time())}"}}

        try:
            # Use stream_mode="updates" to get per-node state updates
            async for event_chunk in graph.astream(
                initial_state, config, stream_mode="updates"
            ):
                for node_name, state_update in event_chunk.items():
                    # Skip internal LangGraph nodes
                    if node_name.startswith("__"):
                        continue

                    # State update must be a dict (node output)
                    if not isinstance(state_update, dict):
                        logger.warning(
                            f"Unexpected state_update type from '{node_name}': "
                            f"{type(state_update).__name__}"
                        )
                        continue

                    # Extract and yield events from node output
                    events = state_update.get("events", [])
                    for event in events:
                        yield self._event_to_progress(event, start_time)

                    # Check for completion (response set)
                    response = state_update.get("response")
                    if response:
                        yield ProgressDict(
                            status="completed",
                            output=json.dumps({"result": response}),
                            error_message="",
                            timestamp_ms=int(time.time() * 1000),
                            progress_percent=100.0,
                        )
                        return

                    # Check for error
                    error = state_update.get("error")
                    if error:
                        yield ProgressDict(
                            status="failed",
                            output="",
                            error_message=error,
                            timestamp_ms=int(time.time() * 1000),
                            progress_percent=100.0,
                        )
                        return

        except Exception as e:
            logger.error(f"❌ Coordinator execution failed: {e}")
            yield ProgressDict(
                status="failed",
                output="",
                error_message=str(e),
                timestamp_ms=int(time.time() * 1000),
                progress_percent=100.0,
            )

    def _event_to_progress(
        self,
        event: Any,
        start_time: float,
    ) -> ProgressDict:
        """Convert coordinator event to typed progress dict."""
        elapsed = time.time() - start_time
        timestamp_ms = int(time.time() * 1000)

        if isinstance(event, PlanCreatedEvent):
            return ProgressDict(
                status="in_progress",
                output=json.dumps({
                    "type": "plan_created",
                    "plan_id": event.plan_id,
                    "goal": event.plan.goal,
                    "steps": len(event.plan.steps),
                }),
                error_message="",
                timestamp_ms=timestamp_ms,
                progress_percent=25.0,
            )
        elif isinstance(event, StepStartedEvent):
            return ProgressDict(
                status="in_progress",
                output=json.dumps({
                    "type": "step_started",
                    "step_id": event.step_id,
                    "description": event.step_description,
                }),
                error_message="",
                timestamp_ms=timestamp_ms,
                progress_percent=40.0,
            )
        elif isinstance(event, StepCompletedEvent):
            return ProgressDict(
                status="in_progress",
                output=json.dumps({
                    "type": "step_completed",
                    "step_id": event.step_id,
                    "result": event.result[:200] if event.result else "",
                }),
                error_message="",
                timestamp_ms=timestamp_ms,
                progress_percent=60.0,
            )
        elif isinstance(event, StepFailedEvent):
            return ProgressDict(
                status="in_progress",
                output=json.dumps({
                    "type": "step_failed",
                    "step_id": event.step_id,
                    "error": event.error,
                }),
                error_message=event.error,
                timestamp_ms=timestamp_ms,
                progress_percent=60.0,
            )
        elif isinstance(event, GoalAchievedEvent):
            return ProgressDict(
                status="completed",
                output=json.dumps({
                    "type": "goal_achieved",
                    "plan_id": event.plan_id,
                    "reason": event.reason,
                }),
                error_message="",
                timestamp_ms=timestamp_ms,
                progress_percent=100.0,
            )
        elif isinstance(event, ExecutionCompletedEvent):
            return ProgressDict(
                status="completed" if event.success else "failed",
                output=json.dumps({
                    "type": "execution_completed",
                    "plan_id": event.plan_id,
                    "success": event.success,
                }),
                error_message="",
                timestamp_ms=timestamp_ms,
                progress_percent=100.0,
            )
        else:
            # Generic event
            return ProgressDict(
                status="in_progress",
                output=json.dumps({
                    "type": type(event).__name__,
                    "elapsed": elapsed,
                }),
                error_message="",
                timestamp_ms=timestamp_ms,
                progress_percent=50.0,
            )


# Singleton instance
_default_executor: CoordinatorExecutor | None = None


def get_coordinator_executor() -> CoordinatorExecutor:
    """Get shared CoordinatorExecutor instance."""
    global _default_executor
    if _default_executor is None:
        _default_executor = CoordinatorExecutor()
    return _default_executor
