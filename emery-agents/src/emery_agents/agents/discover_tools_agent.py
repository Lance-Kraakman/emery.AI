"""
Discover Tools Agent - Integration discovery and connection checking.

AIDEV-NOTE: This agent is designed for READ-ONLY integration discovery.
It helps users find available Pipedream tools and check their OAuth
connections. All operations are read-only and safe for planning phase.

Unlike other managed agents, this one does NOT need HITL approval
because it only reads, never writes.
"""

import logging
from typing import Any, List, Optional, Callable

from smolagents import ToolCallingAgent, Tool, CodeAgent
from smolagents.memory import PlanningStep
from smolagents.monitoring import LogLevel

from ..prompts import build_agent_instructions, render_capabilities
from ..tools.integration_discovery import get_integration_discovery_tools

logger = logging.getLogger(__name__)


def create_discover_tools_agent(
    model: Any,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None,
    additional_tools: Optional[List[Tool]] = None,
    max_steps: int = 10,
    # Optional overrides for cascade planning (SubAgentPlanner)
    planning_callback: Optional[Callable[[PlanningStep, CodeAgent], None]] = None,
    planning_only: bool = False,
    extra_tools: Optional[List[Tool]] = None,
) -> ToolCallingAgent:
    """
    Create discover_tools agent for integration discovery.

    This agent helps users:
    - Find available Pipedream integrations/apps
    - Search for specific tools by keyword or category
    - Check which apps they have connected
    - Get detailed tool schemas for planning

    AIDEV-NOTE: Uses ToolCallingAgent (not CodeAgent) because discovery
    is purely tool-based with no code generation needed.

    AIDEV-NOTE: This is a READ-ONLY agent. No HITL approval needed
    because it only reads tool metadata and connection status.

    Args:
        model: The LLM model to use
        api_key: API key for authenticated requests (checking connections)
        organization_id: Organization context for RLS
        additional_tools: Extra tools to include
        max_steps: Maximum agent steps (default 10)
        planning_callback: Optional callback for cascade planning
        planning_only: Whether in planning-only mode
        extra_tools: Additional tools for cascade planning

    Returns:
        Configured ToolCallingAgent for integration discovery
    """
    # Get integration discovery tools with auth context
    discovery_tools = get_integration_discovery_tools(
        api_key=api_key,
        organization_id=organization_id
    )

    all_tools = discovery_tools + (additional_tools or [])

    # Merge extra_tools if provided (for cascade planning question tool)
    if extra_tools:
        all_tools = all_tools + extra_tools

    # Use centralized prompt system
    context_type = "planning_only" if planning_only else "interactive"
    instructions = build_agent_instructions(
        tools=all_tools,
        agent_type="discover_tools",
        context_type=context_type,
    )

    # Build step_callbacks if planning_callback provided
    step_callbacks = {PlanningStep: planning_callback} if planning_callback else None

    agent = ToolCallingAgent(
        tools=all_tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,
        verbosity_level=LogLevel.OFF,
        step_callbacks=step_callbacks,
        planning_interval=3 if planning_callback else None,
    )

    # Required attributes for ManagedAgent protocol
    agent.name = "discover_tools"
    agent.description = (
        "Discovers available Pipedream integrations and tools. "
        "Can search for tools by keyword, category, or app. "
        "Checks user's OAuth connections to determine which tools are ready to use. "
        "Use for: 'find tools for email', 'what integrations are available', "
        "'is Slack connected', 'search for notification tools', "
        "'what tools can I use for messaging'"
    )
    # Use render_capabilities to extract from template
    agent.capabilities = render_capabilities("discover_tools")

    logger.info(f"Created Discover Tools agent (read-only)")
    logger.info(f"   Tools: {[t.name for t in all_tools]}")
    logger.info(f"   Max steps: {max_steps}")

    return agent
