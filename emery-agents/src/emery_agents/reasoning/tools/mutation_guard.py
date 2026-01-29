"""
Mutation guard for DSPy tools.

Blocks mutations during planning phase.
Ported from tools/tool_modes.py and tools/crud_tools.py.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from emery_agents.services.context import get_current_context
from emery_agents.tools.tool_modes import MUTATION_METHODS, ToolMode

if TYPE_CHECKING:
    pass


def check_mutation_allowed(method: str) -> str | None:
    """
    Check if a mutation is allowed in the current execution context.

    During PLANNING phase, mutations (create, update, delete) are blocked.
    The agent should describe what it WILL do, not actually do it.

    Args:
        method: The method being called (e.g., "create_table", "delete_row")

    Returns:
        None if mutation is allowed.
        Error message string if mutation is blocked.
    """
    ctx = get_current_context()
    if ctx and ctx.tool_mode == ToolMode.PLANNING:
        method_lower = method.lower()
        if method_lower in MUTATION_METHODS:
            return (
                f"BLOCKED: Cannot {method} during planning phase. "
                f"Present your plan first, wait for user approval, then execute. "
                f"Describe what you WILL {method} in your plan."
            )
    return None
