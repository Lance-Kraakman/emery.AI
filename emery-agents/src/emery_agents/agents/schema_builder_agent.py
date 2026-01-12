"""
Schema Builder Managed Agent with Native Planning (HITL)

A specialized managed agent for designing database schemas from requirements.
Uses smolagents' planning_interval + step_callbacks for human-in-the-loop approval.

AIDEV-NOTE: This agent is designed for complex schema design tasks:
- Analyzing unstructured requirements (questionnaires, forms, specs)
- Proposing table structures with multiple fields
- Waiting for user approval before batch creating fields

AIDEV-NOTE: For single table operations (add one field, delete one field),
use table_builder instead which is autonomous and faster.

AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory between
calls. Regular managed agents reset memory on each __call__, but StatefulManagedAgent
passes reset=False to run() for HITL workflows.
"""

import logging
from typing import List, Any, Callable

from smolagents import Tool, CodeAgent
from smolagents.memory import PlanningStep
from smolagents.monitoring import LogLevel

from .stateful_managed_agent import StatefulManagedAgent
from ..prompts import build_agent_instructions, render_template

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
        logger.info(f"📋 Schema plan created, interrupting for user approval")
        logger.info(f"📋 Plan preview: {plan_preview}...")

        # Interrupt stops the agent's run loop
        # The plan will be streamed to the user via the normal step streaming
        # User's next message will resume with reset=False (memory preserved)
        agent.interrupt()

    return interrupt_for_approval


def create_schema_builder_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 15
) -> StatefulManagedAgent:
    """
    Create a Schema Builder agent with native planning and step callbacks.

    Uses smolagents' planning_interval + step_callbacks for human-in-the-loop
    approval workflow:

    1. Agent analyzes requirements (ActionStep)
    2. Agent lists existing tables/databases (ActionStep)
    3. Agent creates schema plan (PlanningStep) -> callback interrupts
    4. Plan is streamed to user, execution stops
    5. User responds (yes/no/modifications)
    6. Agent resumes with memory preserved, batch creates fields
    7. Agent verifies by listing created fields

    AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory
    between calls. This enables proper HITL workflows where the agent
    doesn't lose its plan when the user responds.

    Args:
        tools: List of table/field CRUD tools
        model: The LLM model to use
        max_steps: Maximum execution steps (default 15 for batch operations)

    Returns:
        Configured StatefulManagedAgent with planning and interruption
    """
    # Create the callback for planning interruption
    planning_callback = create_planning_callback()

    # Get instructions from centralized function (base + agent-specific + tools)
    instructions = build_agent_instructions(
        tools=tools,
        agent_type="schema_builder",
        context_type="interactive"  # HITL
    )

    # Use StatefulManagedAgent (CodeAgent-based) to preserve memory between calls
    # This is critical for HITL - regular agents reset memory on each __call__
    # StatefulManagedAgent.__init__ sets planning templates automatically
    #
    # AIDEV-NOTE: planning_interval=5 gives agent time to gather context:
    # - Step 1: list_databases (find existing)
    # - Step 2: list_tables (see what exists in target database)
    # - Step 3: list_fields (if updating existing table)
    # - Step 4: analyze requirements
    # - Step 5: THEN create plan with full context
    agent = StatefulManagedAgent(
        tools=tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,  # Custom instructions from Jinja2 template
        planning_interval=5,  # Plan after 5 steps (gathers full context first)
        step_callbacks={PlanningStep: planning_callback},
        verbosity_level=LogLevel.OFF,
    )

    # Override the initial_plan template with schema-specific detailed format
    # This replaces the generic plan.j2 which causes vague plans and hallucinated tools
    # The schema_builder_plan.j2 enforces:
    # - Field-by-field specifications with types and options
    # - Context gathering before planning
    # - Valid tool names (no "emery-*" hallucinations)
    agent.prompt_templates["planning"]["initial_plan"] = render_template(
        "planning/schema_builder_plan.j2"
    )

    # Set attributes for ManagedAgent identification
    # These are used by smolagents to route requests appropriately
    agent.name = "schema_builder"
    agent.description = (
        "Designs database schemas from requirements, questionnaires, or forms. "
        "Analyzes unstructured data, proposes table structure with all fields, "
        "waits for approval, then batch creates. Use for complex schema design."
    )

    logger.info(f"✨ Created Schema Builder agent (HITL CodeAgent) with planning_interval=5")
    logger.info(f"   Using custom planning template: planning/schema_builder_plan.j2")
    logger.info(f"   Tools: {[t.name for t in tools]}")
    logger.info(f"   Max steps: {max_steps}")

    return agent
