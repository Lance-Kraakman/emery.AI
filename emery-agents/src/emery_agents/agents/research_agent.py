"""
Research Agent - Web search and information gathering for planning.

AIDEV-NOTE: This agent is designed for READ-ONLY information gathering.
It uses web search tools available during the planning phase to help
other agents make informed decisions.

AIDEV-NOTE: ResearchAgent can have ResearchEmery as a managed agent for
combined web + system research capabilities. When api_key and organization_id
are provided, ResearchEmery is automatically created as a sub-agent.

Unlike other managed agents, this one does NOT need HITL approval
because it only reads, never writes.
"""

import logging
from typing import Any, List, Optional, Callable

from smolagents import DuckDuckGoSearchTool, VisitWebpageTool, ToolCallingAgent, Tool, CodeAgent
from smolagents.memory import PlanningStep
from smolagents.monitoring import LogLevel

from ..prompts import build_agent_instructions, render_capabilities

logger = logging.getLogger(__name__)


def create_research_agent(
    model: Any,
    additional_tools: Optional[List[Tool]] = None,
    max_steps: int = 10,
    # Optional custom callback for plan interruption
    planning_callback: Optional[Callable[[PlanningStep, CodeAgent], None]] = None,
    # Optional managed agents (ResearchEmery)
    managed_agents: Optional[List[Any]] = None,
    # Auth context for creating ResearchEmery as managed agent
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None,
) -> ToolCallingAgent:
    """
    Create research agent for web search and information gathering.

    This agent is designed for the interactive planning loop.
    It uses read-only tools (web_search, web_fetch) to gather
    information that helps other agents create better plans.

    AIDEV-NOTE: Uses ToolCallingAgent (not CodeAgent) because research
    is purely tool-based with no code generation needed.

    AIDEV-NOTE: Can optionally have ResearchEmery as a managed agent for
    system introspection. If api_key and organization_id are provided,
    ResearchEmery is automatically created and added.

    Args:
        model: The LLM model to use
        additional_tools: Extra tools to include (e.g., file_reader)
        max_steps: Maximum agent steps (default 10)
        planning_callback: Optional callback for plan interruption
        managed_agents: Optional list of managed sub-agents
        api_key: API key for ResearchEmery (if auto-creating)
        organization_id: Organization ID for ResearchEmery (if auto-creating)

    Returns:
        Configured ToolCallingAgent for research tasks
    """
    from .research_emery_agent import create_research_emery_agent

    # Core research tools - instantiate at creation time
    research_tools: List[Tool] = [
        DuckDuckGoSearchTool(max_results=5),
        VisitWebpageTool(max_output_length=40000),
    ]

    all_tools = research_tools + (additional_tools or [])

    # Build managed agents list
    effective_managed_agents = list(managed_agents or [])

    # Auto-create ResearchEmery as managed agent if auth context provided
    if api_key and organization_id:
        research_emery = create_research_emery_agent(
            model=model,
            api_key=api_key,
            organization_id=organization_id,
            max_steps=8,
            planning_callback=planning_callback,
        )
        effective_managed_agents.append(research_emery)
        logger.info(f"   Added ResearchEmery as managed agent for system introspection")

    # Use centralized prompt system - composes base + agent-specific + tools
    instructions = build_agent_instructions(
        tools=all_tools,
        agent_type="research",
        context_type="interactive",
        managed_agents=effective_managed_agents if effective_managed_agents else None
    )

    # Build step_callbacks if planning_callback provided
    step_callbacks = {PlanningStep: planning_callback} if planning_callback else None

    agent = ToolCallingAgent(
        tools=all_tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,  # smolagents uses 'instructions', not 'system_prompt'
        verbosity_level=LogLevel.OFF,
        step_callbacks=step_callbacks,
        planning_interval=3 if planning_callback else None,  # Enable planning if callback
        managed_agents=effective_managed_agents if effective_managed_agents else None,
    )

    # Required attributes for ManagedAgent protocol
    # These enable TaskClassifier routing based on capabilities
    agent.name = "research_agent"
    agent.description = (
        "Researches topics online and the Emery system. "
        "For web: searches DuckDuckGo, visits pages, synthesizes information. "
        "For system: queries agents, skills, tasks, tables, apps, audit via ResearchEmery. "
        "Use for: 'what agents/skills/tables do I have', 'show me my organization', "
        "'list my databases', 'what's in my system', 'research my data', "
        "'search for', 'look up', 'find information about', 'what is', 'who is'"
    )
    # Use render_capabilities to extract from template's {% block capabilities %}
    agent.capabilities = render_capabilities("research")

    logger.info(f"✨ Created Research agent (read-only)")
    logger.info(f"   Tools: {[t.name for t in all_tools]}")
    logger.info(f"   Managed agents: {[a.name for a in effective_managed_agents] if effective_managed_agents else 'None'}")
    logger.info(f"   Max steps: {max_steps}")

    return agent
