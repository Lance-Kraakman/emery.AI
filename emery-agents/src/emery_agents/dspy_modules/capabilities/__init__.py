"""
DSPy Capability Planning Guidance.

This module provides planning guidance for each capability, replacing the old
Jinja2 templates in prompts/capabilities/*/planning.j2.

The guidance tells the planner WHEN to choose each capability and HOW to
structure plan steps for it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from . import (
    agent_builder,
    app_builder,
    document_builder,
    page_builder,
    schema_builder,
    skill_builder,
    table_builder,
    view_builder,
)

if TYPE_CHECKING:
    pass


# Mapping from capability ID to planning guidance
_GUIDANCE_MAP: dict[str, str] = {
    "agent:schema_builder": schema_builder.PLANNING_GUIDANCE,
    "agent:skill_builder": skill_builder.PLANNING_GUIDANCE,
    "agent:app_builder": app_builder.PLANNING_GUIDANCE,
    "agent:document_builder": document_builder.PLANNING_GUIDANCE,
    "agent:agent_builder": agent_builder.PLANNING_GUIDANCE,
    "agent:page_builder": page_builder.PLANNING_GUIDANCE,
    "agent:table_builder": table_builder.PLANNING_GUIDANCE,
    "agent:view_builder": view_builder.PLANNING_GUIDANCE,
}


def get_all_planning_guidance() -> dict[str, str]:
    """
    Return all capability planning guidance.

    Returns:
        Dict mapping capability ID to planning guidance string.
    """
    return _GUIDANCE_MAP.copy()


def get_planning_guidance(capability_id: str) -> str | None:
    """
    Get planning guidance for a specific capability.

    Args:
        capability_id: The capability ID (e.g., "agent:schema_builder")

    Returns:
        Planning guidance string, or None if not found.
    """
    return _GUIDANCE_MAP.get(capability_id)


def format_planning_guidance(
    capability_ids: list[str] | None = None,
) -> str:
    """
    Format planning guidance as a single string for the planner.

    Args:
        capability_ids: Optional list of capability IDs to include.
                       If None, includes all capabilities.

    Returns:
        Formatted planning guidance string.
    """
    if capability_ids is None:
        guidance_list = list(_GUIDANCE_MAP.values())
    else:
        guidance_list = [
            _GUIDANCE_MAP[cap_id]
            for cap_id in capability_ids
            if cap_id in _GUIDANCE_MAP
        ]

    if not guidance_list:
        return ""

    return "\n\n".join(guidance_list)
