"""
Page Builder Managed Agent with Native Planning

A specialized managed agent for creating and editing Puck visual pages.
Uses smolagents' planning_interval + step_callbacks for human-in-the-loop approval.

AIDEV-NOTE: This agent is designed to be used as a managed_agent within the main
agent or called directly for page-specific tasks. The main agent will automatically
route to this agent based on the agent's description when the user wants to create
or edit Puck pages.

AIDEV-NOTE: Unlike app_builder which gets tool_executor (wrapped tools), this agent
gets page_crud DIRECTLY so it receives the full page_crud.j2 instructions including
the complete Puck block schema. This prevents hallucination of block types.

AIDEV-NOTE: Has optional access to research_agent for analyzing reference websites
when creating pages that should replicate external designs (e.g., "create page like flaxx.ai").

AIDEV-NOTE: Uses native smolagents planning features:
- planning_interval=3: Generate a plan after 3 actions (research, gather context, then plan)
- step_callbacks: Interrupt after planning to wait for user approval
- reset=False: Preserve memory between messages for resumption

AIDEV-NOTE: Instructions are loaded from Jinja2 template at prompts/agents/page_builder.j2
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


def create_page_builder_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 15,
    progress_callback: Any = None,
    # Optional research capability
    managed_agents: Optional[List[Any]] = None,
    # Optional overrides for cascade planning (SubAgentPlanner)
    planning_callback: Callable[[PlanningStep, CodeAgent], None] | None = None,
    planning_only: bool = False,
    extra_tools: List[Tool] | None = None,
) -> StatefulManagedAgent:
    """
    Create a Page Builder agent with native planning, step callbacks, and optional research.

    Uses smolagents' planning_interval + step_callbacks for human-in-the-loop
    approval workflow:

    1. Agent optionally researches reference URL (via research_agent managed agent)
    2. Agent lists existing pages (ActionStep)
    3. Agent reads page structure (ActionStep)
    4. Agent creates plan (PlanningStep) -> callback interrupts
    5. Plan is streamed to user, execution stops
    6. User responds (yes/no/modifications)
    7. Agent resumes with memory preserved (StatefulManagedAgent)
    8. Agent builds templateData with correct Puck blocks
    9. Agent executes page_crud to create/update page

    AIDEV-NOTE: This agent receives page_crud DIRECTLY (not via tool_executor) so that
    build_agent_instructions() includes the full page_crud.j2 template with all 38 Puck
    block definitions. This prevents the agent from hallucinating block types like
    "HeroSection" instead of using "Hero".

    AIDEV-NOTE: Optional managed_agents parameter allows passing research_agent for
    analyzing reference websites. The agent can delegate research tasks to understand
    external designs before building pages.

    Args:
        tools: List of page CRUD tools (should include page_crud directly)
        model: The LLM model to use
        max_steps: Maximum execution steps (default 15 for research + full workflow)
        progress_callback: Callback for streaming nested steps
        managed_agents: Optional list of managed agents (e.g., research_agent)
        planning_callback: Custom callback for plan interruption
        planning_only: Whether in planning-only mode (cascade planning)
        extra_tools: Additional tools for cascade planning

    Returns:
        Configured StatefulManagedAgent with planning and interruption
    """
    # Use provided callback or create default callback for planning interruption
    effective_callback = planning_callback if planning_callback is not None else create_planning_callback()

    # Get instructions from centralized function (base + agent-specific + tools)
    # Use planning_only context for cascade sub-planning
    context_type = "planning_only" if planning_only else "interactive"
    instructions = build_agent_instructions(
        tools=tools,
        agent_type="page_builder",
        context_type=context_type
    )

    # Merge extra_tools if provided (for cascade planning question tool)
    effective_tools = list(tools)
    if extra_tools:
        effective_tools.extend(extra_tools)

    # Use StatefulManagedAgent (CodeAgent-based) to preserve memory between calls
    # This is critical for HITL - regular agents reset memory on each __call__
    # StatefulManagedAgent.__init__ sets planning templates automatically
    agent = StatefulManagedAgent(
        tools=effective_tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,  # Custom instructions from Jinja2 template
        planning_interval=3,  # Plan after 3 steps (research, context, then plan)
        step_callbacks={PlanningStep: effective_callback},
        verbosity_level=LogLevel.OFF,
        progress_callback=progress_callback,  # For streaming nested steps to parent
        managed_agents=managed_agents,  # Optional research_agent for URL analysis
    )

    # Set attributes for ManagedAgent identification
    # These are used by smolagents to route requests appropriately
    agent.name = "page_builder"
    agent.description = (
        "Specialized agent for creating and editing Puck visual pages. "
        "Use when user wants to CREATE pages, design page layouts, add content blocks, "
        "or replicate external website designs. Has full knowledge of all 38 Puck block types. "
        "Can analyze reference URLs to understand designs before building."
    )
    agent.capabilities = render_capabilities("page_builder")

    logger.info(f"✨ Created Page Builder agent (CodeAgent) with planning_interval=3")
    logger.info(f"   Tools: {[t.name for t in tools]}")
    if managed_agents:
        logger.info(f"   Managed agents: {[a.name for a in managed_agents if hasattr(a, 'name')]}")

    return agent
