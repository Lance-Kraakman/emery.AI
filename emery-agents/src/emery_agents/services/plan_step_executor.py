"""
PlanStepExecutor - Executes plan steps via sub-agent with managed agents

AIDEV-NOTE: This shared module allows ExecutionCoordinator to execute
plan steps using smolagents' native managed agent routing.

Architecture:
    ExecutionCoordinator.execute_plan()
        └── plan_step_executor.execute(plan, current_step)
                └── Generates prompt using mode-specific templates:
                    - Autonomous: step_executor_autonomous.j2 (has prompt_template)
                    - Interactive: step_executor_interactive.j2 (description-based)
                └── Creates ToolCallingAgent with managed_agents
                └── Smolagents routes based on agent descriptions
                └── Returns result from appropriate managed agent

This is different from StepExecutorService which handles DAG workflow steps.
"""

import logging
from typing import Any, Dict, List, Optional

from smolagents import ToolCallingAgent

from ..ace import StepResult
from ..models.plan import Plan, PlanStep, PlanStepStatus
from ..prompts import render_template
from ..utils.session_logger import get_session_logger
from .protocols import ModelProvider
from .prompt_template_resolver import resolve_prompt_template

logger = logging.getLogger(__name__)


class PlanStepExecutor:
    """
    Executes plan steps via sub-agent with managed agent routing.

    Uses smolagents' native managed_agents feature - the LLM reads
    agent descriptions and automatically routes to the right agent.
    """

    def __init__(
        self,
        tools: List[Any],
        managed_agents: List[Any],
        model: Any,
        max_steps: int = 10,
        skill_inputs: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize PlanStepExecutor.

        Args:
            tools: Available tools for sub-agent
            managed_agents: Managed agents for routing (skill_builder, etc.)
            model: LLM model for sub-agent
            max_steps: Max steps for sub-agent execution
            skill_inputs: Runtime inputs for skill execution (used with prompt templates)
        """
        self.tools = tools
        self.managed_agents = managed_agents
        self.model = model
        self.max_steps = max_steps
        self.skill_inputs = skill_inputs or {}
        # Track results from previous steps for prompt template resolution and ACE curation
        self._step_results: Dict[str, StepResult] = {}

        agent_names = [getattr(a, 'name', '?') for a in managed_agents]
        logger.info(f"✨ Created PlanStepExecutor with {len(tools)} tools, agents: {agent_names}")

    @property
    def step_results(self) -> Dict[str, StepResult]:
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
    ) -> str:
        """
        Execute a plan step with full plan context.

        Generates execution prompt FROM the plan - not from raw user input.

        Args:
            plan: The approved Plan object
            current_step: The step to execute

        Returns:
            Result from step execution
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

        result = self._execute_with_routing(plan, current_step, session_logger)

        # Store result for use in subsequent step templates and ACE curation
        self._step_results[current_step.step_id] = StepResult(
            step_id=current_step.step_id,
            result=result,
            description=current_step.description,
        )

        # Log step completion
        if session_logger:
            session_logger.log_step_execution(
                plan_id=plan.id,
                step_id=current_step.step_id,
                action="completed",
                description=current_step.description,
                result=result[:500] if result else None,
            )
            session_logger.log_full_content(
                content_type="result",
                name=f"step_{current_step.step_id}_result",
                content=result,
                metadata={"step_id": current_step.step_id, "step_index": step_index},
            )

        return result

    def _execute_with_routing(
        self,
        plan: Plan,
        current_step: PlanStep,
        session_logger: Any = None,
    ) -> str:
        """
        Execute step with normal smolagents routing.

        Uses smolagents' native managed agent routing.
        If the step has a prompt_template, uses step_executor_autonomous.j2 with resolved variables.
        Otherwise uses step_executor_interactive.j2 with the description field.

        Special handling for target_agent="direct_execution":
        - Executes directly via LLM without managed agent routing
        - No platform operations, just LLM processing/transformation

        Args:
            plan: The approved Plan object
            current_step: The step to execute

        Returns:
            Result from step execution
        """
        # Handle direct execution (pure LLM tasks without managed agent routing)
        if current_step.target_agent == "direct_execution":
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
        # - Autonomous mode: uses prompt_template with resolved variables
        # - Interactive mode: uses description field with HITL context
        if current_step.prompt_template:
            # Autonomous mode: resolve template variables and use autonomous executor
            resolved_prompt = resolve_prompt_template(
                template=current_step.prompt_template,
                skill_inputs=self.skill_inputs,
                discovered_context={},  # TODO: Implement context discovery
                previous_results=self._step_results,
            )
            logger.info(
                f"📝 Autonomous mode: resolved prompt template for step {step_index + 1} "
                f"({len(resolved_prompt)} chars)"
            )
            prompt = render_template(
                "execution/step_executor_autonomous.j2",
                goal=plan.goal,
                current_step=current_step,
                step_index=step_index,
                total_steps=len(plan.steps),
                completed_steps=completed_steps,
                remaining_steps=remaining_steps,
                managed_agents=self.managed_agents,
                resolved_prompt=resolved_prompt,
            )
        else:
            # Interactive mode: use description with interactive executor
            logger.info(
                f"📝 Interactive mode: using description for step {step_index + 1}"
            )
            prompt = render_template(
                "execution/step_executor_interactive.j2",
                goal=plan.goal,
                current_step=current_step,
                step_index=step_index,
                total_steps=len(plan.steps),
                completed_steps=completed_steps,
                remaining_steps=remaining_steps,
                managed_agents=self.managed_agents,
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

        # Disable HITL on all managed agents during execution
        # (already approved at high-level during planning phase)
        original_intervals = {}
        for agent in self.managed_agents:
            if hasattr(agent, 'planning_interval'):
                original_intervals[id(agent)] = agent.planning_interval
                agent.planning_interval = None
        if original_intervals:
            logger.debug(f"🔧 Disabled planning_interval for {len(original_intervals)} managed agents")

        try:
            # Create sub-agent with managed agents
            # Smolagents reads agent descriptions and routes automatically
            sub_agent = ToolCallingAgent(
                tools=self.tools,
                managed_agents=self.managed_agents,
                model=self.model,
                max_steps=self.max_steps,
            )

            # Execute step - smolagents handles routing
            result = sub_agent.run(task=prompt, reset=True)
            result_str = str(result)

            logger.info(f"✅ PlanStepExecutor: Step completed")
            logger.debug(f"🔧 PlanStepExecutor: Result preview: {result_str[:200]}...")

            return result_str

        except Exception as e:
            error_msg = f"Step execution error: {str(e)}"
            logger.error(f"❌ PlanStepExecutor: {error_msg}", exc_info=True)
            raise

        finally:
            # Restore original planning_intervals
            for agent in self.managed_agents:
                agent_id = id(agent)
                if agent_id in original_intervals:
                    agent.planning_interval = original_intervals[agent_id]

    def _execute_direct(
        self,
        plan: Plan,
        current_step: PlanStep,
        session_logger: Any = None,
    ) -> str:
        """
        Execute a direct LLM task without managed agent routing.

        Used for pure LLM tasks: analysis, classification, routing,
        summarization, transformation, decision-making.

        These tasks don't create platform entities (tables, apps, agents)
        and don't need managed agent routing.

        Args:
            plan: The approved Plan object
            current_step: The step to execute

        Returns:
            Result from LLM execution
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
            # Autonomous mode: resolve template variables
            task = resolve_prompt_template(
                template=current_step.prompt_template,
                skill_inputs=self.skill_inputs,
                discovered_context={},
                previous_results=self._step_results,
            )
            logger.info(f"📝 Direct execution (autonomous): resolved template ({len(task)} chars)")
        else:
            # Interactive mode: use description
            task = current_step.description
            logger.info(f"📝 Direct execution (interactive): using description")

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
            # Create agent with NO managed agents (direct LLM task)
            # Tools are still available for structured output if needed
            direct_agent = ToolCallingAgent(
                tools=self.tools,
                managed_agents=[],  # No managed agents for direct execution
                model=self.model,
                max_steps=3,  # Direct tasks should be quick
            )

            # Execute the direct task
            result = direct_agent.run(task=task, reset=True)
            result_str = str(result)

            logger.info(f"✅ Direct execution completed")
            logger.debug(f"🔧 Direct execution result preview: {result_str[:200]}...")

            return result_str

        except Exception as e:
            error_msg = f"Direct execution error: {str(e)}"
            logger.error(f"❌ Direct execution failed: {error_msg}", exc_info=True)
            raise


class PlanStepExecutorFactory:
    """Factory for creating PlanStepExecutor instances."""

    def __init__(
        self,
        model_provider: ModelProvider,
        org_model: Optional[str] = None,
    ):
        """
        Initialize factory.

        Args:
            model_provider: Provider for getting LLM models
            org_model: Organization model ID for model resolution
        """
        self.model_provider = model_provider
        self.org_model = org_model

    def create(
        self,
        tools: List[Any],
        managed_agents: List[Any],
        max_steps: int = 10,
    ) -> PlanStepExecutor:
        """
        Create a PlanStepExecutor with tools and managed agents.

        Args:
            tools: Available tools for sub-agent
            managed_agents: Managed agents for routing
            max_steps: Max steps for sub-agent execution

        Returns:
            Configured PlanStepExecutor instance
        """
        model = self.model_provider.get_model(model_id=self.org_model)
        return PlanStepExecutor(
            tools=tools,
            managed_agents=managed_agents,
            model=model,
            max_steps=max_steps,
        )
