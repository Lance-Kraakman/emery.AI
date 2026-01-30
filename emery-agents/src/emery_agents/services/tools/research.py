"""
Research Tools Provider

Provides web research tools for the planning phase.
Conditionally enables research capabilities when user intent is detected.

DSPy Migration: Uses DSPy-compatible callable tools instead of smolagents.
"""

import logging
from typing import Callable, List, Any

logger = logging.getLogger(__name__)

# Track availability of research tools
RESEARCH_TOOLS_AVAILABLE = False

try:
    from duckduckgo_search import DDGS
    RESEARCH_TOOLS_AVAILABLE = True
except ImportError:
    logger.warning("Research tools unavailable (missing duckduckgo-search package)")




def duckduckgo_search(query: str, max_results: int = 5) -> str:
    """
    Search DuckDuckGo for web results.

    Args:
        query: Search query string
        max_results: Maximum number of results to return (default 5)

    Returns:
        Formatted search results as string
    """
    if not RESEARCH_TOOLS_AVAILABLE:
        return "Search unavailable - duckduckgo-search package not installed"

    try:
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=max_results))

        if not results:
            return f"No results found for: {query}"

        formatted = []
        for i, r in enumerate(results, 1):
            title = r.get("title", "No title")
            body = r.get("body", "No description")
            href = r.get("href", "")
            formatted.append(f"{i}. {title}\n   {body}\n   URL: {href}")

        return "\n\n".join(formatted)
    except Exception as e:
        logger.error(f"DuckDuckGo search failed: {e}")
        return f"Search failed: {e}"


def get_research_tools() -> List[Callable[..., Any]]:
    """
    Get research tools for planning phase.

    Returns DuckDuckGo search callable if available.
    Returns empty list if dependencies are missing.
    """
    if not RESEARCH_TOOLS_AVAILABLE:
        logger.debug("Research tools not available, returning empty list")
        return []

    # Return callable tools for DSPy
    tools = [duckduckgo_search]
    logger.debug(f"Providing {len(tools)} research tools for planning")
    return tools


