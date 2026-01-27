"""
@agent Mention Routing - Direct routing to user-defined agents.

AIDEV-NOTE: This module handles routing to user-defined agents via @agent:name mentions.
Extracted from chat_processing_service.py to keep that file manageable.

Uses AgentAPIService for consistent API access with RLS headers and observability,
sharing the same patterns as ManagedAgentsFactory.load_user_agents().

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

import asyncio
import logging
from typing import Any, AsyncIterator, List, Optional

from ..services.tools.provider import ToolProvider
from ..services.skills.executor import SkillExecutorService
from ..services.agents.api import AgentAPIService
from ..agents.agent_executor_agent import create_agent_executor
from .response_types import StreamResponseDict, create_error_response

logger = logging.getLogger(__name__)


async def _stream_text_chunks(text: str, chunk_size: int = 8) -> AsyncIterator[str]:
    """Stream text by word chunks for progressive UI display."""
    words = text.split()
    for i in range(0, len(words), chunk_size):
        chunk = ' '.join(words[i:i + chunk_size]) + ' '
        yield chunk
        await asyncio.sleep(0.02)  # Small delay for progressive display


async def handle_agent_mention_routing(
    agent_mention: str,
    task: str,
    tool_provider: ToolProvider,
    skill_executor_service: Optional[SkillExecutorService] = None,
    org_model: Optional[str] = None,
    images: Optional[List[Any]] = None,
) -> AsyncIterator[StreamResponseDict]:
    """
    Handle @agent:name mention routing to user-defined agents.

    Fetches the agent by name, loads its skills, creates an AgentExecutor,
    and runs the task through it directly (bypassing normal orchestration).

    AIDEV-NOTE: Uses AgentAPIService for API calls, sharing patterns with
    ManagedAgentsFactory.load_user_agents() for consistency.

    Args:
        agent_mention: The agent name from @agent:name mention
        task: The cleaned task (with mention removed)
        tool_provider: ToolProvider for API calls
        skill_executor_service: Optional service for skill execution callbacks
        org_model: Organization model override
        images: Optional images from the message

    Yields:
        StreamResponseDict events (step_progress, content_chunk, error)
    """
    logger.info(f"[MENTION-ROUTING] Routing to @agent:{agent_mention} with task: {task[:100]}...")

    # Use shared AgentAPIService for consistent API access
    api_service = AgentAPIService(
        api_key=tool_provider.api_key,
        organization_id=tool_provider.organization_id,
    )

    # 1. Fetch agent by name
    agent_data = await api_service.fetch_agent_by_name(agent_mention)

    if not agent_data:
        logger.warning(f"[MENTION-ROUTING] Agent '{agent_mention}' not found")
        yield {
            "type": "content_chunk",
            "content": f"I couldn't find an agent named '{agent_mention}'. Please check the agent name and try again."
        }
        return

    agent_config = agent_data.raw
    agent_id = agent_data.id
    logger.info(f"[MENTION-ROUTING] Found agent: {agent_data.name} (id={agent_id})")

    # 2. Fetch agent's skills
    skills_data = await api_service.fetch_skills(agent_id)
    skills = [s.raw for s in skills_data]
    logger.info(f"[MENTION-ROUTING] Loaded {len(skills)} skills for agent {agent_id}")

    # 3. Create AgentExecutor
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
        api_key=tool_provider.api_key,
        organization_id=tool_provider.organization_id,
        skill_executor_callback=skill_executor_callback,
        max_steps=15,
    )

    logger.info(f"[MENTION-ROUTING] Created AgentExecutor for {agent_data.name}")

    # 4. Run the task through the executor
    # Send initial step progress
    yield {
        "type": "step_progress",
        "step_type": "ACTION",
        "step_name": f"Running {agent_data.name}",
        "content": f"Executing task with {agent_data.name}...",
        "metadata": {"agent_id": str(agent_id), "agent_name": agent_data.name},
        "step_index": 0
    }

    try:
        # Run the agent in a thread pool to avoid blocking async loop
        # DSPy ExecutorModule is synchronous, so we run in executor
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: agent_executor.run(
                task=task,
                images=images if images else None,
                reset=True  # Fresh execution for each mention
            )
        )

        # Stream the result progressively
        final_text = str(result) if result else "Task completed."
        async for chunk in _stream_text_chunks(final_text):
            yield {
                "type": "content_chunk",
                "content": chunk
            }

        logger.info(f"[MENTION-ROUTING] AgentExecutor completed for @agent:{agent_mention}")

    except Exception as e:
        logger.error(f"[MENTION-ROUTING] AgentExecutor failed: {e}")
        yield create_error_response(
            "AGENT_EXECUTION_FAILED",
            f"Agent execution failed: {str(e)}"
        )
