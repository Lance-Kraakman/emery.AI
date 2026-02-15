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

from emery_agents.entities.tool_config import ToolConfig, extract_app_name
from emery_agents.tools.capability_registry import CapabilityRegistry
from emery_agents.tools.factories import create_all_tools
from emery_agents.tools.loader import UnifiedToolLoader

from ...ace import StepResult
from ...entities.models.plan import Plan, PlanStep, PlanStepStatus
from ...reasoning.config import get_dspy_lm
from ...reasoning.modules.executor import ExecutorModule, SimpleExecutorModule
from ...reasoning.utils import StepOutcome, build_step_outcome, extract_dspy_result
from ...services.analysis.llm_usage import LlmUsageTracker, record_from_lm
from ...services.execution.events import ToolLoadedEvent
from ...utils.session_logger import get_session_logger
from ..protocols import ModelProviderProtocol
from .prompt_template_resolver import resolve_prompt_template

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
        display_task = (
            original_task[:8000] + "\n...[truncated]"
            if len(original_task) > 8000
            else original_task
        )
        parts.extend(
            ["", "## Original User Request (contains input data)", display_task]
        )

    # No operational guidance here - tool selection comes from KNNFewShot examples
    # The examples teach which tool to use for each task type

    if current_step.phase_name:
        parts.extend(["", f"## Phase: {current_step.phase_name}"])

    # Content section
    if resolved_prompt:
        parts.extend(["", "## Execute", resolved_prompt])
    else:
        parts.extend(["", "## Current Step", current_step.description])

    # Skill execution hint — guide executor to use skill_crud
    if current_step.target_agent == "skill_executor":
        parts.extend(
            [
                "",
                "## Skill Execution",
                "This step executes an existing skill. Use `skill_crud(method='execute', skill_id=<ID>, data={inputs})`.",
                "If you don't have the skill_id yet, call `skill_crud(method='list')` first.",
                "Do NOT replicate the skill's logic — just execute it by ID.",
            ]
        )

    # Tool directive — when the plan specifies a tool, the executor MUST use it
    if current_step.tool_call:
        parts.extend(
            [
                "",
                "## Required Tool",
                f"You MUST use the `{current_step.tool_call}` tool to complete this step.",
                "Do NOT use alternative tools or skip the tool call.",
            ]
        )

    # Step scope constraint — prevent LLM from executing beyond this step
    parts.extend(
        [
            "",
            "## Step Scope",
            "Execute ONLY what this step describes. Do NOT perform work from remaining steps.",
            "Each remaining step will be executed separately with its own context.",
        ]
    )

    # Completed steps
    if completed_steps:
        parts.extend(
            ["", "## Previously Completed Steps (already done — use their results)"]
        )
        for i, step in enumerate(completed_steps, 1):
            result = step.result or "completed"
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
        extra_headers: dict[str, str] | None = None,
        llm_tracker: LlmUsageTracker | None = None,
        tool_loader: UnifiedToolLoader | None = None,
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
            extra_headers: Optional HTTP headers for agent context audit trail
            llm_tracker: Optional tracker for LLM usage
        """
        self.api_key = api_key
        self.org_id = org_id
        self.org_model = org_model
        self.max_steps = max_steps
        self.skill_inputs = skill_inputs if skill_inputs is not None else {}
        self.capability_registry = capability_registry
        self.llm_tracker = llm_tracker
        self.tool_loader = tool_loader

        # Create DSPy tools with auth captured (includes CRUD + discovery tools)
        self._crud_tools = create_all_tools(
            api_key=api_key,
            org_id=org_id,
            extra_headers=extra_headers,
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

        # Track dynamically loaded tools for frontend sync
        self._loaded_tool_events: list[ToolLoadedEvent] = []

        logger.info(f"Created PlanStepExecutor with {len(self._all_tools)} DSPy tools")

    @property
    def step_results(self) -> dict[str, StepResult]:
        """
        Get results from all executed steps.

        Returns dict of step_id -> StepResult.
        Used by ExecutionContextService for context curation (ACE pattern).
        """
        return self._step_results

    @property
    def loaded_tool_events(self) -> list[ToolLoadedEvent]:
        """
        Get events for dynamically loaded tools.

        Used by execution node to emit ToolLoadedEvent to frontend.
        """
        return self._loaded_tool_events

    def _ensure_tool_available(self, tool_name: str) -> bool:
        """
        Dynamically load tool if specified in step.tool_call but not in _all_tools.

        Supports lazy loading patterns:
        - skill:{id} → Creates DynamicSkillTool with typed inputs
        - agent:{id} → Creates DynamicAgentTool with proper context

        Args:
            tool_name: Name of the tool to ensure is available

        Returns:
            True if tool is available (already loaded or dynamically loaded)
        """
        # Check if already available
        if any(getattr(t, "name", None) == tool_name for t in self._all_tools):
            logger.debug(f"Tool {tool_name} already available")
            return True

        if not self.tool_loader:
            logger.warning(f"Tool {tool_name} not available and no tool_loader to load it")
            return False

        try:
            # Parse org_id for tool loading
            org_id_int = int(self.org_id) if self.org_id else None

            tool = self.tool_loader.load_tool(
                ToolConfig(name=tool_name),
                api_key=self.api_key,
                organization_id=org_id_int,
            )
            if tool:
                self._all_tools.append(tool)

                # Get the actual tool name (may differ for skill:{id} → skill_30_name)
                actual_tool_name = getattr(tool, "name", tool_name)
                logger.info(f"Dynamically loaded tool: {tool_name} → {actual_tool_name}")

                # Create event for frontend sync
                tool_description = getattr(tool, "description", actual_tool_name)
                self._loaded_tool_events.append(
                    ToolLoadedEvent(
                        tool_name=actual_tool_name,
                        tool_display_name=tool_description[:50],
                        tool_description=tool_description,
                        app_name=extract_app_name(actual_tool_name),
                    )
                )
                return True
        except Exception as e:
            logger.error(f"Failed to dynamically load tool {tool_name}: {e}")
        return False

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
            session_logger.log_event(
                "step_routing",
                {
                    "step_id": current_step.step_id,
                    "target_agent": current_step.target_agent,
                    "has_prompt_template": bool(current_step.prompt_template),
                    "execution_mode": "autonomous"
                    if current_step.prompt_template
                    else "interactive",
                    "phase_name": current_step.phase_name,
                    "step_index": step_index,
                    "total_steps": len(plan.steps),
                },
            )

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
                "📝 Direct execution: step has prompt_template but no tool_call, "
                "executing as pure LLM task (skipping ReAct tools)"
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
            for s in plan.steps[step_index + 1 :]
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
            execution_mode = (
                "autonomous" if current_step.prompt_template else "interactive"
            )
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

        # Ensure required tool is available (dynamic loading if needed)
        if current_step.tool_call:
            self._ensure_tool_available(current_step.tool_call)

        # Filter tools when step specifies a tool_call (reduces token usage)
        if current_step.tool_call:
            step_tool = next(
                (t for t in self._all_tools if getattr(t, "name", None) == current_step.tool_call),
                None,
            )
            if step_tool:
                step_tools = [step_tool]
                logger.info(f"Filtered to single tool: {current_step.tool_call}")
            else:
                # Tool not found after ensure - fall back to all tools
                logger.warning(
                    f"Tool {current_step.tool_call} not found after ensure, using all tools"
                )
                step_tools = self._all_tools
        else:
            # No specific tool - executor chooses from all
            step_tools = self._all_tools

        try:
            # Get DSPy LM for execution
            lm = get_dspy_lm(org_model=self.org_model)

            # Create executor with filtered tools
            executor = ExecutorModule(
                execution_tools=step_tools,
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
            if self.llm_tracker:
                record_from_lm(lm, self.llm_tracker)

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
            logger.info(
                f"📝 Direct execution (autonomous): resolved template ({len(task)} chars), preview: {task[:100]}..."
            )
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
                    "execution_mode": "autonomous"
                    if current_step.prompt_template
                    else "interactive",
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
            if self.llm_tracker:
                record_from_lm(lm, self.llm_tracker)

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
                    "result": result.result[:500]
                    if result.result
                    else None,  # Truncate for context
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
