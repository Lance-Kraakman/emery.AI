"""
@skill Mention Routing - Direct routing to user-defined skills.

Handles routing to skills via @skill:name mentions, bypassing the planner entirely.
Uses SkillAPIService for skill lookup and DynamicSkillTool for execution.

Usage:
    from .skill_mention_routing import handle_skill_mention_routing

    skill_invocation = parse_skill_invocation(current_task)
    if skill_invocation:
        async for event in handle_skill_mention_routing(
            skill_invocation=skill_invocation,
            tool_provider=tool_provider,
            org_model=org_model,
        ):
            yield event
"""

import asyncio
import logging
from typing import AsyncIterator, Optional

from ..utils.mention_parser import SkillInvocation
from ..services.tools.provider import ToolProvider
from emery_agents.api import SkillAPIService
from ..reasoning.tools.integrations.dynamic_skill import DynamicSkillTool
from .response_types import StreamResponseDict, create_error_response

logger = logging.getLogger(__name__)


async def _stream_text_chunks(text: str, chunk_size: int = 8) -> AsyncIterator[str]:
    """Stream text by word chunks for progressive UI display."""
    words = text.split()
    for i in range(0, len(words), chunk_size):
        chunk = ' '.join(words[i:i + chunk_size]) + ' '
        yield chunk
        await asyncio.sleep(0.02)


async def handle_skill_mention_routing(
    skill_invocation: SkillInvocation,
    tool_provider: ToolProvider,
    org_model: Optional[str] = None,
) -> AsyncIterator[StreamResponseDict]:
    """
    Handle @skill:name mention routing to user-defined skills.

    Looks up the skill by name via SkillAPIService, creates a DynamicSkillTool,
    and executes it directly with parsed inputs (bypassing normal orchestration).

    Args:
        skill_invocation: Parsed skill invocation with name, inputs, cleaned_task
        tool_provider: ToolProvider for API credentials
        org_model: Organization model override (unused for skill execution)

    Yields:
        StreamResponseDict events (step_progress, content_chunk, error)
    """
    skill_name = skill_invocation.skill_name
    logger.info(
        f"[SKILL-ROUTING] Routing to @skill:{skill_name} "
        f"with {len(skill_invocation.inputs)} inputs"
    )

    api_key = tool_provider.api_key
    org_id = str(tool_provider.organization_id)

    # 1. Look up skill by name via SkillAPIService
    try:
        api_service = SkillAPIService(api_key=api_key, organization_id=org_id)
        skill_data = await api_service.fetch_skill_by_name(skill_name)
    except Exception as e:
        logger.error(f"[SKILL-ROUTING] Failed to fetch skills: {e}")
        yield create_error_response(
            "SKILL_LOOKUP_FAILED",
            f"Failed to look up skills: {str(e)}"
        )
        return

    if not skill_data:
        logger.warning(f"[SKILL-ROUTING] Skill '{skill_name}' not found")
        # Fetch available names for the error message
        try:
            all_skills = await api_service.fetch_skills()
            skill_names = [s.name for s in all_skills]
        except Exception:
            skill_names = []
        yield {
            "type": "content_chunk",
            "content": (
                f"I couldn't find a skill named '{skill_name}'. "
                f"Available skills: {', '.join(skill_names) if skill_names else 'none'}"
            )
        }
        return

    logger.info(
        f"[SKILL-ROUTING] Found skill: {skill_data.name} (id={skill_data.id})"
    )

    # 2. Send initial progress event
    yield {
        "type": "step_progress",
        "step_type": "ACTION",
        "step_name": f"Running {skill_data.name}",
        "content": f"Executing skill {skill_data.name}...",
        "metadata": {"skill_name": skill_data.name},
        "step_index": 0
    }

    # 3. Create DynamicSkillTool and execute
    try:
        tool = await asyncio.to_thread(
            DynamicSkillTool,
            skill_id=int(skill_data.id),
            api_key=api_key,
            organization_id=int(org_id),
        )

        inputs = skill_invocation.inputs or {}
        logger.info(
            f"[SKILL-ROUTING] Executing skill {skill_data.id} "
            f"with inputs: {list(inputs.keys())}"
        )

        result = await asyncio.to_thread(tool.forward, **inputs)

        # Stream the result progressively
        final_text = str(result) if result else "Skill executed successfully."
        async for chunk in _stream_text_chunks(final_text):
            yield {
                "type": "content_chunk",
                "content": chunk
            }

        logger.info(f"[SKILL-ROUTING] Skill execution completed for @skill:{skill_name}")

    except Exception as e:
        logger.error(f"[SKILL-ROUTING] Skill execution failed: {e}")
        yield create_error_response(
            "SKILL_EXECUTION_FAILED",
            f"Skill execution failed: {str(e)}"
        )
