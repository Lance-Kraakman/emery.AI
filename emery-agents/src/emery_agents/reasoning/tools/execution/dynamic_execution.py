"""
Dynamic Skill/Agent Execution

Provides functions for executing skills/agents by ID at runtime.
Fetches config from API, resolves credentials from ownership, executes.

AIDEV-NOTE: Part of dynamic execution architecture.
- Skills are fetched via POST /api/skills/:id/execution-config
- Agents are fetched via POST /api/agents/:id/execution-config
- Credentials are resolved based on skill.agentId / agent ownership
- Parent credentials propagate to all nested calls
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional, TYPE_CHECKING

import requests

from ..http_client import get_base_url

if TYPE_CHECKING:
    from ....services.skills.executor import SkillExecutorService

logger = logging.getLogger(__name__)


def execute_skill_by_id(
    skill_id: int,
    inputs: Dict[str, Any],
    api_key: str,
    org_id: str,
    skill_executor_service: Optional["SkillExecutorService"] = None,
) -> str:
    """
    Execute a skill by ID with dynamic credential resolution.

    Flow:
    1. Fetch skill config from API (includes agentId)
    2. Resolve credentials from skill ownership
    3. Execute skill using resolved credentials

    Args:
        skill_id: The skill ID to execute
        inputs: Input parameters for the skill
        api_key: Caller's API key (used for API calls and fallback credentials)
        org_id: Organization ID
        skill_executor_service: Optional executor service for full execution

    Returns:
        Skill execution result as string
    """
    logger.info(f"[DYNAMIC-EXEC] Executing skill {skill_id} with inputs: {list(inputs.keys())}")

    # 1. Fetch skill config + credentials from API
    try:
        config_result = fetch_skill_execution_config(skill_id, api_key, org_id)
    except Exception as e:
        logger.error(f"[DYNAMIC-EXEC] Failed to fetch skill config: {e}")
        return f"ERROR: Failed to fetch skill configuration: {e}"

    if not config_result.get("success"):
        error = config_result.get("error", "Unknown error")
        logger.error(f"[DYNAMIC-EXEC] API error: {error}")
        return f"ERROR: {error}"

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

    # 3. Execute skill
    # For now, return skill info + note that full execution requires executor service
    if skill_executor_service is None:
        # Without executor service, we can't do full execution
        # Return skill info so caller knows what they're working with
        return json.dumps({
            "status": "skill_info",
            "message": "Skill config retrieved but full execution requires skill executor service",
            "skill": {
                "id": skill_dto.get("id"),
                "name": skill_dto.get("name"),
                "description": skill_dto.get("description"),
                "instructions": skill_dto.get("instructions"),
                "inputs": skill_dto.get("inputs", []),
                "outputs": skill_dto.get("outputs", []),
            },
            "agentId": agent_id,
            "credentialSource": "agent" if agent_id else "user",
        })

    # TODO: Full execution with skill_executor_service
    # This requires building SkillConfig proto from skill_dto
    # and calling skill_executor_service.execute()
    logger.warning("[DYNAMIC-EXEC] Full skill execution not yet implemented")
    return json.dumps({
        "status": "not_implemented",
        "message": "Full dynamic skill execution is not yet implemented",
        "skill_id": skill_id,
    })


def fetch_skill_execution_config(
    skill_id: int,
    api_key: str,
    org_id: str,
) -> Dict[str, Any]:
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

    return response.json()


def execute_agent_by_id(
    agent_id: int,
    task: str,
    api_key: str,
    org_id: str,
) -> str:
    """
    Execute an agent by ID with dynamic credential resolution.

    Flow:
    1. Fetch agent config from API
    2. Use agent's credentials
    3. Execute task via existing agent execute endpoint

    Args:
        agent_id: The agent ID to execute
        task: The task/instruction for the agent
        api_key: Caller's API key
        org_id: Organization ID

    Returns:
        Agent execution result as string
    """
    logger.info(f"[DYNAMIC-EXEC] Executing agent {agent_id} with task: {task[:100]}...")

    # For agent execution, we can use the existing /api/agents/:id/execute endpoint
    # which already handles credential resolution internally

    base_url = get_base_url()
    url = f"{base_url}/api/agents/{agent_id}/execute"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-Organization-Id": org_id,
        "Content-Type": "application/json",
    }

    payload = {
        "instructions": task,
    }

    logger.debug(f"[DYNAMIC-EXEC] Calling agent execute at {url}")

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=300)

        if response.status_code == 403:
            return "ERROR: Permission denied: agents:execute required"
        elif response.status_code == 404:
            return f"ERROR: Agent {agent_id} not found"
        elif response.status_code >= 400:
            return f"ERROR: API error: {response.status_code}"

        result = response.json()

        if result.get("success"):
            return json.dumps({
                "status": "completed",
                "result": result.get("result"),
                "execution_id": result.get("execution_id"),
            })
        else:
            return f"ERROR: {result.get('error', 'Agent execution failed')}"

    except requests.exceptions.Timeout:
        return "ERROR: Agent execution timed out"
    except Exception as e:
        logger.error(f"[DYNAMIC-EXEC] Agent execution failed: {e}")
        return f"ERROR: {e}"
