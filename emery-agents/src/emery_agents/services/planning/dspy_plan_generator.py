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

from emery_agents.ace import StrategyAccumulationService
from emery_agents.dspy_modules.config import configure_dspy
from emery_agents.dspy_modules.modules.planner import PlannerModule
from emery_agents.dspy_modules.signatures.planning import (
    ClarifyingQuestion,
    Plan as DSPyPlan,
    PlanOrQuestions,
    PlanStep as DSPyPlanStep,
)
from emery_agents.models.plan import Plan, PlanStep, create_plan, create_step
from emery_agents.services.context import WorkspaceContext

from .models import PlanGenerationRequest, PlanGenerationResult

if TYPE_CHECKING:
    from emery_agents.services.protocols import ModelProvider, Tool

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
        model_provider: Optional[ModelProvider] = None,
        discovery_tools: Optional[list[Tool]] = None,
    ) -> None:
        """
        Initialize DSPy plan generator.

        Args:
            model_provider: Model provider for LLM access and model resolution
            discovery_tools: Optional tools for planning phase (read-only discovery)
        """
        self.model_provider = model_provider
        self.discovery_tools = discovery_tools or []
        self._last_strategy_guidance: str = ""

        # Initialize planner module (will be configured with model on each call)
        self._planner: Optional[PlannerModule] = None

    def _get_planner(self, org_model: Optional[str] = None) -> PlannerModule:
        """Get or create planner module with correct model configuration."""
        # Configure DSPy with the appropriate model
        configure_dspy(org_model=org_model)

        # Create planner if not exists
        if self._planner is None:
            self._planner = PlannerModule(discovery_tools=self.discovery_tools)

        return self._planner

    async def generate(
        self,
        request: PlanGenerationRequest,
        strategy_service: Optional[StrategyAccumulationService] = None,
    ) -> PlanGenerationResult:
        """
        Generate plan using DSPy PlannerModule.

        Args:
            request: Plan generation request with all inputs
            strategy_service: Optional service for surfacing proven patterns

        Returns:
            PlanGenerationResult with plan or clarifying questions
        """
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

        # Get the planner module
        planner = self._get_planner(org_model=org_model)

        # Format workspace context for the signature
        workspace_context = self._format_workspace_context(request.workspace)

        # Get capability guidance (from capability registry if available)
        capability_guidance = self._get_capability_guidance(request)

        # Call the DSPy planner
        try:
            result: PlanOrQuestions = planner(
                request=request.basic_instructions,
                workspace_context=workspace_context,
                capability_guidance=capability_guidance,
                proven_strategies=strategy_guidance,
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
        """Get capability guidance from registry if available.

        AIDEV-NOTE: This is a placeholder for capability-specific guidance.
        The capability registry currently doesn't have a method to get
        guidance for a specific request. In the future, this could be
        enhanced to match requests to capabilities and return domain-specific
        planning instructions.
        """
        # Capability guidance is currently derived from workspace context
        # which already includes available agents, skills, and tools.
        # Return empty string as placeholder - capability matching can be
        # added when the registry supports request-based lookup.
        return ""

    def _convert_questions(
        self,
        dspy_questions: list[ClarifyingQuestion],
    ) -> list[dict[str, Any]]:
        """Convert DSPy ClarifyingQuestion to dict format for compatibility."""
        return [
            {
                "question": q.question,
                "question_type": q.question_type,
                "options": q.options,
                "reason": q.reason,
            }
            for q in dspy_questions
        ]

    def _convert_plan(
        self,
        dspy_plan: DSPyPlan,
        basic_instructions: str,
    ) -> Plan:
        """Convert DSPy Plan to the existing Plan model."""
        # Convert steps
        steps: list[PlanStep] = []
        for dspy_step in dspy_plan.steps:
            step = create_step(
                description=dspy_step.description,
                target_agent=dspy_step.target_agent,
                prompt_template=None,  # DSPy doesn't use prompt templates
                required_context=dspy_step.required_context,
                phase_name="Execution",
                phase_order=1,
                replan_after=False,
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
