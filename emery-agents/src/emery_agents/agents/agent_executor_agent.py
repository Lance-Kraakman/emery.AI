"""
Agent Executor - Dynamic DSPy module for user-defined Agents.

AIDEV-NOTE: Creates a dynamic ExecutorModule at runtime that wraps a user-defined
Agent entity. This enables:
- Chat mode: Conversational interaction using persona, skills, and data access
- HITL input gathering: When skill inputs are missing, prompts user conversationally

The AgentExecutor loads:
1. Agent's skills → SkillInvokerTools (as callables)
2. Agent's databaseId → scoped data access tools

Uses ExecutorModule (dspy.ReAct) for tool orchestration.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from emery_agents.tools.execution import create_skill_invoker_tools

from ..entities.workspace import WorkspaceAgent, WorkspaceSkill
from ..reasoning.modules import ExecutorModule
from ..services.skills.validator import create_validator_from_skills
from ..utils.persona_sanitizer import sanitize_description

logger = logging.getLogger(__name__)


def create_agent_executor(
    agent_data: WorkspaceAgent,
    skills: list[WorkspaceSkill],
    api_key: str | None = None,
    organization_id: int | None = None,
    additional_tools: list[Callable[..., Any]] | None = None,
    skill_executor_callback: Callable[..., Any] | None = None,
    max_steps: int = 15,
) -> ExecutorModule:
    """
    Create a dynamic AgentExecutor for a user-defined agent.

    Builds an ExecutorModule (dspy.ReAct) at runtime with:
    - SkillInvokerTools for each agent skill
    - Optional data access tools (row_crud scoped to agent's database)

    Args:
        agent_data: Typed agent configuration (WorkspaceAgent)
        skills: List of typed skill definitions (WorkspaceSkill)
        api_key: API key for tool/skill execution
        organization_id: Organization ID for RLS context
        additional_tools: Extra tools to include (e.g., scoped row_crud)
        skill_executor_callback: Callback to execute skills
        max_steps: Maximum ReAct iterations

    Returns:
        Configured ExecutorModule for agent execution
    """
    agent_id = agent_data.id
    agent_name = agent_data.name

    # SECURITY: Sanitize user-provided content
    agent_description = sanitize_description(agent_data.description)

    logger.info(
        f"[AGENT-EXECUTOR] Creating ExecutorModule for agent: {agent_name} (id={agent_id})"
    )

    # SECURITY: Create skill permission validator to enforce skill whitelist
    agent_id_int = int(agent_id) if agent_id else None
    skill_validator = create_validator_from_skills(skills, agent_id=agent_id_int)
    logger.info(
        f"[AGENT-EXECUTOR] Created skill validator with {len(skill_validator.allowed_skill_ids)} allowed skills"
    )

    # 1. Create SkillInvokerTools for each skill (with permission validation)
    skill_tools = create_skill_invoker_tools(
        skills=skills,
        api_key=api_key,
        organization_id=organization_id,
        skill_executor_callback=skill_executor_callback,
        permission_validator=skill_validator,
    )
    logger.info(f"[AGENT-EXECUTOR] Created {len(skill_tools)} skill tools")

    # 2. Combine with additional tools
    all_tools: list[Callable[..., Any]] = list(skill_tools)
    if additional_tools:
        all_tools.extend(additional_tools)
        logger.info(f"   Added {len(additional_tools)} additional tools")

    # 3. Create the ExecutorModule (dspy.ReAct)
    executor = ExecutorModule(
        execution_tools=all_tools,
        max_iters=max_steps,
    )

    # 4. Store metadata for identification
    executor._agent_id = agent_id
    executor._agent_name = f"agent_{agent_name.lower().replace(' ', '_')}"
    executor._agent_description = (
        f"User-defined agent: {agent_name}. "
        f"{agent_description or 'Executes skills and interacts with data.'}"
    )

    logger.info(f"Created ExecutorModule: {executor._agent_name}")
    tool_names = [getattr(t, "name", getattr(t, "__name__", str(t))) for t in all_tools]
    logger.info(f"   Tools: {tool_names}")
    logger.info(f"   Max iters: {max_steps}")

    return executor


def create_agent_executor_from_api(
    agent_id: int,
    api_key: str | None = None,
    organization_id: int | None = None,
    skill_executor_callback: Callable[..., Any] | None = None,
    max_steps: int = 15,
    fetch_agent_callback: Callable[..., WorkspaceAgent | None] | None = None,
    fetch_skills_callback: Callable[..., list[WorkspaceSkill]] | None = None,
    create_row_crud_callback: Callable[..., Any] | None = None,
) -> ExecutorModule:
    """
    Create an AgentExecutor by loading agent from API.

    This is a convenience function that:
    1. Fetches agent config from API
    2. Fetches agent's skills from API
    3. Creates scoped row_crud if agent has databaseId
    4. Builds the dynamic ExecutorModule

    Args:
        agent_id: Database ID of the agent
        api_key: API key for authentication
        organization_id: Organization ID for RLS context
        skill_executor_callback: Callback to execute skills
        max_steps: Maximum ReAct iterations
        fetch_agent_callback: Callback returning WorkspaceAgent
        fetch_skills_callback: Callback returning list[WorkspaceSkill]
        create_row_crud_callback: Callback to create scoped row_crud tool

    Returns:
        Configured ExecutorModule
    """
    if fetch_agent_callback is None or fetch_skills_callback is None:
        raise ValueError("fetch_agent_callback and fetch_skills_callback are required")

    # 1. Fetch agent configuration
    logger.info(f"Fetching agent {agent_id} from API")
    agent_data = fetch_agent_callback(agent_id)
    if not agent_data:
        raise ValueError(f"Agent {agent_id} not found")

    # 2. Fetch agent's skills
    logger.info(f"Fetching skills for agent {agent_id}")
    skills = fetch_skills_callback(agent_id)

    # 3. Create additional tools (e.g., scoped row_crud for data access)
    additional_tools: list[Callable[..., Any]] = []
    if agent_data.database_id and create_row_crud_callback:
        logger.info(f"   Creating row_crud scoped to database {agent_data.database_id}")
        row_crud = create_row_crud_callback(
            api_key=api_key,
            organization_id=organization_id,
            database_id=agent_data.database_id,
        )
        additional_tools.append(row_crud)

    # 4. Create the executor
    return create_agent_executor(
        agent_data=agent_data,
        skills=skills,
        api_key=api_key,
        organization_id=organization_id,
        additional_tools=additional_tools,
        skill_executor_callback=skill_executor_callback,
        max_steps=max_steps,
    )
