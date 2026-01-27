"""
Execution Node

Executes a single plan step using PlanStepExecutor.
The graph loops back to this node for each step.

Handles:
- Fresh PlanStepExecutor per step (created from RuntimeContext)
- Phase tracking with PhaseStartedEvent/PhaseCompletedEvent
"""

import json
import logging
from typing import Any, Dict, List, Optional

from ...entities.models.plan import Plan, PlanStep, PlanStepStatus
from ...services.plan_service import PlanService
from ...services.execution.plan_step_executor import PlanStepExecutor
from ...services.execution.step_executor import StepExecutor
from ...services.execution.events import (
    StepStartedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    AwaitingClarificationEvent,
    PhaseStartedEvent,
    PhaseCompletedEvent,
)
from ..state import PlanExecuteState
from ..runtime import RuntimeContext

logger = logging.getLogger(__name__)


def _handle_phase_transition(
    step: PlanStep,
    plan: Plan,
    current_phase_name: Optional[str],
    phase_step_results: Dict[str, List[str]],
    pending_steps: List[PlanStep],
    events: List[Any],
) -> tuple[Optional[str], Dict[str, List[str]], bool]:
    """
    Handle phase transitions between steps.

    Returns:
        (new_phase_name, updated_phase_step_results, needs_phase_replan)
    """
    step_phase = step.phase_name
    needs_phase_replan = False

    if step_phase == current_phase_name:
        return current_phase_name, phase_step_results, False

    # Phase changed — emit PhaseCompletedEvent for previous phase
    if current_phase_name is not None:
        phase_results = phase_step_results.get(current_phase_name, [])
        results_summary = f"Completed {len(phase_results)} step(s)"
        if phase_results:
            results_summary = "; ".join(r[:100] for r in phase_results if r)[:500]

        # Check if any step in completed phase has replan_after=True
        phase_steps = [s for s in plan.steps if s.phase_name == current_phase_name]
        needs_phase_replan = any(s.replan_after for s in phase_steps)

        events.append(PhaseCompletedEvent(
            plan_id=plan.id,
            phase_name=current_phase_name,
            results_summary=results_summary,
            needs_replan=needs_phase_replan,
        ))

    # Start new phase
    if step_phase:
        phase_step_count = sum(1 for s in pending_steps if s.phase_name == step_phase)
        events.append(PhaseStartedEvent(
            plan_id=plan.id,
            phase_name=step_phase,
            phase_goal=f"Executing {step_phase} phase",
            step_count=phase_step_count,
        ))
        if step_phase not in phase_step_results:
            phase_step_results[step_phase] = []

    return step_phase, phase_step_results, needs_phase_replan


async def execute_step_node(state: PlanExecuteState, runtime: RuntimeContext) -> Dict[str, Any]:
    """
    Execute the current plan step.

    Replaces the inner loop of ExecutionCoordinator.execute_plan().
    Executes one step at a time - the graph loops back for each step.

    Handles:
    - Fresh PlanStepExecutor per step (created from RuntimeContext)
    - Phase tracking with PhaseStarted/PhaseCompleted events
    """
    plan = state.get("plan")
    current_step_index = state.get("current_step_index", 0)
    step_results = dict(state.get("step_results", {}))
    ledger = state.get("ledger")
    current_phase_name = state.get("current_phase_name")
    phase_step_results = dict(state.get("phase_step_results", {}))

    # Read non-serializable objects from runtime
    tools = runtime.tools
    managed_agents = runtime.managed_agents

    events: List[Any] = []

    assert plan is not None, "Cannot execute without a plan"

    # Get pending steps
    pending_steps = plan.get_pending_steps()

    if not pending_steps:
        logger.info("No more pending steps to execute")
        return {"events": events}

    # Get current step (first pending)
    step = pending_steps[0]

    # === Phase tracking ===
    new_phase_name, phase_step_results, needs_phase_replan = _handle_phase_transition(
        step=step,
        plan=plan,
        current_phase_name=current_phase_name,
        phase_step_results=phase_step_results,
        pending_steps=pending_steps,
        events=events,
    )

    # Update ledger - step started
    if ledger:
        ledger.start_step(step.step_id)

    events.append(StepStartedEvent(
        plan_id=plan.id,
        step_id=step.step_id,
        step_description=step.description,
    ))

    # Mark step as in progress
    plan_service = PlanService()
    plan = await plan_service.update_step_status(plan, step.step_id, "in_progress")

    # Create fresh PlanStepExecutor per step from RuntimeContext
    plan_step_executor = PlanStepExecutor(
        api_key=runtime.api_key,
        org_id=runtime.org_id,
        org_model=runtime.org_model,
        max_steps=10,
        capability_registry=runtime.capability_registry,
    )
    step_executor = StepExecutor(plan_step_executor=plan_step_executor)

    try:
        result = await step_executor.execute_step(
            current_plan=plan,
            step=step,
            tools=tools,
            managed_agents=managed_agents,
        )

        # Check if step needs clarification
        if result and "__needs_clarification__" in result:
            try:
                clarification_data = json.loads(result)
                if clarification_data.get("__needs_clarification__"):
                    questions = clarification_data.get("questions", [])
                    logger.info(f"Step {step.step_id} needs clarification: {len(questions)} question(s)")

                    events.append(AwaitingClarificationEvent.from_dict_list(
                        questions=questions,
                        reasoning=f"Step '{step.description}' needs more information",
                    ))
                    return {
                        "plan": plan,
                        "awaiting_input": "clarification",
                        "clarifying_questions": questions,
                        "current_phase_name": new_phase_name,
                        "phase_step_results": phase_step_results,
                        "events": events,
                    }
            except json.JSONDecodeError:
                pass  # Not JSON, treat as normal result

        # Mark step as completed
        plan = await plan_service.update_step_status(
            plan, step.step_id, "completed", result=result
        )

        # Update ledger
        if ledger:
            ledger.complete_step(step.step_id, result)

        events.append(StepCompletedEvent(
            plan_id=plan.id,
            step_id=step.step_id,
            result=result,
        ))

        # Store result
        step_results[step.step_id] = result

        # Track result for phase summary
        if step.phase_name and result:
            if step.phase_name not in phase_step_results:
                phase_step_results[step.phase_name] = []
            phase_step_results[step.phase_name].append(result)

        logger.info(f"Step {step.step_id} completed")

        return {
            "plan": plan,
            "current_step_index": current_step_index + 1,
            "step_results": step_results,
            "steps_since_eval": state.get("steps_since_eval", 0) + 1,
            "ledger": ledger,
            "current_phase_name": new_phase_name,
            "phase_step_results": phase_step_results,
            "error": None,
            "events": events,
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Step {step.step_id} failed: {error_msg}")

        # Mark step as failed
        plan = await plan_service.update_step_status(
            plan, step.step_id, "failed", error=error_msg
        )

        # Update ledger
        if ledger:
            ledger.fail_step(step.step_id, error_msg)

        events.append(StepFailedEvent(
            plan_id=plan.id,
            step_id=step.step_id,
            error=error_msg,
        ))

        return {
            "plan": plan,
            "step_results": step_results,
            "ledger": ledger,
            "current_phase_name": new_phase_name,
            "phase_step_results": phase_step_results,
            "error": error_msg,
            "events": events,
        }
