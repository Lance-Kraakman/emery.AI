"""
Coordinator Streaming Handler

Handles execution orchestration via LangGraph plan-execute graph.
Replaces the old ExecutionCoordinator-based two-phase execution.
"""

import logging
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

from langgraph.types import Command
from PIL import Image

from emery_agents.planning.registry import PlanningRegistry
from emery_agents.services.analysis.token_accumulator import TokenAccumulator
from emery_agents.tools.capability_bootstrap import (
    populate_external_tools,
    populate_user_skills,
)
from emery_agents.tools.capability_registry import CapabilityRegistry
from emery_agents.tools.knowledge import get_knowledge_base

from ..engine import AgentEngine
from ..entities.execution_context import ExecutionContext
from ..entities.models.plan import Plan
from ..orchestrators import RuntimeContext, create_session_graph
from ..orchestrators.nodes.planning import _build_workspace_context
from ..orchestrators.state import DEFAULT_STATE
from ..services.agents.executor import AgentExecutor

# MemoryService now accessed via engine.memory
from ..services.context import ConversationMessage, WorkspaceContext
from ..services.execution.events import (
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    PlanCreatedEvent,
)
from ..tools.tool_modes import ToolMode
from .approval_handler import is_approval_response
from .coordinator_event_converter import convert_coordinator_event
from .response_types import create_error_response

logger = logging.getLogger(__name__)

# Session-scoped graph cache keyed by thread_id.
# Stores (graph, runtime) tuple so credentials can be refreshed on resume.
_session_cache: dict[str, tuple[Any, RuntimeContext]] = {}


def _convert_history(
    conversation_history: list[Any] | None,
) -> list[ConversationMessage] | None:
    """Convert HistoryMessage entities to typed ConversationMessage dataclasses."""
    from ..entities.message import TextPart

    if not conversation_history:
        return None
    messages: list[ConversationMessage] = []
    for msg in conversation_history:
        if isinstance(msg, ConversationMessage):
            messages.append(msg)
        else:
            role = getattr(msg, "role", "unknown")
            content_parts = getattr(msg, "content_parts", [])
            text = " ".join(
                part.text for part in content_parts if isinstance(part, TextPart)
            )
            messages.append(ConversationMessage(role=role, content=text))
    return messages


def _format_plan_for_message(plan: "Plan") -> str:
    """Format plan as markdown for the message body."""
    lines = [f"## Plan: {plan.goal}\n"]
    if plan.context:
        lines.append(f"**Current State:** {plan.context}\n")
    if plan.analysis:
        lines.append(f"**Analysis:** {plan.analysis}\n")
    lines.append("**Steps:**")
    for i, step in enumerate(plan.steps, 1):
        lines.append(f"{i}. {step.description}")
        if step.tool_call:
            lines.append(f"   - Tool: `{step.tool_call}`")
    return "\n".join(lines)


def _get_or_create_session_graph(
    thread_id: str,
    runtime: RuntimeContext,
) -> Any:
    """Get cached session graph, refreshing credentials from current request."""
    if thread_id in _session_cache:
        cached_graph, cached_runtime = _session_cache[thread_id]
        # Refresh credentials from the new request's runtime
        # This ensures approval/resume requests use fresh auth tokens
        logger.info(f"Refreshing credentials for cached session {thread_id}")
        cached_runtime.api_key = runtime.api_key
        cached_runtime.org_id = runtime.org_id
        cached_runtime.extra_headers = runtime.extra_headers
        return cached_graph

    # New session - create graph and cache with runtime
    graph = create_session_graph(runtime)
    _session_cache[thread_id] = (graph, runtime)
    return graph


def _clear_session(thread_id: str) -> None:
    """Remove cached session graph after completion."""
    _session_cache.pop(thread_id, None)


class CoordinatorStreamingHandler:
    """
    Handles orchestration via LangGraph plan-execute graph.

    Execution modes:
    - NEW REQUEST: Graph triage routes to direct/plan/respond
    - AUTONOMOUS: Pre-approved stored plan executed directly
    - RESUME: Resumes a paused graph (approval, clarification, recovery)
    """

    def __init__(self):
        pass

    async def stream_response(
        self,
        context: "ExecutionContext",
        tools: list[Any],
        task: str,
        session_id: str | None,
        org_model: str | None,
        capability_registry: CapabilityRegistry,
        planning_registry: PlanningRegistry | None,
        token_accumulator: TokenAccumulator,
        sm: Any | None = None,
        managed_agents: list[Any] | None = None,
        stored_plan: Plan | None = None,
        conversation_history: list[Any] | None = None,
        user_id: str | None = None,
        workspace_type: str | None = None,
        workspace_id: str | None = None,
        runtime_skill_inputs: dict[str, str] | None = None,
        images: list[Image.Image] | None = None,
        has_images: bool = False,
        pre_selected_skill: str | None = None,
        pre_selected_agent: str | None = None,
        pre_selected_tool: str | None = None,
    ) -> AsyncIterator[Any]:
        """
        Main entry point for coordinator-driven execution.

        Uses LangGraph for all orchestration paths. The `sm` parameter is
        accepted for backward compatibility but LangGraph's checkpointer
        handles state management internally.
        """
        thread_id = session_id or "default"

        # Build RuntimeContext with non-serializable objects
        assert context.tool_provider is not None, "tool_provider required"

        # Initialize AgentEngine for unified workspace management
        engine = None
        memory_context_str = ""
        if workspace_type and workspace_id:
            try:
                engine = AgentEngine(
                    workspace_id=workspace_id,
                    workspace_type=workspace_type,
                    base_path=Path("/tmp/workspace"),
                )
                engine.initialize()

                # Fetch relevant memories (passed separately to planner, not mixed into task)
                memory_context_str = engine.memory.get_context_summary(task)
                if memory_context_str:
                    logger.info(
                        f"Found relevant memory context ({len(memory_context_str)} chars)"
                    )
            except Exception as e:
                logger.warning(f"Failed to initialize AgentEngine: {e}")

        runtime = RuntimeContext(
            # Engine (unified workspace management)
            engine=engine,
            # Tools and agents
            tools=tools,
            managed_agents=self._get_managed_agents_list(managed_agents),
            # Authentication
            api_key=context.tool_provider.api_key,
            org_id=str(context.tool_provider.organization_id),
            org_model=org_model,
            # Registries
            capability_registry=capability_registry,
            planning_registry=planning_registry,
            knowledge_base=get_knowledge_base(),
            # Context
            conversation_history=_convert_history(conversation_history),
            user_id=user_id,
            workspace_type=workspace_type,
            workspace_id=workspace_id,
            # Additional context
            images=images or [],
            extra_headers=context.tool_provider.extra_headers,
            token_accumulator=token_accumulator,
        )

        # Check if there's a pending graph interrupt to resume
        graph = _get_or_create_session_graph(thread_id, runtime)
        config = {"configurable": {"thread_id": thread_id}}

        has_pending_interrupt = False
        try:
            graph_state = graph.get_state(config)
            if graph_state and graph_state.next:
                has_pending_interrupt = True
        except Exception:
            pass  # No state yet — fresh graph

        if has_pending_interrupt:
            # === RESUME: Graph is paused at interrupt, resume with user's response ===
            if is_approval_response(task):
                response = "approve"
            else:
                response = task

            async for event in self._resume_graph(
                graph=graph,
                config=config,
                response=response,
                context=context,
                tools=tools,
                thread_id=thread_id,
            ):
                yield event
            return

        # === BUILD WORKSPACE CONTEXT (reused for classifier + planning) ===
        workspace = _build_workspace_context(
            context.tool_provider.api_key,
            str(context.tool_provider.organization_id),
            token_accumulator,
        )

        # === POPULATE CAPABILITY REGISTRY (per-request: user skills + external tools) ===
        org_id_str = str(context.tool_provider.organization_id)
        if workspace.existing_skills:
            populate_user_skills(
                capability_registry, workspace.existing_skills, org_id_str
            )
        if tools:
            populate_external_tools(capability_registry, tools, org_id_str)
        capability_registry.enable_all_system_agents(org_id_str)

        # === INVOKE GRAPH (triage → direct/plan/respond, or @mention → plan) ===
        async for event in self.stream_with_graph(
            context=context,
            runtime=runtime,
            task=task,
            org_model=org_model,
            stored_plan=stored_plan,
            thread_id=thread_id,
            runtime_skill_inputs=runtime_skill_inputs,
            memory_context=memory_context_str,
            workspace_context=workspace,
            pre_selected_skill=pre_selected_skill,
            pre_selected_agent=pre_selected_agent,
            pre_selected_tool=pre_selected_tool,
        ):
            yield event

    async def stream_with_graph(
        self,
        context: "ExecutionContext",
        runtime: RuntimeContext,
        task: str,
        org_model: str | None,
        stored_plan: Plan | None = None,
        thread_id: str | None = None,
        runtime_skill_inputs: dict[str, str] | None = None,
        memory_context: str = "",
        workspace_context: WorkspaceContext | None = None,
        pre_selected_skill: str | None = None,
        pre_selected_agent: str | None = None,
        pre_selected_tool: str | None = None,
    ) -> AsyncIterator[Any]:
        """
        LangGraph-based execution path.

        Starts the plan-execute graph from scratch with the given task.
        The graph will pause at interrupt() for approval/clarification
        and can be resumed later via _resume_graph().
        """
        effective_thread_id = thread_id or "default"

        # Build initial state — ONLY serializable data
        initial_state = {
            **DEFAULT_STATE,
            "task": task,
            "memory_context": memory_context or None,
            "api_key": runtime.api_key,
            "org_id": runtime.org_id,
            "org_model": org_model,
            "organization_id": context.tool_provider.organization_id
            if context.tool_provider
            else None,
            "stored_plan": stored_plan,
            "runtime_skill_inputs": runtime_skill_inputs,
            "workspace_context": workspace_context,
            "pre_selected_skill": pre_selected_skill,
            "pre_selected_agent": pre_selected_agent,
            "pre_selected_tool": pre_selected_tool,
        }

        # Get or create session graph (uses cached instance for thread_id)
        graph = _get_or_create_session_graph(effective_thread_id, runtime)
        config = {"configurable": {"thread_id": effective_thread_id}}

        async for event in self._stream_graph_events(
            graph=graph,
            input_data=initial_state,
            config=config,
            context=context,
            thread_id=effective_thread_id,
            tools=runtime.tools,
        ):
            yield event

    async def _resume_graph(
        self,
        graph: Any,
        config: dict[str, Any],
        response: str,
        context: "ExecutionContext",
        tools: list[Any],
        thread_id: str,
    ) -> AsyncIterator[Any]:
        """
        Resume a paused graph with the user's response.

        Called when the graph has a pending interrupt (approval, clarification, recovery).
        Uses LangGraph's Command(resume=response) to continue execution.
        """
        logger.info(
            f"Resuming graph for thread {thread_id} with response: {response[:100]}"
        )

        # Set execution context for tool mode
        if context.tool_provider:
            context.tool_mode = ToolMode.EXECUTION
            AgentExecutor.set_current_context(context)

        # Resume with Command
        resume_input: Any = Command(resume=response)

        async for event in self._stream_graph_events(
            graph=graph,
            input_data=resume_input,
            config=config,
            context=context,
            thread_id=thread_id,
            tools=tools,
        ):
            yield event

    async def _stream_graph_events(
        self,
        graph: Any,
        input_data: Any,
        config: dict[str, Any],
        context: "ExecutionContext",
        thread_id: str,
        tools: list[Any] | None = None,
    ) -> AsyncIterator[Any]:
        """
        Stream events from graph execution (shared by initial invocation and resume).

        Handles:
        - Converting coordinator events to streaming format via convert_coordinator_event()
        - Tracking awaiting_input events for interrupt detection
        - Detecting completion and yielding final summary
        """
        step_index = 0
        final_synthesis: str | None = None
        execution_success = False
        awaiting_ui_sent = False  # Track whether we sent an awaiting_input UI event

        try:
            async for event_chunk in graph.astream(
                input_data, config=config, stream_mode="updates"
            ):
                for node_name, state_update in event_chunk.items():
                    if node_name == "__end__":
                        continue

                    # Skip LangGraph internal events (e.g. __interrupt__)
                    # __interrupt__ yields (Interrupt(...),) — a tuple, not a dict
                    if node_name.startswith("__"):
                        continue

                    # Guard: state_update must be a dict (node output)
                    if not isinstance(state_update, dict):
                        logger.warning(
                            f"Unexpected state_update type from node '{node_name}': "
                            f"{type(state_update).__name__}"
                        )
                        continue

                    # Extract events from node output
                    node_events = state_update.get("events", [])
                    for event in node_events:
                        converted = convert_coordinator_event(event, step_index)
                        if converted:
                            # For plan events, yield plan content as message body
                            if isinstance(event, PlanCreatedEvent) and event.plan:
                                yield {
                                    "type": "content_chunk",
                                    "content": _format_plan_for_message(event.plan),
                                }
                            yield converted
                            step_index += 1

                            # Track awaiting_input events (approval/clarification)
                            if converted.get("type") == "awaiting_input":
                                awaiting_ui_sent = True

                        if isinstance(event, FinalSynthesisEvent):
                            final_synthesis = event.synthesis
                        elif isinstance(event, ExecutionCompletedEvent):
                            execution_success = event.success

        except Exception as e:
            logger.error(f"LangGraph execution failed: {e}", exc_info=True)
            yield create_error_response(
                "GRAPH_EXECUTION_FAILED",
                f"Graph execution failed: {e}",
            )
            _clear_session(thread_id)
            return

        # Check if graph is paused at an interrupt (approval/clarification/recovery)
        graph_paused = False
        try:
            graph_state = graph.get_state(config)
            if graph_state and graph_state.next:
                graph_paused = True
        except Exception:
            pass

        if graph_paused:
            # Graph paused at interrupt — UI event was already yielded above.
            # If we somehow missed sending the UI event, send a generic one.
            if not awaiting_ui_sent:
                logger.warning("Graph paused at interrupt but no UI event was yielded")
            return

        # Graph completed (not paused) — send final summary and clean up
        if execution_success:
            summary = (
                final_synthesis
                or f"Plan executed successfully with {step_index} steps."
            )
            yield {"type": "content_chunk", "content": f"\n\n{summary}"}
        elif step_index > 0:
            yield {
                "type": "content_chunk",
                "content": "\n\nExecution completed with issues. Some steps may have failed.",
            }
        elif final_synthesis:
            # Triage → direct or respond path completed with a synthesis
            yield {"type": "content_chunk", "content": f"\n\n{final_synthesis}"}
        else:
            # No steps and no synthesis — graph terminated without producing output
            logger.warning("Graph completed without producing any output")
            yield {"type": "content_chunk", "content": "Task completed."}

        _clear_session(thread_id)

    def _get_managed_agents_list(self, managed_agents: list[Any] | None) -> list[Any]:
        """Convert managed_agents to list format."""
        if managed_agents:
            if isinstance(managed_agents, dict):
                return list(managed_agents.values())
            return list(managed_agents)
        return []
