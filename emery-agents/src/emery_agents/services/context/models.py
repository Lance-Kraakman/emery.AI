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

from emery_agents.entities.workspace import (
    WorkspaceDatabase,
    WorkspaceTable,
    WorkspacePage,
    WorkspaceApp,
    WorkspaceAgent,
    WorkspaceSkill,
    WorkspaceView,
)


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
    - Views (data views for tables)

    This gives the planner awareness of existing resources to avoid duplicates.
    CapabilityRegistry handles runtime capability routing separately.
    """
    existing_databases: List[WorkspaceDatabase] = field(default_factory=list)
    existing_tables: List[WorkspaceTable] = field(default_factory=list)
    existing_apps: List[WorkspaceApp] = field(default_factory=list)
    existing_agents: List[WorkspaceAgent] = field(default_factory=list)
    existing_skills: List[WorkspaceSkill] = field(default_factory=list)
    existing_views: List[WorkspaceView] = field(default_factory=list)

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

    @property
    def has_views(self) -> bool:
        return len(self.existing_views) > 0

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
            "existing_views": [v.to_dict() for v in self.existing_views],
            "has_databases": self.has_databases,
            "has_tables": self.has_tables,
            "has_apps": self.has_apps,
            "has_agents": self.has_agents,
            "has_skills": self.has_skills,
            "has_views": self.has_views,
        }

    def resource_summary(self) -> str:
        """Human-readable summary of resource counts."""
        parts: List[str] = []
        if self.existing_databases:
            parts.append(f"{len(self.existing_databases)} database(s)")
        if self.existing_tables:
            parts.append(f"{len(self.existing_tables)} table(s)")
        if self.existing_apps:
            parts.append(f"{len(self.existing_apps)} app(s)")
        if self.existing_agents:
            parts.append(f"{len(self.existing_agents)} agent(s)")
        if self.existing_skills:
            parts.append(f"{len(self.existing_skills)} skill(s)")
        if self.existing_views:
            parts.append(f"{len(self.existing_views)} view(s)")
        return ", ".join(parts) if parts else "empty workspace"

    def get_database_by_name(self, name: str) -> Optional[WorkspaceDatabase]:
        """Look up database by name."""
        for db in self.existing_databases:
            if db.name == name:
                return db
        return None

    def get_table_by_name(self, name: str) -> Optional[WorkspaceTable]:
        """Look up table by name."""
        for table in self.existing_tables:
            if table.name == name:
                return table
        return None

    def get_app_by_name(self, name: str) -> Optional[WorkspaceApp]:
        """Look up app by name."""
        for app in self.existing_apps:
            if app.name == name:
                return app
        return None

    def get_agent_by_name(self, name: str) -> Optional[WorkspaceAgent]:
        """Look up agent by name."""
        for agent in self.existing_agents:
            if agent.name == name:
                return agent
        return None

    def get_skill_by_name(self, name: str) -> Optional[WorkspaceSkill]:
        """Look up skill by name."""
        for skill in self.existing_skills:
            if skill.name == name:
                return skill
        return None

    def get_view_by_name(self, name: str) -> Optional[WorkspaceView]:
        """Look up view by name."""
        for view in self.existing_views:
            if view.name == name:
                return view
        return None
