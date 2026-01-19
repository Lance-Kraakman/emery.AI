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
from typing import Any, Dict, List, Optional

from smolagents import ToolCallingAgent

from ..models.plan import Plan, PlanStep, PlanStepStatus, SubPlan
from ..prompts import render_template
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
        # Track results from previous steps for prompt template resolution
        self._step_results: Dict[str, Any] = {}

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
            result = self._execute_sub_plan(plan, current_step, current_step.sub_plan)
        else:
            # Standard execution path
            result = self._execute_with_routing(plan, current_step)

        # Store result for use in subsequent step templates
        self._step_results[current_step.step_id] = {
            "result": result,
            "description": current_step.description,
        }

        return result

    def _execute_sub_plan(
        self,
        plan: Plan,
        parent_step: PlanStep,
        sub_plan: SubPlan,
        depth: int = 0,
    ) -> str:
        """
        Execute a pre-planned sub-plan from cascading planning.

        The sub-plan was already created during planning phase.
        We execute it directly without replanning.

        Supports RECURSIVE execution: if a sub-plan step has its own
        nested sub_plan, we recursively execute that first.

        Args:
            plan: The parent Plan object
            parent_step: The parent step containing the sub_plan
            sub_plan: The pre-planned SubPlan to execute
            depth: Current recursion depth (for logging)

        Returns:
            Result from sub-plan execution
        """
        depth_prefix = "  " * depth
        logger.info(
            f"{depth_prefix}🔧 Executing sub-plan for {sub_plan.agent_name}: "
            f"{len(sub_plan.steps)} steps (depth={depth})"
        )
        logger.debug(f"{depth_prefix}🔧 Sub-plan goal: {sub_plan.goal[:100]}...")

        # Execute each step, handling nested sub-plans recursively
        results: List[str] = []

        for i, step in enumerate(sub_plan.steps):
            step_num = i + 1

            # Check for nested sub-plan (from recursive cascade planning)
            if step.sub_plan:
                logger.info(
                    f"{depth_prefix}📋 Step {step_num}: Executing nested {step.sub_plan.agent_name} sub-plan"
                )

                # RECURSIVE: Execute nested sub-plan
                nested_result = self._execute_sub_plan(
                    plan=plan,
                    parent_step=step,
                    sub_plan=step.sub_plan,
                    depth=depth + 1,
                )
                results.append(
                    f"Step {step_num} ({step.sub_plan.agent_name}): {nested_result}"
                )
                continue

            # Regular step - execute via target agent
            logger.info(f"{depth_prefix}📋 Step {step_num}: {step.description[:60]}...")

        # If all steps were nested sub-plans, return combined results
        all_nested = len(results) == len(sub_plan.steps)
        if results and all_nested:
            combined = "\n".join(results)
            logger.info(f"{depth_prefix}✅ Sub-plan executed (all nested)")
            return combined

        # Otherwise, execute via target agent for non-nested steps
        target_agent = None
        for agent in self.managed_agents:
            if getattr(agent, 'name', None) == sub_plan.agent_name:
                target_agent = agent
                break

        if not target_agent:
            raise ValueError(
                f"Target agent '{sub_plan.agent_name}' not found in managed_agents"
            )

        # Format remaining non-nested steps for execution
        non_nested_steps = [s for s in sub_plan.steps if not s.sub_plan]
        steps_text = "\n".join([
            f"{i+1}. {step.description}"
            for i, step in enumerate(non_nested_steps)
        ])

        # Generate execution-mode prompt (no replanning)
        prompt = render_template(
            "execution/sub_plan_executor.j2",
            goal=plan.goal,
            sub_plan_goal=sub_plan.goal,
            parent_step=parent_step,
            sub_plan_steps=non_nested_steps,
            steps_text=steps_text,
            planning_observations=sub_plan.planning_observations,
        )

        try:
            # Disable HITL on sub-agent during execution
            # (already approved at high-level during planning phase)
            original_planning_interval = getattr(target_agent, 'planning_interval', None)
            if hasattr(target_agent, 'planning_interval'):
                target_agent.planning_interval = None
                logger.debug(f"{depth_prefix}🔧 Disabled planning_interval for {sub_plan.agent_name}")

            # Execute via target agent directly
            # The agent should not replan - just execute the approved steps
            result = target_agent(prompt)
            result_str = str(result)

            # Combine with nested results
            if results:
                combined = "\n".join(results) + f"\n\nAgent execution: {result_str}"
                logger.info(f"{depth_prefix}✅ Sub-plan executed for {sub_plan.agent_name}")
                return combined

            logger.info(f"{depth_prefix}✅ Sub-plan executed for {sub_plan.agent_name}")
            logger.debug(f"{depth_prefix}🔧 Result preview: {result_str[:200]}...")

            return result_str

        except Exception as e:
            error_msg = f"Sub-plan execution error: {str(e)}"
            logger.error(f"{depth_prefix}❌ PlanStepExecutor: {error_msg}", exc_info=True)
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
        If the step has a prompt_template, uses the resolver with runtime context.
        Otherwise falls back to step_executor.j2 template.

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
