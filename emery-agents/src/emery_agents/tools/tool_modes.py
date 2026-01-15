"""
Tool Mode Classification

Categorizes tools as read-only or mutation-capable for two-phase execution.
Planning mode uses only read-only tools, execution mode uses all tools.
"""

from enum import Enum
from typing import List, Set, Optional, Any
import logging

logger = logging.getLogger(__name__)


class ToolMode(Enum):
    """Execution mode for tool access."""
    PLANNING = "planning"   # Read-only tools only
    EXECUTION = "execution"  # All tools available


# Tool names that are read-only (safe for planning phase)
# These tools only query/fetch data without making changes
READ_ONLY_TOOLS: Set[str] = {
    # CRUD read operations (method parameter determines actual operation)
    # These tool names support read/list methods
    "database_crud",  # list, read methods are safe
    "table_crud",     # list, read methods are safe
    "field_crud",     # list, read methods are safe
    "row_crud",       # get_rows, read methods are safe
    "document_crud",  # read method is safe
    "skill_crud",     # list, read methods are safe
    "file_crud",      # read, download methods are safe
    "agent_crud",     # list, read methods are safe
    "team_crud",      # list, read methods are safe
    # Organizational/query tools
    "emery_database",
    "table_schema",
    "table_data",
    # External read-only
    "web_search",
    "web_fetch",
    # File reading
    "file_reader",
    "document_reader",
    "template_reader",
    # Query/analysis tools
    "table_query",
    "calculator",
}

# Methods within CRUD tools that are read-only
READ_ONLY_METHODS: Set[str] = {
    "list",
    "read",
    "get",
    "get_rows",
    "download",
    "query",
    "search",
}

# Methods within CRUD tools that perform mutations
MUTATION_METHODS: Set[str] = {
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
MUTATION_ONLY_TOOLS: Set[str] = {
    "tool_executor",      # Executes arbitrary tools
    "pipedream",          # External integrations
    "output",             # Writes output
    "skill_tool",         # Executes skills
    "document_generator", # Creates documents
    "file_writer",        # Writes files
    "simple_report_saver", # Saves reports
}


def is_read_only_tool(tool_name: str, method: Optional[str] = None) -> bool:
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
    tools: List[Any],
    mode: ToolMode,
    get_tool_name: Optional[callable] = None,
) -> List[Any]:
    """
    Filter tools based on execution mode.

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

    # Planning mode: filter to read-only tools
    def extract_name(tool: Any) -> str:
        if get_tool_name:
            return get_tool_name(tool)
        if hasattr(tool, 'name'):
            return tool.name
        return str(tool)

    filtered = []
    for tool in tools:
        tool_name = extract_name(tool)
        # For planning, we're conservative - only include known read-only tools
        # and exclude CRUD tools since they can mutate
        if tool_name.lower() in READ_ONLY_TOOLS and tool_name.lower() not in {
            # Exclude CRUD tools from planning since they have mutation methods
            "database_crud", "table_crud", "field_crud", "row_crud",
            "document_crud", "skill_crud", "file_crud", "agent_crud", "team_crud"
        }:
            filtered.append(tool)
            logger.debug(f"Planning mode: including tool {tool_name}")
        elif tool_name.lower() in {"web_search", "web_fetch", "calculator",
                                   "file_reader", "document_reader", "template_reader",
                                   "table_query", "emery_database", "table_schema", "table_data"}:
            # Explicitly safe read-only tools
            filtered.append(tool)
            logger.debug(f"Planning mode: including safe tool {tool_name}")
        else:
            logger.debug(f"Planning mode: excluding tool {tool_name}")

    return filtered


def get_planning_tool_restrictions() -> str:
    """
    Get a human-readable description of planning mode restrictions.

    Returns:
        String describing what tools are available in planning mode
    """
    return """In PLANNING mode, you have access to READ-ONLY tools only:
- Web search and fetch
- File and document readers
- Table queries and schema inspection
- Calculator

You DO NOT have access to:
- CRUD operations (create, update, delete)
- Tool executor
- Skill execution
- File writing
- Any mutation operations

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
