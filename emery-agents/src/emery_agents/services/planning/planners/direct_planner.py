"""
Direct Execution Domain Planner

Generates plan steps for pure LLM tasks without platform operations.
Routes to direct_execution for analysis, routing, summarization, etc.

AIDEV-NOTE: This planner handles tasks that:
- Don't require creating/modifying platform entities (tables, apps, agents)
- Are pure LLM tasks: analysis, classification, routing, summarization
- Transform or process input data without side effects
- Make decisions or route to other processes

This addresses the issue where pure LLM skills (like "analyze {{text}} and route")
were misclassified as "automation" because automation_planner expects entity creation.
"""

import logging
from typing import Optional

from emery_agents.models.plan import create_step

from .base_planner import BaseDomainPlanner, DomainPlanResult, ACEContext, TemplateGenerationContext

logger = logging.getLogger(__name__)


class DirectDomainPlanner(BaseDomainPlanner):
    """
    Plans direct LLM execution without platform operations.

    Unlike other planners, this doesn't use an LLM to generate steps
    because the task IS the LLM task - no further decomposition needed.

    Routes to direct_execution pseudo-agent for execution.
    """

    domain = "direct"
    target_agents = ["direct_execution"]

    async def generate_steps(
        self,
        instructions: str,
        domain_context: Optional[str] = None,
        ace_context: Optional[ACEContext] = None,
        template_context: Optional[TemplateGenerationContext] = None,
        org_model: Optional[str] = None,
    ) -> DomainPlanResult:
        """
        Generate steps for direct LLM execution.

        Unlike other domain planners, this creates a single step that
        encapsulates the entire LLM task. No further decomposition is
        needed because the task itself IS the LLM operation.

        Args:
            instructions: Full user instructions (the LLM task itself)
            domain_context: Context from earlier domains (if any)
            ace_context: ACE variables (strategy_guidance, recent_tool_results)
            template_context: Template generation settings
            org_model: Organization model ID for model resolution

        Returns:
            DomainPlanResult with a single direct execution step
        """
        # For direct execution, the instructions ARE the task
        # No need to use LLM to generate steps - the task is the step

        # Create a concise description from the instructions
        description = self._create_description(instructions)

        # Determine if this is template generation
        is_template = template_context.is_template_generation if template_context else False

        # Create the single step
        step = create_step(
            description=description,
            target_agent="direct_execution",
            phase_name="Direct",
            phase_order=1,
            # For templates, include the full instructions as prompt_template
            prompt_template=instructions if is_template else None,
            # No required_context for direct - it uses skill inputs directly
            required_context=self._extract_required_context(instructions) if is_template else None,
        )

        logger.info(f"Direct planner created step: {description[:80]}...")

        return DomainPlanResult(
            steps=[step],
            context=domain_context or "",
            analysis="Pure LLM task - no platform operations needed. Task will be executed directly.",
            target_agents=self.target_agents,
        )

    def _create_description(self, instructions: str, max_length: int = 100) -> str:
        """Create a concise description from instructions."""
        # Get first sentence or line
        first_line = instructions.split("\n")[0].strip()
        first_sentence = first_line.split(".")[0].strip()

        # Prefer first sentence if reasonable length
        if 10 < len(first_sentence) < max_length:
            return first_sentence

        # Otherwise truncate first line
        if len(first_line) > max_length:
            return first_line[:max_length - 3] + "..."
        return first_line or "Execute direct LLM task"

    def _extract_required_context(self, instructions: str) -> list[str]:
        """Extract variable names from {{ variable }} placeholders."""
        import re

        # Find all {{ variable }} patterns
        pattern = r"\{\{\s*(\w+)\s*\}\}"
        matches = re.findall(pattern, instructions)

        # Return unique variable names
        return list(set(matches))
