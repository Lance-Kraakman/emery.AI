"""
Coordinator Streaming Handler

Handles execution orchestration via LangGraph plan-execute graph.
Replaces the old ExecutionCoordinator-based two-phase execution.
"""

import json
import logging
from pathlib import Path
from typing import AsyncIterator, Optional, List, Any, Dict

import dspy
from langgraph.types import Command

from ..services.execution.events import (
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    PlanCreatedEvent,
)
from ..entities.models.plan import Plan
from ..entities.execution_context import ExecutionContext
from ..tools.tool_modes import ToolMode
from ..services.agents.executor import AgentExecutor
from ..services.models.provider import ModelProvider
from ..services.plan_service import PlanService
from ..reasoning.config import get_dspy_lm
from ..reasoning.modules.executor import ExecutorModule
from ..reasoning.modules.classifier import TaskClassifierModule
from ..reasoning.signatures.planning import TaskExecutionMode
from ..reasoning.utils import extract_dspy_result
from ..reasoning.tools import create_all_tools, QuestionCollector, create_ask_question_tool
from .coordinator_event_converter import convert_coordinator_event
from .approval_handler import is_approval_response
from .response_types import create_error_response
from ..orchestrators import create_session_graph, RuntimeContext
from ..orchestrators.runtime import ConversationMessage
from ..orchestrators.state import DEFAULT_STATE
from ..services.memory import MemoryService
from ..services.planning import PlanFileRepository

logger = logging.getLogger(__name__)

# Session-scoped graph cache keyed by thread_id.
# Each session gets its own graph with RuntimeContext bound via closures.
_session_cache: Dict[str, Any] = {}


def _convert_history(
    conversation_history: Optional[List[Any]],
) -> Optional[List[ConversationMessage]]:
    """Convert protobuf HistoryMessage objects to typed ConversationMessage dataclasses."""
    if not conversation_history:
        return None
    messages: List[ConversationMessage] = []
    for msg in conversation_history:
        if isinstance(msg, ConversationMessage):
            messages.append(msg)
        else:
            # Protobuf HistoryMessage: .role str, .content_parts[].text.text str
            role = getattr(msg, "role", "unknown")
            content_parts = getattr(msg, "content_parts", [])
            text = " ".join(
                getattr(getattr(part, "text", None), "text", "")
                for part in content_parts
                if getattr(part, "text", None)
            )
            messages.append(ConversationMessage(role=role, content=text))
    return messages


def _format_dict_questions(questions: List[dict[str, Any]]) -> List[dict[str, Any]]:
    """Format dict-based questions from QuestionCollector for serialization."""
    questions_data = []
    for i, q in enumerate(questions):
        q_dict = {
            "questionId": f"q_{i}",
            "question": q.get("question", ""),
            "questionType": q.get("question_type", "text"),
            "required": q.get("required", True),
            "allowOther": q.get("allow_other", True),
        }
        if q.get("options"):
            q_dict["options"] = q["options"]
        if q.get("context"):
            q_dict["context"] = q["context"]
        questions_data.append(q_dict)
    return questions_data


def _format_plan_for_message(plan: 'Plan') -> str:
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
    runtime: Optional[RuntimeContext] = None,
) -> Any:
    """Get a cached session graph or create a new one with RuntimeContext."""
    if thread_id not in _session_cache:
        assert runtime is not None, "RuntimeContext required for new session graph"
        _session_cache[thread_id] = create_session_graph(runtime)
    return _session_cache[thread_id]


def _clear_session(thread_id: str) -> None:
    """Remove a cached session graph after completion."""
    _session_cache.pop(thread_id, None)


class CoordinatorStreamingHandler:
    """
    Handles orchestration via LangGraph plan-execute graph.

    Execution modes:
    - NEW REQUEST: Starts the graph from scratch (generate_plan -> await_approval -> execute)
    - AUTONOMOUS: Pre-approved stored plan executed directly
    - RESUME: Resumes a paused graph (approval, clarification, recovery)
    - DIRECT: Simple task without plan (DSPy ReAct execution)
    """

    def __init__(
        self,
        plan_service: 'PlanService',
        model_provider: 'ModelProvider',
    ):
        self.plan_service = plan_service
        self.model_provider = model_provider
        self._classifier: Optional[TaskClassifierModule] = None

    def _get_classifier(self) -> TaskClassifierModule:
        """Lazy-initialize task classifier."""
        if self._classifier is None:
            self._classifier = TaskClassifierModule()
        return self._classifier

    async def _classify_task(
        self,
        task: str,
        org_model: Optional[str],
        context: str = "",
    ) -> TaskExecutionMode:
        """
        Classify a task to determine execution mode.

        Args:
            task: The user's task
            org_model: Model to use for classification
            context: Optional context about system state

        Returns:
            TaskExecutionMode.DIRECT or TaskExecutionMode.PLAN_AND_APPROVE
        """
        classifier = self._get_classifier()

        with dspy.context(lm=get_dspy_lm(org_model)):
            result = classifier.classify(task=task, context=context)

        return result.mode

    async def stream_response(
        self,
        context: 'ExecutionContext',
        tools: List[Any],
        task: str,
        session_id: Optional[str],
        org_model: Optional[str],
        sm: Optional[Any] = None,
        managed_agents: Optional[List[Any]] = None,
        stored_plan: Optional[Plan] = None,
        conversation_history: Optional[List[Any]] = None,
        capability_registry: Optional[Any] = None,
        user_id: Optional[str] = None,
        workspace_type: Optional[str] = None,
        workspace_id: Optional[str] = None,
        runtime_skill_inputs: Optional[Dict[str, str]] = None,
    ) -> AsyncIterator[Any]:
        """
        Main entry point for coordinator-driven execution.

        Uses LangGraph for all orchestration paths. The `sm` parameter is
        accepted for backward compatibility but LangGraph's checkpointer
        handles state management internally.
        """
        thread_id = session_id or "default"
        raw_task = task  # Preserve original before memory injection

        # Build RuntimeContext with non-serializable objects
        assert context.tool_provider is not None, "tool_provider required"
        # Initialize MemoryService from workspace IDs
        memory_service = None
        if workspace_type and workspace_id:
            try:
                memory_service = MemoryService(
                    workspace_type=workspace_type,
                    workspace_id=workspace_id,
                    base_path=Path("/tmp/workspace"),
                )
                # Inject relevant memories into task context
                memory_context = memory_service.get_context_summary(task)
                if memory_context:
                    task = f"{task}\n\n[Relevant memories]\n{memory_context}"
                    logger.info(f"Injected memory context into task ({len(memory_context)} chars)")
            except Exception as e:
                logger.warning(f"Failed to initialize MemoryService: {e}")

        # Initialize PlanFileRepository for filesystem-based plan persistence
        plan_file_repo = None
        if workspace_type and workspace_id:
            try:
                plan_file_repo = PlanFileRepository(
                    base_path=Path("/tmp/workspace"),
                    workspace_id=workspace_id,
                )
            except Exception as e:
                logger.warning(f"Failed to initialize PlanFileRepository: {e}")

        runtime = RuntimeContext(
            tools=tools,
            managed_agents=self._get_managed_agents_list(managed_agents),
            api_key=context.tool_provider.api_key,
            org_id=str(context.tool_provider.organization_id),
            org_model=org_model,
            capability_registry=capability_registry,
            conversation_history=_convert_history(conversation_history),
            user_id=user_id,
            workspace_type=workspace_type,
            workspace_id=workspace_id,
            memory_service=memory_service,
            plan_file_repository=plan_file_repo,
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
            # Use raw_task (before memory injection) so "approve" isn't corrupted
            # by appended memory context like "[Relevant memories]\n..."
            if is_approval_response(raw_task):
                response = "approve"
            else:
                response = raw_task

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

        # === CLASSIFY TASK (if no stored plan) ===
        if not stored_plan:
            try:
                execution_mode = await self._classify_task(
                    task=task,
                    org_model=org_model,
                )

                if execution_mode == TaskExecutionMode.DIRECT:
                    # Direct execution with tools (skill_crud, etc.)
                    async for event in self._handle_direct_execution(
                        context=context,
                        task=task,
                        org_model=org_model,
                    ):
                        yield event
                    return
            except Exception as e:
                logger.warning(f"Task classification failed, defaulting to plan mode: {e}")
                # Fall through to graph execution on classification failure

        # === NEW REQUEST or AUTONOMOUS ===
        async for event in self.stream_with_graph(
            context=context,
            runtime=runtime,
            task=task,
            org_model=org_model,
            stored_plan=stored_plan,
            thread_id=thread_id,
            runtime_skill_inputs=runtime_skill_inputs,
        ):
            yield event

    async def stream_with_graph(
        self,
        context: 'ExecutionContext',
        runtime: RuntimeContext,
        task: str,
        org_model: Optional[str],
        stored_plan: Optional[Plan] = None,
        thread_id: Optional[str] = None,
        runtime_skill_inputs: Optional[Dict[str, str]] = None,
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
            "api_key": runtime.api_key,
            "org_id": runtime.org_id,
            "org_model": org_model,
            "organization_id": context.tool_provider.organization_id if context.tool_provider else None,
            "stored_plan": stored_plan,
            "runtime_skill_inputs": runtime_skill_inputs,
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
        ):
            yield event

    async def _resume_graph(
        self,
        graph: Any,
        config: Dict[str, Any],
        response: str,
        context: 'ExecutionContext',
        tools: List[Any],
        thread_id: str,
    ) -> AsyncIterator[Any]:
        """
        Resume a paused graph with the user's response.

        Called when the graph has a pending interrupt (approval, clarification, recovery).
        Uses LangGraph's Command(resume=response) to continue execution.
        """
        logger.info(f"Resuming graph for thread {thread_id} with response: {response[:100]}")

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
        ):
            yield event

    async def _stream_graph_events(
        self,
        graph: Any,
        input_data: Any,
        config: Dict[str, Any],
        context: 'ExecutionContext',
        thread_id: str,
    ) -> AsyncIterator[Any]:
        """
        Stream events from graph execution (shared by initial invocation and resume).

        Handles:
        - Converting coordinator events to streaming format via convert_coordinator_event()
        - Tracking awaiting_input events for interrupt detection
        - Detecting completion and yielding final summary
        """
        step_index = 0
        final_synthesis: Optional[str] = None
        execution_success = False
        awaiting_ui_sent = False  # Track whether we sent an awaiting_input UI event

        try:
            async for event_chunk in graph.astream(input_data, config=config, stream_mode="updates"):
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
                                yield {"type": "content_chunk", "content": _format_plan_for_message(event.plan)}
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
            summary = final_synthesis or f"Plan executed successfully with {step_index} steps."
            yield {
                "type": "content_chunk",
                "content": f"\n\n{summary}"
            }
        elif step_index > 0:
            yield {
                "type": "content_chunk",
                "content": "\n\nExecution completed with issues. Some steps may have failed."
            }
        else:
            # No steps executed — direct execution fallback
            async for event in self._handle_direct_execution(
                context=context,
                task="",  # Task already processed by graph
                org_model=None,
            ):
                yield event

        _clear_session(thread_id)

    async def _handle_direct_execution(
        self,
        context: 'ExecutionContext',
        task: str,
        org_model: Optional[str],
    ) -> AsyncIterator[Any]:
        """
        Handle direct execution without a plan using DSPy.

        Used for simple tasks that don't require planning.
        """
        assert context.tool_provider is not None, "tool_provider required for direct execution"

        logger.info("Direct execution: Starting DSPy ReAct execution...")

        # Create DSPy tools with auth
        tools = create_all_tools(
            api_key=context.tool_provider.api_key,
            org_id=str(context.tool_provider.organization_id),
        )

        # Add ask_question tool for clarification
        question_collector = QuestionCollector()
        ask_question_tool = create_ask_question_tool(question_collector)
        all_tools = [ask_question_tool] + tools

        # Create executor
        executor = ExecutorModule(
            execution_tools=all_tools,
            max_iters=10,
        )

        # Get DSPy LM
        lm = get_dspy_lm(org_model=org_model)

        # Build minimal context
        execution_context = {
            "task": task,
            "org_id": str(context.tool_provider.organization_id),
        }

        try:
            # Execute with DSPy
            with dspy.context(lm=lm):
                result = executor(
                    step_description=task,
                    context=json.dumps(execution_context),
                )

            result_str = extract_dspy_result(result)

            # Check for clarification questions
            if question_collector.has_questions():
                questions = question_collector.get_questions()
                logger.info(f"Direct execution needs clarification: {len(questions)} question(s)")
                yield {
                    "type": "awaiting_input",
                    "data": {
                        "input_type": "questions",
                        "title": "Clarification Needed",
                        "content": "I need some additional information to complete this task.",
                        "questions": _format_dict_questions(questions),
                        "options": [],
                        "plan_json": ""
                    }
                }
                return

            logger.info(f"Direct execution completed: {len(result_str)} chars")

            # Yield result as content chunks
            yield {
                "type": "step_progress",
                "step_type": "ACTION",
                "step_name": "Direct Execution",
                "content": "Task executed directly",
                "metadata": {},
                "step_index": 0
            }
            yield {
                "type": "content_chunk",
                "content": result_str
            }

        except Exception as e:
            logger.error(f"Direct execution failed: {e}", exc_info=True)
            yield create_error_response(
                "DIRECT_EXECUTION_FAILED",
                f"Failed to execute task: {e}",
            )

    def _get_managed_agents_list(self, managed_agents: Optional[List[Any]]) -> List[Any]:
        """Convert managed_agents to list format."""
        if managed_agents:
            if isinstance(managed_agents, dict):
                return list(managed_agents.values())
            return list(managed_agents)
        return []
