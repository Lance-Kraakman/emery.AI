"""
Research Agent - Web search and information gathering for planning.

AIDEV-NOTE: This agent is designed for READ-ONLY information gathering.
It uses web search tools available during the planning phase to help
other agents make informed decisions.

Unlike other managed agents, this one does NOT need HITL approval
because it only reads, never writes.
"""

import logging
from typing import Any, List, Optional

from smolagents import DuckDuckGoSearchTool, VisitWebpageTool, ToolCallingAgent, Tool
from smolagents.monitoring import LogLevel

from ..prompts import build_agent_instructions, render_capabilities

logger = logging.getLogger(__name__)


def create_research_agent(
    model: Any,
    additional_tools: Optional[List[Tool]] = None,
    max_steps: int = 10,
) -> ToolCallingAgent:
    """
    Create research agent for web search and information gathering.

    This agent is designed for the interactive planning loop.
    It uses read-only tools (web_search, web_fetch) to gather
    information that helps other agents create better plans.

    AIDEV-NOTE: Uses ToolCallingAgent (not CodeAgent) because research
    is purely tool-based with no code generation needed.

    Args:
        model: The LLM model to use
        additional_tools: Extra tools to include (e.g., file_reader)
        max_steps: Maximum agent steps (default 10)

    Returns:
        Configured ToolCallingAgent for research tasks
    """
    # Core research tools - instantiate at creation time
    research_tools: List[Tool] = [
        DuckDuckGoSearchTool(max_results=5),
        VisitWebpageTool(max_output_length=40000),
    ]

    all_tools = research_tools + (additional_tools or [])

    # Use centralized prompt system - composes base + agent-specific + tools
    instructions = build_agent_instructions(
        tools=all_tools,
        agent_type="research",
        context_type="interactive"  # Read-only research context
    )

    agent = ToolCallingAgent(
        tools=all_tools,
        model=model,
        max_steps=max_steps,
        system_prompt=instructions,
        verbosity_level=LogLevel.OFF,
    )

    # Required attributes for ManagedAgent protocol
    # These enable TaskClassifier routing based on capabilities
    agent.name = "research_agent"
    agent.description = (
        "Researches topics online, searches the web, visits pages, "
        "and synthesizes information. Use for: 'search for', 'look up', "
        "'find information about', 'research', 'what is', 'who is'"
    )
    # Use render_capabilities to extract from template's {% block capabilities %}
    agent.capabilities = render_capabilities("research")

    logger.info(f"✨ Created Research agent (read-only)")
    logger.info(f"   Tools: {[t.name for t in all_tools]}")
    logger.info(f"   Max steps: {max_steps}")

    return agent
