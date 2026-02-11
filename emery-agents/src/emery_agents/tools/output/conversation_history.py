"""
Conversation History Tool — Returns recent chat messages for context.

Closure pattern (same as memory_crud, ask_question). Captures the
conversation history list and returns formatted last 10 messages.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from ...orchestrators.runtime import format_conversation_history


def create_conversation_history_tool(
    conversation_history: list[Any],
) -> Callable[..., str]:
    """
    Factory: Create get_conversation_history function with history captured in closure.

    Args:
        conversation_history: List of ConversationMessage instances from RuntimeContext.

    Returns:
        get_conversation_history function that DSPy ReAct can use.
    """

    def get_conversation_history() -> str:
        """Get recent messages from the current chat session (last 10).

        Returns "role: content" lines. Use to understand follow-up questions
        or what the user said previously in this session.
        """
        return (
            format_conversation_history(conversation_history)
            or "No conversation history."
        )

    return get_conversation_history
