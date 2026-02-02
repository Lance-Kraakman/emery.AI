"""
Triage Node

Classifies tasks with discovery tools available. Replaces the external
ChainOfThought classifier that had no tool access.

Routes to: "direct" | "plan" | "respond"
"""

import logging
from typing import Any, Dict, List

import dspy

from ...reasoning.config import get_dspy_lm
from ...reasoning.signatures.planning import TriageTask
from ...tools.discovery import create_discovery_tools
from ...services.execution.events import ErrorEvent, FinalSynthesisEvent, ExecutionCompletedEvent
from ..state import PlanExecuteState
from ..runtime import RuntimeContext

logger = logging.getLogger(__name__)

VALID_MODES = {"direct", "plan", "respond"}


async def triage_node(state: PlanExecuteState, runtime: RuntimeContext) -> Dict[str, Any]:
    """
    Triage node: classify task with discovery tools available.

    Uses DSPy ReAct with discovery tools (search_capabilities, system_research,
    workspace_overview) to understand the task before routing.

    Returns state update with execution_mode, triage_reasoning, triage_context.
    """
    task = state.get("task", "")
    if not task:
        logger.error("triage_node called without a task")
        return {
            "error": "No task provided",
            "events": [ErrorEvent(error="No task provided")],
        }

    org_model = state.get("org_model")
    api_key = state.get("api_key", "")
    org_id = state.get("org_id", "")

    events: List[Any] = []

    # Build workspace context summary for triage
    workspace = state.get("workspace_context")
    workspace_summary = workspace.resource_summary() if workspace else ""

    # Create discovery tools for ReAct triage
    discovery_tools: list[dspy.Tool] = []
    if api_key and org_id:
        discovery_tools = create_discovery_tools(
            api_key, org_id, runtime.capability_registry
        )

    # Create ReAct module with discovery tools for informed routing
    react = dspy.ReAct(
        TriageTask,
        tools=discovery_tools,
        max_iters=3,  # Quick research, not deep
    )

    try:
        lm = get_dspy_lm(org_model=org_model)
        with dspy.context(lm=lm):
            result = react(
                task=task,
                workspace_context=workspace_summary,
            )

        execution_mode = getattr(result, "execution_mode", "plan").strip().lower()
        reasoning = getattr(result, "reasoning", "")
        context_notes = getattr(result, "context_notes", "")

        # Validate execution_mode
        if execution_mode not in VALID_MODES:
            logger.warning(
                f"Triage returned invalid mode '{execution_mode}', defaulting to 'plan'"
            )
            execution_mode = "plan"

        logger.info(f"Triage: mode={execution_mode}, reasoning={reasoning[:100]}")

        # For "respond" mode, generate the response inline
        if execution_mode == "respond":
            final_response = context_notes or reasoning
            events.append(FinalSynthesisEvent(
                plan_id="triage",
                synthesis=final_response,
            ))
            events.append(ExecutionCompletedEvent(
                plan_id="triage",
                success=True,
            ))
            return {
                "execution_mode": execution_mode,
                "triage_reasoning": reasoning,
                "triage_context": context_notes,
                "response": final_response,
                "success": True,
                "events": events,
            }

        return {
            "execution_mode": execution_mode,
            "triage_reasoning": reasoning,
            "triage_context": context_notes,
            "events": events,
        }

    except Exception as e:
        logger.error(f"Triage failed, defaulting to plan mode: {e}")
        events.append(ErrorEvent(error=f"Triage failed: {e}", recoverable=True))
        return {
            "execution_mode": "plan",
            "triage_reasoning": f"Triage failed ({e}), defaulting to plan mode",
            "triage_context": "",
            "events": events,
        }
