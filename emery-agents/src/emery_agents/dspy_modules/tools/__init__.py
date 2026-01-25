"""
DSPy tool factories.

This module provides factory functions that create DSPy-compatible tool functions.
Each tool function has authentication captured via closures.

Usage:
    tools = create_all_tools(api_key="...", org_id="...")
    # tools is a list of callable functions ready for DSPy ReAct
"""

from __future__ import annotations

from typing import Callable

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
from .output import (
    ClarificationRequestedException,
    QuestionCollector,
    StepCollector,
    create_ask_question_tool,
    create_step_output_tool,
)

__all__ = [
    "create_all_tools",
    "create_crud_tools",
    # Re-export individual factories
    "create_agent_crud",
    "create_app_crud",
    "create_database_crud",
    "create_document_crud",
    "create_field_crud",
    "create_file_crud",
    "create_page_crud",
    "create_row_crud",
    "create_skill_crud",
    "create_table_crud",
    "create_team_crud",
    "create_view_crud",
    # Output tools (require collector instances)
    "ClarificationRequestedException",
    "QuestionCollector",
    "StepCollector",
    "create_ask_question_tool",
    "create_step_output_tool",
]


def create_crud_tools(api_key: str, org_id: str) -> list[Callable[..., str]]:
    """
    Create all CRUD tool functions with auth captured.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        List of callable tool functions for DSPy ReAct
    """
    return [
        create_table_crud(api_key, org_id),
        create_field_crud(api_key, org_id),
        create_row_crud(api_key, org_id),
        create_database_crud(api_key, org_id),
        create_view_crud(api_key, org_id),
        create_app_crud(api_key, org_id),
        create_page_crud(api_key, org_id),
        create_document_crud(api_key, org_id),
        create_file_crud(api_key, org_id),
        create_skill_crud(api_key, org_id),
        create_agent_crud(api_key, org_id),
        create_team_crud(api_key, org_id),
    ]


def create_all_tools(api_key: str, org_id: str) -> list[Callable[..., str]]:
    """
    Create all DSPy tool functions with auth captured.

    This is the main entry point for creating tools for DSPy ReAct execution.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        List of callable tool functions for DSPy ReAct
    """
    tools: list[Callable[..., str]] = []

    # Add CRUD tools
    tools.extend(create_crud_tools(api_key, org_id))

    # TODO: Add discovery tools when ported
    # tools.extend(create_discovery_tools(api_key, org_id))

    # TODO: Add output tools when ported
    # tools.extend(create_output_tools(api_key, org_id))

    return tools
