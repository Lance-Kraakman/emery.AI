"""
Adapters to convert legacy ExecutionContext to typed request objects.

Provides backwards compatibility during migration from the old executor
architecture to the new ExecutionRouter.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Union

from emery_agents.entities.configs import (
    AuthConfig,
    CoordinatorRequest,
    InteractiveRequest,
    SkillRequest,
    WorkflowRequest,
)
from emery_agents.entities.tool_config import ToolConfig

if TYPE_CHECKING:
    from emery_agents.entities.execution_context import ExecutionContext


def _convert_tools(tools: list[Any] | None) -> list[ToolConfig]:
    """Convert tool list to ToolConfig list.

    ExecutionContext.available_tools may be list[str] (tool names) or list[ToolConfig].
    This function handles both cases, returning an empty list for strings since
    the executor will load tools separately.
    """
    if not tools:
        return []
    # Check if first item is already a ToolConfig
    if tools and isinstance(tools[0], ToolConfig):
        return list(tools)  # type: ignore[arg-type]
    # Tool names only - executor will load tools separately
    return []

# Union of all request types
ExecutionRequest = Union[
    InteractiveRequest,
    SkillRequest,
    WorkflowRequest,
    CoordinatorRequest,
]


def context_to_request(ctx: ExecutionContext) -> ExecutionRequest:
    """Convert legacy ExecutionContext to appropriate typed request.

    Routes based on context fields:
    - use_coordinator=True → CoordinatorRequest
    - skill with is_workflow() → WorkflowRequest
    - skill set → SkillRequest
    - otherwise → InteractiveRequest

    Args:
        ctx: Legacy ExecutionContext with mixed concerns

    Returns:
        Typed request object for ExecutionRouter
    """
    # Build auth from context
    auth = AuthConfig(
        api_key=ctx.tool_provider.api_key if ctx.tool_provider else "",
        org_id=ctx.organization_id or 0,
        org_model=ctx.org_model,
    )

    # Route: Coordinator mode (two-phase plan-execute)
    if ctx.use_coordinator:
        return CoordinatorRequest(
            goal=ctx.task,
            auth=auth,
            tools=_convert_tools(ctx.available_tools),
            images=list(ctx.images) if ctx.images else [],
            attachments=list(ctx.attachments) if ctx.attachments else [],
            plan=ctx.plan,
            workspace_path=ctx.workspace_path,
            agent_id=ctx.agent_id,
            max_steps=ctx.max_steps,
        )

    # Route: Skill-based execution
    if ctx.skill:
        skill = ctx.skill

        # Workflow skill (DAG steps)
        if skill.is_workflow():
            return WorkflowRequest(
                steps=list(skill.steps),
                initial_inputs=ctx.skill_inputs or {},
                auth=auth,
                available_skills={s.id: s for s in (ctx.available_skills or [])},
                skill_model=ctx.agent_model,
            )

        # Agentic or human skill
        return SkillRequest(
            skill=skill,
            inputs=ctx.skill_inputs or {},
            auth=auth,
            resolved_context=ctx.resolved_context,
            available_skills=list(ctx.available_skills) if ctx.available_skills else [],
            source_row_id=ctx.source_row_id,
            capture_outputs=True,  # Default to capturing for backwards compat
            skill_model=ctx.agent_model,
        )

    # Route: Interactive (direct chat command)
    return InteractiveRequest(
        task=ctx.task,
        auth=auth,
        tools=_convert_tools(ctx.available_tools),
        images=list(ctx.images) if ctx.images else [],
        attachments=list(ctx.attachments) if ctx.attachments else [],
        session_attachments=list(ctx.session_attachments) if ctx.session_attachments else [],
        agent_id=ctx.agent_id,
        agent_model=ctx.agent_model,
        max_steps=ctx.max_steps,
        timeout_seconds=ctx.timeout_seconds,
    )
