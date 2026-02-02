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
from PIL import Image

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
from ..reasoning.config import get_dspy_lm, get_lm_for_task
from ..reasoning.modules.executor import ExecutorModule
from ..reasoning.modules.classifier import TaskClassifierModule
from ..reasoning.signatures.planning import (
    TaskClassificationResult,
    TaskComplexity,
    TaskExecutionMode,
)
from ..reasoning.utils import extract_dspy_result
from emery_agents.tools.factories import create_all_tools
from emery_agents.tools.output import QuestionCollector, create_ask_question_tool
from .coordinator_event_converter import convert_coordinator_event
from .approval_handler import is_approval_response
from .response_types import create_error_response
from ..orchestrators import create_session_graph, RuntimeContext
from ..orchestrators.runtime import ConversationMessage
from ..orchestrators.state import DEFAULT_STATE
from ..services.memory import MemoryService
from ..services.context import WorkspaceContext
from emery_agents.tools.capability_registry import CapabilityRegistry
from ..orchestrators.nodes.planning import _build_workspace_context
from ..services.planning import PlanFileRepository

logger = logging.getLogger(__name__)

# Session-scoped graph cache keyed by thread_id.
# Each session gets its own graph with RuntimeContext bound via closures.
_session_cache: Dict[str, Any] = {}


def _convert_history(
    conversation_history: Optional[List[Any]],
) -> Optional[List[ConversationMessage]]:
    """Convert HistoryMessage entities to typed ConversationMessage dataclasses."""
    from ..entities.message import TextPart

    if not conversation_history:
        return None
    messages: List[ConversationMessage] = []
    for msg in conversation_history:
        if isinstance(msg, ConversationMessage):
            messages.append(msg)
        else:
            role = getattr(msg, "role", "unknown")
            content_parts = getattr(msg, "content_parts", [])
            text = " ".join(
                part.text for part in content_parts
                if isinstance(part, TextPart)
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
    ) -> TaskClassificationResult:
        """
        Classify a task to determine execution mode.

        Args:
            task: The user's task
            org_model: Model to use for classification
            context: Optional context about system state

        Returns:
            TaskClassificationResult with mode, complexity, and reasoning
        """
        classifier = self._get_classifier()

        with dspy.context(lm=get_dspy_lm(org_model)):
            result = classifier.classify(
                task=task,
                context=context,
            )

        return result

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
        images: Optional[List[Image.Image]] = None,
        has_images: bool = False,
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
        # Initialize MemoryService from workspace IDs
        memory_service = None
        memory_context_str = ""
        if workspace_type and workspace_id:
            try:
                memory_service = MemoryService(
                    workspace_type=workspace_type,
                    workspace_id=workspace_id,
                    base_path=Path("/tmp/workspace"),
                )
                # Fetch relevant memories (passed separately to planner, not mixed into task)
                memory_context_str = memory_service.get_context_summary(task)
                if memory_context_str:
                    logger.info(f"Found relevant memory context ({len(memory_context_str)} chars)")
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
        )

        # === CLASSIFY TASK (if no stored plan) ===
        if not stored_plan:
            try:
                context_str = workspace.resource_summary()
                if workspace.existing_skills:
                    skill_names = [s.name for s in workspace.existing_skills]
                    context_str += f"\nAvailable skills: {', '.join(skill_names)}"

                classification = await self._classify_task(
                    task=task,
                    org_model=org_model,
                    context=context_str,
                )

                if classification.mode == TaskExecutionMode.DIRECT:
                    async for event in self._handle_direct_execution(
                        context=context,
                        task=task,
                        org_model=org_model,
                        classification=classification,
                        external_tools=tools,
                        workspace_context=workspace,
                        memory_context=memory_context_str,
                        conversation_history=_convert_history(conversation_history),
                        capability_registry=capability_registry,
                        images=images,
                        has_images=has_images,
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
            memory_context=memory_context_str,
            workspace_context=workspace,
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
        memory_context: str = "",
        workspace_context: Optional[WorkspaceContext] = None,
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
            "organization_id": context.tool_provider.organization_id if context.tool_provider else None,
            "stored_plan": stored_plan,
            "runtime_skill_inputs": runtime_skill_inputs,
            "workspace_context": workspace_context,
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
            tools=tools,
        ):
            yield event

    async def _stream_graph_events(
        self,
        graph: Any,
        input_data: Any,
        config: Dict[str, Any],
        context: 'ExecutionContext',
        thread_id: str,
        tools: Optional[List[Any]] = None,
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
            # No steps executed — direct execution fallback (no classification)
            async for event in self._handle_direct_execution(
                context=context,
                task="",  # Task already processed by graph
                org_model=None,
                external_tools=tools,
            ):
                yield event

        _clear_session(thread_id)

    async def _handle_direct_execution(
        self,
        context: 'ExecutionContext',
        task: str,
        org_model: Optional[str],
        classification: Optional[TaskClassificationResult] = None,
        external_tools: Optional[List[dspy.Tool]] = None,
        workspace_context: Optional[WorkspaceContext] = None,
        memory_context: str = "",
        conversation_history: Optional[List[ConversationMessage]] = None,
        capability_registry: Optional[CapabilityRegistry] = None,
        images: Optional[List[Image.Image]] = None,
        has_images: bool = False,
    ) -> AsyncIterator[Any]:
        """
        Handle direct execution without a plan using DSPy.

        Used for simple tasks that don't require planning.
        When images are present (user uploads or scanned PDFs), uses vision model.
        """
        assert context.tool_provider is not None, "tool_provider required for direct execution"

        logger.info(f"Direct execution: Starting DSPy ReAct execution... (has_images={has_images})")

        # Create DSPy tools with auth (pass capability_registry for search_capabilities)
        tools = create_all_tools(
            api_key=context.tool_provider.api_key,
            org_id=str(context.tool_provider.organization_id),
            capability_registry=capability_registry,
        )

        # Include loaded tools (skill tools, Pipedream, etc.) from agent config
        if external_tools:
            tools.extend(external_tools)

        # Add ask_question tool for clarification
        question_collector = QuestionCollector()
        ask_question_tool = create_ask_question_tool(question_collector)
        all_tools = [ask_question_tool] + tools

        max_iters = self._max_iters_for_direct(classification)

        logger.info(
            f"Direct execution: {len(all_tools)} tools, max_iters={max_iters}"
        )

        # Create executor wrapped in Refine for quality gating
        from ..reasoning.modules.executor import DirectExecutorModule, direct_execution_reward

        base_executor = DirectExecutorModule(
            execution_tools=all_tools,
            max_iters=max_iters,
        )
        executor = dspy.Refine(
            module=base_executor,
            N=3,
            reward_fn=direct_execution_reward,
            threshold=0.8,
        )

        # Use vision model when images are present (uploaded images or scanned PDF pages)
        if has_images:
            lm = get_lm_for_task("execution", prefer_vision=True)
            logger.info("Using vision model for image-containing request")
        else:
            lm = get_dspy_lm(org_model=org_model)

        # Build execution context with available information
        execution_context: Dict[str, Any] = {
            "task": task,
            "org_id": str(context.tool_provider.organization_id),
        }

        # Add workspace context so executor knows existing resources
        if workspace_context:
            execution_context["workspace"] = workspace_context.resource_summary()

        # Add memory context from past interactions
        if memory_context:
            execution_context["memory"] = memory_context

        # Add conversation history for follow-up context
        if conversation_history:
            recent = conversation_history[-10:]
            execution_context["conversation_history"] = [
                {"role": m.role, "content": m.content[:500]} for m in recent
            ]

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

    @staticmethod
    def _max_iters_for_direct(classification: Optional[TaskClassificationResult]) -> int:
        """Determine max ReAct iterations based on task complexity."""
        if not classification:
            return 10  # fallback default
        if classification.complexity == TaskComplexity.SIMPLE:
            return 5
        if classification.complexity == TaskComplexity.MEDIUM:
            return 7
        return 9

    def _get_managed_agents_list(self, managed_agents: Optional[List[Any]]) -> List[Any]:
        """Convert managed_agents to list format."""
        if managed_agents:
            if isinstance(managed_agents, dict):
                return list(managed_agents.values())
            return list(managed_agents)
        return []
