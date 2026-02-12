"""
Execution Node

Executes a single plan step using PlanStepExecutor.
The graph always routes to the replan node after execution (success or failure).
"""

import logging
from typing import Any

from ...ace import StepResult
from ...api.skill_api import SkillAPIService
from ...entities.output_mapping import (
    FieldMapping,
    FieldSource,
    OutputMappingConfig,
    RowAction,
    RowIdSource,
    TableMapping,
)
from ...entities.skill_config import OutputTableMapping, SkillConfig
from ...entities.task import SkillOutputValue
from ...reasoning.utils import StepOutcome
from ...services.data.output_mapping import MappingContext, OutputMappingService
from ...services.execution.events import (
    AwaitingHumanSkillEvent,
    StepCompletedEvent,
    StepFailedEvent,
    StepStartedEvent,
    ToolLoadedEvent,
)
from ...services.execution.plan_step_executor import PlanStepExecutor
from ...services.execution.step_executor import StepExecutor
from ...services.memory import create_memory_crud
from ...services.plan_service import PlanService
from ...tools.execution.skill import HumanSkillAwaitingException
from ...tools.loader import UnifiedToolLoader
from ..runtime import RuntimeContext
from ..state import HumanSkillCompleted, PlanExecuteState

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
        skill_id = human_skill_completed.get("skill_id")
        skill_name = human_skill_completed.get("skill_name", "unknown")
        human_outputs = human_skill_completed.get("outputs", {})

        logger.info(
            f"Human skill '{skill_name}' (id={skill_id}) completed for step {completed_step_id} - "
            f"marking step as done"
        )

        # Apply output mappings if skill has them configured
        if skill_id and runtime.api_key:
            await _apply_human_skill_output_mappings(
                skill_id=skill_id,
                outputs=human_outputs,
                api_key=runtime.api_key,
                org_id=runtime.org_id,
                extra_headers=runtime.extra_headers,
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

    # Add external tools from runtime (Pipedream tools selected in chat UI)
    if runtime.tools:
        extra_tools.extend(runtime.tools)
        logger.info(f"Added {len(runtime.tools)} external tools from runtime")

    # Create tool loader for dynamic tool loading during execution
    tool_loader = UnifiedToolLoader()

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
        tool_loader=tool_loader,  # Enable dynamic tool loading
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

        # Emit events for dynamically loaded tools (frontend sync)
        if plan_step_executor.loaded_tool_events:
            events.extend(plan_step_executor.loaded_tool_events)
            logger.info(
                f"Emitting {len(plan_step_executor.loaded_tool_events)} tool loaded events"
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


async def _apply_human_skill_output_mappings(
    skill_id: str,
    outputs: dict[str, Any],
    api_key: str,
    org_id: str,
    extra_headers: dict[str, str] | None = None,
) -> None:
    """
    Apply output mappings for a completed human skill.

    Fetches the skill config, finds outputs with output_mapping configured,
    and writes the human-provided values to the target database tables.

    Args:
        skill_id: The skill ID to fetch config for
        outputs: Human-provided output values (name -> value)
        api_key: API key for authentication
        org_id: Organization ID
        extra_headers: Optional extra headers for API calls
    """
    try:
        # Fetch skill config from API
        skill_api = SkillAPIService(
            api_key=api_key, organization_id=int(org_id) if org_id else None
        )
        skill_data = await skill_api.fetch_skill_by_id(skill_id)

        if not skill_data or not skill_data.raw:
            logger.warning(f"Could not fetch skill config for {skill_id}")
            return

        # Parse skill config
        skill_config = SkillConfig.from_api_response(skill_data.raw)

        # Find outputs with output mappings
        outputs_with_mappings = [
            output
            for output in skill_config.outputs
            if output.output_mapping is not None
        ]

        if not outputs_with_mappings:
            logger.info(f"Skill {skill_id} has no output mappings configured")
            return

        # Convert human outputs to SkillOutputValue list
        skill_output_values = [
            SkillOutputValue(name=name, value=value)
            for name, value in outputs.items()
        ]

        # Create mapping context
        ctx = MappingContext(api_key=api_key, organization_id=org_id)

        # Apply output mappings for each output that has them
        for output_def in outputs_with_mappings:
            if output_def.output_mapping is None:
                continue

            # Convert skill_config types to output_mapping types
            config = OutputMappingConfig(
                mode=output_def.output_mapping.mode,
                table_mappings=[
                    _convert_table_mapping(tm)
                    for tm in output_def.output_mapping.table_mappings
                ],
            )

            logger.info(
                f"Applying output mapping for '{output_def.name}' "
                f"with {len(config.table_mappings)} table mappings"
            )

            results = await OutputMappingService.apply_multi_table_mapping(
                ctx=ctx,
                config=config,
                skill_outputs=skill_output_values,
            )

            logger.info(
                f"✅ Human skill output mapping complete: {len(results)} tables updated"
            )

    except Exception as e:
        logger.error(f"Failed to apply human skill output mappings: {e}", exc_info=True)


def _convert_table_mapping(tm: OutputTableMapping) -> TableMapping:
    """Convert skill_config OutputTableMapping to output_mapping TableMapping.

    These are two different type hierarchies:
    - skill_config types: Used for parsing API responses (camelCase -> snake_case)
    - output_mapping types: Used by OutputMappingService for execution

    Args:
        tm: OutputTableMapping from skill_config module

    Returns:
        TableMapping compatible with OutputMappingService
    """
    # Convert row_id_source with proper use_source_row handling
    row_id_source = None
    if tm.row_id_source:
        # Handle use_source_row flag → type="source_row"
        row_type = tm.row_id_source.type
        if tm.row_id_source.use_source_row:
            row_type = "source_row"

        row_id_source = RowIdSource(
            type=row_type,
            static_id=tm.row_id_source.static_id or None,
            skill_input=tm.row_id_source.skill_input or None,
            skill_output=tm.row_id_source.skill_output or None,
        )

    # Convert field mappings
    field_mappings = [
        FieldMapping(
            source=FieldSource(
                type=fm.source.type,
                name=fm.source.name or None,
                order=fm.source.order or None,
                field=fm.source.field or None,
            ),
            target_field_id=fm.target_field_id,
            append_mode=fm.append_mode,
        )
        for fm in tm.mappings
    ]

    # Convert row_action string to enum
    row_action = RowAction.UPDATE if tm.row_action == "update" else RowAction.CREATE

    return TableMapping(
        order=tm.order,
        target_table_id=tm.target_table_id,
        row_action=row_action,
        row_id_source=row_id_source,
        mappings=field_mappings,
    )
