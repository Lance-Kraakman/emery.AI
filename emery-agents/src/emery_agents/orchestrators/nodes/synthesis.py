"""
Synthesis Node

Synthesizes all step results into a coherent final answer.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

import dspy

from ...reasoning.modules.evaluator import EvaluatorModule
from ...reasoning.config import get_dspy_lm
from ...services.execution.events import (
    FinalSynthesisEvent,
    ExecutionCompletedEvent,
)
from ...services.plan_service import PlanService
from ...entities.models.plan import PlanStatus
from ...ace import StrategyOutcome
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


async def synthesize_node(state: PlanExecuteState) -> Dict[str, Any]:
    """
    Synthesize final answer from all step results.

    Replaces ExecutionCoordinator._synthesize_final_answer() and
    the completion logic at the end of execute_plan().
    """
    plan = state["plan"]
    ledger = state.get("ledger")
    org_model = state.get("org_model")
    strategy_service = state.get("strategy_service")
    error = state.get("error")

    events: List[Any] = []

    assert plan is not None, "Cannot synthesize without a plan"

    # Determine success
    success = error is None

    # Mark plan as completed or failed
    if success:
        plan = plan.complete()
    else:
        plan = plan.fail()

    # ACE: Record execution pattern
    if strategy_service and plan:
        outcome = StrategyOutcome.SUCCESS if success else StrategyOutcome.FAILURE
        success_factors: List[str] = []
        failure_patterns: List[str] = []

        if ledger and ledger.execution_context:
            for insight in ledger.execution_context.insights:
                if insight.insight_type.value in ("decision", "artifact"):
                    success_factors.append(insight.summary)
                elif insight.insight_type.value in ("constraint", "error_recovery"):
                    failure_patterns.append(insight.summary)

        strategy_service.record_execution(
            plan=plan,
            outcome=outcome,
            success_factors=success_factors[:5],
            failure_patterns=failure_patterns[:5],
        )
        logger.info(f"Recorded execution pattern ({outcome.value})")

    # Synthesize final answer
    final_synthesis = None
    if success and ledger:
        try:
            final_synthesis = await _synthesize_final_answer(
                plan=plan,
                ledger=ledger,
                org_model=org_model,
            )
            if final_synthesis:
                events.append(FinalSynthesisEvent(
                    plan_id=plan.id,
                    synthesis=final_synthesis,
                ))
                logger.info("Final synthesis generated from all step results")
        except Exception as e:
            logger.warning(f"Final synthesis failed, using raw results: {e}")

    logger.info(f"Plan {plan.id} execution {'completed' if success else 'failed'}")

    events.append(ExecutionCompletedEvent(plan_id=plan.id, success=success))

    return {
        "plan": plan,
        "final_result": final_synthesis,
        "success": success,
        "events": events,
    }


async def _synthesize_final_answer(
    plan: Any,
    ledger: Any,
    org_model: Optional[str] = None,
) -> str:
    """Use DSPy evaluator to synthesize all step results into coherent final answer."""
    step_results = ledger.get_step_results()
    if not step_results:
        return ""

    # Get curated insights
    curated_context = ""
    if ledger.execution_context:
        curated_context = ledger.execution_context.format_insights(max_tokens=1000)

    goal = plan.goal

    # Format results
    parts = []
    for step_id, result in step_results.items():
        step_state = ledger.steps.get(step_id)
        step_name = step_state.step_name if step_state else step_id
        result_text = result if result else "(completed with no output)"
        parts.append(f"### {step_name}\n{result_text}")
    formatted_results = "\n\n".join(parts)

    try:
        lm = get_dspy_lm(org_model=org_model)
        evaluator = EvaluatorModule()

        with dspy.context(lm=lm):
            result = await asyncio.to_thread(
                evaluator.synthesize_answer,
                goal,
                formatted_results,
                curated_context,
            )
        return str(result)
    except Exception as e:
        logger.error(f"Synthesis failed: {e}")
        return formatted_results
