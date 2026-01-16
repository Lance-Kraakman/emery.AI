"""
Agent Executor - Dynamic agent for user-defined Agents.

AIDEV-NOTE: Creates a dynamic ToolCallingAgent at runtime that wraps a user-defined
Agent entity. This enables:
- Chat mode: Conversational interaction using persona, skills, and data access
- HITL input gathering: When skill inputs are missing, prompts user conversationally

The AgentExecutor loads:
1. Agent's persona → system instructions
2. Agent's skills → SkillInvokerTools
3. Agent's databaseId → scoped row_crud tool

Uses ToolCallingAgent (not CodeAgent) since it orchestrates via tool calls,
no code generation needed.
"""

import logging
from typing import Any, Dict, List, Optional

from smolagents import ToolCallingAgent, Tool
from smolagents.monitoring import LogLevel

from ..prompts import build_agent_instructions, render_capabilities
from ..tools.skill_invoker_tool import create_skill_invoker_tools

logger = logging.getLogger(__name__)


def create_agent_executor(
    agent_config: Dict[str, Any],
    skills: List[Dict[str, Any]],
    model: Any,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None,
    additional_tools: Optional[List[Tool]] = None,
    skill_executor_callback: Optional[Any] = None,
    max_steps: int = 15,
) -> ToolCallingAgent:
    """
    Create a dynamic AgentExecutor for a user-defined agent.

    Builds a ToolCallingAgent at runtime with:
    - Persona-based system instructions
    - SkillInvokerTools for each agent skill
    - Optional data access tools (row_crud scoped to agent's database)

    Args:
        agent_config: Agent entity data (id, name, persona, databaseId, etc.)
        skills: List of skill definitions for this agent
        model: The LLM model to use
        api_key: API key for tool/skill execution
        organization_id: Organization ID for RLS context
        additional_tools: Extra tools to include (e.g., scoped row_crud)
        skill_executor_callback: Callback to execute skills
        max_steps: Maximum execution steps

    Returns:
        Configured ToolCallingAgent for agent execution
    """
    agent_id = agent_config.get("id")
    agent_name = agent_config.get("name", "Agent")
    agent_persona = agent_config.get("persona", "")
    agent_description = agent_config.get("description", "")
    agent_database_id = agent_config.get("databaseId")

    logger.info(f"🤖 Creating AgentExecutor for agent: {agent_name} (id={agent_id})")

    # 1. Create SkillInvokerTools for each skill
    skill_tools = create_skill_invoker_tools(
        skills=skills,
        api_key=api_key,
        organization_id=organization_id,
        skill_executor_callback=skill_executor_callback,
    )
    logger.info(f"   Created {len(skill_tools)} skill tools")

    # 2. Combine with additional tools
    all_tools = list(skill_tools)
    if additional_tools:
        all_tools.extend(additional_tools)
        logger.info(f"   Added {len(additional_tools)} additional tools")

    # 3. Build instructions from agent persona + template
    # Pass agent context variables directly to the template builder
    instructions = build_agent_instructions(
        tools=all_tools,
        agent_type="agent_executor",
        context_type="interactive",
        # Template variables (passed via **kwargs to Jinja2)
        agent_name=agent_name,
        agent_persona=agent_persona,
        agent_description=agent_description,
        skills=skills,
        database_id=agent_database_id,
    )

    # 4. Create the ToolCallingAgent
    agent = ToolCallingAgent(
        tools=all_tools,
        model=model,
        max_steps=max_steps,
        instructions=instructions,
        verbosity_level=LogLevel.OFF,
    )

    # 5. Set attributes for ManagedAgent protocol
    agent.name = f"agent_{agent_name.lower().replace(' ', '_')}"
    agent.description = (
        f"User-defined agent: {agent_name}. "
        f"{agent_description or 'Executes skills and interacts with data.'}"
    )
    agent.capabilities = render_capabilities("agent_executor")

    # Store agent metadata for routing/identification
    agent._agent_id = agent_id
    agent._agent_config = agent_config

    logger.info(f"✨ Created AgentExecutor: {agent.name}")
    logger.info(f"   Tools: {[t.name for t in all_tools]}")
    logger.info(f"   Max steps: {max_steps}")

    return agent


def create_agent_executor_from_api(
    agent_id: int,
    model: Any,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None,
    skill_executor_callback: Optional[Any] = None,
    max_steps: int = 15,
    fetch_agent_callback: Optional[Any] = None,
    fetch_skills_callback: Optional[Any] = None,
    create_row_crud_callback: Optional[Any] = None,
) -> ToolCallingAgent:
    """
    Create an AgentExecutor by loading agent from API.

    This is a convenience function that:
    1. Fetches agent config from API
    2. Fetches agent's skills from API
    3. Creates scoped row_crud if agent has databaseId
    4. Builds the dynamic agent

    Args:
        agent_id: Database ID of the agent
        model: The LLM model to use
        api_key: API key for authentication
        organization_id: Organization ID for RLS context
        skill_executor_callback: Callback to execute skills
        max_steps: Maximum execution steps
        fetch_agent_callback: Callback to fetch agent from API
        fetch_skills_callback: Callback to fetch skills from API
        create_row_crud_callback: Callback to create scoped row_crud tool

    Returns:
        Configured ToolCallingAgent
    """
    if fetch_agent_callback is None or fetch_skills_callback is None:
        raise ValueError("fetch_agent_callback and fetch_skills_callback are required")

    # 1. Fetch agent configuration
    logger.info(f"📥 Fetching agent {agent_id} from API")
    agent_config = fetch_agent_callback(agent_id)
    if not agent_config:
        raise ValueError(f"Agent {agent_id} not found")

    # 2. Fetch agent's skills
    logger.info(f"📥 Fetching skills for agent {agent_id}")
    skills = fetch_skills_callback(agent_id)

    # 3. Create additional tools (e.g., scoped row_crud for data access)
    additional_tools = []
    database_id = agent_config.get("databaseId")
    if database_id and create_row_crud_callback:
        logger.info(f"   Creating row_crud scoped to database {database_id}")
        row_crud = create_row_crud_callback(
            api_key=api_key,
            organization_id=organization_id,
            database_id=database_id
        )
        additional_tools.append(row_crud)

    # 4. Create the executor
    return create_agent_executor(
        agent_config=agent_config,
        skills=skills,
        model=model,
        api_key=api_key,
        organization_id=organization_id,
        additional_tools=additional_tools,
        skill_executor_callback=skill_executor_callback,
        max_steps=max_steps,
    )
