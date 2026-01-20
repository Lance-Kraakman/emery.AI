"""
System Designer Managed Agent with Native Planning

A specialized managed agent for designing complete Emery automation systems.
Uses smolagents' planning_interval + step_callbacks for human-in-the-loop approval.

AIDEV-NOTE: This is the TOP-LEVEL ORCHESTRATOR that sits above specialized builders.
It understands the full Emery ecosystem (agents -> skills -> databases -> views -> apps)
and designs holistic solutions before delegating to specialists.

AIDEV-NOTE: System Designer does NOT have CRUD tools directly. It has managed agents:
- research_agent for system introspection + web research
- schema_builder for database/table design
- app_builder for app/page creation
- agent_builder for agent configuration
- skill_builder for skill definitions

It delegates actual resource creation to these specialists, each of which uses its
own planning_interval for HITL approval of complex operations.

AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory between
calls. Regular managed agents reset memory on each __call__, but StatefulManagedAgent
passes reset=False to run() for HITL workflows.

AIDEV-NOTE: Instructions loaded from prompts/agents/system_designer.j2
"""

import logging
from typing import List, Any, Callable, Optional

from smolagents import Tool, CodeAgent
from smolagents.memory import PlanningStep
from smolagents.monitoring import LogLevel

from .stateful_managed_agent import StatefulManagedAgent
from .planning_utils import create_planning_callback
from ..prompts import build_agent_instructions, render_capabilities

logger = logging.getLogger(__name__)


def create_system_designer_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 15,
    progress_callback: Any = None,
    # Managed agents for delegation (research_emery, and optionally specialized builders)
    managed_agents: Optional[List[Any]] = None,
    # Optional custom callback for plan interruption
    planning_callback: Callable[[PlanningStep, CodeAgent], None] | None = None,
) -> StatefulManagedAgent:
    """
    Create System Designer agent for holistic automation system design.

    Uses smolagents' planning_interval + step_callbacks for human-in-the-loop
    approval workflow:

    1. Agent researches existing resources via research_emery (ActionSteps)
    2. Agent asks clarifying questions about system requirements
    3. Agent creates system architecture plan (PlanningStep) -> callback interrupts
    4. Plan streamed to user, execution stops
    5. User responds (yes/no/modifications)
    6. Agent resumes with memory preserved, delegates to specialized builders

    AIDEV-NOTE: System Designer is unique because it orchestrates OTHER agents
    rather than executing CRUD operations directly. It has:
    - read-only tools (research_emery, web_search, visit_webpage)
    - managed_agents for delegation (schema_builder, app_builder, etc.)

    Args:
        tools: List of research tools (web_search, visit_webpage)
        model: The LLM model to use
        max_steps: Maximum execution steps (default 15 for comprehensive planning)
        progress_callback: Callback for streaming nested steps
        managed_agents: Specialized builders for delegation + research_emery
        planning_callback: Custom callback for plan interruption

    Returns:
        Configured StatefulManagedAgent with planning and interruption
    """
    # Use provided callback or create default
    effective_callback = planning_callback or create_planning_callback()

    # Build instructions from template
    instructions = build_agent_instructions(
        tools=tools,
        agent_type="system_designer",
        context_type="interactive"
    )

    # Create agent with HITL support
    # planning_interval=3: Research first, then create comprehensive system plan
    agent = StatefulManagedAgent(
        tools=tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,
        planning_interval=3,  # Plan after 3 steps (gather context first)
        step_callbacks={PlanningStep: effective_callback},
        verbosity_level=LogLevel.OFF,
        progress_callback=progress_callback,
        managed_agents=managed_agents,  # research_emery + specialized builders
    )

    # ManagedAgent identification
    agent.name = "system_designer"
    agent.description = (
        "Designs complete automation systems across Emery (databases, apps, agents, skills). "
        "Use when user wants to build a multi-component system, workflow, or end-to-end automation. "
        "Understands relationships between all Emery resources and orchestrates specialized builders. "
        "Creates system architecture plan and waits for approval before delegating."
    )
    agent.capabilities = render_capabilities("system_designer")

    logger.info(f"Created System Designer agent (CodeAgent) with planning_interval=3")
    logger.info(f"   Tools: {[t.name for t in tools]}")
    if managed_agents:
        agent_names = [a.name for a in managed_agents if hasattr(a, 'name')]
        logger.info(f"   Managed agents: {agent_names}")

    return agent
