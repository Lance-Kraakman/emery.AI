"""
Plan Generator

Generates plans using a single planner agent with all tools available.

AIDEV-NOTE: Simplified from 3-agent architecture (planner + researcher + submitter)
to single agent. Benefits:
- 1-2 LLM calls instead of 3+ (agent decides when to research)
- Simpler prompt flow
- Same functionality, fewer round-trips

The planner has access to:
- Discovery tools: search/list/get capabilities
- Research tools: web search, read-only data access
- Ask question tool: for clarifying user intent
- Submit plan tool: for outputting structured plans
"""

import logging
from typing import Any, Dict, List, Optional

from smolagents import ToolCallingAgent

from ..protocols import ModelProvider, Tool
from ..capability_registry import CapabilityRegistry
from emery_agents.ace import StrategyAccumulationService
from emery_agents.models.plan import Plan, PlanStep, create_plan, create_step
from emery_agents.models.skill_definition import SkillInputDefinition, SkillOutputDefinition
from emery_agents.tools.plan_output_tool import PlanOutputTool
from emery_agents.tools.capability_discovery import create_discovery_tools
from emery_agents.tools.ask_question_tool import AskQuestionTool
from emery_agents.prompts import render_template
from emery_agents.services.context import WorkspaceContext
from .models import (
    PlanGenerationRequest,
    PlanGenerationResult,
)

logger = logging.getLogger(__name__)


class PlanGenerator:
    """
    Generates plans using a single planner agent.

    The planner has all tools available and decides when to use them:
    - Discovery tools: Find relevant capabilities (agents)
    - Research tools: Gather context about existing data
    - Ask question tool: Clarify user intent when needed
    - Submit plan tool: Output structured plan

    Benefits:
    - 1-2 LLM calls (vs 3+ with sub-agents)
    - Agent decides when research is needed (not forced)
    - Simpler control flow
    """

    def __init__(
        self,
        model_provider: Optional[ModelProvider] = None,
        capability_registry: Optional[CapabilityRegistry] = None,
        research_tools: Optional[List[Tool]] = None,
        read_only_tools: Optional[List[Tool]] = None,
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

        # Get model - use org_model from config if available
        org_model = request.config.org_model if request.config else None
        model_id = self.model_provider.resolve_model_selection(org_model=org_model)
        model = self.model_provider.get_model(model_id=model_id)

        # Get capability registry
        registry = request.capability_registry or self.capability_registry

        # Build all tools for the single planning agent
        plan_output_tool = PlanOutputTool()
        ask_question_tool = AskQuestionTool()
        discovery_tools = create_discovery_tools(registry) if registry else []

        # Single agent has all tools: discovery + research + read_only + plan output + ask questions
        # Agent decides when to use research tools (not forced)
        all_tools: List[Tool] = [plan_output_tool, ask_question_tool]
        all_tools.extend(discovery_tools)
        all_tools.extend(self.research_tools)
        all_tools.extend(self.read_only_tools)

        # Build the planning prompt
        prompt = self._build_planning_prompt(
            instructions=request.basic_instructions,
            goal=request.goal,
            strategy_guidance=strategy_guidance,
            is_template_generation=request.is_template_generation,
            skill_inputs=request.skill_inputs,
            skill_outputs=request.skill_outputs,
            user_feedback=request.user_feedback,
            workspace=request.workspace,
        )

        # Create and run the single planning agent (no sub-agents)
        planner = ToolCallingAgent(
            tools=all_tools,
            model=model,
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

    def _build_planning_prompt(
        self,
        instructions: str,
        goal: Optional[str],
        strategy_guidance: str,
        is_template_generation: bool,
        skill_inputs: Optional[List[SkillInputDefinition]],
        skill_outputs: Optional[List[SkillOutputDefinition]],
        user_feedback: Optional[str] = None,
        workspace: Optional[WorkspaceContext] = None,
    ) -> str:
        """Build the planning prompt using J2 templates.

        Uses templates:
        - planning/planner.j2 for interactive planning
        - planning/skill_template_planner.j2 for skill template generation

        If workspace is provided, it injects:
        - available_agents: Pre-resolved agents (no discovery calls needed)
        - context: Existing tables/apps for context-aware clarification
        """
        # Choose template based on mode
        template_name = (
            "planning/skill_template_planner.j2"
            if is_template_generation
            else "planning/planner.j2"
        )

        # Build template context
        template_vars: Dict[str, Any] = {
            "task": instructions,
            "goal": goal,
            "strategy_guidance": strategy_guidance,
            "skill_inputs": skill_inputs,
            "skill_outputs": skill_outputs,
            "user_feedback": user_feedback,
        }

        # Inject workspace context if available
        if workspace:
            template_context = workspace.to_template_context()
            template_vars["available_agents"] = template_context.get("available_agents", [])
            template_vars["context"] = template_context  # Full context for workspace_context.j2 macros

        return render_template(template_name, **template_vars)

    def _create_plan_from_captured(
        self,
        captured_plan: Dict[str, Any],
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
