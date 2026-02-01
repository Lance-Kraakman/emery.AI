"""Typed API layer for CRUD operations.

This module provides reusable typed APIs that both tools and services use.
Dataclasses provide type safety, API classes provide the operations.
"""

from .database_api import DatabaseAPI, Database
from .table_api import TableAPI, Table
from .row_api import RowAPI
from .app_api import AppAPI, App
from .agent_api import AgentAPI, Agent
from .skill_api import SkillAPI, Skill
from .workspace_api import WorkspaceAPI
# Workspace entity types now canonical in entities/workspace.py
from ....entities.workspace import (
    WorkspaceData,
    WorkspaceApp,
    WorkspaceAgent,
    WorkspaceSkill,
    WorkspaceDatabase,
    WorkspaceTable,
    WorkspaceView,
    WorkspacePage,
    WorkspaceField,
)

__all__ = [
    "DatabaseAPI",
    "Database",
    "TableAPI",
    "Table",
    "RowAPI",
    "AppAPI",
    "App",
    "AgentAPI",
    "Agent",
    "SkillAPI",
    "Skill",
    "WorkspaceAPI",
    "WorkspaceData",
    "WorkspaceApp",
    "WorkspaceAgent",
    "WorkspaceSkill",
    "WorkspaceDatabase",
    "WorkspaceTable",
    "WorkspaceView",
    "WorkspacePage",
    "WorkspaceField",
]
