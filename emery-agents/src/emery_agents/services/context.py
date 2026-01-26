"""
Session Config and Workspace Context

Provides two focused dataclasses for context management:
1. SessionConfig - Auth and identity (immutable, set at session start)
2. WorkspaceContext - Workspace resources for planner awareness

This separates concerns:
- Config: Who is making the request (org, auth)
- Context: What resources exist (databases, tables, apps, agents, skills)

WorkspaceContext gives the planner visibility into existing resources to avoid
creating duplicates. CapabilityRegistry handles runtime capability routing.
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
class PageInfo:
    """Page information for context injection."""
    name: str
    id: Optional[str] = None
    app_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
            "app_id": self.app_id,
        }


@dataclass
class AppInfo:
    """Pre-resolved app information for context injection."""
    name: str
    id: Optional[str] = None
    description: str = ""
    pages: List[PageInfo] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
            "description": self.description,
            "pages": [p.to_dict() for p in self.pages],
        }


@dataclass
class AgentInfo:
    """Agent information for context injection."""
    name: str
    id: Optional[str] = None
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
            "description": self.description,
        }


@dataclass
class SkillInfo:
    """Skill information for context injection."""
    name: str
    id: Optional[str] = None
    description: str = ""
    agent_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
            "description": self.description,
            "agent_id": self.agent_id,
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

    Contains what resources exist in the workspace:
    - Databases (containers for tables)
    - Tables (user's data)
    - Apps (user's apps with pages)
    - Agents (user's custom agents)
    - Skills (user's custom skills)

    This gives the planner awareness of existing resources to avoid duplicates.
    CapabilityRegistry handles runtime capability routing separately.
    """
    existing_databases: List[DatabaseInfo] = field(default_factory=list)
    existing_tables: List[TableInfo] = field(default_factory=list)
    existing_apps: List[AppInfo] = field(default_factory=list)
    existing_agents: List[AgentInfo] = field(default_factory=list)
    existing_skills: List[SkillInfo] = field(default_factory=list)

    @property
    def has_databases(self) -> bool:
        return len(self.existing_databases) > 0

    @property
    def has_tables(self) -> bool:
        return len(self.existing_tables) > 0

    @property
    def has_apps(self) -> bool:
        return len(self.existing_apps) > 0

    @property
    def has_agents(self) -> bool:
        return len(self.existing_agents) > 0

    @property
    def has_skills(self) -> bool:
        return len(self.existing_skills) > 0

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
            "existing_agents": [a.to_dict() for a in self.existing_agents],
            "existing_skills": [s.to_dict() for s in self.existing_skills],
            "has_databases": self.has_databases,
            "has_tables": self.has_tables,
            "has_apps": self.has_apps,
            "has_agents": self.has_agents,
            "has_skills": self.has_skills,
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

    def get_app_by_name(self, name: str) -> Optional[AppInfo]:
        """Look up app by name."""
        for app in self.existing_apps:
            if app.name == name:
                return app
        return None

    def get_agent_by_name(self, name: str) -> Optional[AgentInfo]:
        """Look up agent by name."""
        for agent in self.existing_agents:
            if agent.name == name:
                return agent
        return None

    def get_skill_by_name(self, name: str) -> Optional[SkillInfo]:
        """Look up skill by name."""
        for skill in self.existing_skills:
            if skill.name == name:
                return skill
        return None
