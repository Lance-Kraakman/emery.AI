"""
Async-safe execution context management.

AIDEV-NOTE: This module exists to avoid circular imports between
agent_executor.py and stateful_managed_agent.py. Both modules need
access to the current ExecutionContext, but agent_executor imports
from the agents module which imports stateful_managed_agent.

By extracting context management here, we break the circular dependency.

SECURITY: Uses contextvars.ContextVar instead of threading.local()
to prevent context leakage between async requests.
"""

import contextvars
from contextlib import contextmanager
from typing import TYPE_CHECKING, Any, Optional

from ...entities.execution_context import ExecutionContext

if TYPE_CHECKING:
    from ...tools.execution.skill import HumanSkillAwaitingException

# Async-safe context variable for ExecutionContext
_context_var: contextvars.ContextVar[ExecutionContext | None] = contextvars.ContextVar(
    "execution_context", default=None
)

# Context variable for human skill interrupt signal
# Used to pass HumanSkillAwaitingException from tool to executor
# (DSPy ReAct catches exceptions, so we signal via context instead)
_human_skill_awaiting_var: contextvars.ContextVar[Any] = contextvars.ContextVar(
    "human_skill_awaiting", default=None
)


def set_current_context(context: ExecutionContext | None) -> None:
    """Store execution context for skill access in current async context."""
    _context_var.set(context)


def get_current_context() -> Optional["ExecutionContext"]:
    """Get execution context for current async context (used by SkillTool, managed agents)."""
    return _context_var.get()


@contextmanager
def execution_scope(context: "ExecutionContext"):
    """Context manager ensuring proper cleanup of execution context.

    SECURITY: Always cleans up context even on exception,
        preventing sensitive data from leaking between requests.

        Usage:
            with execution_scope(context):
                # Execute agent task
                pass
            # Context is automatically cleaned up
    """
    token = _context_var.set(context)
    try:
        yield context
    finally:
        _context_var.reset(token)


# Human skill awaiting signal functions
# Used to pass HumanSkillAwaitingException from tool to executor
# since DSPy ReAct catches exceptions internally


def signal_human_skill_awaiting(exception: "HumanSkillAwaitingException") -> None:
    """Signal that a human skill is awaiting input.

    Called by skill tools when they detect a human skill needs input.
    The executor checks this after ReAct completes and re-raises the exception.
    """
    _human_skill_awaiting_var.set(exception)


def get_human_skill_awaiting() -> Optional["HumanSkillAwaitingException"]:
    """Get pending human skill exception, if any."""
    return _human_skill_awaiting_var.get()


def clear_human_skill_awaiting() -> None:
    """Clear the human skill awaiting signal."""
    _human_skill_awaiting_var.set(None)
