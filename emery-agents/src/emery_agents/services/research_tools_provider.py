"""
Research Tools Provider

Provides web research tools for the planning phase.
Conditionally enables research capabilities when user intent is detected.
"""

import logging
from typing import List

from smolagents import Tool

logger = logging.getLogger(__name__)

# Track availability of research tools
RESEARCH_TOOLS_AVAILABLE = False

try:
    from smolagents import DuckDuckGoSearchTool, VisitWebpageTool
    RESEARCH_TOOLS_AVAILABLE = True
except ImportError:
    logger.warning("Research tools unavailable (missing ddgs or related packages)")


# Keywords that indicate user wants research before planning
RESEARCH_KEYWORDS = [
    "research",
    "analyze pattern",
    "look up",
    "find out",
    "best practice",
    "industry standard",
    "common approach",
    "how do other",
    "what are common",
    "examples of",
    "typical",
    "standard way",
]


def get_research_tools() -> List[Tool]:
    """
    Get research tools for planning phase.

    Returns DuckDuckGoSearchTool and VisitWebpageTool if available.
    Returns empty list if dependencies are missing.
    """
    if not RESEARCH_TOOLS_AVAILABLE:
        logger.debug("Research tools not available, returning empty list")
        return []

    tools = [
        DuckDuckGoSearchTool(max_results=5),
        VisitWebpageTool(max_output_length=20000),
    ]
    logger.debug(f"Providing {len(tools)} research tools for planning")
    return tools


def detect_research_intent(task: str) -> bool:
    """
    Detect if user wants research before planning.

    Checks for keywords that indicate the user wants external research
    (patterns, best practices, industry standards) before creating a plan.

    Args:
        task: The user's task/request text

    Returns:
        True if research intent detected, False otherwise
    """
    if not task:
        return False

    task_lower = task.lower()
    for keyword in RESEARCH_KEYWORDS:
        if keyword in task_lower:
            logger.debug(f"Research intent detected: keyword '{keyword}' found")
            return True

    return False
