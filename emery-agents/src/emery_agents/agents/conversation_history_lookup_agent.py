"""
Conversation History Lookup Agent - Searches chat messages during planning.

Used during PLANNING to resolve references to prior discussion:
- "option 1", "option 2"
- "what you said earlier"
- "your suggestion"
- "the plan you proposed"

NOT for step execution results - use ExecutionContext for that.
"""

import logging
from typing import Any, List, Optional

from smolagents import ToolCallingAgent
from smolagents.monitoring import LogLevel

from ..tools.conversation_history_lookup_tool import ConversationHistoryLookupTool
from ..prompts import build_agent_instructions, render_capabilities

logger = logging.getLogger(__name__)


def create_conversation_history_lookup_agent(
    model: Any,
    conversation_history: List[Any],
    max_steps: int = 5,
) -> ToolCallingAgent:
    """
    Create agent for searching conversation history during PLANNING.

    Used when user references prior discussion:
    - "option 1", "what you said"
    - "your suggestion earlier"
    - References to previous messages

    Args:
        model: The LLM model to use
        conversation_history: List of message objects from the chat session
        max_steps: Maximum agent steps (default 5)

    Returns:
        Configured ToolCallingAgent for conversation history lookup
    """
    # Create the lookup tool with conversation history
    lookup_tool = ConversationHistoryLookupTool(conversation_history)

    # Build instructions - may fall back to generic if template doesn't exist
    try:
        instructions = build_agent_instructions(
            tools=[lookup_tool],
            agent_type="conversation_history_lookup",
        )
    except Exception:
        # Fallback if template doesn't exist yet
        instructions = """You are the Conversation History Lookup agent.
Your role is to search the chat history when users reference prior discussion.

## Data Source
- Chat messages (user + assistant)
- NOT execution results (use ExecutionContext for that)

## When to Use
- User says "option 1", "option 2", etc.
- User references "what you said", "earlier", "above"
- User mentions "your suggestion", "the plan you proposed"

Use the search_conversation tool to find relevant content."""

    agent = ToolCallingAgent(
        tools=[lookup_tool],
        model=model,
        max_steps=max_steps,
        instructions=instructions,
        verbosity_level=LogLevel.OFF,
    )

    # Required attributes for ManagedAgent protocol
    agent.name = "conversation_history_lookup"
    agent.description = (
        "Searches conversation history for referenced content. "
        "Use when user mentions 'option 1', 'your earlier suggestion', "
        "'what you said', 'the plan you proposed', or similar references "
        "to prior discussion. NOT for execution results."
    )

    # Try to render capabilities, with fallback
    try:
        agent.capabilities = render_capabilities("conversation_history_lookup")
    except Exception:
        agent.capabilities = (
            "- Search conversation history for keywords\n"
            "- Filter by message role (user/assistant)\n"
            "- Resolve references like 'option 1', 'your suggestion'"
        )

    logger.info(f"Created ConversationHistoryLookup agent")
    logger.info(f"   History messages: {len(conversation_history)}")
    logger.info(f"   Max steps: {max_steps}")

    return agent
