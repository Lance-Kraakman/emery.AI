"""
Dynamic Skill/Agent Execution

Provides functions for executing skills/agents by ID at runtime.
Fetches config from API, resolves credentials from ownership, executes in-process.

AIDEV-NOTE: Part of dynamic execution architecture (Jan 2026).
- Skills are fetched via POST /api/skills/:id/execution-config
- Agents are fetched via POST /api/agents/:id/execution-config
- Credentials are resolved based on skill.agentId / agent ownership
- Execution happens in-process via SkillExecutorService/AgentExecutor
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

import requests

from emery_agents.api.http_client import get_base_url
from emery_agents.entities.execution_context import ExecutionContext
from emery_agents.entities.skill_config import SkillConfig
from emery_agents.services.context import get_current_context, signal_human_skill_awaiting
from emery_agents.tools.execution.skill import HumanSkillAwaitingException
from emery_agents.types import ExecutionMode
from emery_agents.utils import run_async_in_thread

logger = logging.getLogger(__name__)


@dataclass
class AgentExecutionConfig:
    """Typed response from POST /api/agents/[id]/execution-config."""

    agent_id: int
    agent_api_key: str  # Required — no fallback to caller's key
    agent_name: str
    agent_description: str
    agent_persona: str | None

    @classmethod
    def from_api_response(cls, data: dict[str, Any]) -> AgentExecutionConfig:
        """Parse execution-config API response into typed structure.

        Raises:
            ValueError: If agent has no API key configured.
        """
        agent_dto = data.get("agent", {})
        agent_api_key = data.get("agentApiKey")
        if not agent_api_key:
            raise ValueError(
                f"Agent {agent_dto.get('name', 'unknown')} has no API key configured. "
                "Agents must have their own API key for execution."
            )
        return cls(
            agent_id=data.get("agentId", agent_dto.get("id", 0)),
            agent_api_key=agent_api_key,
            agent_name=agent_dto.get("name", "unknown"),
            agent_description=agent_dto.get("description", ""),
            agent_persona=agent_dto.get("persona"),
        )


def execute_skill_by_id(
    skill_id: int,
    inputs: dict[str, Any],
    api_key: str,
    org_id: str,
) -> str:
    """
    Execute a skill by ID with dynamic credential resolution.

    Flow:
    1. Fetch skill config from API (includes agentId)
    2. Resolve credentials from skill ownership
    3. Execute skill in-process using SkillExecutorService

    Args:
        skill_id: The skill ID to execute
        inputs: Input parameters for the skill
        api_key: Caller's API key (used for API calls and fallback credentials)
        org_id: Organization ID

    Returns:
        Skill execution result as string
    """
    logger.info(
        f"[DYNAMIC-EXEC] Executing skill {skill_id} with inputs: {list(inputs.keys())}"
    )

    # 1. Fetch skill config + credentials from API
    try:
        config_result = fetch_skill_execution_config(skill_id, api_key, org_id)
    except Exception as e:
        logger.error(f"[DYNAMIC-EXEC] Failed to fetch skill config: {e}")
        return json.dumps(
            {
                "status": "error",
                "error": f"Failed to fetch skill configuration: {e}",
            }
        )

    if not config_result.get("success"):
        error = config_result.get("error", "Unknown error")
        logger.error(f"[DYNAMIC-EXEC] API error: {error}")
        return json.dumps(
            {
                "status": "error",
                "error": error,
            }
        )

    data = config_result.get("data", {})
    skill_dto = data.get("skill", {})
    agent_api_key = data.get("agentApiKey")
    agent_id = data.get("agentId")

    # 2. Resolve credentials
    # If skill has agentId and we have agent's API key, use it
    # Otherwise use caller's credentials
    if agent_id and agent_api_key:
        execution_api_key = agent_api_key
        logger.info(f"[DYNAMIC-EXEC] Using agent {agent_id} credentials")
    else:
        execution_api_key = api_key
        logger.info("[DYNAMIC-EXEC] Using caller credentials (org-level skill)")

    # 3. Create SkillConfig from API response
    skill_config = SkillConfig.from_api_response(skill_dto)
    logger.info(
        f"[DYNAMIC-EXEC] Skill config: {skill_config.name} (type={skill_config.execution_type})"
    )

    # 4. Create executor and execute in-process
    try:
        # Lazy imports to avoid circular dependency:
        # tools/loader -> tools/crud -> dynamic_execution -> services/skills/executor -> tools/loader
        from emery_agents.services.agents.factory import AgentFactory
        from emery_agents.services.models.provider import ModelProvider
        from emery_agents.services.skills.executor import (
            SkillExecutorService,
            SkillExecutionResult,
        )
        from emery_agents.tools.loader import UnifiedToolLoader

        tool_loader = UnifiedToolLoader()
        model_provider = ModelProvider()
        agent_factory = AgentFactory(model_provider)

        skill_executor = SkillExecutorService(
            tool_loader=tool_loader,
            agent_factory=agent_factory,
        )

        # Use capture_outputs=True to get SkillExecutionResult with status
        result = skill_executor.execute_skill(
            skill_config=skill_config,
            runtime_inputs=inputs,
            capture_outputs=True,  # Changed: get full result with status
            api_key=execution_api_key,
            organization_id=int(org_id),
        )

        logger.info(f"[DYNAMIC-EXEC] Skill {skill_id} execution complete")

        # Check if human skill is awaiting human input
        if isinstance(result, SkillExecutionResult) and result.status == "awaiting_human":
            logger.info(
                f"[DYNAMIC-EXEC] Human skill {skill_id} awaiting input - "
                "signaling via context for executor to handle"
            )

            # Get human skill config for instructions and assignee
            human_config = skill_config.human_skill_config
            instructions = (
                human_config.instructions if human_config else skill_config.instructions
            )
            assigned_to = ""
            if human_config:
                if human_config.assignee_type == "specific_user" and human_config.assignee_id:
                    assigned_to = human_config.assignee_id
                elif human_config.assignee_type == "role" and human_config.assignee_role:
                    assigned_to = f"role:{human_config.assignee_role}"

            # Signal via context variable (executor will raise after ReAct completes)
            # DSPy ReAct catches tool exceptions, so we signal via context instead
            exception = HumanSkillAwaitingException(
                skill_id=skill_id,
                skill_name=skill_config.name,
                step_id="",  # Set by execution node
                instructions=instructions,
                inputs=inputs,
                output_schema=[
                    {"name": out.name, "type": out.type}
                    for out in skill_config.outputs
                ],
                assigned_to=assigned_to,
            )
            signal_human_skill_awaiting(exception)

            # Return marker so DSPy treats as success (stops further tool calls)
            return f"Human skill '{skill_config.name}' requires human input. Execution paused."

        # Wrap completed result in standard format
        result_str = (
            result.result if isinstance(result, SkillExecutionResult)
            else (result if isinstance(result, str) else str(result))
        )
        return json.dumps(
            {
                "status": "completed",
                "result": result_str,
                "skill_id": skill_id,
                "credential_source": "agent" if agent_id else "user",
            }
        )

    except Exception as e:
        logger.error(f"[DYNAMIC-EXEC] Skill execution failed: {e}", exc_info=True)
        return json.dumps(
            {
                "status": "error",
                "error": str(e),
                "skill_id": skill_id,
            }
        )


def fetch_skill_execution_config(
    skill_id: int,
    api_key: str,
    org_id: str,
) -> dict[str, Any]:
    """
    Fetch skill execution config from API.

    Calls POST /api/skills/:id/execution-config which:
    - Checks skills:execute permission
    - Returns full skill config
    - Returns agentApiKey if skill is agent-owned

    Args:
        skill_id: Skill ID
        api_key: API key for auth
        org_id: Organization ID

    Returns:
        API response dict with skill config and credentials
    """
    base_url = get_base_url()
    url = f"{base_url}/api/skills/{skill_id}/execution-config"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-Organization-Id": org_id,
        "Content-Type": "application/json",
    }

    logger.debug(f"[DYNAMIC-EXEC] Fetching skill config from {url}")

    response = requests.post(url, headers=headers, json={}, timeout=30)

    if response.status_code == 403:
        return {"success": False, "error": "Permission denied: skills:execute required"}
    elif response.status_code == 404:
        return {"success": False, "error": f"Skill {skill_id} not found"}
    elif response.status_code >= 400:
        return {"success": False, "error": f"API error: {response.status_code}"}

    result: dict[str, Any] = response.json()
    return result


def execute_agent_by_id(
    agent_id: int,
    task: str,
    api_key: str,
    org_id: str,
) -> str:
    """
    Execute an agent by ID with dynamic credential resolution.

    Flow:
    1. Fetch agent config + credentials from API
    2. Use agent's own API key (no fallback)
    3. Execute task in-process using AgentExecutor

    Args:
        agent_id: The agent ID to execute
        task: The task/instruction for the agent
        api_key: Caller's API key (used for the config fetch, not execution)
        org_id: Organization ID

    Returns:
        Agent execution result as string
    """
    logger.info(f"[DYNAMIC-EXEC] Executing agent {agent_id} with task: {task[:100]}...")

    # 1. Fetch agent config + credentials from API
    try:
        exec_config = fetch_agent_execution_config(agent_id, api_key, org_id)
    except ValueError as e:
        logger.error(f"[DYNAMIC-EXEC] Agent config/credential error: {e}")
        return json.dumps(
            {
                "status": "error",
                "error": str(e),
            }
        )
    except Exception as e:
        logger.error(f"[DYNAMIC-EXEC] Failed to fetch agent config: {e}")
        return json.dumps(
            {
                "status": "error",
                "error": f"Failed to fetch agent configuration: {e}",
            }
        )

    logger.info(
        f"[DYNAMIC-EXEC] Agent config: {exec_config.agent_name} "
        f"(using agent's own API key)"
    )

    # 2. Build ExecutionContext - inherit org_model from parent context
    parent_context = get_current_context()
    parent_org_model = parent_context.org_model if parent_context else None

    context = ExecutionContext(
        mode=ExecutionMode.INTERACTIVE,
        task=task,
        available_tools=[],
        agent_id=agent_id,
        organization_id=int(org_id),
        org_model=parent_org_model,  # Inherit from parent execution
    )

    # 3. Execute in-process using AgentExecutor
    try:
        # Lazy import to avoid circular dependency
        from emery_agents.services.agents.executor import AgentExecutor

        agent_executor = AgentExecutor()

        # Collect results from async iterator
        async def collect_results() -> str | None:
            final_result = None
            async for update in agent_executor.execute_task(context):
                if update.get("type") == "final_answer":
                    final_result = update.get("content", "")
                elif update.get("final_answer"):
                    final_result = update.get("final_answer")
            return final_result

        result = run_async_in_thread(collect_results(), timeout=300)

        logger.info(f"[DYNAMIC-EXEC] Agent {agent_id} execution complete")

        return json.dumps(
            {
                "status": "completed",
                "result": result,
                "agent_id": agent_id,
            }
        )

    except Exception as e:
        logger.error(f"[DYNAMIC-EXEC] Agent execution failed: {e}", exc_info=True)
        return json.dumps(
            {
                "status": "error",
                "error": str(e),
                "agent_id": agent_id,
            }
        )


def fetch_agent_execution_config(
    agent_id: int,
    api_key: str,
    org_id: str,
) -> AgentExecutionConfig:
    """
    Fetch agent execution config from API.

    Calls POST /api/agents/:id/execution-config which:
    - Checks agents:execute permission
    - Returns full agent config
    - Returns agentApiKey if agent has one

    Args:
        agent_id: Agent ID
        api_key: API key for auth
        org_id: Organization ID

    Returns:
        AgentExecutionConfig with typed fields

    Raises:
        ValueError: If API call fails or agent has no API key
    """
    base_url = get_base_url()
    url = f"{base_url}/api/agents/{agent_id}/execution-config"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-Organization-Id": org_id,
        "Content-Type": "application/json",
    }

    logger.debug(f"[DYNAMIC-EXEC] Fetching agent config from {url}")

    response = requests.post(url, headers=headers, json={}, timeout=30)

    if response.status_code == 403:
        raise ValueError("Permission denied: agents:execute required")
    elif response.status_code == 404:
        raise ValueError(f"Agent {agent_id} not found")
    elif response.status_code >= 400:
        raise ValueError(f"API error: {response.status_code}")

    result: dict[str, Any] = response.json()
    if not result.get("success"):
        raise ValueError(result.get("error", "Unknown API error"))

    return AgentExecutionConfig.from_api_response(result.get("data", {}))
