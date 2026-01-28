"""
Execution Node

Executes a single plan step using PlanStepExecutor.
The graph always routes to the replan node after execution (success or failure).
"""

import logging
from typing import Any, Dict, List

from ...entities.models.plan import Plan, PlanStep, PlanStepStatus
from ...services.plan_service import PlanService
from ...services.execution.plan_step_executor import PlanStepExecutor
from ...services.execution.step_executor import StepExecutor
from ...services.execution.events import (
    StepStartedEvent,
    StepCompletedEvent,
    StepFailedEvent,
)
from ...services.memory import create_memory_crud
from ..state import PlanExecuteState
from ..runtime import RuntimeContext

logger = logging.getLogger(__name__)


async def execute_step_node(state: PlanExecuteState, runtime: RuntimeContext) -> Dict[str, Any]:
    """
    Execute the current plan step.

    Executes one step at a time. After execution (success or failure),
    the graph routes to the replan node which decides what to do next.
    """
    plan = state.get("plan")
    step_results = dict(state.get("step_results", {}))
    ledger = state.get("ledger")

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

    # Build extra tools (e.g., memory CRUD)
    extra_tools = []
    if runtime.memory_service:
        extra_tools.append(create_memory_crud(runtime.memory_service))

    # Create fresh PlanStepExecutor per step from RuntimeContext
    plan_step_executor = PlanStepExecutor(
        api_key=runtime.api_key,
        org_id=runtime.org_id,
        org_model=runtime.org_model,
        max_steps=10,
        capability_registry=runtime.capability_registry,
        extra_tools=extra_tools or None,
    )
    step_executor = StepExecutor(plan_step_executor=plan_step_executor)

    try:
        result = await step_executor.execute_step(
            current_plan=plan,
            step=step,
            tools=tools,
            managed_agents=managed_agents,
        )

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
            "step_results": step_results,
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
