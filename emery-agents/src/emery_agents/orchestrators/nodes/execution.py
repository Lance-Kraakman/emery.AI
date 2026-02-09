"""
Execution Node

Executes a single plan step using PlanStepExecutor.
The graph always routes to the replan node after execution (success or failure).
"""

import logging
from typing import Any

from ...ace import StepResult
from ...reasoning.utils import StepOutcome
from ...services.execution.events import (
    AwaitingHumanSkillEvent,
    StepCompletedEvent,
    StepFailedEvent,
    StepStartedEvent,
)
from ...services.execution.plan_step_executor import PlanStepExecutor
from ...services.execution.step_executor import StepExecutor
from ...services.memory import create_memory_crud
from ...services.plan_service import PlanService
from ...tools.execution.skill import HumanSkillAwaitingException
from ..runtime import RuntimeContext
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


async def execute_step_node(
    state: PlanExecuteState, runtime: RuntimeContext
) -> dict[str, Any]:
    """
    Execute the current plan step.

    Executes one step at a time. After execution (success or failure),
    the graph routes to the replan node which decides what to do next.
    """
    plan = state.get("plan")
    step_outcomes = dict(state.get("step_outcomes", {}))
    ledger = state.get("ledger")
    runtime_skill_inputs = state.get("runtime_skill_inputs")

    logger.info(
        f"📝 execute_step_node - runtime_skill_inputs from state: {runtime_skill_inputs}"
    )

    # Read non-serializable objects from runtime
    tools = runtime.tools
    managed_agents = runtime.managed_agents

    events: list[Any] = []

    assert plan is not None, "Cannot execute without a plan"

    # Check if we're resuming after a human skill completion
    human_skill_completed = state.get("human_skill_completed")
    if human_skill_completed:
        completed_step_id = human_skill_completed.get("step_id")
        skill_name = human_skill_completed.get("skill_name", "unknown")
        human_outputs = human_skill_completed.get("outputs", {})

        logger.info(
            f"Human skill '{skill_name}' completed for step {completed_step_id} - "
            f"marking step as done"
        )

        # Format outputs for result
        outputs_str = ", ".join(
            f"{k}: {str(v)[:100]}" for k, v in human_outputs.items()
        )
        result_summary = f"Human skill '{skill_name}' completed with: {outputs_str}"

        # Update step outcome
        step_outcomes[completed_step_id] = {
            "summary": result_summary,
            "success": True,
            "tool_calls": [],
            "human_skill_outputs": human_outputs,
        }

        # Mark step as completed
        plan_service = PlanService()
        plan = await plan_service.update_step_status(
            plan, completed_step_id, "completed", result=result_summary
        )

        if ledger:
            ledger.complete_step(completed_step_id, result_summary)

        events.append(
            StepCompletedEvent(
                plan_id=plan.id,
                step_id=completed_step_id,
                result=result_summary,
            )
        )

        # Clear the flag and return to replan
        return {
            "plan": plan,
            "step_outcomes": step_outcomes,
            "ledger": ledger,
            "human_skill_completed": None,
            "events": events,
        }

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

    events.append(
        StepStartedEvent(
            plan_id=plan.id,
            step_id=step.step_id,
            step_description=step.description,
        )
    )

    # Mark step as in progress
    plan_service = PlanService()
    plan = await plan_service.update_step_status(plan, step.step_id, "in_progress")

    # Build extra tools (e.g., memory CRUD)
    extra_tools = []
    if runtime.engine:
        extra_tools.append(create_memory_crud(runtime.engine.memory))

    # Create fresh PlanStepExecutor per step from RuntimeContext
    plan_step_executor = PlanStepExecutor(
        api_key=runtime.api_key,
        org_id=runtime.org_id,
        org_model=runtime.org_model,
        max_steps=10,
        skill_inputs=runtime_skill_inputs,  # Pass runtime inputs for template resolution
        capability_registry=runtime.capability_registry,
        extra_tools=extra_tools or None,
        extra_headers=runtime.extra_headers,  # Audit trail headers for CRUD tool calls
        llm_tracker=runtime.token_accumulator.get_llm_tracker()
        if runtime.token_accumulator
        else None,
    )

    # Hydrate with previous step results so context flows between steps
    for prev_step in plan.steps:
        if prev_step.step_id in step_outcomes:
            outcome_dict = step_outcomes[prev_step.step_id]
            plan_step_executor._step_results[prev_step.step_id] = StepResult(
                step_id=prev_step.step_id,
                result=outcome_dict.get("summary", ""),
                description=prev_step.description,
            )

    step_executor = StepExecutor(plan_step_executor=plan_step_executor)

    try:
        outcome: StepOutcome = await step_executor.execute_step(
            current_plan=plan,
            step=step,
            tools=tools,
            managed_agents=managed_agents,
        )

        # Store structured outcome
        step_outcomes[step.step_id] = outcome.to_dict()

        if outcome.success:
            # Mark step as completed
            plan = await plan_service.update_step_status(
                plan, step.step_id, "completed", result=outcome.summary
            )
            if ledger:
                ledger.complete_step(step.step_id, outcome.summary)

            events.append(
                StepCompletedEvent(
                    plan_id=plan.id,
                    step_id=step.step_id,
                    result=outcome.summary,
                )
            )

            logger.info(
                f"Step {step.step_id} completed (tool_calls={len(outcome.tool_calls)})"
            )

            return {
                "plan": plan,
                "step_outcomes": step_outcomes,
                "ledger": ledger,
                "error": None,
                "events": events,
            }
        else:
            # Tool calls failed — mark step as failed with evidence
            error_msg = f"Tool calls failed:\n{outcome.format_evidence()}"
            plan = await plan_service.update_step_status(
                plan, step.step_id, "failed", error=error_msg
            )
            if ledger:
                ledger.fail_step(step.step_id, error_msg)

            events.append(
                StepFailedEvent(
                    plan_id=plan.id,
                    step_id=step.step_id,
                    error=error_msg,
                )
            )

            logger.warning(f"Step {step.step_id} failed: tool calls unsuccessful")

            return {
                "plan": plan,
                "step_outcomes": step_outcomes,
                "ledger": ledger,
                "error": error_msg,
                "events": events,
            }

    except HumanSkillAwaitingException as e:
        # Human skill requires human input - set up interrupt
        logger.info(
            f"Human skill {e.skill_name} requires input - setting up interrupt"
        )

        # Emit the awaiting human skill event
        events.append(
            AwaitingHumanSkillEvent(
                skill_id=e.skill_id,
                skill_name=e.skill_name,
                step_id=step.step_id,  # Associate with current plan step
                instructions=e.instructions,
                inputs=e.inputs,
                output_schema=e.output_schema,
                assigned_to=e.assigned_to,
                external_links=e.external_links,
                session_id=e.session_id,
            )
        )

        # Set state for human skill interrupt
        return {
            "plan": plan,
            "step_outcomes": step_outcomes,
            "ledger": ledger,
            "awaiting_input": "human_skill",
            "human_skill_info": {
                "skill_id": e.skill_id,
                "skill_name": e.skill_name,
                "step_id": step.step_id,
                "instructions": e.instructions,
                "inputs": e.inputs,
                "output_schema": e.output_schema,
                "assigned_to": e.assigned_to,
            },
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

        events.append(
            StepFailedEvent(
                plan_id=plan.id,
                step_id=step.step_id,
                error=error_msg,
            )
        )

        return {
            "plan": plan,
            "step_outcomes": step_outcomes,
            "ledger": ledger,
            "error": error_msg,
            "events": events,
        }
