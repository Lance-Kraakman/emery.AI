"""
Tool Mode Classification

Categorizes tools as read-only or mutation-capable for two-phase execution.
Planning mode uses only read-only tools, execution mode uses all tools.
"""

from __future__ import annotations

import logging
from typing import Any

from emery_agents.types import ToolMode

logger = logging.getLogger(__name__)


# Tool names that are read-only (safe for planning phase)
# These tools only query/fetch data without making changes
READ_ONLY_TOOLS: set[str] = {
    # CRUD read operations (method parameter determines actual operation)
    # These tool names support read/list methods
    "database_crud",  # list, read methods are safe
    "table_crud",  # list, read methods are safe
    "field_crud",  # list, read methods are safe
    "row_crud",  # get_rows, read methods are safe
    "document_crud",  # read method is safe
    "skill_crud",  # list, read methods are safe
    "file_crud",  # read, download methods are safe
    "agent_crud",  # list, read methods are safe
    "team_crud",  # list, read methods are safe
    # Organizational/query tools
    "emery_database",
    "table_schema",
    "table_data",
    # External read-only
    "web_search",
    # File reading
    "file_reader",
    "document_reader",
    "template_reader",
    # Query/analysis tools
    "table_query",
    "calculator",
    # System introspection (ResearchEmery)
    "system_research",  # Queries Emery platform resources (agents, skills, tasks, etc.)
}

# Methods within CRUD tools that are read-only
READ_ONLY_METHODS: set[str] = {
    "list",
    "read",
    "get",
    "get_rows",
    "download",
    "query",
    "search",
}

# Methods within CRUD tools that perform mutations
MUTATION_METHODS: set[str] = {
    "create",
    "create_row",
    "create_table",
    "create_database",
    "create_field",
    "update",
    "update_row",
    "update_table",
    "update_database",
    "update_field",
    "delete",
    "delete_row",
    "delete_table",
    "delete_database",
    "delete_field",
    "append_text",
    "append_heading",
    "append_list",
    "update_text",
    "update_heading",
    "upload",
    "write",
}

# Tools that always perform mutations (no read-only methods)
MUTATION_ONLY_TOOLS: set[str] = {
    "tool_executor",  # Executes arbitrary tools
    "pipedream",  # External integrations
    "output",  # Writes output
    "skill_tool",  # Executes skills
    "document_generator",  # Creates documents
    "file_writer",  # Writes files
    "simple_report_saver",  # Saves reports
}


def is_read_only_tool(tool_name: str, method: str | None = None) -> bool:
    """
    Determine if a tool/method combination is read-only.

    Args:
        tool_name: Name of the tool (e.g., "row_crud", "web_search")
        method: Optional method being called (e.g., "list", "create")

    Returns:
        True if the tool/method is read-only, False if it can mutate
    """
    tool_name_lower = tool_name.lower()

    # Check if it's a mutation-only tool
    if tool_name_lower in MUTATION_ONLY_TOOLS:
        return False

    # If method is specified, check if it's a read-only method
    if method:
        method_lower = method.lower()
        if method_lower in MUTATION_METHODS:
            return False
        if method_lower in READ_ONLY_METHODS:
            return True

    # Check if tool is in read-only list
    if tool_name_lower in READ_ONLY_TOOLS:
        # Without a specific method, assume CRUD tools could mutate
        # Only return True if we know the method is safe
        if method is None:
            return False  # Be conservative - CRUD tools can mutate
        return True

    # Default: assume tools can mutate (conservative)
    return False


def filter_tools_for_mode(
    tools: list[Any],
    mode: ToolMode,
    get_tool_name: callable | None = None,
) -> list[Any]:
    """
    Filter tools based on execution mode.

    Planning mode includes CRUD tools because:
    1. BaseCrudTool._check_mutation_allowed() blocks mutations at runtime
    2. CRUD tools have useful read methods (list, read, get) for discovery
    3. Workspace context building needs CRUD tools to list databases/tables

    Only MUTATION_ONLY_TOOLS are excluded (tools with no read methods).

    Args:
        tools: List of tool objects
        mode: ToolMode.PLANNING (read-only) or ToolMode.EXECUTION (all)
        get_tool_name: Optional function to extract tool name from tool object.
                      Defaults to checking .name attribute.

    Returns:
        Filtered list of tools appropriate for the mode
    """
    if mode == ToolMode.EXECUTION:
        return tools

    # Planning mode: include all tools EXCEPT mutation-only tools
    # CRUD tools are allowed because they have runtime protection via _check_mutation_allowed()
    def extract_name(tool: Any) -> str:
        if get_tool_name:
            return get_tool_name(tool)
        if hasattr(tool, "name"):
            return tool.name
        return str(tool)

    filtered = []
    for tool in tools:
        tool_name = extract_name(tool)
        tool_name_lower = tool_name.lower()

        # Only exclude tools that ONLY mutate (no read methods)
        if tool_name_lower in MUTATION_ONLY_TOOLS:
            logger.debug(f"Planning mode: excluding mutation-only tool {tool_name}")
        else:
            filtered.append(tool)
            logger.debug(f"Planning mode: including tool {tool_name}")

    return filtered


def get_planning_tool_restrictions() -> str:
    """
    Get a human-readable description of planning mode restrictions.

    Returns:
        String describing what tools are available in planning mode
    """
    return """In PLANNING mode, you have access to most tools with READ-ONLY operations:
- CRUD tools (database_crud, table_crud, etc.) - READ methods only (list, read, get)
- Web search and fetch
- File and document readers
- Table queries and schema inspection
- Calculator
- System research (agents, skills, tasks, apps, audit)

MUTATIONS ARE BLOCKED at runtime. If you try to create/update/delete, you'll get an error.

You DO NOT have access to:
- Tool executor (executes arbitrary tools)
- Skill execution
- File writing
- Document generator

Focus on gathering information and creating a detailed plan."""


def get_execution_tool_permissions() -> str:
    """
    Get a human-readable description of execution mode permissions.

    Returns:
        String describing what tools are available in execution mode
    """
    return """In EXECUTION mode, you have access to ALL tools:
- Full CRUD operations (create, read, update, delete)
- Tool executor for external integrations
- Skill execution
- File operations
- All read-only tools from planning mode

Execute the approved plan step by step."""
