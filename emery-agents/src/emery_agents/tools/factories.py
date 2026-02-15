"""Tool factory functions for creating tool sets with auth."""

from __future__ import annotations

import dspy

from .crud import (
    create_agent_crud,
    create_app_crud,
    create_database_crud,
    create_document_crud,
    create_field_crud,
    create_file_crud,
    create_page_crud,
    create_row_crud,
    create_skill_crud,
    create_table_crud,
    create_team_crud,
    create_view_crud,
)
from .discovery import create_discovery_tools


def create_direct_mode_tools(
    api_key: str,
    org_id: str,
) -> list[dspy.Tool]:
    """Create lightweight tool set for direct execution.

    Only includes tools useful for Q&A and lookup:
    - Discovery tools (workspace_overview, system_research, web_search, search_external)
    - row_crud (for looking up specific records like "John Smith")
    - table_crud (for listing tables/fields)

    This reduces token usage from ~440K (24 tools) to ~60K (6 tools).
    Mutations are blocked via ToolMode.PLANNING in direct_execute_node.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        List of 6 DSPy tool instances for direct mode
    """
    tools: list[dspy.Tool] = []
    tools.extend(create_discovery_tools(api_key, org_id))  # 4 tools
    tools.append(create_row_crud(api_key, org_id))  # For record lookup
    tools.append(create_table_crud(api_key, org_id))  # For schema lookup
    return tools


def create_crud_tools(
    api_key: str,
    org_id: str,
    extra_headers: dict[str, str] | None = None,
) -> list[dspy.Tool]:
    """Create all CRUD tool functions with auth captured."""
    return [
        create_table_crud(api_key, org_id, extra_headers=extra_headers),
        create_field_crud(api_key, org_id, extra_headers=extra_headers),
        create_row_crud(api_key, org_id, extra_headers=extra_headers),
        create_database_crud(api_key, org_id, extra_headers=extra_headers),
        create_view_crud(api_key, org_id, extra_headers=extra_headers),
        create_app_crud(api_key, org_id, extra_headers=extra_headers),
        create_page_crud(api_key, org_id, extra_headers=extra_headers),
        create_document_crud(api_key, org_id, extra_headers=extra_headers),
        create_file_crud(api_key, org_id, extra_headers=extra_headers),
        create_skill_crud(api_key, org_id, extra_headers=extra_headers),
        create_agent_crud(api_key, org_id, extra_headers=extra_headers),
        create_team_crud(api_key, org_id, extra_headers=extra_headers),
    ]


def create_all_tools(
    api_key: str,
    org_id: str,
    extra_headers: dict[str, str] | None = None,
) -> list[dspy.Tool]:
    """Create all DSPy tool functions with auth captured."""
    tools: list[dspy.Tool] = []
    tools.extend(create_crud_tools(api_key, org_id, extra_headers=extra_headers))
    tools.extend(create_discovery_tools(api_key, org_id))
    return tools
