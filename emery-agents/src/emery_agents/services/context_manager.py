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
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..entities.execution_context import ExecutionContext


# Async-safe context variable for ExecutionContext
_context_var: contextvars.ContextVar[Optional["ExecutionContext"]] = \
    contextvars.ContextVar('execution_context', default=None)


def set_current_context(context: Optional["ExecutionContext"]) -> None:
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
