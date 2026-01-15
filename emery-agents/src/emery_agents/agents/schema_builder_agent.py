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

AIDEV-NOTE: Uses a STATEFUL CALLBACK to skip the first PlanningStep (before context
gathering) and only interrupt on the second PlanningStep (after context is gathered).
This allows the agent to list databases/tables before creating a detailed plan.
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
    Create a stateful callback that only interrupts AFTER context gathering.

    The callback tracks how many times it's been called using a closure:
    - First call (step 1): Let agent continue to gather context - NO interrupt
    - Second call (step 4): Interrupt for user approval

    This approach uses native smolagents HITL exactly as designed:
    - step_callbacks receives (memory_step, agent)
    - agent.interrupt() sets interrupt_switch = True
    - Resume with reset=False preserves memory

    Returns:
        Callback function with closure tracking call count
    """
    call_count = [0]  # Use list for mutable closure

    def interrupt_for_approval(memory_step: PlanningStep, agent: CodeAgent) -> None:
        """
        Callback invoked after each PlanningStep.

        With planning_interval=3:
        - Step 1: PlanningStep (generic, pre-context) -> count=1, NO interrupt
        - Steps 2-3: ActionSteps (context gathering)
        - Step 4: PlanningStep (detailed, with context) -> count=2, INTERRUPT
        """
        call_count[0] += 1

        # SKIP first plan (before context gathering)
        if call_count[0] == 1:
            logger.info("📋 Initial plan created (pre-context), continuing to gather context...")
            return  # Don't interrupt - let agent gather context first

        # Interrupt on subsequent plans (after context gathered)
        plan_preview = memory_step.plan[:300] if memory_step.plan else "(empty plan)"
        logger.info(f"📋 Detailed schema plan created, interrupting for user approval")
        logger.info(f"📋 Plan preview: {plan_preview}...")

        # Interrupt stops the agent's run loop
        # The plan will be streamed to the user via the normal step streaming
        # User's next message will resume with reset=False (memory preserved)
        agent.interrupt()

    return interrupt_for_approval


def create_schema_builder_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 20,
    progress_callback: Any = None
) -> StatefulManagedAgent:
    """
    Create Schema Builder agent with proper native HITL workflow.

    Uses smolagents' native planning + step_callbacks for human-in-the-loop:

    Step Flow with planning_interval=3:
    1. PlanningStep (generic) -> callback skips interrupt (count=1)
    2. ActionStep: list databases
    3. ActionStep: list tables
    4. PlanningStep (detailed) -> callback interrupts for approval (count=2)
    5+ On approval: Execute plan (create fields)

    AIDEV-NOTE: Uses StatefulManagedAgent (CodeAgent-based) to preserve memory
    between calls. This enables proper HITL workflows where the agent
    doesn't lose its plan when the user responds.

    AIDEV-NOTE: The callback is STATEFUL - it tracks how many times it's been
    called and only interrupts on the SECOND plan (after context gathering).

    Args:
        tools: List of CRUD tools (database_crud, table_crud, field_crud)
        model: The LLM model to use
        max_steps: Maximum execution steps (default 20 for batch operations)

    Returns:
        Configured StatefulManagedAgent with HITL planning
    """
    # Get instructions from centralized function (base + agent-specific + tools)
    instructions = build_agent_instructions(
        tools=tools,
        agent_type="schema_builder",
        context_type="interactive"  # HITL
    )

    # Create the STATEFUL callback for planning interruption
    # This callback skips the first plan and interrupts on the second
    planning_callback = create_planning_callback()

    # Use StatefulManagedAgent (CodeAgent-based) to preserve memory between calls
    # This is critical for HITL - regular agents reset memory on each __call__
    agent = StatefulManagedAgent(
        tools=tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,
        planning_interval=3,  # Plan at step 1, then step 4 (after 3 action steps)
        step_callbacks={PlanningStep: planning_callback},
        verbosity_level=LogLevel.OFF,
        progress_callback=progress_callback,  # For streaming nested steps to parent
    )

    # Set attributes for ManagedAgent identification
    # These are used by smolagents to route requests appropriately
    agent.name = "schema_builder"
    agent.description = (
        "Designs database schemas from requirements, questionnaires, or forms. "
        "Gathers context first, creates detailed field-by-field plan, "
        "waits for approval, then batch creates. Use for complex schema design."
    )

    logger.info(f"✨ Created Schema Builder agent (native HITL)")
    logger.info(f"   planning_interval=3 (plan at steps 1, 4, 7...)")
    logger.info(f"   Callback skips first plan, interrupts on second")
    logger.info(f"   Tools: {[t.name for t in tools]}")
    logger.info(f"   Max steps: {max_steps}")

    return agent
