"""Tool factory functions for creating tool sets with auth."""

from __future__ import annotations

from typing import TYPE_CHECKING

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

if TYPE_CHECKING:
    from emery_agents.planning.registry import PlanningRegistry

    from .capability_registry import CapabilityRegistry


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
    capability_registry: CapabilityRegistry | None = None,
    planning_registry: PlanningRegistry | None = None,
    extra_headers: dict[str, str] | None = None,
) -> list[dspy.Tool]:
    """Create all DSPy tool functions with auth captured."""
    tools: list[dspy.Tool] = []
    tools.extend(create_crud_tools(api_key, org_id, extra_headers=extra_headers))
    tools.extend(
        create_discovery_tools(api_key, org_id, capability_registry, planning_registry)
    )
    return tools
