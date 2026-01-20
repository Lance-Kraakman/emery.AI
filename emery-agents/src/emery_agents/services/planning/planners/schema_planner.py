"""
Schema Domain Planner

Generates plan steps for database schema operations using LLM.
Routes to schema_builder agent for execution.

AIDEV-NOTE: This planner handles:
- Database creation
- Table creation
- Field/column management
- Relations between tables
"""

import logging
from typing import Any, List, Optional

from smolagents import ToolCallingAgent

from emery_agents.models.plan import create_step
from emery_agents.tools.step_output_tool import StepOutputTool
from emery_agents.prompts import render_template

from .base_planner import BaseDomainPlanner, DomainPlanResult, ACEContext, TemplateGenerationContext

logger = logging.getLogger(__name__)


class SchemaDomainPlanner(BaseDomainPlanner):
    """
    Plans database schema operations using LLM.

    Routes to schema_builder agent for execution.
    Requires model_provider for LLM-based planning.
    """

    domain = "schema"
    target_agents = ["schema_builder"]

    async def generate_steps(
        self,
        instructions: str,
        domain_context: Optional[str] = None,
        ace_context: Optional[ACEContext] = None,
        template_context: Optional[TemplateGenerationContext] = None,
        org_model: Optional[str] = None,
    ) -> DomainPlanResult:
        """
        Generate schema-specific plan steps using LLM.

        Args:
            instructions: Full user instructions (NOT truncated)
            domain_context: Context from earlier domains
            ace_context: ACE variables (strategy_guidance, recent_tool_results)
            template_context: Template generation settings
            org_model: Organization model ID for model resolution

        Returns:
            DomainPlanResult with LLM-generated steps

        Raises:
            ValueError: If no model_provider is available
        """
        if not self.model_provider:
            raise ValueError("SchemaDomainPlanner requires model_provider for LLM-based planning")

        # LLM-driven step generation
        model_id = self.model_provider.resolve_model_selection(org_model=org_model)
        model = self.model_provider.get_model(model_id=model_id)

        step_tool = StepOutputTool()

        # Build prompt using Jinja2 template
        prompt = render_template(
            "planning/schema_planner.j2",
            instructions=instructions,
            domain_context=domain_context,
            strategy_guidance=ace_context.strategy_guidance if ace_context else None,
            recent_tool_results=ace_context.recent_tool_results if ace_context else None,
            is_template_generation=template_context.is_template_generation if template_context else False,
            skill_inputs=template_context.skill_inputs if template_context else None,
            skill_outputs=template_context.skill_outputs if template_context else None,
        )

        agent = ToolCallingAgent(
            tools=[step_tool],
            model=model,
            max_steps=4,
        )
        agent.run(prompt)

        captured_steps = step_tool.get_steps()
        analysis = step_tool.get_analysis()

        if not captured_steps:
            raise ValueError("Schema planner LLM did not generate any steps")

        steps = [
            create_step(
                description=s.get("description", ""),
                target_agent=s.get("target_agent"),
                phase_name=s.get("phase_name", "Schema"),
                phase_order=s.get("phase_order", 2),
            )
            for s in captured_steps
        ]
        logger.info(f"Schema planner generated {len(steps)} LLM-driven steps")

        return DomainPlanResult(
            steps=steps,
            context=analysis,  # Return LLM-generated analysis as context (not input echo)
            analysis=analysis,
            target_agents=self.target_agents,
        )
