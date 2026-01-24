"""
Session Config and Workspace Context

Provides two focused dataclasses for context management:
1. SessionConfig - Auth and identity (immutable, set at session start)
2. WorkspaceContext - Workspace DATA for templates (tables, apps)

This separates concerns:
- Config: Who is making the request (org, auth)
- Context: What DATA exists in the workspace (tables, apps)

NOTE: Capabilities (agents, skills, tools) are handled separately via
CapabilityRegistry and discovery tools. WorkspaceContext is for DATA only.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class DatabaseInfo:
    """Pre-resolved database information for context injection."""
    name: str
    id: Optional[str] = None
    table_count: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
            "table_count": self.table_count,
        }


@dataclass
class TableInfo:
    """Pre-resolved table information for context injection."""
    name: str
    id: Optional[str] = None
    database_id: Optional[str] = None
    database_name: Optional[str] = None
    field_count: int = 0
    fields: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
            "database_id": self.database_id,
            "database_name": self.database_name,
            "field_count": self.field_count,
            "fields": self.fields,
        }


@dataclass
class AppInfo:
    """Pre-resolved app information for context injection."""
    name: str
    id: Optional[str] = None
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
            "description": self.description,
        }


@dataclass(frozen=True)
class SessionConfig:
    """
    Auth and identity - immutable, set once at session start.

    Contains configuration that doesn't change during execution:
    - Organization identity
    - Model preferences
    - API credentials
    """
    org_id: str
    org_model: Optional[str] = None
    api_key: Optional[str] = None


@dataclass
class WorkspaceContext:
    """
    Workspace DATA for template rendering.

    Contains what DATA exists in the workspace:
    - Existing databases (containers for tables)
    - Existing tables (user's data)
    - Existing apps (user's apps)

    NOTE: This is for DATA only. Capabilities (agents, skills, tools)
    are handled separately via CapabilityRegistry. Core system agents
    are pre-loaded directly into planner prompts.
    """
    existing_databases: List[DatabaseInfo] = field(default_factory=list)
    existing_tables: List[TableInfo] = field(default_factory=list)
    existing_apps: List[AppInfo] = field(default_factory=list)

    @property
    def has_databases(self) -> bool:
        return len(self.existing_databases) > 0

    @property
    def has_tables(self) -> bool:
        return len(self.existing_tables) > 0

    @property
    def has_apps(self) -> bool:
        return len(self.existing_apps) > 0

    def to_template_context(self) -> Dict[str, Any]:
        """
        Build dict for template rendering.

        Returns dict that can be passed directly to render_template().
        Templates select what they need via macros.
        """
        return {
            "existing_databases": [d.to_dict() for d in self.existing_databases],
            "existing_tables": [t.to_dict() for t in self.existing_tables],
            "existing_apps": [a.to_dict() for a in self.existing_apps],
            "has_databases": self.has_databases,
            "has_tables": self.has_tables,
            "has_apps": self.has_apps,
        }

    def get_database_by_name(self, name: str) -> Optional[DatabaseInfo]:
        """Look up database by name."""
        for db in self.existing_databases:
            if db.name == name:
                return db
        return None

    def get_table_by_name(self, name: str) -> Optional[TableInfo]:
        """Look up table by name."""
        for table in self.existing_tables:
            if table.name == name:
                return table
        return None
