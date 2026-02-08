"""
DSPy Capability Planning Guidance.

This module provides the capability routing header for the planner.
Individual capability guidance has been migrated to PlanningRegistry
and is now accessed via the search_planning_patterns tool.
"""

from __future__ import annotations

# Quick-reference routing table prepended to all capability guidance.
# Helps the planner match user intent to the correct target_agent.
CAPABILITY_ROUTING_HEADER = """
## Research Protocol

Use these tools as needed during planning. Call any tool multiple times to refine your understanding.

- CHECK WORKSPACE: Read workspace_context for existing resources. Don't recreate what exists.
- DISCOVER CAPABILITIES: search_capabilities(query="...") finds system agents, user skills,
  AND external integrations (Gmail, Slack, etc.). Good starting point for any task.
- GET PLANNING PATTERNS: search_planning_patterns(query="...") finds relevant planning strategies,
  step templates, and examples for your task. Use this to structure your plan steps.
- GET TOOL DETAILS: search_external(service="<name>") returns exact tool names and input schemas.
  Call after you know which service you need (e.g., from search_capabilities results).
- LOOK UP DETAILS: system_research(resource_type='tables', query='<name>', include_details=True)
  retrieves field schemas, page content, and resource details for existing workspace resources.
- DOMAIN RESEARCH: web_search for external knowledge (industry practices, business requirements).

Do NOT call search_external without knowing which service — use search_capabilities to discover services first.

## Capability Routing — Quick Reference

>>> YOUR CALLABLE PLANNING TOOLS: system_research, search_external, search_capabilities, search_planning_patterns, web_search, finish
>>> NOTHING ELSE IS CALLABLE. The "route_to" column below is for plan step ROUTING ONLY — NOT tool calls.

| User Intent | route_to (NOT a tool!) | Step Capability |
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
| Send/receive via external service (email, chat, API) | skill_builder | search_capabilities -> search_external for tool details |

SKILL EXECUTION: When user asks to "run", "execute", or "trigger" an existing skill,
route to skill_executor (NOT skill_builder). Check workspace_context for the skill ID.

MULTI-CAPABILITY TASKS: Use multiple route_to values across steps.
Example: "Build a CRM" -> schema_builder (tables) -> app_builder (UI) -> view_builder (data views).
Order: always create data (schema) before UI (app/page/view).

EXTERNAL INTEGRATIONS: If task_analysis lists external services (Gmail, Slack, etc.),
call search_capabilities first to verify which integrations are available, then
call search_external(service="<name>") to get specific tool names and input schemas.
Include the specific tool name in the plan step and set connection_required.

AMBIGUOUS INTEGRATIONS: If search_capabilities returns multiple matching integrations
for a task (e.g., both Gmail and Outlook for "send email"), always ask the user which
service to use. If the user already specified (e.g., "send with Gmail"), proceed directly.
""".strip()


def get_planning_guidance(capability_id: str) -> str | None:
    """
    DEPRECATED: Use search_planning_patterns tool instead.

    This function is kept for backwards compatibility but returns None.
    Planning guidance is now accessed dynamically via PlanningRegistry.
    """
    return None


def format_planning_guidance(
    capability_ids: list[str] | None = None,
) -> str:
    """
    Return the capability routing header.

    Individual capability guidance has been migrated to PlanningRegistry
    and is accessed via the search_planning_patterns tool during planning.
    """
    return CAPABILITY_ROUTING_HEADER
