"""
Direct Execution Node

Executes a task in a single ReAct loop with all tools.
Replaces the _handle_direct_execution method from coordinator_streaming.py.

On success: sets response (signals end).
On failure: sets execution_mode = "plan" to escalate to full planning.
"""

import json
import logging
from typing import Any

import dspy
from dspy.adapters.types.image import Image as DspyImage

from ...reasoning.config import get_dspy_lm
from ...reasoning.modules.executor import DirectExecutorModule, direct_execution_reward
from ...reasoning.utils import extract_dspy_result
from ...services.analysis.llm_usage import record_from_lm
from ...services.context import format_conversation_history
from ...services.execution.events import (
    AwaitingClarificationEvent,
    ErrorEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
)
from ...entities.execution_context import ExecutionContext
from ...services.context import execution_scope
from ...services.memory import create_memory_crud
from ...types import ExecutionMode
from ...tools.factories import create_all_tools
from ...tools.output import QuestionCollector, create_ask_question_tool
from ...tools.profiles import select_tools_for_task
from ...types import ToolMode
from ..runtime import RuntimeContext
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


async def direct_execute_node(
    state: PlanExecuteState, runtime: RuntimeContext
) -> dict[str, Any]:
    """
    Direct execution node: execute task in a single ReAct loop.

    Has ALL tools (CRUD + discovery + external). Uses DirectExecution signature
    for completion guidance via dspy.Refine for quality gating.

    On success: sets `response` field (signals END).
    On failure: sets `execution_mode = "plan"` for escalation to generate_plan.
    """
    task = state.get("task", "")
    org_model = state.get("org_model")
    api_key = state.get("api_key", "")
    org_id = state.get("org_id", "")
    workspace = state.get("workspace_context")
    memory_context = state.get("memory_context", "") or ""
    triage_context = state.get("triage_context", "") or ""

    events: list[Any] = []

    # Create all tools with auth
    tools = create_all_tools(
        api_key=api_key,
        org_id=org_id,
        capability_registry=runtime.capability_registry,
        planning_registry=runtime.planning_registry,
    )

    # Include external tools from runtime (skill tools, Pipedream, etc.)
    if runtime.tools:
        # runtime.tools may include external tools passed from gRPC
        # Avoid duplicates by checking names
        existing_names = {getattr(t, "name", None) for t in tools}
        for t in runtime.tools:
            if getattr(t, "name", None) not in existing_names:
                tools.append(t)

    # Add memory CRUD if available
    if runtime.engine:
        tools.append(create_memory_crud(runtime.engine.memory))

    # Filter tools based on triage analysis (reduces tool surface for better selection)
    triage_analysis = state.get("triage_analysis")
    tools = select_tools_for_task(tools, triage_analysis)

    # Add ask_question tool for clarification
    question_collector = QuestionCollector()
    ask_question_tool = create_ask_question_tool(question_collector)
    all_tools = [ask_question_tool] + tools

    # Determine max iterations (default 7 for direct execution)
    max_iters = 7

    logger.info(f"Direct execution: {len(all_tools)} tools, max_iters={max_iters}")

    # Create executor wrapped in Refine for quality gating
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

    # Build execution context
    execution_context: dict[str, Any] = {
        "task": task,
        "org_id": org_id,
    }
    if workspace:
        execution_context["workspace"] = workspace.resource_summary()
    if memory_context:
        execution_context["memory"] = memory_context
    if triage_context:
        execution_context["triage_findings"] = triage_context
    conversation_str = format_conversation_history(runtime.conversation_history)
    if conversation_str:
        execution_context["conversation_history"] = conversation_str

    # Convert PIL images to DSPy Image objects for multimodal LLM support
    dspy_images = [DspyImage(img) for img in runtime.images]
    if dspy_images:
        logger.info(f"Direct execution: passing {len(dspy_images)} image(s) to LLM")

    # Create execution context with PLANNING mode to block mutations
    # Direct execution is for read-only research, Q&A, information gathering
    ctx = ExecutionContext(
        mode=ExecutionMode.INTERACTIVE,
        task=task,
        available_tools=[t.name for t in all_tools if hasattr(t, "name")],
        tool_mode=ToolMode.PLANNING,  # Block mutations in direct mode
        organization_id=int(org_id) if org_id else None,
    )

    try:
        lm = get_dspy_lm(org_model=org_model)
        with execution_scope(ctx), dspy.context(lm=lm):
            result = executor(
                step_description=task,
                context=json.dumps(execution_context),
                images=dspy_images,
            )
        record_from_lm(lm, runtime.token_accumulator.get_llm_tracker())

        result_str = extract_dspy_result(result)

        # Check for clarification questions
        if question_collector.has_questions():
            questions = question_collector.get_questions()
            logger.info(
                f"Direct execution needs clarification: {len(questions)} question(s)"
            )

            events.append(
                AwaitingClarificationEvent.from_dict_list(
                    questions=questions,
                    reasoning="Need more details to complete this task",
                )
            )
            return {
                "awaiting_input": "clarification",
                "clarifying_questions": questions,
                "events": events,
            }

        logger.info(f"Direct execution completed: {len(result_str)} chars")

        # Emit completion events
        events.append(
            FinalSynthesisEvent(
                plan_id="direct",
                synthesis=result_str,
            )
        )
        events.append(
            ExecutionCompletedEvent(
                plan_id="direct",
                success=True,
            )
        )

        return {
            "response": result_str,
            "success": True,
            "events": events,
        }

    except Exception as e:
        logger.error(f"Direct execution failed, escalating to plan: {e}", exc_info=True)

        events.append(
            ErrorEvent(
                error=f"Direct execution failed: {e}",
                recoverable=True,
            )
        )

        # Escalate to plan mode
        return {
            "execution_mode": "plan",
            "error": None,  # Clear error so generate_plan doesn't abort
            "events": events,
        }
