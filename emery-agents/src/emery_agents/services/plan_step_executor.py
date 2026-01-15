"""
PlanStepExecutor - Executes plan steps via sub-agent with managed agents

AIDEV-NOTE: This shared module allows ExecutionCoordinator to execute
plan steps using smolagents' native managed agent routing.

Architecture:
    ExecutionCoordinator.execute_plan()
        └── plan_step_executor.execute(plan, current_step)
                └── Generates prompt from Plan using step_executor.j2
                └── Creates ToolCallingAgent with managed_agents
                └── Smolagents routes based on agent descriptions
                └── Returns result from appropriate managed agent

This is different from StepExecutorService which handles DAG workflow steps.
"""

import logging
from typing import Any, List, Optional

from smolagents import ToolCallingAgent

from ..models.plan import Plan, PlanStep, PlanStepStatus, SubPlan
from ..prompts import render_template
from .protocols import ModelProvider

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
    ):
        """
        Initialize PlanStepExecutor.

        Args:
            tools: Available tools for sub-agent
            managed_agents: Managed agents for routing (skill_builder, etc.)
            model: LLM model for sub-agent
            max_steps: Max steps for sub-agent execution
        """
        self.tools = tools
        self.managed_agents = managed_agents
        self.model = model
        self.max_steps = max_steps

        agent_names = [getattr(a, 'name', '?') for a in managed_agents]
        logger.info(f"✨ Created PlanStepExecutor with {len(tools)} tools, agents: {agent_names}")

    def execute(
        self,
        plan: Plan,
        current_step: PlanStep,
    ) -> str:
        """
        Execute a plan step with full plan context.

        If the step has a pre-planned sub_plan (from cascading planning),
        executes that directly. Otherwise, generates execution prompt
        FROM the plan - not from raw user input.

        Args:
            plan: The approved Plan object
            current_step: The step to execute

        Returns:
            Result from step execution
        """
        # Check for pre-planned sub-plan from cascading planning
        if current_step.sub_plan:
            return self._execute_sub_plan(plan, current_step, current_step.sub_plan)

        # Standard execution path
        return self._execute_with_routing(plan, current_step)

    def _execute_sub_plan(
        self,
        plan: Plan,
        parent_step: PlanStep,
        sub_plan: SubPlan,
    ) -> str:
        """
        Execute a pre-planned sub-plan from cascading planning.

        The sub-plan was already created during planning phase.
        We execute it directly without replanning.

        Args:
            plan: The parent Plan object
            parent_step: The parent step containing the sub_plan
            sub_plan: The pre-planned SubPlan to execute

        Returns:
            Result from sub-plan execution
        """
        # Find target agent
        target_agent = None
        for agent in self.managed_agents:
            if getattr(agent, 'name', None) == sub_plan.agent_name:
                target_agent = agent
                break

        if not target_agent:
            raise ValueError(
                f"Target agent '{sub_plan.agent_name}' not found in managed_agents"
            )

        # Format sub-plan steps for execution
        steps_text = "\n".join([
            f"{i+1}. {step.description}"
            for i, step in enumerate(sub_plan.steps)
        ])

        # Generate execution-mode prompt (no replanning)
        prompt = render_template(
            "planning/sub_plan_executor.j2",
            goal=plan.goal,
            sub_plan_goal=sub_plan.goal,
            parent_step=parent_step,
            sub_plan_steps=sub_plan.steps,
            steps_text=steps_text,
            planning_observations=sub_plan.planning_observations,
        )

        logger.info(
            f"🔧 Executing pre-planned sub-plan for {sub_plan.agent_name}: "
            f"{len(sub_plan.steps)} steps"
        )
        logger.debug(f"🔧 Sub-plan goal: {sub_plan.goal[:100]}...")

        try:
            # Disable HITL on sub-agent during execution
            # (already approved at high-level during planning phase)
            original_planning_interval = getattr(target_agent, 'planning_interval', None)
            if hasattr(target_agent, 'planning_interval'):
                target_agent.planning_interval = None
                logger.debug(f"🔧 Disabled planning_interval for {sub_plan.agent_name}")

            # Execute via target agent directly
            # The agent should not replan - just execute the approved steps
            result = target_agent(prompt)
            result_str = str(result)

            logger.info(f"✅ Sub-plan executed for {sub_plan.agent_name}")
            logger.debug(f"🔧 Result preview: {result_str[:200]}...")

            return result_str

        except Exception as e:
            error_msg = f"Sub-plan execution error: {str(e)}"
            logger.error(f"❌ PlanStepExecutor: {error_msg}", exc_info=True)
            raise

        finally:
            # Restore original planning_interval
            if original_planning_interval is not None and hasattr(target_agent, 'planning_interval'):
                target_agent.planning_interval = original_planning_interval

    def _execute_with_routing(
        self,
        plan: Plan,
        current_step: PlanStep,
    ) -> str:
        """
        Execute step with normal smolagents routing.

        Used when step doesn't have a pre-planned sub_plan.

        Args:
            plan: The approved Plan object
            current_step: The step to execute

        Returns:
            Result from step execution
        """
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

        # Generate execution prompt from plan
        prompt = render_template(
            "planning/step_executor.j2",
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
