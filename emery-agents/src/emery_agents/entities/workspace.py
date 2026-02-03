"""
Canonical Workspace Resource Entities

Single source of truth for all workspace resource types.
All layers (api, grpc, services, reasoning, tools) import from here.

Entity fields use native types (int IDs matching the database).
Presentation concerns (str conversion) handled by to_dict().
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class WorkspaceField:
    """Field within a table."""
    name: str
    type: str
    related_table_id: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "type": self.type,
            "related_table_id": self.related_table_id,
        }


@dataclass
class WorkspacePage:
    """Page within an app."""
    id: int = 0
    name: str = ""
    slug: str = ""
    app_id: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": str(self.id),
            "app_id": str(self.app_id) if self.app_id is not None else None,
        }


@dataclass
class WorkspaceApp:
    """App with its pages."""
    id: int = 0
    name: str = ""
    slug: str = ""
    description: str = ""
    pages: List[WorkspacePage] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": str(self.id),
            "description": self.description,
            "pages": [p.to_dict() for p in self.pages],
        }


@dataclass
class WorkspaceAgent:
    """Agent entity."""
    id: int = 0
    name: str = ""
    description: str = ""
    persona: Optional[str] = None
    database_id: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": str(self.id),
            "description": self.description,
        }


@dataclass
class WorkspaceSkill:
    """Skill entity."""
    id: int = 0
    name: str = ""
    description: str = ""
    agent_id: Optional[int] = None
    agent_name: Optional[str] = None
    inputs: List[Dict[str, Any]] = field(default_factory=list)
    raw: Optional[Dict[str, Any]] = None
    is_system: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": str(self.id),
            "description": self.description,
            "agent_id": str(self.agent_id) if self.agent_id is not None else None,
        }


@dataclass
class WorkspaceTable:
    """Table within a database."""
    id: int = 0
    name: str = ""
    database_id: Optional[int] = None
    database_name: Optional[str] = None
    field_count: int = 0
    fields: List[WorkspaceField] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": str(self.id),
            "database_id": str(self.database_id) if self.database_id is not None else None,
            "database_name": self.database_name,
            "field_count": self.field_count,
            "fields": [f"{f.name} ({f.type})" for f in self.fields],
        }


@dataclass
class WorkspaceDatabase:
    """Database with its tables."""
    id: int = 0
    name: str = ""
    table_count: int = 0
    tables: List[WorkspaceTable] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": str(self.id),
            "table_count": self.table_count,
        }


@dataclass
class WorkspaceView:
    """Data view entity."""
    id: int = 0
    name: str = ""
    table_id: Optional[int] = None
    view_type: str = "grid"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": str(self.id),
            "table_id": str(self.table_id) if self.table_id is not None else None,
            "view_type": self.view_type,
        }


@dataclass
class WorkspaceData:
    """Complete workspace data from unified endpoint."""
    apps: List[WorkspaceApp] = field(default_factory=list)
    agents: List[WorkspaceAgent] = field(default_factory=list)
    skills: List[WorkspaceSkill] = field(default_factory=list)
    databases: List[WorkspaceDatabase] = field(default_factory=list)
    views: List[WorkspaceView] = field(default_factory=list)
