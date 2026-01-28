"""
DSPy Plan Generator

Generates plans using DSPy modules instead of smolagents.

AIDEV-NOTE: This is the DSPy-based replacement for plan_generator.py.
It uses declarative signatures and automatic prompt optimization
instead of Jinja2 templates and manual prompt engineering.

Benefits:
- Typed I/O contracts (no manual TOON parsing)
- Automatic prompt optimization with BootstrapFewShot/MIPROv2
- ChainOfThought reasoning built-in
- Cleaner separation between logic and prompts
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any, Optional

import dspy

from emery_agents.ace import StrategyAccumulationService
from emery_agents.reasoning.config import get_dspy_lm
from emery_agents.reasoning.modules.planner import PlannerModule
from emery_agents.reasoning.signatures.planning import (
    ClarifyingQuestionOutput,
    PlanOutput,
    PlanOrQuestionsOutput,
    PlanStepOutput,
)
from emery_agents.entities.models.plan import Plan, PlanStep, create_plan, create_step
from emery_agents.services.context import WorkspaceContext

from .models import PlanGenerationRequest, PlanGenerationResult

if TYPE_CHECKING:
    from emery_agents.orchestrators.runtime import ConversationMessage
    from emery_agents.services.protocols import ModelProviderProtocol, Tool

logger = logging.getLogger(__name__)


class DSPyPlanGenerator:
    """
    Generates plans using DSPy modules.

    Replaces the smolagents-based PlanGenerator with DSPy:
    - PlannerModule with ChainOfThought for plan generation
    - Typed Pydantic outputs instead of dict/TOON parsing
    - ACE strategy patterns as input field

    The generator:
    1. Configures DSPy with the appropriate model
    2. Formats workspace context for the signature
    3. Calls PlannerModule
    4. Converts DSPy output to PlanGenerationResult
    """

    def __init__(
        self,
        model_provider: Optional["ModelProviderProtocol"] = None,
        discovery_tools: Optional[list["Tool"]] = None,
    ) -> None:
        self.model_provider = model_provider
        self.discovery_tools = discovery_tools or []
        self._last_strategy_guidance: str = ""

        # Initialize planner module (will be configured with model on each call)
        self._planner: Optional[PlannerModule] = None

    def _get_planner(self) -> PlannerModule:
        """Get or create planner module."""
        # Create planner if not exists
        if self._planner is None:
            self._planner = PlannerModule(discovery_tools=self.discovery_tools)

        return self._planner

    async def generate(
        self,
        request: PlanGenerationRequest,
        strategy_service: Optional[StrategyAccumulationService] = None,
    ) -> PlanGenerationResult:
        """Generate plan using DSPy PlannerModule. Returns plan or clarifying questions."""
        logger.info("📋 Generating plan using DSPy PlannerModule")

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

        # Get model from config
        org_model = request.config.org_model if request.config else None

        # Get DSPy LM without calling configure (safe for async)
        lm = get_dspy_lm(org_model=org_model)

        # Get the planner module
        planner = self._get_planner()

        # Format workspace context for the signature
        workspace_context = self._format_workspace_context(request.workspace)

        # Get capability guidance (from capability registry if available)
        capability_guidance = self._get_capability_guidance(request)

        # Format conversation history for the signature
        conversation_history = self._format_conversation_history(request.conversation_history)

        # Format skill inputs description for template generation
        skill_inputs_desc = self._format_skill_inputs_description(request)

        # Call the DSPy planner with async-safe context
        try:
            with dspy.context(lm=lm):
                result: PlanOrQuestionsOutput = planner(
                    request=request.basic_instructions,
                    workspace_context=workspace_context,
                    capability_guidance=capability_guidance,
                    proven_strategies=strategy_guidance,
                    conversation_history=conversation_history,
                    skill_inputs_description=skill_inputs_desc,
                )
        except Exception as e:
            logger.error(f"DSPy planning failed: {e}")
            raise

        # Handle clarifying questions
        if result.questions:
            logger.info(f"❓ DSPy planner returned {len(result.questions)} clarifying question(s)")
            return PlanGenerationResult(
                plan=None,
                strategy_guidance=strategy_guidance,
                clarifying_questions=self._convert_questions(result.questions),
            )

        # Handle plan output
        if result.plan:
            plan = self._convert_plan(
                dspy_plan=result.plan,
                basic_instructions=request.basic_instructions,
            )
            return PlanGenerationResult(
                plan=plan,
                strategy_guidance=strategy_guidance,
            )

        # Neither plan nor questions - shouldn't happen
        raise ValueError("DSPy planner returned neither plan nor questions")

    def _format_conversation_history(
        self,
        history: Optional[list["ConversationMessage"]],
    ) -> str:
        """Format conversation history as a string for the DSPy signature."""
        if not history:
            return ""

        parts = []
        for msg in history[-10:]:  # Last 10 messages to keep context bounded
            if msg.content:
                parts.append(f"{msg.role}: {msg.content}")

        return "\n".join(parts)

    def _format_workspace_context(
        self,
        workspace: Optional[WorkspaceContext],
    ) -> str:
        """Format workspace context as JSON string for DSPy signature."""
        if not workspace:
            return "{}"

        # Use the workspace's template context method
        context = workspace.to_template_context()
        return json.dumps(context, indent=2, default=str)

    def _get_capability_guidance(
        self,
        request: PlanGenerationRequest,
    ) -> str:
        """Get capability planning guidance for the planner."""
        from emery_agents.reasoning.capabilities import (
            format_planning_guidance,
            get_all_planning_guidance,
        )

        guidance_map = get_all_planning_guidance()

        # Filter by enabled capabilities if registry available
        if request.capability_registry:
            org_id = request.config.org_id if request.config else None
            try:
                enabled = (
                    request.capability_registry.get_enabled(org_id)
                    if org_id
                    else request.capability_registry.all()
                )
                if enabled:
                    enabled_ids = {cap.id for cap in enabled}
                    # Only include guidance for enabled capabilities
                    filtered_ids = [
                        cap_id for cap_id in guidance_map.keys()
                        if cap_id in enabled_ids
                    ]
                    if filtered_ids:
                        return format_planning_guidance(filtered_ids)
            except Exception as e:
                logger.warning(f"Failed to filter capabilities by registry: {e}")

        # Return all guidance if no filtering possible
        return format_planning_guidance()

    def _convert_questions(
        self,
        dspy_questions: list[ClarifyingQuestionOutput],
    ) -> list[dict[str, Any]]:
        """Convert DSPy ClarifyingQuestionOutput to dict format for compatibility."""
        return [
            {
                "question": q.question,
                "question_type": q.question_type,
                "options": q.options,
                "reason": q.reason,
            }
            for q in dspy_questions
        ]

    def _format_skill_inputs_description(
        self,
        request: PlanGenerationRequest,
    ) -> str:
        """Format skill inputs/outputs as guidance for the DSPy planner.

        When generating templates for autonomous skills, this provides comprehensive
        instructions so the LLM produces prompt_template fields with {{ variable }}
        placeholders instead of generic descriptions.
        """
        if not request.is_template_generation or not request.skill_inputs:
            return ""

        parts = [
            "=== TEMPLATE GENERATION MODE ===",
            "",
            "You are creating a REUSABLE SKILL TEMPLATE, not executing a one-off task.",
            "",
            "CRITICAL RULES:",
            "1. Every step MUST have a prompt_template field",
            "2. The prompt_template is the FULL instruction the executor LLM receives at runtime",
            "3. Use {{ variable_name }} Jinja2 syntax to reference skill inputs",
            "4. Put ALL execution logic, conditions, and formatting rules INTO the prompt_template",
            "5. The description field is just a short human-readable label for the UI",
            "",
            "Available skill input variables (use in prompt_template as {{ name }}):",
        ]
        for inp in request.skill_inputs:
            req = "required" if inp.required else "optional"
            parts.append(f"  - {{ {inp.name} }} ({inp.type}, {req})")
        if request.skill_outputs:
            parts.append("")
            parts.append("Expected outputs:")
            for out in request.skill_outputs:
                parts.append(f"  - {out.name} ({out.type})")
        parts.extend([
            "",
            "EXAMPLE:",
            '  description: "Generate individual summary"',
            '  prompt_template: "Write a summary for {{ name }}, age {{ age }}. '
            'Include family info: {{ family }}."',
        ])
        return "\n".join(parts)

    def _convert_plan(
        self,
        dspy_plan: PlanOutput,
        basic_instructions: str,
    ) -> Plan:
        """Convert DSPy Plan to the existing Plan model."""
        # Convert steps
        steps: list[PlanStep] = []
        for dspy_step in dspy_plan.steps:
            step = create_step(
                description=dspy_step.description,
                target_agent=dspy_step.target_agent,
                prompt_template=dspy_step.prompt_template,
                required_context=dspy_step.required_context,
                phase_name=dspy_step.phase_name,
                phase_order=dspy_step.phase_order,
                replan_after=dspy_step.replan_after,
            )
            steps.append(step)

        return create_plan(
            goal=dspy_plan.goal,
            basic_instructions=basic_instructions,
            steps=steps,
            context=dspy_plan.context,
            analysis=dspy_plan.analysis,
        )

    @property
    def last_strategy_guidance(self) -> str:
        """Get the strategy guidance used in the last plan generation."""
        return self._last_strategy_guidance
