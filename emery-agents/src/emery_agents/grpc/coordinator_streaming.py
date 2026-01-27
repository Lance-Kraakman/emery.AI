"""
Coordinator Streaming Handler

Handles execution orchestration via LangGraph plan-execute graph.
Replaces the old ExecutionCoordinator-based two-phase execution.
"""

import json
import logging
from typing import AsyncIterator, Optional, List, Any, Dict, TYPE_CHECKING

import dspy
from langgraph.types import Command

from ..services.execution.events import (
    PlanCreatedEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    AwaitingClarificationEvent,
    ErrorEvent,
)
from ..entities.models.plan import Plan
from ..tools.tool_modes import ToolMode
from ..services.agents.executor import AgentExecutor
from ..reasoning.config import get_dspy_lm
from ..reasoning.modules.executor import ExecutorModule
from ..reasoning.tools import create_all_tools, QuestionCollector, create_ask_question_tool
from .coordinator_event_converter import convert_coordinator_event
from .mappers import format_clarifying_questions
from .approval_handler import is_approval_response, create_awaiting_input_for_plan
from .response_types import create_error_response
from ..orchestrators import create_plan_execute_graph
from ..orchestrators.state import DEFAULT_STATE

if TYPE_CHECKING:
    from ..entities.execution_context import ExecutionContext
    from ..services.models.provider import ModelProvider
    from ..services.plan_service import PlanService

logger = logging.getLogger(__name__)

# Thread-local storage for graph instances keyed by thread_id.
# This allows resuming interrupted graphs across requests.
_graph_cache: Dict[str, Any] = {}


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


def _get_or_create_graph(thread_id: str) -> Any:
    """Get a cached graph instance or create a new one."""
    if thread_id not in _graph_cache:
        _graph_cache[thread_id] = create_plan_execute_graph()
    return _graph_cache[thread_id]


def _clear_graph(thread_id: str) -> None:
    """Remove a cached graph instance after completion."""
    _graph_cache.pop(thread_id, None)


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
    ) -> AsyncIterator[Any]:
        """
        Main entry point for coordinator-driven execution.

        Uses LangGraph for all orchestration paths. The `sm` parameter is
        accepted for backward compatibility but LangGraph's checkpointer
        handles state management internally.
        """
        thread_id = session_id or "default"

        # Check if there's a pending graph interrupt to resume
        graph = _get_or_create_graph(thread_id)
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

        # === NEW REQUEST or AUTONOMOUS ===
        async for event in self.stream_with_graph(
            context=context,
            tools=tools,
            task=task,
            org_model=org_model,
            managed_agents=managed_agents,
            stored_plan=stored_plan,
            conversation_history=conversation_history,
            capability_registry=capability_registry,
            thread_id=thread_id,
        ):
            yield event

    async def stream_with_graph(
        self,
        context: 'ExecutionContext',
        tools: List[Any],
        task: str,
        org_model: Optional[str],
        managed_agents: Optional[List[Any]] = None,
        stored_plan: Optional[Plan] = None,
        conversation_history: Optional[List[Any]] = None,
        capability_registry: Optional[Any] = None,
        thread_id: Optional[str] = None,
    ) -> AsyncIterator[Any]:
        """
        LangGraph-based execution path.

        Starts the plan-execute graph from scratch with the given task.
        The graph will pause at interrupt() for approval/clarification
        and can be resumed later via _resume_graph().
        """
        assert context.tool_provider is not None, "tool_provider required"

        effective_thread_id = thread_id or "default"

        # Build initial state
        initial_state = {
            **DEFAULT_STATE,
            "task": task,
            "tools": tools,
            "managed_agents": self._get_managed_agents_list(managed_agents),
            "api_key": context.tool_provider.api_key,
            "org_id": str(context.tool_provider.organization_id),
            "org_model": org_model,
            "organization_id": context.tool_provider.organization_id,
            "conversation_history": conversation_history,
            "capability_registry": capability_registry,
            "stored_plan": stored_plan,
        }

        # Get or create graph (uses cached instance for thread_id)
        graph = _get_or_create_graph(effective_thread_id)
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
        - Converting coordinator events to streaming format
        - Detecting interrupts (approval, clarification) and yielding UI events
        - Detecting completion and yielding final summary
        """
        step_index = 0
        final_synthesis: Optional[str] = None
        execution_success = False
        graph_paused = False

        try:
            async for event_chunk in graph.astream(input_data, config=config):
                for node_name, state_update in event_chunk.items():
                    if node_name == "__end__":
                        continue

                    # Extract events from node output
                    node_events = state_update.get("events", [])
                    for event in node_events:
                        converted = convert_coordinator_event(event, step_index)
                        if converted:
                            yield converted
                            step_index += 1

                        if isinstance(event, FinalSynthesisEvent):
                            final_synthesis = event.synthesis
                        elif isinstance(event, ExecutionCompletedEvent):
                            execution_success = event.success

                        # Handle clarification — graph will pause at interrupt
                        if isinstance(event, AwaitingClarificationEvent):
                            yield {
                                "type": "awaiting_input",
                                "data": {
                                    "input_type": "questions",
                                    "title": "Clarification Needed",
                                    "content": event.reasoning,
                                    "questions": format_clarifying_questions(event.questions),
                                    "options": [],
                                    "plan_json": ""
                                }
                            }
                            graph_paused = True
                            return

                        # Handle plan created — graph will pause at interrupt for approval
                        if isinstance(event, PlanCreatedEvent):
                            yield create_awaiting_input_for_plan(event.plan)
                            graph_paused = True
                            return

        except Exception as e:
            logger.error(f"LangGraph execution failed: {e}", exc_info=True)
            yield create_error_response(
                "GRAPH_EXECUTION_FAILED",
                f"Graph execution failed: {e}",
            )
            _clear_graph(thread_id)
            return

        # Graph completed (not paused) — send final summary and clean up
        if not graph_paused:
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

            _clear_graph(thread_id)

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

            result_str = str(result)

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
