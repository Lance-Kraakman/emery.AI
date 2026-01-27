"""
Execution Node

Executes a single plan step using PlanStepExecutor.
The graph loops back to this node for each step.
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
    PlanApprovedEvent,
    PlanCreatedEvent,
)
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


async def execute_step_node(state: PlanExecuteState) -> Dict[str, Any]:
    """
    Execute the current plan step.

    Replaces the inner loop of ExecutionCoordinator.execute_plan().
    Executes one step at a time - the graph loops back for each step.
    """
    plan = state["plan"]
    current_step_index = state.get("current_step_index", 0)
    step_results = dict(state.get("step_results", {}))
    tools = state.get("tools", [])
    managed_agents = state.get("managed_agents", [])
    api_key = state.get("api_key", "")
    org_id = state.get("org_id", "")
    org_model = state.get("org_model")
    capability_registry = state.get("capability_registry")
    ledger = state.get("ledger")

    events: List[Any] = []

    assert plan is not None, "Cannot execute without a plan"

    # Get pending steps
    pending_steps = plan.get_pending_steps()

    if not pending_steps:
        logger.info("No more pending steps to execute")
        return {"events": events}

    # Get current step (first pending)
    step = pending_steps[0]

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

    # Create PlanStepExecutor
    plan_step_executor = PlanStepExecutor(
        api_key=api_key,
        org_id=org_id,
        org_model=org_model,
        max_steps=10,
        capability_registry=capability_registry,
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

        logger.info(f"Step {step.step_id} completed")

        return {
            "plan": plan,
            "current_step_index": current_step_index + 1,
            "step_results": step_results,
            "steps_since_eval": state.get("steps_since_eval", 0) + 1,
            "ledger": ledger,
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
            "error": error_msg,
            "events": events,
        }
