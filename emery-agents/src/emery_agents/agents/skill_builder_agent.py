"""
Skill Builder Managed Agent with Native Planning

A specialized managed agent for modifying skills within the Emery platform.
Uses smolagents' planning_interval + step_callbacks for human-in-the-loop approval.

AIDEV-NOTE: This agent is designed to be used as a managed_agent within the main
agent. The main agent will automatically route to this agent based on
the agent's description when the user wants to modify skills.

AIDEV-NOTE: Uses native smolagents planning features:
- planning_interval=2: Generate a plan after 2 actions (more informed planning)
- step_callbacks: Interrupt after planning to wait for user approval
- reset=False: Preserve memory between messages for resumption

AIDEV-NOTE: smolagents uses `instructions` parameter (not `system_prompt`) to add
custom instructions to the agent. These are inserted into the default system prompt.

AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory between
calls. Regular managed agents reset memory on each __call__, but StatefulManagedAgent
passes reset=False to run() for HITL workflows.

AIDEV-NOTE: Instructions are loaded from Jinja2 template at prompts/agents/skill_builder.j2
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


def create_skill_builder_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 10,
    progress_callback: Any = None,
    # Optional overrides for cascade planning (SubAgentPlanner)
    planning_callback: Callable[[PlanningStep, CodeAgent], None] | None = None,
    planning_only: bool = False,
    extra_tools: List[Tool] | None = None,
) -> StatefulManagedAgent:
    """
    Create a Skill Builder agent with native planning and step callbacks.

    Uses smolagents' planning_interval + step_callbacks for human-in-the-loop
    approval workflow:

    1. Agent lists/reads skill (ActionStep)
    2. Agent gathers more context (ActionStep)
    3. Agent creates plan (PlanningStep) -> callback interrupts
    4. Plan is streamed to user, execution stops
    5. User responds (yes/no/modifications)
    6. Agent resumes with memory preserved (StatefulManagedAgent)

    AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory
    between calls. This enables proper HITL workflows where the agent
    doesn't lose its plan when the user responds.

    Args:
        tools: List of skill CRUD tools
        model: The LLM model to use
        max_steps: Maximum execution steps (default 10 for full workflow)

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
        agent_type="skill_builder",
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
        planning_interval=2,  # Plan after 2 steps (more informed - gathers context first)
        step_callbacks={PlanningStep: effective_callback},
        verbosity_level=LogLevel.OFF,
        progress_callback=progress_callback,  # For streaming nested steps to parent
    )

    # Set attributes for ManagedAgent identification
    # These are used by smolagents to route requests appropriately
    agent.name = "skill_builder"
    agent.description = (
        "Specialized assistant for modifying skills. "
        "Use when user wants to update skill name, description, instructions, "
        "inputs, outputs, tools, or model. Proposes changes and waits for approval."
    )
    agent.capabilities = render_capabilities("skill_builder")

    logger.info(f"✨ Created Skill Builder agent (CodeAgent) with planning_interval=2")
    logger.info(f"   Tools: {[t.name for t in tools]}")

    return agent
