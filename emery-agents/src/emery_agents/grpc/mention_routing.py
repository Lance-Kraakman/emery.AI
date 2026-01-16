"""
@agent Mention Routing - Direct routing to user-defined agents.

AIDEV-NOTE: This module handles routing to user-defined agents via @agent:name mentions.
Extracted from chat_processing_service.py to keep that file manageable.

Usage:
    from .mention_routing import handle_agent_mention_routing

    async for event in handle_agent_mention_routing(
        agent_mention="my-agent",
        task="do something",
        tool_provider=tool_provider,
        ...
    ):
        yield event
"""

import logging
import os
from typing import Any, AsyncIterator, Dict, List, Optional

import requests

from ..services.tool_provider import ToolProvider
from ..services.model_provider import SmolagentsModelProvider
from ..services.skill_executor import SkillExecutorService
from ..agents.agent_executor_agent import create_agent_executor
from .response_types import StreamResponseDict, ErrorResponseDict

logger = logging.getLogger(__name__)


def _create_error_response(error_code: str, error_message: str) -> ErrorResponseDict:
    """Create a typed error response dict."""
    return {
        "type": "error",
        "error": {
            "error_code": error_code,
            "error_message": error_message,
            "error_details": {"severity": "recoverable"},
            "hint": "",
            "can_retry": True,
            "auto_retry": False,
            "session_reset": False
        }
    }


async def _stream_text_chunks(text: str, chunk_size: int = 5) -> AsyncIterator[str]:
    """Stream text by word chunks to simulate streaming."""
    import asyncio
    words = text.split()
    for i in range(0, len(words), chunk_size):
        chunk = ' '.join(words[i:i + chunk_size]) + ' '
        yield chunk
        await asyncio.sleep(0.05)  # Small delay for realistic streaming feel


async def handle_agent_mention_routing(
    agent_mention: str,
    task: str,
    tool_provider: ToolProvider,
    model_provider: SmolagentsModelProvider,
    skill_executor_service: Optional[SkillExecutorService] = None,
    org_model: Optional[str] = None,
    images: Optional[List] = None,
) -> AsyncIterator[StreamResponseDict]:
    """
    Handle @agent:name mention routing to user-defined agents.

    Fetches the agent by name, loads its skills, creates an AgentExecutor,
    and runs the task through it directly (bypassing normal orchestration).

    Args:
        agent_mention: The agent name from @agent:name mention
        task: The cleaned task (with mention removed)
        tool_provider: ToolProvider for API calls
        model_provider: Model provider for creating agent
        skill_executor_service: Optional service for skill execution callbacks
        org_model: Organization model override
        images: Optional images from the message

    Yields:
        StreamResponseDict events (step_progress, content_chunk, error)
    """
    logger.info(f"🔄 Routing to @agent:{agent_mention} with task: {task[:100]}...")

    # 1. Fetch agent by name from API
    try:
        api_base = os.getenv("NEXT_API_URL", "http://localhost:3000")
        headers = {
            "Authorization": f"Bearer {tool_provider.api_key}",
            "Content-Type": "application/json"
        }

        # GET /api/agents?name=agent_mention
        agent_response = requests.get(
            f"{api_base}/api/agents",
            params={"name": agent_mention},
            headers=headers,
            timeout=10
        )

        if agent_response.status_code == 404:
            logger.warning(f"⚠️ Agent '{agent_mention}' not found")
            yield {
                "type": "content_chunk",
                "content": f"I couldn't find an agent named '{agent_mention}'. Please check the agent name and try again."
            }
            return

        if not agent_response.ok:
            logger.error(f"❌ Failed to fetch agent: {agent_response.status_code}")
            yield _create_error_response(
                "AGENT_LOOKUP_FAILED",
                f"Failed to look up agent '{agent_mention}'"
            )
            return

        agent_data = agent_response.json()
        if not agent_data.get("success") or not agent_data.get("data"):
            logger.warning(f"⚠️ Agent '{agent_mention}' not found in response")
            yield {
                "type": "content_chunk",
                "content": f"I couldn't find an agent named '{agent_mention}'. Please check the agent name and try again."
            }
            return

        agent_config = agent_data["data"]
        agent_id = agent_config.get("id")
        logger.info(f"✅ Found agent: {agent_config.get('name')} (id={agent_id})")

    except requests.RequestException as e:
        logger.error(f"❌ API request failed: {e}")
        yield _create_error_response(
            "AGENT_LOOKUP_FAILED",
            f"Failed to look up agent: {e}"
        )
        return

    # 2. Fetch agent's skills
    try:
        skills_response = requests.get(
            f"{api_base}/api/skills",
            params={"agent_id": agent_id},
            headers=headers,
            timeout=10
        )

        if skills_response.ok:
            skills_data = skills_response.json()
            skills = skills_data.get("data", [])
            logger.info(f"📦 Loaded {len(skills)} skills for agent {agent_id}")
        else:
            skills = []
            logger.warning(f"⚠️ Failed to load skills for agent {agent_id}")

    except requests.RequestException as e:
        logger.warning(f"⚠️ Skills fetch failed: {e}, continuing without skills")
        skills = []

    # 3. Create AgentExecutor
    model = model_provider.get_model(
        model_provider.resolve_model_selection(org_model=org_model)
    )

    # Create skill executor callback for skill invocation
    skill_executor_callback = None
    if skills and skill_executor_service:
        skill_executor_callback = skill_executor_service.create_executor_callback(
            org_model=org_model,
            return_message_parts=False,
            api_key=tool_provider.api_key,
            organization_id=tool_provider.organization_id
        )

    agent_executor = create_agent_executor(
        agent_config=agent_config,
        skills=skills,
        model=model,
        api_key=tool_provider.api_key,
        organization_id=tool_provider.organization_id,
        skill_executor_callback=skill_executor_callback,
        max_steps=15,
    )

    logger.info(f"🤖 Created AgentExecutor for {agent_config.get('name')}")

    # 4. Run the task through the executor
    # Send initial step progress
    yield {
        "type": "step_progress",
        "step_type": "ACTION",
        "step_name": f"Running {agent_config.get('name')}",
        "content": f"Executing task with {agent_config.get('name')}...",
        "metadata": {"agent_id": str(agent_id), "agent_name": agent_config.get("name")},
        "step_index": 0
    }

    try:
        # Run the agent (non-streaming for simplicity)
        result = agent_executor.run(
            task=task,
            images=images if images else None,
            reset=True  # Fresh execution for each mention
        )

        # Stream the result
        final_text = str(result) if result else "Task completed."
        async for chunk in _stream_text_chunks(final_text):
            yield {
                "type": "content_chunk",
                "content": chunk
            }

        logger.info(f"✅ AgentExecutor completed for @agent:{agent_mention}")

    except Exception as e:
        logger.error(f"❌ AgentExecutor failed: {e}")
        yield _create_error_response(
            "AGENT_EXECUTION_FAILED",
            f"Agent execution failed: {str(e)}"
        )
