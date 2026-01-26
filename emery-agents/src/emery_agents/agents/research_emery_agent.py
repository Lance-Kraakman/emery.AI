"""
ResearchEmery Agent - System introspection for planning.

AIDEV-NOTE: This agent researches the INTERNAL Emery system (agents, skills,
tasks, tables, apps, audit). It complements ResearchAgent which handles
WEB research (DuckDuckGo, web fetch).

AIDEV-NOTE: Uses ExecutorModule (dspy.ReAct) for tool-based research.

AIDEV-NOTE: Uses READ-ONLY tools - safe for planning phase without HITL approval.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from ..dspy_modules.modules import ExecutorModule
from ..dspy_modules.tools.analysis import create_system_research_tool

if TYPE_CHECKING:
    from collections.abc import Callable

logger = logging.getLogger(__name__)


def create_research_emery_agent(
    model: Any = None,
    api_key: str | None = None,
    organization_id: int | None = None,
    additional_tools: list[Callable[..., Any]] | None = None,
    max_steps: int = 10,
    planning_callback: Callable[[Any, Any], None] | None = None,
) -> ExecutorModule:
    """
    Create ResearchEmery agent for system introspection.

    Provides READ-ONLY access to Emery platform resources:
    - Agents: configuration, automations, plans
    - Skills: instructions, inputs, outputs, tools
    - Tasks: history, logs, results
    - Tables: schema, fields, databases
    - Apps: pages, themes
    - Audit: events, resource trails

    Args:
        model: LLM model (used for DSPy configuration)
        api_key: API key for authenticated requests
        organization_id: Organization context for RLS
        additional_tools: Extra tools to include
        max_steps: Maximum ReAct iterations (default 10)
        planning_callback: Optional callback (currently unused in DSPy)

    Returns:
        Configured ExecutorModule for system research
    """
    # Core system research tool with auth context
    system_research = create_system_research_tool(
        api_key=api_key,
        organization_id=organization_id,
    )

    research_tools: list[Callable[..., Any]] = [system_research]

    # Add any additional tools
    all_tools = research_tools + (additional_tools or [])

    # Create ExecutorModule with ReAct
    executor = ExecutorModule(
        execution_tools=all_tools,
        max_iters=max_steps,
    )

    # Store metadata for routing
    executor._agent_name = "research_emery"  # type: ignore[attr-defined]
    executor._agent_description = (  # type: ignore[attr-defined]
        "Researches the Emery platform: finds agents, skills, tasks, tables, apps, and audit history. "
        "Use for: 'what do I have', 'show my organization', 'list my agents/skills/tables/databases', "
        "'what agents exist', 'find skill', 'task history', 'show audit events', "
        "'what's configured', 'explore my system', 'what resources exist'"
    )

    tool_names = [getattr(t, "name", getattr(t, "__name__", str(t))) for t in all_tools]
    logger.info("✨ Created ResearchEmery ExecutorModule (read-only system introspection)")
    logger.info(f"   Tools: {tool_names}")
    logger.info(f"   Max iters: {max_steps}")

    return executor
