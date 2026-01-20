"""
Plan Generator

Core logic for generating plans from instructions using PlannerRouter.
Routes planning to domain-specific planners (schema, app, automation).

AIDEV-NOTE: Uses phased domain routing for all plan generation.
Classifies requests by domain, generates domain-specific steps,
and combines into a phased plan.
"""

import logging
from typing import List, Any, Optional

from ..protocols import ModelProvider
from emery_agents.ace import StrategyAccumulationService
from .models import (
    PlanGenerationRequest,
    PlanGenerationResult,
)
from .planners import PlannerRouter, ACEContext, TemplateGenerationContext

logger = logging.getLogger(__name__)


class PlanGenerator:
    """
    Generates plans from instructions using phased domain routing.

    Uses PlannerRouter to:
    1. Classify the request into domains (schema, app, automation)
    2. Generate domain-specific steps via specialized planners
    3. Combine into a phased plan
    """

    def __init__(self, model_provider: Optional[ModelProvider] = None):
        """
        Initialize plan generator.

        Args:
            model_provider: Model provider for LLM access and model resolution
        """
        self.model_provider = model_provider
        self._last_strategy_guidance: str = ""

    async def generate(
        self,
        request: PlanGenerationRequest,
        strategy_service: Optional[StrategyAccumulationService] = None,
    ) -> PlanGenerationResult:
        """
        Generate plan using phased domain routing.

        Uses PlannerRouter to classify the request into domains (schema, app, automation)
        and generates domain-specific plans that are combined into a phased plan.

        Args:
            request: Plan generation request with all inputs
            strategy_service: Optional service for surfacing proven patterns

        Returns:
            PlanGenerationResult with plan and metadata
        """
        if not self.model_provider:
            raise ValueError("PlanGenerator requires model_provider for planning")

        logger.info("📋 Using phased domain routing via PlannerRouter")

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

        # Build ACE context
        # AIDEV-NOTE: recent_tool_results disabled - the extraction function was broken
        # (looked for attributes that don't exist on ChatMessage). For future implementation,
        # extract from TaskLedger.steps during re-planning scenarios. See ACE docs in plan file.
        ace_context = ACEContext(
            strategy_guidance=strategy_guidance if strategy_guidance else None,
            recent_tool_results=None,
            conversation_history=request.conversation_history,
        )

        # Build template generation context
        template_context = TemplateGenerationContext(
            is_template_generation=request.is_template_generation,
            skill_inputs=[i.to_dict() for i in request.skill_inputs] if request.skill_inputs else None,
            skill_outputs=[o.to_dict() for o in request.skill_outputs] if request.skill_outputs else None,
        )

        router = PlannerRouter(model_provider=self.model_provider)
        plan = await router.generate_plan(
            instructions=request.basic_instructions,
            goal=request.goal,
            org_model=request.org_model,
            ace_context=ace_context,
            template_context=template_context,
        )

        return PlanGenerationResult(
            plan=plan,
            strategy_guidance=strategy_guidance,
        )

    @property
    def last_strategy_guidance(self) -> str:
        """Get the strategy guidance used in the last plan generation."""
        return self._last_strategy_guidance
