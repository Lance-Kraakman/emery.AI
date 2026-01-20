"""
Step Output Tool - Captures structured steps from domain planners.

Used by domain planners (SchemaDomainPlanner, AppDomainPlanner, etc.)
to output LLM-generated plan steps in a structured format.

AIDEV-NOTE: This is similar to PlanOutputTool but designed for
domain-specific step generation within the PlannerRouter flow.
"""

import logging
from typing import Any, Dict, List, Optional

from smolagents import Tool

logger = logging.getLogger(__name__)


class StepOutputTool(Tool):  # type: ignore[misc]
    """
    Tool for domain planners to output structured steps.

    The domain planner LLM calls this tool with:
    - steps: List of step objects with description and target_agent
    - analysis: Brief analysis of the approach
    """

    # Skip smolagents' forward signature validation
    skip_forward_signature_validation = True

    name = "output_steps"
    description = """Output the generated plan steps for this domain.

Use this tool to submit your steps:
- steps: List of step objects with description and target_agent
- analysis: Brief analysis of your approach

Each step object should have:
- description: What needs to be done (be specific, include details)
- target_agent: Which agent will execute this step
- phase_name: (optional) Phase grouping like "Discovery", "Schema", "App"
- phase_order: (optional) Order within phases

Example:
{
  "steps": [
    {"description": "Research existing tables and their fields", "target_agent": "research_agent", "phase_name": "Discovery", "phase_order": 1},
    {"description": "Create 'customers' table with name (text), email (email), status (single-select)", "target_agent": "schema_builder", "phase_name": "Schema", "phase_order": 2}
  ],
  "analysis": "Need to create a simple customer tracking schema with status field for tracking customer state."
}
"""

    inputs = {
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
                        "description": "Name of managed agent to handle this step",
                    },
                    "phase_name": {
                        "type": "string",
                        "description": "Logical phase grouping (e.g., 'Discovery', 'Schema', 'App', 'Automation')",
                    },
                    "phase_order": {
                        "type": "integer",
                        "description": "Order of this phase (1, 2, 3...)",
                    },
                },
                "required": ["description", "target_agent"],
            },
            "description": "List of step objects with description and target_agent",
        },
        "analysis": {
            "type": "string",
            "description": "Brief analysis of the approach taken",
            "nullable": True,
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self._steps: List[Dict[str, Any]] = []
        self._analysis: str = ""

    def forward(
        self,
        steps: List[Dict[str, Any]],
        analysis: str = "",
    ) -> str:
        """
        Capture the steps from domain planner.

        Args:
            steps: List of step objects (dict with description, target_agent, etc.)
            analysis: Brief analysis of the approach

        Returns:
            Confirmation message
        """
        # Normalize and store steps
        normalized_steps: List[Dict[str, Any]] = []
        for step in steps:
            if isinstance(step, dict):
                normalized_steps.append({
                    "description": step.get("description", str(step)),
                    "target_agent": step.get("target_agent"),
                    "phase_name": step.get("phase_name"),
                    "phase_order": step.get("phase_order"),
                })
            else:
                logger.warning(f"Unexpected step format: {type(step).__name__}")
                normalized_steps.append({
                    "description": str(step),
                    "target_agent": None,
                })

        self._steps = normalized_steps
        self._analysis = analysis or ""

        logger.info(f"📋 Domain planner captured {len(normalized_steps)} steps")
        for i, step in enumerate(normalized_steps, 1):
            agent = step.get("target_agent", "?")
            desc = step.get("description", "")[:60]
            logger.debug(f"  Step {i} [{agent}]: {desc}...")

        return f"Captured {len(normalized_steps)} steps"

    def get_steps(self) -> List[Dict[str, Any]]:
        """Get the captured steps."""
        return self._steps

    def get_analysis(self) -> str:
        """Get the captured analysis."""
        return self._analysis

    def reset(self) -> None:
        """Reset captured state for reuse."""
        self._steps = []
        self._analysis = ""
