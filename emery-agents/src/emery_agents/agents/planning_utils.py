"""
Shared utilities for managed agents with planning.

AIDEV-NOTE: This module contains shared callbacks and utilities used by
managed agents that implement HITL (Human-in-the-Loop) workflows with
smolagents' planning features.

Extracted to avoid code duplication across builder agents.

AIDEV-NOTE: Uses a STATEFUL CALLBACK that tracks call count:
- First call (generic plan): Let agent continue to gather context
- Second call (detailed plan): Interrupt for user approval

This pattern matches schema_builder and ensures agents gather context
before presenting a plan to the user.
"""

import logging
from typing import Callable

from smolagents import CodeAgent
from smolagents.memory import PlanningStep

logger = logging.getLogger(__name__)


def create_planning_callback() -> Callable[[PlanningStep, CodeAgent], None]:
    """
    Create a stateful callback that only interrupts AFTER context gathering.

    The callback tracks how many times it's been called using a closure:
    - First call (step 1): Let agent continue to gather context - NO interrupt
    - Second call (step 4 with planning_interval=3): Interrupt for user approval

    This approach uses native smolagents HITL exactly as designed:
    - step_callbacks receives (memory_step, agent)
    - agent.interrupt() sets interrupt_switch = True
    - Resume with reset=False preserves memory

    AIDEV-NOTE: With planning_interval=3:
    - Step 1: PlanningStep (generic, pre-context) -> count=1, NO interrupt
    - Steps 2-3: ActionSteps (context gathering)
    - Step 4: PlanningStep (detailed, with context) -> count=2, INTERRUPT

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
        logger.info(f"📋 Detailed plan created, interrupting for user approval")
        logger.info(f"📋 Plan preview: {plan_preview}...")

        # Interrupt stops the agent's run loop
        # The plan will be streamed to the user via the normal step streaming
        # User's next message will resume with reset=False (memory preserved)
        agent.interrupt()

    return interrupt_for_approval
