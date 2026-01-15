"""
Plan Output Tool - Captures structured plan from planner agent.

Instead of parsing LLM text output, the planner calls this tool
to submit a structured plan.

AIDEV-NOTE: This replaces text parsing with structured tool capture.
The planner calls submit_plan with goal and steps, which are captured
directly without any regex parsing.
"""

import logging
from typing import Any, Dict, List, Optional

from smolagents import Tool

logger = logging.getLogger(__name__)


class PlanOutputTool(Tool):  # type: ignore[misc]
    """
    Tool for planner to submit structured plans.

    The planner calls this tool with:
    - goal: Short description of what will be achieved
    - steps: List of human-readable step descriptions
    """

    # Skip smolagents' forward signature validation since we use **kwargs pattern
    skip_forward_signature_validation = True

    name = "submit_plan"
    description = """Submit a structured execution plan with context and analysis.

IMPORTANT: Only call this AFTER you have gathered context using database_list() and table_list().

Use this tool to output your plan with:
- context: What you discovered from listing databases/tables (existing resources)
- analysis: Your analysis of what needs to change and why
- goal: Clear statement of what will be achieved
- steps: List of step objects with description and optional target_agent

Each step object should have:
- description: Human-readable description of what will be done (include specific table/field names)
- target_agent: (optional) Name of managed agent to handle this step

Example:
{
  "context": "## Existing Resources\\n- No databases found\\n- No tables found",
  "analysis": "## Analysis\\n\\nI identified these entities from your request:\\n- **clients**: name, DOB, contact info\\n- **health_history**: conditions, medications\\n\\nRelationships: health_history belongs to clients",
  "goal": "Create client consultation database with health tracking",
  "steps": [
    {"description": "Create 'clients' table with: id, name, date_of_birth, phone, email", "target_agent": "schema_builder"},
    {"description": "Create 'health_history' table with: id, client_id, conditions, medications", "target_agent": "schema_builder"},
    {"description": "Set up foreign key: health_history.client_id -> clients.id", "target_agent": "schema_builder"}
  ]
}
"""

    inputs = {
        "context": {
            "type": "string",
            "description": "What you discovered from listing databases/tables (existing resources). Format as markdown.",
            "nullable": True,
        },
        "analysis": {
            "type": "string",
            "description": "Your analysis of what needs to change and why. Include entities identified, relationships, and reasoning.",
            "nullable": True,
        },
        "goal": {
            "type": "string",
            "description": "Brief goal statement describing what will be achieved",
        },
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "Human-readable step description with specific details",
                    },
                    "target_agent": {
                        "type": "string",
                        "description": "Name of managed agent to handle this step (optional)",
                    },
                },
                "required": ["description"],
            },
            "description": "List of step objects with description and optional target_agent",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self.captured_plan: Optional[Dict[str, Any]] = None

    def forward(
        self,
        goal: str,
        steps: List[Any],
        context: Optional[str] = None,
        analysis: Optional[str] = None,
    ) -> str:
        """
        Capture the plan structure with context and analysis.

        Args:
            goal: Brief goal statement
            steps: List of step objects (dict with description, optional target_agent)
                   or strings (legacy format)
            context: What was discovered from listing databases/tables
            analysis: Analysis of what needs to change and why

        Returns:
            Confirmation message
        """
        # Normalize steps to ensure consistent structure
        normalized_steps = []
        for step in steps:
            if isinstance(step, str):
                # Legacy format - just a string description
                normalized_steps.append({"description": step, "target_agent": None})
            elif isinstance(step, dict):
                normalized_steps.append({
                    "description": step.get("description", str(step)),
                    "target_agent": step.get("target_agent"),
                })
            else:
                normalized_steps.append({"description": str(step), "target_agent": None})

        self.captured_plan = {
            "goal": goal,
            "steps": normalized_steps,
            "context": context,
            "analysis": analysis,
        }
        logger.info(f"📋 Plan captured: {goal} ({len(normalized_steps)} steps)")
        if context:
            logger.debug(f"  Context: {context[:100]}...")
        if analysis:
            logger.debug(f"  Analysis: {analysis[:100]}...")
        for i, step in enumerate(normalized_steps, 1):
            agent_info = f" [{step['target_agent']}]" if step.get('target_agent') else ""
            desc = step.get('description') or ""
            logger.debug(f"  Step {i}{agent_info}: {desc[:80]}...")
        return f"Plan submitted: {goal} with {len(normalized_steps)} steps"

    def get_plan(self) -> Optional[Dict[str, Any]]:
        """
        Retrieve the captured plan.

        Returns:
            Dict with 'goal' and 'steps' keys, or None if not captured
        """
        return self.captured_plan

    def reset(self) -> None:
        """Reset captured state for reuse."""
        self.captured_plan = None
