"""
DSPy Capability Planning Guidance.

This module provides the capability routing header for the planner.
Individual capability guidance is accessed via PlanningRegistry and KNN retrievers.
"""

from __future__ import annotations

# Quick-reference routing table prepended to all capability guidance.
# Helps the planner match user intent to the correct target_agent.
CAPABILITY_ROUTING_HEADER = """
## YOUR CALLABLE TOOLS (use during planning research)

You have EXACTLY 4 tools available. Call any tool multiple times as needed:

1. `system_research` - Read existing tables, fields, pages from workspace
2. `search_external` - Find Pipedream integrations by service name (gmail, slack, etc.)
3. `web_search` - Research domain best practices, industry standards
4. `finish` - Complete planning and output your plan

>>> STOP: agent:schema_builder, agent:app_builder, table_crud, skill_tool are NOT callable.
>>> They are EXECUTION targets, not planning tools. See routing table below.

## Research Protocol

- CHECK WORKSPACE: Read workspace_context for existing resources. Don't recreate what exists.
- GET TOOL DETAILS: search_external(service="<name>") returns exact tool names and input schemas.
- LOOK UP DETAILS: system_research(resource_type='tables', query='<name>', include_details=True)
  retrieves field schemas, page content, and resource details.
- DOMAIN RESEARCH: web_search for external knowledge (industry practices, business requirements).

## Capability Routing — for plan step ROUTING only

The table below shows how to ROUTE plan steps to executors.
These are NOT tools you can call. The executor will handle routing automatically.

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
| Send/receive via external service (email, chat, API) | skill_builder | Use search_external for tool details |

SKILL EXECUTION: When user asks to "run", "execute", or "trigger" an existing skill,
route to skill_executor (NOT skill_builder). Check workspace_context for the skill ID.

MULTI-CAPABILITY TASKS: Use multiple route_to values across steps.
Example: "Build a CRM" -> schema_builder (tables) -> app_builder (UI) -> view_builder (data views).
Order: always create data (schema) before UI (app/page/view).

EXTERNAL INTEGRATIONS: If the task involves external services (Gmail, Slack, etc.),
call search_external(service="<name>") to get specific tool names and input schemas.
Include the specific tool name in the plan step and set connection_required.

## How to Write Plan Steps

Plan steps should describe WHAT to do, not WHICH agent to call:

GOOD: "Create table 'contacts' with fields: name (text), email (email), phone (phone)"
BAD: "Use agent:schema_builder to create the contacts table"

The executor will automatically route steps to the appropriate agent based on the action.
""".strip()


def get_planning_guidance(capability_id: str) -> str | None:
    """Return planning guidance for a capability. Returns None (use KNN retrievers)."""
    return None


def format_planning_guidance(capability_ids: list[str] | None = None) -> str:
    """Return the capability routing header."""
    return CAPABILITY_ROUTING_HEADER
