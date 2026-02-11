"""
Research Tools Provider

Provides web research tools for the planning phase.
Conditionally enables research capabilities when user intent is detected.

DSPy Migration: Uses DSPy-compatible callable tools instead of smolagents.
"""

import logging
from collections.abc import Callable

from ddgs import DDGS

logger = logging.getLogger(__name__)


def duckduckgo_search(query: str, max_results: int = 5) -> str:
    """
    Search DuckDuckGo for web results.

    Args:
        query: Search query string
        max_results: Maximum number of results to return (default 5)

    Returns:
        Formatted search results as string
    """
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


def get_research_tools() -> list[Callable[..., str]]:
    """
    Get research tools for planning phase.

    Returns DuckDuckGo search callable.
    """
    return [duckduckgo_search]
