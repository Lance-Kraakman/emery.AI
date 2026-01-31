"""
PlanStepExecutor - Executes plan steps via DSPy ReAct

AIDEV-NOTE: This module uses DSPy's ReAct pattern for step execution,
replacing the previous smolagents-based implementation.

Architecture:
    ExecutionCoordinator.execute_plan()
        └── plan_step_executor.execute(plan, current_step)
                └── Generates prompt using mode-specific templates:
                    - Autonomous: step_executor_autonomous.j2 (has prompt_template)
                    - Interactive: step_executor_interactive.j2 (description-based)
                └── Creates DSPy ExecutorModule with tools
                └── Executes via ReAct pattern
                └── Returns result from execution

This is different from StepExecutorService which handles DAG workflow steps.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import dspy

from ...ace import StepResult
from ...reasoning.config import get_dspy_lm
from ...reasoning.modules.executor import ExecutorModule, SimpleExecutorModule
from ...reasoning.utils import extract_dspy_result, build_step_outcome, StepOutcome
from ...reasoning.tools import (
    create_all_tools,
)
from ...entities.models.plan import Plan, PlanStep, PlanStepStatus
from ..tools import CapabilityRegistry
from ...utils.session_logger import get_session_logger
from .prompt_template_resolver import resolve_prompt_template
from ..protocols import ModelProviderProtocol

logger = logging.getLogger(__name__)


def _build_step_prompt(
    goal: str,
    current_step: PlanStep,
    step_index: int,
    total_steps: int,
    completed_steps: list[PlanStep],
    remaining_steps: list[PlanStep],
    resolved_prompt: str | None = None,
    original_task: str | None = None,
) -> str:
    """Build execution prompt for a plan step."""
    parts = [
        f"You are executing step {step_index + 1} of {total_steps} in the approved plan.",
        "",
        "## Plan Goal",
        goal,
    ]

    # Include original user request when it contains data not captured in goal
    if original_task and len(original_task) > len(goal) + 50:
        display_task = original_task[:8000] + "\n...[truncated]" if len(original_task) > 8000 else original_task
        parts.extend(["", "## Original User Request (contains input data)", display_task])

    parts.extend([
        "",
        "## Before You Act",
        "",
        "You have discovery tools (`workspace_overview`, `system_research`, `search_capabilities`, `search_external`) ",
        "and CRUD tools for listing, reading, creating, updating, and deleting resources.",
        "",
        "1. Discover what exists — use `workspace_overview` or list operations to find resources and IDs",
        "2. Understand schemas — discover field names and types before creating or populating data",
        "3. Use discovered info directly — do not ask the user for things you can look up",
        "4. Chain discoveries — find the table, then list its fields, then populate rows",
    ])

    if current_step.phase_name:
        parts.extend(["", f"## Phase: {current_step.phase_name}"])

    # Content section
    if resolved_prompt:
        parts.extend(["", "## Execute", resolved_prompt])
    else:
        parts.extend(["", "## Current Step", current_step.description])

    # Step scope constraint — prevent LLM from executing beyond this step
    parts.extend([
        "",
        "## Step Scope",
        "Execute ONLY what this step describes. Do NOT perform work from remaining steps.",
        "Each remaining step will be executed separately with its own context.",
    ])

    # Completed steps
    if completed_steps:
        parts.extend(["", "## Previously Completed Steps (already done — use their results)"])
        for i, step in enumerate(completed_steps, 1):
            result = step.result or 'completed'
            parts.append(f"- Step {i}: {step.description}")
            parts.append(f"  Result: {result}")

    # Remaining steps
    if remaining_steps:
        parts.extend(["", "## Remaining Steps After This"])
        for step in remaining_steps:
            parts.append(f"- {step.description}")

    parts.extend(["", "---", "", "Execute directly. Report concrete results."])

    return "\n".join(parts)


class PlanStepExecutor:
    """
    Executes plan steps via DSPy ReAct.

    Uses DSPy's ReAct pattern for tool-based execution with reasoning.
    """

    def __init__(
        self,
        api_key: str,
        org_id: str,
        org_model: str | None = None,
        max_steps: int = 10,
        skill_inputs: dict[str, Any] | None = None,
        capability_registry: CapabilityRegistry | None = None,
        extra_tools: list[Any] | None = None,
    ):
        """
        Initialize PlanStepExecutor.

        Args:
            api_key: Bearer token for API authentication
            org_id: Organization ID for RLS context
            org_model: Model ID to use for execution
            max_steps: Max iterations for ReAct loop
            skill_inputs: Runtime inputs for skill execution (used with prompt templates)
            capability_registry: Registry of capabilities for dynamic discovery in templates
            extra_tools: Additional tools to include (e.g., memory_crud)
        """
        self.api_key = api_key
        self.org_id = org_id
        self.org_model = org_model
        self.max_steps = max_steps
        self.skill_inputs = skill_inputs or {}
        self.capability_registry = capability_registry

        # Create DSPy tools with auth captured (includes CRUD + discovery tools)
        self._crud_tools = create_all_tools(
            api_key=api_key,
            org_id=org_id,
            capability_registry=capability_registry,
        )

        # Step execution tools — NO ask_question tool.
        # Step execution should be deterministic: complete or fail.
        # Failures trigger recovery/replanning, not user clarification.
        # ask_question is only for planning phase and direct (no-plan) execution.
        self._all_tools = list(self._crud_tools)
        if extra_tools:
            self._all_tools.extend(extra_tools)

        # Track results from previous steps for prompt template resolution and ACE curation
        self._step_results: dict[str, StepResult] = {}

        logger.info(f"Created PlanStepExecutor with {len(self._all_tools)} DSPy tools")

    @property
    def step_results(self) -> dict[str, StepResult]:
        """
        Get results from all executed steps.

        Returns dict of step_id -> StepResult.
        Used by ExecutionContextService for context curation (ACE pattern).
        """
        return self._step_results

    def execute(
        self,
        plan: Plan,
        current_step: PlanStep,
    ) -> StepOutcome:
        """
        Execute a plan step with full plan context.

        Generates execution prompt FROM the plan - not from raw user input.

        Args:
            plan: The approved Plan object
            current_step: The step to execute

        Returns:
            StepOutcome with LLM summary and structured tool call results
        """
        # Session logging for flow tracking
        session_logger = get_session_logger()
        step_index = next(
            (i for i, s in enumerate(plan.steps) if s.step_id == current_step.step_id),
            0,
        )
        if session_logger:
            session_logger.log_step_execution(
                plan_id=plan.id,
                step_id=current_step.step_id,
                action="routing_started",
                description=current_step.description,
            )
            session_logger.log_event("step_routing", {
                "step_id": current_step.step_id,
                "target_agent": current_step.target_agent,
                "has_prompt_template": bool(current_step.prompt_template),
                "execution_mode": "autonomous" if current_step.prompt_template else "interactive",
                "phase_name": current_step.phase_name,
                "step_index": step_index,
                "total_steps": len(plan.steps),
            })

        outcome = self._execute_with_dspy(plan, current_step, session_logger)

        # Store result for use in subsequent step templates and ACE curation
        self._step_results[current_step.step_id] = StepResult(
            step_id=current_step.step_id,
            result=outcome.summary,
            description=current_step.description,
        )

        # Log step completion
        if session_logger:
            session_logger.log_step_execution(
                plan_id=plan.id,
                step_id=current_step.step_id,
                action="completed",
                description=current_step.description,
                result=outcome.summary[:500] if outcome.summary else None,
            )
            session_logger.log_full_content(
                content_type="result",
                name=f"step_{current_step.step_id}_result",
                content=outcome.summary,
                metadata={"step_id": current_step.step_id, "step_index": step_index},
            )

        return outcome

    def _execute_with_dspy(
        self,
        plan: Plan,
        current_step: PlanStep,
        session_logger: Any = None,
    ) -> StepOutcome:
        """
        Execute step using DSPy ReAct.

        Args:
            plan: The approved Plan object
            current_step: The step to execute

        Returns:
            StepOutcome with LLM summary and structured tool call results
        """
        # Handle direct execution (pure LLM tasks without tool use)
        # Route to direct execution if:
        # 1. target_agent is "direct_execution" (explicit marker)
        # 2. prompt_template exists but no tool_call (pure LLM prompt, no tools needed)
        if current_step.target_agent == "direct_execution":
            return self._execute_direct(plan, current_step, session_logger)

        if current_step.prompt_template and not current_step.tool_call:
            # Pure LLM task with prompt template - no tools needed
            logger.info(
                f"📝 Direct execution: step has prompt_template but no tool_call, "
                f"executing as pure LLM task (skipping ReAct tools)"
            )
            return self._execute_direct(plan, current_step, session_logger)

        # Get step index and context
        step_index = next(
            (i for i, s in enumerate(plan.steps) if s.step_id == current_step.step_id),
            0,
        )
        completed_steps = [
            s for s in plan.steps if s.status == PlanStepStatus.COMPLETED.value
        ]
        remaining_steps = [
            s
            for s in plan.steps[step_index + 1:]
            if s.status == PlanStepStatus.PENDING.value
        ]

        # Determine prompt and template based on execution mode
        if current_step.prompt_template:
            # Autonomous mode: resolve template variables and use autonomous executor
            logger.info(
                f"📝 Template resolution - skill_inputs: {self.skill_inputs}, "
                f"template preview: {current_step.prompt_template[:100]}..."
            )
            resolved_prompt = resolve_prompt_template(
                template=current_step.prompt_template,
                skill_inputs=self.skill_inputs,
                discovered_context={},
                previous_results=self._step_results,
            )
            logger.info(
                f"📝 Autonomous mode: resolved prompt template for step {step_index + 1} "
                f"({len(resolved_prompt)} chars)"
            )
            prompt = _build_step_prompt(
                goal=plan.goal,
                current_step=current_step,
                step_index=step_index,
                total_steps=len(plan.steps),
                completed_steps=completed_steps,
                remaining_steps=remaining_steps,
                resolved_prompt=resolved_prompt,
                original_task=plan.basic_instructions,
            )
        else:
            # Interactive mode: use description with interactive executor
            logger.info(
                f"📝 Interactive mode: using description for step {step_index + 1}"
            )
            prompt = _build_step_prompt(
                goal=plan.goal,
                current_step=current_step,
                step_index=step_index,
                total_steps=len(plan.steps),
                completed_steps=completed_steps,
                remaining_steps=remaining_steps,
                original_task=plan.basic_instructions,
            )

        logger.info(
            f"🔧 Executing step {step_index + 1}/{len(plan.steps)}: "
            f"{current_step.description[:80]}..."
        )
        logger.debug(f"🔧 Generated prompt ({len(prompt)} chars)")

        # Log full prompt for debugging
        if session_logger:
            execution_mode = "autonomous" if current_step.prompt_template else "interactive"
            session_logger.log_full_content(
                content_type="prompt",
                name=f"step_{current_step.step_id}_executor",
                content=prompt,
                metadata={
                    "step_id": current_step.step_id,
                    "target_agent": current_step.target_agent,
                    "execution_mode": execution_mode,
                    "step_index": step_index,
                },
            )

        try:
            # Get DSPy LM for execution
            lm = get_dspy_lm(org_model=self.org_model)

            # Create executor with tools
            executor = ExecutorModule(
                execution_tools=self._all_tools,
                max_iters=self.max_steps,
            )

            # Build context for executor
            context = self._build_context(plan, current_step, completed_steps)

            # Execute with DSPy context
            with dspy.context(lm=lm):
                result = executor(
                    step_description=prompt,
                    context=json.dumps(context),
                )

            result_str = extract_dspy_result(result)
            outcome = build_step_outcome(result_str, executor.last_trajectory)

            logger.info(
                f"PlanStepExecutor: Step completed "
                f"(success={outcome.success}, tool_calls={len(outcome.tool_calls)})"
            )
            logger.debug(f"PlanStepExecutor: Result preview: {result_str[:200]}...")

            return outcome

        except Exception as e:
            error_msg = f"Step execution error: {str(e)}"
            logger.error(f"❌ PlanStepExecutor: {error_msg}", exc_info=True)
            raise

    def _execute_direct(
        self,
        plan: Plan,
        current_step: PlanStep,
        session_logger: Any = None,
    ) -> StepOutcome:
        """
        Execute a direct LLM task without tool use.

        Used for pure LLM tasks: analysis, classification, routing,
        summarization, transformation, decision-making.

        Args:
            plan: The approved Plan object
            current_step: The step to execute

        Returns:
            StepOutcome (no tool calls, always success unless exception)
        """
        step_index = next(
            (i for i, s in enumerate(plan.steps) if s.step_id == current_step.step_id),
            0,
        )

        logger.info(
            f"🔧 Direct execution step {step_index + 1}/{len(plan.steps)}: "
            f"{current_step.description[:80]}..."
        )

        # Determine the task from prompt_template or description
        if current_step.prompt_template:
            logger.info(
                f"📝 Direct execution - skill_inputs: {self.skill_inputs}, "
                f"template preview: {current_step.prompt_template[:100]}..."
            )
            task = resolve_prompt_template(
                template=current_step.prompt_template,
                skill_inputs=self.skill_inputs,
                discovered_context={},
                previous_results=self._step_results,
            )
            logger.info(f"📝 Direct execution (autonomous): resolved template ({len(task)} chars), preview: {task[:100]}...")
        else:
            task = current_step.description
            logger.info("📝 Direct execution (interactive): using description")

        # Log full task for debugging
        if session_logger:
            session_logger.log_full_content(
                content_type="prompt",
                name=f"step_{current_step.step_id}_direct_execution",
                content=task,
                metadata={
                    "step_id": current_step.step_id,
                    "target_agent": "direct_execution",
                    "execution_mode": "autonomous" if current_step.prompt_template else "interactive",
                    "step_index": step_index,
                },
            )

        try:
            # Get DSPy LM for execution
            lm = get_dspy_lm(org_model=self.org_model)

            # Use SimpleExecutorModule for direct tasks (no tools needed)
            executor = SimpleExecutorModule()

            # Build minimal context
            context = {"goal": plan.goal, "step_description": current_step.description}

            # Execute with DSPy context
            with dspy.context(lm=lm):
                result = executor(
                    step_description=task,
                    context=json.dumps(context),
                )

            result_str = extract_dspy_result(result)

            logger.info("Direct execution completed")
            logger.debug(f"Direct execution result preview: {result_str[:200]}...")

            return StepOutcome(summary=result_str, success=True, tool_calls=[])

        except Exception as e:
            error_msg = f"Direct execution error: {str(e)}"
            logger.error(f"Direct execution failed: {error_msg}", exc_info=True)
            raise

    def _build_context(
        self,
        plan: Plan,
        current_step: PlanStep,
        completed_steps: list[PlanStep],
    ) -> dict[str, Any]:
        """
        Build execution context for DSPy executor.

        Args:
            plan: The full plan
            current_step: Current step being executed
            completed_steps: Already completed steps

        Returns:
            Context dict for executor
        """
        # Include results from previous steps
        previous_results = {}
        for step in completed_steps:
            if step.step_id in self._step_results:
                result = self._step_results[step.step_id]
                previous_results[step.step_id] = {
                    "description": result.description,
                    "result": result.result[:500] if result.result else None,  # Truncate for context
                }

        context: dict[str, Any] = {
            "goal": plan.goal,
            "current_step": {
                "step_id": current_step.step_id,
                "description": current_step.description,
                "target_agent": current_step.target_agent,
                "phase_name": current_step.phase_name,
            },
            "previous_results": previous_results,
            "org_id": self.org_id,
        }

        # Include original task when it contains data beyond the goal summary
        if plan.basic_instructions and plan.basic_instructions != plan.goal:
            context["original_task"] = plan.basic_instructions[:4000]

        # Include planner's analysis — high-level description of the approach
        if plan.analysis:
            context["plan_analysis"] = plan.analysis

        return context


class PlanStepExecutorFactory:
    """Factory for creating PlanStepExecutor instances."""

    def __init__(
        self,
        model_provider: ModelProviderProtocol,
        org_model: str | None = None,
        capability_registry: CapabilityRegistry | None = None,
    ):
        """
        Initialize factory.

        Args:
            model_provider: Provider for getting LLM models (legacy, kept for compatibility)
            org_model: Organization model ID for model resolution
            capability_registry: Registry for dynamic capability discovery in templates
        """
        self.model_provider = model_provider
        self.org_model = org_model
        self.capability_registry = capability_registry

    def create(
        self,
        api_key: str,
        org_id: str,
        max_steps: int = 10,
    ) -> PlanStepExecutor:
        """
        Create a PlanStepExecutor with DSPy tools.

        Args:
            api_key: Bearer token for API authentication
            org_id: Organization ID for RLS context
            max_steps: Max iterations for ReAct loop

        Returns:
            Configured PlanStepExecutor instance
        """
        return PlanStepExecutor(
            api_key=api_key,
            org_id=org_id,
            org_model=self.org_model,
            max_steps=max_steps,
            capability_registry=self.capability_registry,
        )
