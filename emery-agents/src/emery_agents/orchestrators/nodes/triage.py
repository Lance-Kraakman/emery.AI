"""
Triage Node

Classifies tasks using KNNFewShot for fast routing without tool calls.
Falls back to ReAct with discovery tools for complex/uncertain cases.

Routes to: "direct" | "plan" | "respond"
"""

import logging
from typing import Any

import dspy
from dspy import KNNFewShot

from ...reasoning.config import get_dspy_lm
from ...reasoning.examples.triage import TRIAGE_DEMOS
from ...reasoning.signatures.planning import TriageTask
from ...services.analysis.embeddings import create_dspy_embedder
from ...services.analysis.llm_usage import record_from_lm
from ...services.execution.events import (
    ErrorEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
)
from ..runtime import RuntimeContext
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)

VALID_MODES = {"direct", "plan", "respond"}


def _create_triage_module() -> dspy.Module:
    """Create KNNFewShot triage module.

    Uses ChainOfThought wrapped with KNNFewShot for fast routing.
    No ReAct/tool calls needed - demos teach the model how to route.
    Embeddings are disk-cached so creation is fast after first startup.
    """
    base_triage = dspy.ChainOfThought(TriageTask)
    embedder = create_dspy_embedder()
    return KNNFewShot(
        k=5,
        trainset=TRIAGE_DEMOS,
        vectorizer=embedder,
    ).compile(base_triage)


async def triage_node(
    state: PlanExecuteState, runtime: RuntimeContext
) -> dict[str, Any]:
    """
    Triage node: classify task using KNNFewShot for fast routing.

    Uses ChainOfThought wrapped with KNNFewShot - demos teach the model
    how to route based on task similarity. No tool calls needed for most
    common patterns.

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

    events: list[Any] = []

    # Build context for triage
    workspace = state.get("workspace_context")
    workspace_summary = workspace.resource_summary() if workspace else ""
    memory_context = state.get("memory_context", "") or ""

    # Build image context for triage routing decisions
    image_context = ""
    if runtime.images:
        image_context = f"{len(runtime.images)} image(s) uploaded by the user, available for visual analysis in direct/plan execution."

    # Use KNNFewShot triage module - no tool calls needed for most patterns
    # Demos teach the model how to route based on task similarity
    triage_module = _create_triage_module()

    try:
        lm = get_dspy_lm(org_model=org_model)
        with dspy.context(lm=lm):
            result = triage_module(
                task=task,
                workspace_context=workspace_summary,
                memory_context=memory_context,
                image_context=image_context,
            )
        if not runtime.token_accumulator:
            raise ValueError("token_accumulator is required for triage")
        record_from_lm(lm, runtime.token_accumulator.get_llm_tracker())

        execution_mode = getattr(result, "execution_mode", "direct").strip().lower()
        reasoning = getattr(result, "reasoning", "")
        context_notes = getattr(result, "context_notes", "")
        response_text = getattr(result, "response", "")

        # Extract analysis fields (combined triage + analysis in single call)
        triage_analysis = {
            "intent": getattr(result, "intent", ""),
            "entities": getattr(result, "entities", []),
            "approach": getattr(result, "approach", ""),
            "external_services": getattr(result, "external_services", []),
        }

        # Validate execution_mode
        if execution_mode not in VALID_MODES:
            logger.warning(
                f"Triage returned invalid mode '{execution_mode}', defaulting to 'direct'"
            )
            execution_mode = "direct"

        logger.info(f"Triage: mode={execution_mode}, reasoning={reasoning[:100]}")

        # For "respond" mode, generate the response inline
        if execution_mode == "respond":
            final_response = response_text or context_notes or reasoning
            events.append(
                FinalSynthesisEvent(
                    plan_id="triage",
                    synthesis=final_response,
                )
            )
            events.append(
                ExecutionCompletedEvent(
                    plan_id="triage",
                    success=True,
                )
            )
            return {
                "execution_mode": execution_mode,
                "triage_reasoning": reasoning,
                "triage_context": context_notes,
                "triage_analysis": triage_analysis,
                "response": final_response,
                "success": True,
                "events": events,
            }

        return {
            "execution_mode": execution_mode,
            "triage_reasoning": reasoning,
            "triage_context": context_notes,
            "triage_analysis": triage_analysis,
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
