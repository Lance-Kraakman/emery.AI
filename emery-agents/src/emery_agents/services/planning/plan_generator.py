"""
Plan Generator

Generates plans using the chat planner agent with capability discovery.
The chat planner uses discovery tools to find relevant capabilities
and outputs structured plans via PlanOutputTool.

AIDEV-NOTE: Replaces domain-specific planners (schema, app, automation)
with unified capability-based planning. The chat planner:
1. Uses search_capabilities, list_capabilities, get_capability to find capabilities
2. Generates plan steps with target agents from discovered capabilities
3. Outputs structured plan via submit_plan tool
"""

import logging
from typing import List, Any, Optional

from smolagents import ToolCallingAgent

from ..protocols import ModelProvider
from emery_agents.ace import StrategyAccumulationService
from emery_agents.models.plan import Plan, PlanStep, create_plan, create_step
from emery_agents.tools.plan_output_tool import PlanOutputTool
from emery_agents.prompts import render_template
from .models import (
    PlanGenerationRequest,
    PlanGenerationResult,
)

logger = logging.getLogger(__name__)


class PlanGenerator:
    """
    Generates plans using capability-based discovery.

    Uses a ToolCallingAgent with:
    - Capability discovery tools (search_capabilities, list_capabilities, get_capability)
    - Plan output tool (submit_plan) for structured plan capture
    - Research tools for context gathering

    The agent discovers relevant capabilities based on the task and generates
    a plan with steps targeting those capabilities.
    """

    def __init__(
        self,
        model_provider: Optional[ModelProvider] = None,
        capability_registry: Optional[Any] = None,
        research_tools: Optional[List[Any]] = None,
        read_only_tools: Optional[List[Any]] = None,
    ):
        """
        Initialize plan generator.

        Args:
            model_provider: Model provider for LLM access and model resolution
            capability_registry: Registry for capability discovery
            research_tools: Optional research tools (web search, etc.)
            read_only_tools: Optional read-only tools for context gathering
        """
        self.model_provider = model_provider
        self.capability_registry = capability_registry
        self.research_tools = research_tools or []
        self.read_only_tools = read_only_tools or []
        self._last_strategy_guidance: str = ""

    async def generate(
        self,
        request: PlanGenerationRequest,
        strategy_service: Optional[StrategyAccumulationService] = None,
    ) -> PlanGenerationResult:
        """
        Generate plan using capability-based discovery.

        The chat planner agent:
        1. Gathers context using research/read-only tools
        2. Uses capability discovery to find relevant capabilities
        3. Generates plan steps with target capabilities
        4. Outputs structured plan via submit_plan tool

        Args:
            request: Plan generation request with all inputs
            strategy_service: Optional service for surfacing proven patterns

        Returns:
            PlanGenerationResult with plan and metadata
        """
        if not self.model_provider:
            raise ValueError("PlanGenerator requires model_provider for planning")

        logger.info("📋 Generating plan using capability-based discovery")

        # ACE: Get strategy guidance from past successful executions
        strategy_guidance = ""
        if strategy_service:
            strategies = strategy_service.get_relevant_strategies(
                goal=request.basic_instructions,
                max_results=3,
                min_confidence=0.3,
            )
            if strategies:
                strategy_guidance = strategy_service.format_for_planner(strategies)
                logger.info(f"📊 Found {len(strategies)} relevant strategies for planning")

        self._last_strategy_guidance = strategy_guidance

        # Build tools for the planning agent
        plan_output_tool = PlanOutputTool()
        tools: List[Any] = [plan_output_tool]

        # Add capability discovery tools if registry available
        if self.capability_registry:
            from emery_agents.tools.capability_discovery import create_discovery_tools
            discovery_tools = create_discovery_tools(self.capability_registry)
            tools.extend(discovery_tools)
            logger.info(f"Added {len(discovery_tools)} capability discovery tools")

        # Add read-only tools for context gathering
        tools.extend(self.read_only_tools)

        # Add research tools
        tools.extend(self.research_tools)

        # Build the planning prompt
        prompt = self._build_planning_prompt(
            instructions=request.basic_instructions,
            goal=request.goal,
            strategy_guidance=strategy_guidance,
            is_template_generation=request.is_template_generation,
            skill_inputs=request.skill_inputs,
            skill_outputs=request.skill_outputs,
        )

        # Get model
        model_id = self.model_provider.resolve_model_selection(org_model=request.org_model)
        model = self.model_provider.get_model(model_id=model_id)

        # Create and run the planning agent
        planner = ToolCallingAgent(
            tools=tools,
            model=model,
            max_steps=15,  # Allow sufficient steps for discovery + planning
        )

        try:
            planner.run(prompt)
        except Exception as e:
            logger.error(f"Planning agent failed: {e}")
            raise

        # Extract the captured plan
        captured_plan = plan_output_tool.get_plan()
        if not captured_plan:
            raise ValueError(
                "Planning agent did not call submit_plan tool. "
                "No plan was generated."
            )

        # Convert to Plan model
        plan = self._create_plan_from_captured(
            captured_plan=captured_plan,
            basic_instructions=request.basic_instructions,
        )

        return PlanGenerationResult(
            plan=plan,
            strategy_guidance=strategy_guidance,
        )

    def _build_planning_prompt(
        self,
        instructions: str,
        goal: Optional[str],
        strategy_guidance: str,
        is_template_generation: bool,
        skill_inputs: Optional[List[Any]],
        skill_outputs: Optional[List[Any]],
    ) -> str:
        """Build the planning prompt."""
        # Use a simple planning prompt that instructs the agent to:
        # 1. Use capability discovery to understand available capabilities
        # 2. Gather context about existing resources
        # 3. Generate a plan using submit_plan

        prompt_parts = [
            "You are a planning agent. Generate an execution plan for this task.",
            "",
            "## Task",
            instructions,
            "",
        ]

        if goal:
            prompt_parts.extend([
                "## Goal",
                goal,
                "",
            ])

        if strategy_guidance:
            prompt_parts.extend([
                "## Strategy Guidance (from past successful executions)",
                strategy_guidance,
                "",
            ])

        prompt_parts.extend([
            "## Instructions",
            "",
            "1. **Discover capabilities**: Use search_capabilities, list_capabilities to find relevant capabilities for this task",
            "2. **Gather context**: Use available tools to understand existing resources (databases, tables, etc.)",
            "3. **Generate plan**: Call submit_plan with:",
            "   - goal: Brief description of what will be achieved",
            "   - context: What you discovered about existing resources",
            "   - analysis: Your analysis of what needs to be done",
            "   - steps: List of steps with description and target_agent",
            "",
            "For each step, set target_agent to the capability that should handle it.",
            "Common targets: schema_builder, table_builder, skill_builder, document_builder, app_builder",
            "",
        ])

        if is_template_generation:
            prompt_parts.extend([
                "## Template Generation Mode",
                "This is for a skill template. Use {{ variable }} placeholders in step descriptions",
                "for values that should be provided at runtime.",
                "",
            ])
            if skill_inputs:
                prompt_parts.append("Available inputs:")
                for inp in skill_inputs:
                    name = inp.name if hasattr(inp, 'name') else inp.get('name', 'unknown')
                    prompt_parts.append(f"  - {name}")
                prompt_parts.append("")

        prompt_parts.append("Now discover capabilities and generate the plan.")

        return "\n".join(prompt_parts)

    def _create_plan_from_captured(
        self,
        captured_plan: dict[str, Any],
        basic_instructions: str,
    ) -> Plan:
        """Convert captured plan dict to Plan model."""
        goal = captured_plan.get("goal", "")
        context = captured_plan.get("context")
        analysis = captured_plan.get("analysis")
        steps_data = captured_plan.get("steps", [])

        # Convert step dicts to PlanStep objects
        steps: List[PlanStep] = []
        for step_data in steps_data:
            step = create_step(
                description=step_data.get("description", ""),
                target_agent=step_data.get("target_agent"),
                prompt_template=step_data.get("prompt_template"),
                required_context=step_data.get("required_context", []),
                phase_name=step_data.get("phase_name", "Execution"),
                phase_order=step_data.get("phase_order", 1),
                replan_after=step_data.get("replan_after", False),
            )
            steps.append(step)

        return create_plan(
            goal=goal,
            basic_instructions=basic_instructions,
            steps=steps,
            context=context,
            analysis=analysis,
        )

    @property
    def last_strategy_guidance(self) -> str:
        """Get the strategy guidance used in the last plan generation."""
        return self._last_strategy_guidance
