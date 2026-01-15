"""
Table Builder Managed Agent (Autonomous)

A specialized agent for single table operations like adding/deleting fields.
Executes directly without HITL approval - designed for quick schema changes.

AIDEV-NOTE: Unlike skill_builder which uses HITL workflow, table_builder is
autonomous because single field operations are low-risk and reversible.
This keeps the agent fast and the context small.

AIDEV-NOTE: For complex schema design (multiple tables, many fields), use
schema_builder instead which has HITL approval workflow.
"""

import logging
from typing import List, Any

from smolagents import Tool, CodeAgent
from smolagents.monitoring import LogLevel

from ..prompts import build_agent_instructions

logger = logging.getLogger(__name__)


def create_table_builder_agent(
    tools: List[Tool],
    model: Any,
    max_steps: int = 6
) -> CodeAgent:
    """
    Create a Table Builder agent for single table operations.

    This agent executes autonomously without planning approval:
    - Add column to table
    - Delete field from table
    - Rename field

    Uses smaller context and fewer steps for fast execution.

    AIDEV-NOTE: No HITL workflow - executes directly. For complex schema
    design with approval, use schema_builder instead.

    Args:
        tools: List of table/field CRUD tools
        model: The LLM model to use
        max_steps: Maximum execution steps (default 6 for single operations)

    Returns:
        Configured CodeAgent for autonomous execution
    """
    # Get instructions from centralized function
    instructions = build_agent_instructions(
        tools=tools,
        agent_type="table_builder",
        context_type="autonomous"  # No HITL
    )

    # Use CodeAgent directly - no StatefulManagedAgent needed
    # since we don't need memory preservation between calls
    agent = CodeAgent(
        tools=tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,
        verbosity_level=LogLevel.OFF,
    )

    # Set attributes for ManagedAgent identification
    agent.name = "table_builder"
    agent.description = (
        "Executes single table operations: add column, delete field, rename. "
        "Use for quick schema changes to a specific table. "
        "Does NOT design schemas - use schema_builder for complex design."
    )
    agent.capabilities = (
        "- Quick single-field operations (add field, delete field, rename)\n"
        "- Autonomous execution (no approval needed for simple changes)\n"
        "- Use for targeted changes to existing tables\n"
        "- Does NOT design schemas - delegates complex work to schema_builder"
    )

    logger.info(f"✨ Created Table Builder agent (autonomous CodeAgent)")
    logger.info(f"   Tools: {[t.name for t in tools]}")
    logger.info(f"   Max steps: {max_steps}")

    return agent
