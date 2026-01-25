"""
ResearchEmery Agent - System introspection for planning.

AIDEV-NOTE: This agent researches the INTERNAL Emery system (agents, skills,
tasks, tables, apps, audit). It complements ResearchAgent which handles
WEB research (DuckDuckGo, web fetch).

AIDEV-NOTE: Uses ToolCallingAgent (not CodeAgent) because system research
is purely tool-based with no code generation needed.

AIDEV-NOTE: Uses READ-ONLY tools - safe for planning phase without HITL approval.
This agent can be used as a managed agent of ResearchAgent for combined
web + system research capabilities.
"""

import logging
from typing import Any, List, Optional, Callable

from smolagents import ToolCallingAgent, Tool, CodeAgent
from smolagents.memory import PlanningStep
from smolagents.monitoring import LogLevel

from ..prompts import build_agent_instructions, render_capabilities
from ..dspy_modules.tools.analysis import create_system_research_tool

logger = logging.getLogger(__name__)


def create_research_emery_agent(
    model: Any,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None,
    additional_tools: Optional[List[Tool]] = None,
    max_steps: int = 10,
    # Optional custom callback for plan interruption
    planning_callback: Optional[Callable[[PlanningStep, CodeAgent], None]] = None,
) -> ToolCallingAgent:
    """
    Create ResearchEmery agent for system introspection.

    Provides READ-ONLY access to Emery platform resources:
    - Agents: configuration, automations, plans
    - Skills: instructions, inputs, outputs, tools
    - Tasks: history, logs, results
    - Tables: schema, fields, databases
    - Apps: pages, themes
    - Audit: events, resource trails

    AIDEV-NOTE: This agent is designed for the interactive planning loop.
    It uses read-only tools (system_research) to gather information about
    the Emery platform to help other agents create better plans.

    AIDEV-NOTE: Can be used as a managed agent of ResearchAgent for combined
    web + system research capabilities.

    Args:
        model: The LLM model to use
        api_key: API key for authenticated requests
        organization_id: Organization context for RLS
        additional_tools: Extra tools to include
        max_steps: Maximum agent steps (default 10)
        planning_callback: Optional callback for plan interruption

    Returns:
        Configured ToolCallingAgent for system research
    """
    # Core system research tool with auth context
    system_research = create_system_research_tool(
        api_key=api_key,
        organization_id=organization_id
    )

    research_tools: List[Tool] = [system_research]

    # Add any additional tools
    all_tools = research_tools + (additional_tools or [])

    # Use centralized prompt system - composes base + agent-specific + tools
    instructions = build_agent_instructions(
        tools=all_tools,
        agent_type="research_emery",
        context_type="interactive"
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
    )

    # Required attributes for ManagedAgent protocol
    # These enable TaskClassifier routing based on capabilities
    agent.name = "research_emery"
    agent.description = (
        "Researches the Emery platform: finds agents, skills, tasks, tables, apps, and audit history. "
        "Use for: 'what do I have', 'show my organization', 'list my agents/skills/tables/databases', "
        "'what agents exist', 'find skill', 'task history', 'show audit events', "
        "'what's configured', 'explore my system', 'what resources exist'"
    )
    # Use render_capabilities to extract from template's {% block capabilities %}
    agent.capabilities = render_capabilities("research_emery")

    logger.info(f"✨ Created ResearchEmery agent (read-only system introspection)")
    logger.info(f"   Tools: {[t.name for t in all_tools]}")
    logger.info(f"   Max steps: {max_steps}")

    return agent
