"""
Chat Planner Orchestrator Agent

Top-level agent for chat processing that routes/delegates to specialized agents.
Works in interactive (chat) mode, handling user requests and coordinating work.

AIDEV-NOTE: This agent is the main entry point for chat messages. It:
- Routes to skill_builder for skill modifications
- Routes to document_builder for document operations
- Uses tools directly for simple data queries

AIDEV-NOTE: Uses InterruptAwareToolCallingAgent to propagate interrupts from
managed agents (skill_builder, document_builder) when they pause for user approval.

AIDEV-NOTE: Uses ToolCallingAgent (not CodeAgent) because:
- All instruct models support native tool calling
- smolagents default prompt includes JSON format instructions
- We use `instructions` parameter to ADD context (not replace default prompt)

AIDEV-NOTE: Instructions are loaded from Jinja2 template at prompts/agents/chat_planner.j2
"""

import logging
from typing import List, Any, Optional

from smolagents import Tool
from smolagents.monitoring import LogLevel

from .interrupt_aware_agent import InterruptAwareToolCallingAgent
from ..prompts import build_agent_instructions

logger = logging.getLogger(__name__)


def create_chat_planner_agent(
    tools: List[Tool],
    model: Any,
    managed_agents: Optional[List[Any]] = None,
    context_type: str = "interactive",
    max_steps: int = 10,
    session_attachments: Optional[List[Any]] = None
) -> InterruptAwareToolCallingAgent:
    """
    Create the Chat Planner orchestrator agent.

    This is the top-level agent that:
    - Handles user requests in chat
    - Delegates to skill_builder for skill operations
    - Delegates to document_builder for document operations
    - Uses tools directly for simple data queries

    AIDEV-NOTE: Uses InterruptAwareToolCallingAgent because:
    - All instruct models support native JSON tool calling
    - smolagents default prompt includes required JSON format instructions
    - We use `instructions` parameter to ADD context (doesn't replace default)

    Args:
        tools: Available tools for direct execution
        model: The LLM model to use
        managed_agents: Sub-agents (skill_builder, document_builder)
        context_type: "interactive" for chat, "autonomous" for tasks
        max_steps: Maximum execution steps
        session_attachments: Optional list of file attachments available in session
                            (displayed to agent for file reference awareness)

    Returns:
        Configured InterruptAwareToolCallingAgent
    """
    # Get instructions from centralized function (base + agent-specific + tools)
    # Pass managed_agents so template can list available specialists
    # Pass session_attachments so agent knows what files are available
    instructions = build_agent_instructions(
        tools=tools,
        agent_type="chat_planner",
        context_type=context_type,
        managed_agents=managed_agents or [],
        session_attachments=session_attachments
    )

    # Create the orchestrator agent
    # InterruptAware to propagate interrupts from managed agents (HITL)
    # Use `instructions` parameter to ADD to default prompt (not replace it)
    # This preserves smolagents' tool format instructions while adding our context
    agent = InterruptAwareToolCallingAgent(
        tools=tools,
        model=model,
        max_steps=max_steps,
        managed_agents=managed_agents or [],
        instructions=instructions,  # ADDS to default prompt, doesn't replace
        verbosity_level=LogLevel.OFF,
    )

    # Set attributes for identification
    agent.name = "chat_planner"
    agent.description = (
        "Main chat orchestrator that routes requests to specialized agents "
        "or handles simple queries directly."
    )

    logger.info(f"Created Chat Planner agent (ToolCallingAgent) with {len(tools)} tools, "
                f"{len(managed_agents or [])} managed agents")
    logger.info(f"   Managed agents: {[a.name for a in (managed_agents or [])]}")

    return agent
