"""
App Builder Managed Agent with Native Planning

A specialized managed agent for creating and editing Puck visual apps and pages.
Uses smolagents' planning_interval + step_callbacks for human-in-the-loop approval.

AIDEV-NOTE: This agent is designed to be used as a managed_agent within the main
agent. The main agent will automatically route to this agent based on
the agent's description when the user wants to modify apps or pages.

AIDEV-NOTE: Uses native smolagents planning features:
- planning_interval=3: Generate a plan after 3 actions (context gathering first)
- step_callbacks: Interrupt after second plan for user approval (skip first)
- reset=False: Preserve memory between messages for resumption

AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory between
calls. Regular managed agents reset memory on each __call__, but StatefulManagedAgent
passes reset=False to run() for HITL workflows.

AIDEV-NOTE: Instructions are loaded from Jinja2 template at prompts/agents/app_builder.j2
"""

import logging
from typing import List, Any, Callable

from smolagents import Tool, CodeAgent
from smolagents.memory import PlanningStep
from smolagents.monitoring import LogLevel

from .stateful_managed_agent import StatefulManagedAgent
from .planning_utils import create_planning_callback
from ..prompts import build_agent_instructions, render_capabilities

logger = logging.getLogger(__name__)


def create_app_builder_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 10,
    progress_callback: Any = None,
    # Optional managed agents (e.g., page_builder for delegation)
    managed_agents: list[Any] | None = None,
    # Optional custom callback for plan interruption
    planning_callback: Callable[[PlanningStep, CodeAgent], None] | None = None,
) -> StatefulManagedAgent:
    """
    Create an App Builder agent with native planning and step callbacks.

    Uses smolagents' planning_interval + step_callbacks for human-in-the-loop
    approval workflow:

    1. Agent lists/reads apps or pages (ActionStep)
    2. Agent gathers more context (ActionStep)
    3. Agent creates plan (PlanningStep) -> callback interrupts
    4. Plan is streamed to user, execution stops
    5. User responds (yes/no/modifications)
    6. Agent resumes with memory preserved (StatefulManagedAgent)

    AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory
    between calls. This enables proper HITL workflows where the agent
    doesn't lose its plan when the user responds.

    Args:
        tools: List of app/page CRUD tools (typically [tool_executor])
        model: The LLM model to use
        max_steps: Maximum execution steps (default 10 for full workflow)
        progress_callback: Callback for streaming nested steps
        managed_agents: Optional managed agents (e.g., page_builder for delegation)
        planning_callback: Custom callback for plan interruption

    Returns:
        Configured StatefulManagedAgent with planning and interruption
    """
    # Use provided callback or create default callback for planning interruption
    effective_callback = planning_callback if planning_callback is not None else create_planning_callback()

    # Get instructions from centralized function (base + agent-specific + tools)
    instructions = build_agent_instructions(
        tools=tools,
        agent_type="app_builder",
        context_type="interactive"
    )

    # Use StatefulManagedAgent (CodeAgent-based) to preserve memory between calls
    # This is critical for HITL - regular agents reset memory on each __call__
    # StatefulManagedAgent.__init__ sets planning templates automatically
    agent = StatefulManagedAgent(
        tools=tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,  # Custom instructions from Jinja2 template
        planning_interval=3,  # Plan after 3 steps (context gathering first, skip first plan)
        step_callbacks={PlanningStep: effective_callback},
        verbosity_level=LogLevel.OFF,
        progress_callback=progress_callback,  # For streaming nested steps to parent
        managed_agents=managed_agents,  # Optional page_builder for delegation
    )

    # Set attributes for ManagedAgent identification
    # These are used by smolagents to route requests appropriately
    agent.name = "app_builder"
    agent.description = (
        "Specialized assistant for creating and modifying Puck visual apps and pages. "
        "Use when user wants to create apps, manage pages, configure themes, "
        "or publish/unpublish pages. Proposes changes and waits for approval."
    )
    agent.capabilities = render_capabilities("app_builder")

    logger.info(f"✨ Created App Builder agent (CodeAgent) with planning_interval=3")
    logger.info(f"   Tools: {[t.name for t in tools]}")
    if managed_agents:
        logger.info(f"   Managed agents: {[a.name for a in managed_agents if hasattr(a, 'name')]}")

    return agent
