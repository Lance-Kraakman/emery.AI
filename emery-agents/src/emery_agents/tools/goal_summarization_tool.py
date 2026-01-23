"""
Goal Summarization Tool - Captures concise goal statements from LLM.

Used by PlannerRouter to summarize long user instructions into
meaningful plan.goal values that don't blow out context.

AIDEV-NOTE: Addresses the issue where raw user messages (potentially
very long) were stored as plan.goal, causing evaluator confusion
and wasting context tokens.
"""

import logging
from smolagents import Tool

logger = logging.getLogger(__name__)


class GoalSummarizationTool(Tool):  # type: ignore[misc]
    """
    Tool for capturing summarized goal statements.

    The LLM calls this tool with a concise goal summary.
    """

    # Skip smolagents' forward signature validation
    skip_forward_signature_validation = True

    name = "summarize_goal"
    description = """Submit your concise goal summary.

The goal should be:
- 100 words or less
- Focus on WHAT needs to be achieved
- Use action verbs (create, build, set up)
- Mention key entities (tables, apps, agents)

Example: "Create a customer tracking system with a customers table and dashboard app for viewing and filtering data."
"""

    inputs = {
        "goal": {
            "type": "string",
            "description": "Concise goal statement (100 words or less)",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self._goal: str = ""

    def forward(self, goal: str) -> str:
        """
        Capture the goal summary.

        Args:
            goal: Concise goal statement

        Returns:
            Confirmation message
        """
        self._goal = goal.strip()
        word_count = len(self._goal.split())

        if word_count > 150:
            logger.warning(
                f"Goal summary is {word_count} words (expected <100). "
                "Consider making it more concise."
            )

        logger.info(f"Goal summarized: {self._goal[:100]}...")
        return f"Goal captured ({word_count} words)"

    def get_goal(self) -> str:
        """Get the captured goal summary."""
        return self._goal

    def reset(self) -> None:
        """Reset for reuse."""
        self._goal = ""
