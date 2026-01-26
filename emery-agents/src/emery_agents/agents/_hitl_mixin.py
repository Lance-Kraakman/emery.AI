"""HITL state management utilities for interrupt-aware execution.

Provides helpers for Human-In-The-Loop workflows with DSPy modules.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from ..reasoning.modules import InterruptRequested, TrackedStep, StepType
from ..services.context_manager import get_current_context
from ..tools.tool_modes import ToolMode

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class HITLState:
    """Tracks HITL state for interrupt handling."""

    def __init__(self) -> None:
        self.interrupted_agent_name: str | None = None
        self.interrupt_switch: bool = False
        self.resume_state: dict[str, Any] | None = None

    def is_interrupted(self) -> bool:
        """Check if there's a pending interrupt."""
        return self.interrupted_agent_name is not None

    def clear(self) -> None:
        """Clear interrupt state."""
        self.interrupted_agent_name = None
        self.interrupt_switch = False
        self.resume_state = None

    def store_interrupt(self, agent_name: str, state: dict[str, Any] | None = None) -> None:
        """Store interrupted agent info."""
        self.interrupted_agent_name = agent_name
        self.interrupt_switch = True
        self.resume_state = state
        logger.info(f"Stored interrupted agent: {agent_name}")


def is_approval_response(task: str) -> bool:
    """
    Check if task is a structured approval response.

    AIDEV-NOTE: Only accepts "approve" from UI button.
    Any other text is feedback for the orchestrator.
    """
    return task.lower().strip() == "approve"


def handle_hitl_resume(
    task: str,
    hitl_state: HITLState,
    agent_modules: dict[str, Any] | None = None,
) -> Any | None:
    """
    Handle HITL resume by routing approval to interrupted agent.

    Args:
        task: The user's response
        hitl_state: Current HITL state
        agent_modules: Dict of available agent modules

    Returns:
        Result from resumed agent, or None if no pending interrupt or not approved
    """
    if not hitl_state.is_interrupted():
        return None

    # Check if this is feedback (not approval)
    if not is_approval_response(task):
        logger.info("Feedback received (not approval), clearing interrupt state")
        hitl_state.clear()
        return None

    agent_name = hitl_state.interrupted_agent_name
    logger.info(f"HITL Resume: Routing to {agent_name}")

    # Switch to EXECUTION mode after approval
    ctx = get_current_context()
    if ctx:
        ctx.tool_mode = ToolMode.EXECUTION
        logger.info("HITL: Switched to EXECUTION mode")

    # Get resume state before clearing
    resume_state = hitl_state.resume_state
    hitl_state.clear()

    if agent_modules and agent_name in agent_modules:
        agent_module = agent_modules[agent_name]
        try:
            # Resume with stored state if available
            if resume_state:
                result = agent_module.forward(**resume_state)
            else:
                result = agent_module.forward(step_description=task, context="{}")
            logger.info(f"HITL Resume: {agent_name} completed successfully")
            return result
        except InterruptRequested as e:
            # Another interrupt - store and propagate
            hitl_state.store_interrupt(agent_name, e.state)
            logger.info(f"HITL Resume: {agent_name} interrupted again")
            raise
    else:
        logger.warning(f"Interrupted agent '{agent_name}' not found")

    return None


def create_final_step(result: str) -> TrackedStep:
    """Create a final answer step for streaming compatibility."""
    return TrackedStep(
        step_type=StepType.FINAL,
        content=result,
    )
