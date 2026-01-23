"""
Plan Generator

Generates plans using a planner agent with sub-agents for focused tasks.

Architecture:
- Planner (orchestrator): Analyzes task, delegates to sub-agents
- plan_researcher (sub-agent): Gathers context via capability discovery
- plan_submitter (sub-agent): Validates and submits structured plan

This keeps prompts small (~100 lines total vs 450 lines before) and
isolates research context from the planner.
"""

import logging
from typing import List, Any, Optional

from smolagents import ToolCallingAgent

from ..protocols import ModelProvider
from emery_agents.ace import StrategyAccumulationService
from emery_agents.models.plan import Plan, PlanStep, create_plan, create_step
from emery_agents.tools.plan_output_tool import PlanOutputTool
from emery_agents.tools.capability_discovery import create_discovery_tools
from emery_agents.tools.ask_question_tool import AskQuestionTool
from emery_agents.prompts import render_template
from .models import (
    PlanGenerationRequest,
    PlanGenerationResult,
)

logger = logging.getLogger(__name__)


class PlanGenerator:
    """
    Generates plans using a planner with sub-agents.

    Architecture:
    - Planner: Orchestrates, analyzes task, decides what to do
    - plan_researcher: Gathers context via capability discovery (returns concise summary)
    - plan_submitter: Validates and submits structured plan

    Benefits:
    - Small focused prompts (~100 lines total)
    - Research context isolated (doesn't bloat planner)
    - Clear responsibilities
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

        # Get model
        model_id = self.model_provider.resolve_model_selection(org_model=request.org_model)
        model = self.model_provider.get_model(model_id=model_id)

        # Get capability registry
        registry = request.capability_registry or self.capability_registry

        # Build tools for the planning agent
        plan_output_tool = PlanOutputTool()
        ask_question_tool = AskQuestionTool()
        discovery_tools = create_discovery_tools(registry) if registry else []
        tools: List[Any] = [ask_question_tool] + list(discovery_tools)

        # Create sub-agents (pass task for template rendering)
        managed_agents = self._create_sub_agents(
            model=model,
            registry=registry,
            plan_output_tool=plan_output_tool,
            task=request.basic_instructions,
        )

        # Build the planning prompt
        prompt = self._build_planning_prompt(
            instructions=request.basic_instructions,
            goal=request.goal,
            strategy_guidance=strategy_guidance,
            is_template_generation=request.is_template_generation,
            skill_inputs=request.skill_inputs,
            skill_outputs=request.skill_outputs,
            user_feedback=request.user_feedback,
        )

        # Create and run the planning agent with sub-agents
        planner = ToolCallingAgent(
            tools=tools,
            model=model,
            managed_agents=managed_agents if managed_agents else None,
            max_steps=15,
        )

        try:
            planner.run(prompt)
        except Exception as e:
            logger.error(f"Planning agent failed: {e}")
            raise

        # Check if planner asked clarifying questions
        if ask_question_tool.has_questions():
            questions = ask_question_tool.get_questions()
            logger.info(f"❓ Planner asked {len(questions)} clarifying question(s)")
            return PlanGenerationResult(
                plan=None,
                strategy_guidance=strategy_guidance,
                clarifying_questions=questions,
            )

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

    def _create_sub_agents(
        self,
        model: Any,
        registry: Optional[Any],
        plan_output_tool: PlanOutputTool,
        task: str,
    ) -> List[Any]:
        """Create sub-agents for the planner.

        Args:
            model: LLM model for the agents
            registry: Capability registry for discovery tools
            plan_output_tool: Tool for submitting plans
            task: The task description (for template rendering)

        Returns:
            List of managed agents: [plan_researcher, plan_submitter]
        """
        # Build researcher tools: discovery + read-only + research
        discovery_tools = create_discovery_tools(registry) if registry else []
        researcher_tools = list(discovery_tools) + self.read_only_tools + self.research_tools

        # Render researcher prompt from template
        researcher_prompt = render_template("planning/plan_researcher.j2", task=task)

        # plan_researcher: gathers context via capability discovery
        researcher = ToolCallingAgent(
            tools=researcher_tools,
            model=model,
            name="plan_researcher",
            description="Gathers context for planning via capability discovery.",
            instructions=researcher_prompt,
            max_steps=10,
        )

        # Render submitter prompt from template
        submitter_prompt = render_template("planning/plan_submitter.j2")

        # plan_submitter: validates and submits
        submitter = ToolCallingAgent(
            tools=[plan_output_tool],
            model=model,
            name="plan_submitter",
            description="Validates and submits structured plans.",
            instructions=submitter_prompt,
            max_steps=3,
        )

        logger.info("Created plan_researcher and plan_submitter sub-agents with instructions")
        return [researcher, submitter]

    def _build_planning_prompt(
        self,
        instructions: str,
        goal: Optional[str],
        strategy_guidance: str,
        is_template_generation: bool,
        skill_inputs: Optional[List[Any]],
        skill_outputs: Optional[List[Any]],
        user_feedback: Optional[str] = None,
    ) -> str:
        """Build the planning prompt using J2 templates.

        Uses new focused templates:
        - planning/planner.j2 for interactive planning (with sub-agents)
        - planning/skill_template_planner.j2 for skill template generation
        """
        # Choose template based on mode
        template_name = (
            "planning/skill_template_planner.j2"
            if is_template_generation
            else "planning/planner.j2"
        )

        return render_template(
            template_name,
            task=instructions,
            goal=goal,
            strategy_guidance=strategy_guidance,
            skill_inputs=skill_inputs,
            skill_outputs=skill_outputs,
            user_feedback=user_feedback,
        )

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
