"""
Planner Router

Orchestrates domain planners to generate multi-domain plans.
Uses LLM classification to determine which domains are needed.

AIDEV-NOTE: The router:
1. Classifies the request into domains
2. Invokes domain planners for each domain
3. Combines steps into a phased plan
"""

import logging
from typing import Any, Dict, List, Optional

from smolagents import ToolCallingAgent

from emery_agents.models.plan import Plan, PlanStep, create_plan
from emery_agents.utils.session_logger import get_session_logger
from emery_agents.ace import PlanningContext, PlanningContextService
from emery_agents.prompts import render_template
from emery_agents.tools.goal_summarization_tool import GoalSummarizationTool

from .base_planner import DomainPlanner, DomainPlanResult, ACEContext, TemplateGenerationContext
from .planner_classifier import PlannerClassifier, DomainClassification
from .schema_planner import SchemaDomainPlanner
from .app_planner import AppDomainPlanner
from .automation_planner import AutomationDomainPlanner
from .direct_planner import DirectDomainPlanner

logger = logging.getLogger(__name__)

# Threshold for using LLM-based summarization vs simple truncation
GOAL_SUMMARIZATION_THRESHOLD = 200


class PlannerRouter:
    """
    Routes planning requests to domain-specific planners.

    Orchestrates:
    1. Classification of request into domains
    2. Domain-specific step generation
    3. Composition into phased plan
    """

    # Domain execution order (determines phase ordering)
    # Direct executes first (pure LLM tasks), then platform operations
    DOMAIN_ORDER = ["direct", "schema", "app", "automation"]

    def __init__(self, model_provider: Optional[Any] = None):
        """
        Initialize router with domain planners.

        Args:
            model_provider: Model provider for LLM access
        """
        self.model_provider = model_provider
        self.classifier = PlannerClassifier(model_provider=model_provider)

        # Initialize domain planners
        self.planners: Dict[str, DomainPlanner] = {
            "direct": DirectDomainPlanner(model_provider=model_provider),
            "schema": SchemaDomainPlanner(model_provider=model_provider),
            "app": AppDomainPlanner(model_provider=model_provider),
            "automation": AutomationDomainPlanner(model_provider=model_provider),
        }

    async def generate_plan(
        self,
        instructions: str,
        goal: Optional[str] = None,
        org_model: Optional[str] = None,
        ace_context: Optional[ACEContext] = None,
        template_context: Optional[TemplateGenerationContext] = None,
    ) -> Plan:
        """
        Generate a plan by routing to appropriate domain planners.

        Args:
            instructions: The user's instructions
            goal: Optional explicit goal
            org_model: Optional organization model ID
            ace_context: ACE variables (strategy_guidance, recent_tool_results)
            template_context: Template generation settings

        Returns:
            Combined Plan with steps from all relevant domains
        """
        # Session logging for flow tracking
        session_logger = get_session_logger()
        if session_logger:
            session_logger.log_event("planning_started", {
                "instructions_preview": instructions[:200],
                "has_ace_context": ace_context is not None,
                "is_template_generation": template_context.is_template_generation if template_context else False,
            })

        # Step 1: Summarize goal for consistent use throughout planning
        # This prevents context blowup from large user instructions
        summarized_goal = await self._summarize_goal(instructions, org_model)

        # Step 2: Classify into domains
        classification = await self.classifier.classify(
            instructions,  # Use full instructions for classification (needs detail)
            org_model,
            strategy_guidance=ace_context.strategy_guidance if ace_context else None,
            recent_tool_results=ace_context.recent_tool_results if ace_context else None,
        )
        logger.info(
            f"📋 Request classified as: {classification.domains} "
            f"(primary: {classification.primary_domain})"
        )

        # Step 3: Generate steps for each domain
        all_steps: List[PlanStep] = []

        # Sort domains by execution order
        ordered_domains = sorted(
            classification.domains,
            key=lambda d: self.DOMAIN_ORDER.index(d) if d in self.DOMAIN_ORDER else 99,
        )

        # Initialize PlanningContextService for LLM-based context curation
        planning_context_service = PlanningContextService(
            model_provider=self.model_provider,
            org_model=org_model,
        ) if self.model_provider else None

        # Use summarized goal in PlanningContext for consistent context management
        planning_context = PlanningContext(overall_goal=summarized_goal)

        # Register phase goals for each domain using LLM-generated goals from classification
        for domain in ordered_domains:
            phase_name = domain.title()
            if phase_name not in classification.phase_goals:
                raise ValueError(
                    f"LLM did not generate goal for phase '{phase_name}'. "
                    f"Available goals: {list(classification.phase_goals.keys())}. "
                    f"Ensure domain_classifier.j2 instructs LLM to generate phase_goals."
                )
            goal = classification.phase_goals[phase_name]
            planning_context.add_phase_goal(phase_name, goal, generated_by="Classification")

        prev_domain = None
        for domain in ordered_domains:
            if domain not in self.planners:
                logger.warning(f"No planner for domain: {domain}")
                continue

            # Get curated context from PlanningContext (includes phase goal + prior insights)
            phase_name = domain.title()
            curated_context = planning_context.format_for_phase(phase_name)

            # Log state transition between domains
            if session_logger:
                session_logger.log_state_transition(
                    from_state=f"domain:{prev_domain}" if prev_domain else "start",
                    to_state=f"domain:{domain}",
                    trigger="domain_planning",
                )
                session_logger.log_event("domain_context_input", {
                    "domain": domain,
                    "curated_context_length": len(curated_context),
                    "insight_count": len(planning_context.insights),
                    "completed_phases": planning_context.completed_phases,
                    "curated_context_preview": curated_context[-500:] if curated_context else "",
                })
                # Log full curated context passed to this domain
                session_logger.log_full_content(
                    content_type="context",
                    name=f"domain_{domain}_curated_input",
                    content=curated_context if curated_context else "(empty - first domain)",
                    metadata={
                        "domain": domain,
                        "previous_domains": ordered_domains[:ordered_domains.index(domain)],
                        "insight_count": len(planning_context.insights),
                    },
                )

            planner = self.planners[domain]
            logger.info(f"📋 Generating steps for domain: {domain}")

            result = await planner.generate_steps(
                instructions=instructions,
                domain_context=curated_context,
                ace_context=ace_context,
                template_context=template_context,
                org_model=org_model,
            )

            # Log domain planner results
            if session_logger:
                session_logger.log_event("domain_steps_generated", {
                    "domain": domain,
                    "step_count": len(result.steps),
                    "steps": [
                        {
                            "step_id": s.step_id,
                            "description": s.description[:100],
                            "target_agent": s.target_agent,
                            "phase_name": s.phase_name,
                        }
                        for s in result.steps
                    ],
                    "context_length": len(result.context),
                    "analysis_length": len(result.analysis),
                })
                # Log full context output from this domain
                session_logger.log_full_content(
                    content_type="context",
                    name=f"domain_{domain}_output",
                    content=result.context,
                    metadata={"domain": domain, "step_count": len(result.steps)},
                )
                session_logger.log_full_content(
                    content_type="analysis",
                    name=f"domain_{domain}_analysis",
                    content=result.analysis,
                    metadata={"domain": domain},
                )

            all_steps.extend(result.steps)

            # Curate context via ACE (extracts insights from raw context using LLM)
            if planning_context_service:
                planning_context = planning_context_service.curate_after_phase(
                    planning_context=planning_context,
                    phase_name=phase_name,
                    raw_context=result.context,
                    raw_analysis=result.analysis,
                )
            else:
                # Still mark phase completed even without full ACE curation
                planning_context.mark_phase_completed(phase_name)

            prev_domain = domain

        # AIDEV-NOTE: Discovery deduplication removed - each domain needs its own discovery:
        # - Schema planner discovers: existing tables, fields, relations
        # - App planner discovers: existing apps, pages, views
        # - Automation planner discovers: existing agents, skills, triggers
        # These are NOT duplicates - they discover different domain-specific entities.

        # Step 4: Create plan with ACE-curated context
        # Use the already-summarized goal (or explicit goal if provided)
        plan_goal = goal or summarized_goal

        plan = create_plan(
            goal=plan_goal,
            basic_instructions=instructions,
            steps=all_steps,
            context=planning_context.format_context_for_plan(),
            analysis=planning_context.format_analysis_for_plan(),
        )

        logger.info(
            f"📋 Generated plan {plan.id} with {len(all_steps)} steps "
            f"across {len(classification.domains)} domains"
        )

        return plan

    def _summarize(self, text: str, max_length: int = 100) -> str:
        """Create a short summary of the text (simple fallback)."""
        lines = text.split("\n")
        first_line = lines[0].strip() if lines else ""
        if len(first_line) > max_length:
            return first_line[: max_length - 3] + "..."
        return first_line

    async def _summarize_goal(
        self,
        instructions: str,
        org_model: Optional[str] = None,
    ) -> str:
        """
        Summarize long instructions into a concise goal using LLM.

        For short instructions (<200 chars), returns as-is.
        For longer instructions, uses LLM to create a meaningful summary.

        AIDEV-NOTE: Addresses context blowup issue where raw user messages
        were stored as plan.goal, confusing evaluator and wasting tokens.

        Args:
            instructions: The user's full instructions
            org_model: Optional organization model ID

        Returns:
            Concise goal statement (typically <100 words)
        """
        # Short instructions don't need summarization
        if len(instructions) < GOAL_SUMMARIZATION_THRESHOLD:
            return instructions.strip()

        # No model provider = fallback to simple summarization
        if not self.model_provider:
            logger.warning("No model_provider for goal summarization, using simple fallback")
            return self._summarize(instructions)

        try:
            # Build prompt
            prompt = render_template(
                "planning/goal_summarization.j2",
                instructions=instructions,
            )

            # Use lightweight agent for summarization
            goal_tool = GoalSummarizationTool()
            model_id = self.model_provider.resolve_model_selection(org_model=org_model)
            model = self.model_provider.get_model(model_id=model_id)

            agent = ToolCallingAgent(
                tools=[goal_tool],
                model=model,
                max_steps=2,
            )
            agent.run(prompt)

            summarized_goal = goal_tool.get_goal()
            if summarized_goal:
                logger.info(
                    f"Goal summarized: {len(instructions)} chars -> "
                    f"{len(summarized_goal)} chars"
                )
                return summarized_goal

            # Fallback if tool wasn't called
            logger.warning("Goal summarization tool not called, using fallback")
            return self._summarize(instructions)

        except Exception as e:
            logger.warning(f"Goal summarization failed: {e}, using fallback")
            return self._summarize(instructions)

    async def get_domain_classification(
        self,
        instructions: str,
        org_model: Optional[str] = None,
        ace_context: Optional[ACEContext] = None,
    ) -> DomainClassification:
        """
        Get domain classification without generating a plan.

        Useful for understanding what domains a request involves.

        Args:
            instructions: The user's instructions
            org_model: Optional organization model ID
            ace_context: ACE variables for context
        """
        return await self.classifier.classify(
            instructions,
            org_model,
            strategy_guidance=ace_context.strategy_guidance if ace_context else None,
            recent_tool_results=ace_context.recent_tool_results if ace_context else None,
        )
