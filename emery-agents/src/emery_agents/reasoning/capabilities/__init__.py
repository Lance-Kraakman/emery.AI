"""
DSPy Capability Planning Guidance.

This module provides planning guidance for each capability, replacing the old
Jinja2 templates in prompts/capabilities/*/planning.j2.

The guidance tells the planner WHEN to choose each capability and HOW to
structure plan steps for it.
"""

from __future__ import annotations

from . import (
    agent_builder,
    app_builder,
    document_builder,
    page_builder,
    schema_builder,
    skill_builder,
    skill_executor,
    table_builder,
    view_builder,
)


# Quick-reference routing table prepended to all capability guidance.
# Helps the planner match user intent to the correct target_agent.
CAPABILITY_ROUTING_HEADER = """
## Capability Routing — Quick Reference

| User Intent | target_agent | Capability |
|---|---|---|
| Create/modify tables, fields, data schema | schema_builder | agent:schema_builder |
| Build apps, dashboards, portals, UI | app_builder | agent:app_builder |
| Create pages, layouts, visual blocks | page_builder | agent:page_builder |
| Create data views (grids, forms, detail) | view_builder | agent:view_builder |
| Create/configure agents | agent_builder | agent:agent_builder |
| Create/configure skills (automations) | skill_builder | agent:skill_builder |
| Execute existing skills/automations | skill_executor | agent:skill_executor |
| Generate documents, reports, templates | document_builder | agent:document_builder |
| Add/update/delete records in tables | table_builder | agent:table_builder |

SKILL EXECUTION: When user asks to "run", "execute", or "trigger" an existing skill,
use skill_executor (NOT skill_builder). Check workspace_context for the skill ID.

MULTI-CAPABILITY TASKS: Use multiple target_agents across steps.
Example: "Build a CRM" → schema_builder (tables) → app_builder (UI) → view_builder (data views).
Order: always create data (schema) before UI (app/page/view).

IMPORTANT: target_agent values (schema_builder, skill_builder, etc.) are NOT callable tools.
They are routing labels for plan steps. Do NOT call them as tools.
Your available tools during planning are ONLY: system_research, search_capabilities, search_external.
""".strip()

# Mapping from capability ID to planning guidance
_GUIDANCE_MAP: dict[str, str] = {
    "agent:schema_builder": schema_builder.PLANNING_GUIDANCE,
    "agent:skill_builder": skill_builder.PLANNING_GUIDANCE,
    "agent:skill_executor": skill_executor.PLANNING_GUIDANCE,
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
        return CAPABILITY_ROUTING_HEADER

    return CAPABILITY_ROUTING_HEADER + "\n\n" + "\n\n".join(guidance_list)
