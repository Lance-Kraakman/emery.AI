"""
Tool Profiles — Domain-Based Tool Selection

Reduces the tool surface for direct execution by selecting only relevant
CRUD tools based on triage analysis (intent + entities). Discovery tools
are always included — inline research is the correct behavior for direct mode.

Fallback: all tools when task type is unclear.
"""

from __future__ import annotations

import logging
from typing import Any

import dspy

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool groups by domain
# ---------------------------------------------------------------------------

# Schema operations: table/field/database management
SCHEMA_TOOLS = {"table_crud", "field_crud", "database_crud"}

# Data operations: row/record management
DATA_TOOLS = {"row_crud", "table_crud"}

# App building: apps, pages, views
APP_TOOLS = {"app_crud", "page_crud", "view_crud"}

# Automation: skills, agents
AUTOMATION_TOOLS = {"skill_crud", "agent_crud"}

# Content: documents, files
CONTENT_TOOLS = {"document_crud", "file_crud"}

# Administrative
ADMIN_TOOLS = {"team_crud"}

# Discovery tools — always included in direct execution
DISCOVERY_TOOL_NAMES = {
    "system_research", "workspace_overview", "search_capabilities",
    "search_external", "web_search", "memory_crud",
    "conversation_history", "search_knowledge", "search_planning_patterns",
}

# Non-CRUD tools that should always pass through (ask_question, memory, etc.)
PASSTHROUGH_TOOL_NAMES = {"ask_question", "memory_crud", "conversation_history"}


# ---------------------------------------------------------------------------
# Keyword → tool group mapping
# ---------------------------------------------------------------------------

# Keywords in intent/entities that indicate which tool groups are needed.
# Checked case-insensitively against the combined intent + entities text.
_KEYWORD_GROUPS: list[tuple[set[str], set[str]]] = [
    # Keywords → tool names
    (
        {"table", "field", "column", "schema", "database", "db", "record"},
        SCHEMA_TOOLS | DATA_TOOLS,
    ),
    (
        {"row", "rows", "data", "record", "records", "entry", "entries", "import"},
        DATA_TOOLS | SCHEMA_TOOLS,
    ),
    (
        {"app", "application", "page", "view", "grid", "kanban", "calendar",
         "dashboard", "layout", "form"},
        APP_TOOLS,
    ),
    (
        {"skill", "agent", "automation", "trigger", "workflow", "schedule"},
        AUTOMATION_TOOLS,
    ),
    (
        {"document", "file", "upload", "attachment", "pdf", "report"},
        CONTENT_TOOLS,
    ),
    (
        {"team", "member", "invite", "permission", "role"},
        ADMIN_TOOLS,
    ),
]


def select_tools_for_task(
    all_tools: list[dspy.Tool],
    triage_analysis: dict[str, Any] | None = None,
) -> list[dspy.Tool]:
    """Select relevant tools based on triage analysis.

    Returns a subset of tools relevant to the task domain.
    Discovery tools and passthrough tools are always included.
    Falls back to all tools if task type is unclear.

    Args:
        all_tools: Full list of available tools.
        triage_analysis: Dict with 'intent' and 'entities' from triage node.

    Returns:
        Filtered tool list (or all tools if no filtering possible).
    """
    if not triage_analysis:
        return all_tools

    intent = triage_analysis.get("intent", "")
    entities = triage_analysis.get("entities", [])
    external_services = triage_analysis.get("external_services", [])

    # Build search text from intent + entities
    search_text = f"{intent} {' '.join(entities)}".lower()
    if not search_text.strip():
        return all_tools

    # Collect matching tool names
    matched_tools: set[str] = set()
    for keywords, tool_names in _KEYWORD_GROUPS:
        if any(kw in search_text for kw in keywords):
            matched_tools |= tool_names

    # If external services mentioned, include skill_crud for integrations
    if external_services:
        matched_tools.add("skill_crud")

    # No matches — fall back to all tools
    if not matched_tools:
        logger.debug("No tool profile matched, using all tools")
        return all_tools

    logger.info(f"Tool profile selected {len(matched_tools)} CRUD tools: {sorted(matched_tools)}")

    # Filter: keep matched CRUD tools + all discovery/passthrough tools + unknown tools
    filtered: list[dspy.Tool] = []
    for tool in all_tools:
        name = getattr(tool, "name", "").lower()
        if name in matched_tools:
            filtered.append(tool)
        elif name in DISCOVERY_TOOL_NAMES or name in PASSTHROUGH_TOOL_NAMES:
            filtered.append(tool)
        elif not name.endswith("_crud"):
            # Non-CRUD tools (external tools, etc.) — always include
            filtered.append(tool)

    return filtered
