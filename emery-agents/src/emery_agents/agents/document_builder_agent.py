"""
Document Builder Managed Agent with Native Planning

A specialized managed agent for editing TipTap documents within the Emery platform.
Uses smolagents' planning_interval + step_callbacks for human-in-the-loop approval.

AIDEV-NOTE: This agent is designed to be used as a managed_agent within the main
agent. The main agent will automatically route to this agent based on
the agent's description when the user wants to edit documents.

AIDEV-NOTE: Uses native smolagents planning features:
- planning_interval=2: Generate a plan after 2 actions (more informed planning)
- step_callbacks: Interrupt after planning to wait for user approval
- reset=False: Preserve memory between messages for resumption

AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory between
calls. Regular managed agents reset memory on each __call__, but StatefulManagedAgent
passes reset=False to run() for HITL workflows.

AIDEV-NOTE: Instructions are loaded from Jinja2 template at prompts/agents/document_builder.j2
"""

import logging
from typing import List, Any, Callable

from smolagents import Tool, CodeAgent
from smolagents.memory import PlanningStep
from smolagents.monitoring import LogLevel

from .stateful_managed_agent import StatefulManagedAgent
from ..prompts import build_agent_instructions

logger = logging.getLogger(__name__)


def create_planning_callback() -> Callable[[PlanningStep, CodeAgent], None]:
    """
    Create a step callback that interrupts after planning for user approval.

    The callback is called synchronously during agent.run() when a PlanningStep
    is generated. Calling agent.interrupt() stops execution, and the plan is
    streamed to the user. The agent resumes on next message with reset=False.

    Returns:
        Callback function for PlanningStep interruption
    """
    def interrupt_for_approval(memory_step: PlanningStep, agent: CodeAgent) -> None:
        """Interrupt agent after plan is created, wait for user approval."""
        plan_preview = memory_step.plan[:200] if memory_step.plan else "(empty plan)"
        logger.info(f"📋 Plan created, interrupting for user approval")
        logger.info(f"📋 Plan preview: {plan_preview}...")

        # Interrupt stops the agent's run loop
        # The plan will be streamed to the user via the normal step streaming
        # User's next message will resume with reset=False (memory preserved)
        agent.interrupt()

    return interrupt_for_approval


def create_document_builder_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 10,
    progress_callback: Any = None
) -> StatefulManagedAgent:
    """
    Create a Document Builder agent with native planning and step callbacks.

    Uses smolagents' planning_interval + step_callbacks for human-in-the-loop
    approval workflow:

    1. Agent lists documents (ActionStep)
    2. Agent reads document (ActionStep)
    3. Agent creates plan (PlanningStep) -> callback interrupts
    4. Plan is streamed to user, execution stops
    5. User responds (yes/no/modifications)
    6. Agent resumes with memory preserved (StatefulManagedAgent)

    AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory
    between calls. This enables proper HITL workflows where the agent
    doesn't lose its plan when the user responds.

    Args:
        tools: List of document CRUD tools
        model: The LLM model to use
        max_steps: Maximum execution steps (default 10 for full workflow)

    Returns:
        Configured StatefulManagedAgent with planning and interruption
    """
    # Create the callback for planning interruption
    planning_callback = create_planning_callback()

    # Get instructions from centralized function (base + agent-specific + tools)
    instructions = build_agent_instructions(
        tools=tools,
        agent_type="document_builder",
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
        planning_interval=2,  # Plan after 2 steps (more informed - gathers context first)
        step_callbacks={PlanningStep: planning_callback},
        verbosity_level=LogLevel.OFF,
        progress_callback=progress_callback,  # For streaming nested steps to parent
    )

    # Set attributes for ManagedAgent identification
    # These are used by smolagents to route requests appropriately
    agent.name = "document_builder"
    agent.description = (
        "Specialized assistant for creating and editing documents. "
        "Use when user wants to CREATE a new document, modify document content, "
        "add sections, format text, or restructure documents. "
        "ALWAYS use this for any document-related task."
    )

    logger.info(f"✨ Created Document Builder agent (CodeAgent) with planning_interval=2")
    logger.info(f"   Tools: {[t.name for t in tools]}")

    return agent
