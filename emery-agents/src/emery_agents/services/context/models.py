"""
Session Config, Workspace Context, and Conversation Models

Provides focused dataclasses for context management:
1. SessionConfig - Auth and identity (immutable, set at session start)
2. WorkspaceContext - Workspace resources for planner awareness
3. ConversationMessage - Single message from conversation history

This separates concerns:
- Config: Who is making the request (org, auth)
- Context: What resources exist (databases, tables, apps, agents, skills)
- Conversation: What was said in the current/past sessions

WorkspaceContext gives the planner visibility into existing resources to avoid
creating duplicates. CapabilityRegistry handles runtime capability routing.
"""

from dataclasses import dataclass, field
from typing import Any

from emery_agents.entities.workspace import (
    WorkspaceAgent,
    WorkspaceApp,
    WorkspaceDatabase,
    WorkspaceSkill,
    WorkspaceTable,
    WorkspaceView,
)


@dataclass
class ConversationMessage:
    """A single message from the conversation history.

    Converted from protobuf HistoryMessage at the gRPC boundary.
    """

    role: str
    content: str


def format_conversation_history(
    history: list["ConversationMessage"] | None,
    max_messages: int = 10,
    max_content_length: int = 500,
) -> str:
    """Format recent conversation history as a string for prompt injection.

    Returns last N messages as "role: content" lines, truncated per message.
    Used by triage, direct execution, and planning nodes.
    """
    if not history:
        return ""
    recent = history[-max_messages:]
    parts = []
    for msg in recent:
        if msg.content:
            content = msg.content[:max_content_length]
            parts.append(f"{msg.role}: {content}")
    return "\n".join(parts)


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
    org_model: str | None = None
    api_key: str | None = None


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

    existing_databases: list[WorkspaceDatabase] = field(default_factory=list)
    existing_tables: list[WorkspaceTable] = field(default_factory=list)
    existing_apps: list[WorkspaceApp] = field(default_factory=list)
    existing_agents: list[WorkspaceAgent] = field(default_factory=list)
    existing_skills: list[WorkspaceSkill] = field(default_factory=list)
    existing_views: list[WorkspaceView] = field(default_factory=list)

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

    def to_template_context(self) -> dict[str, Any]:
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
        parts: list[str] = []
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

    def get_database_by_name(self, name: str) -> WorkspaceDatabase | None:
        """Look up database by name."""
        for db in self.existing_databases:
            if db.name == name:
                return db
        return None

    def get_table_by_name(self, name: str) -> WorkspaceTable | None:
        """Look up table by name."""
        for table in self.existing_tables:
            if table.name == name:
                return table
        return None

    def get_app_by_name(self, name: str) -> WorkspaceApp | None:
        """Look up app by name."""
        for app in self.existing_apps:
            if app.name == name:
                return app
        return None

    def get_agent_by_name(self, name: str) -> WorkspaceAgent | None:
        """Look up agent by name."""
        for agent in self.existing_agents:
            if agent.name == name:
                return agent
        return None

    def get_skill_by_name(self, name: str) -> WorkspaceSkill | None:
        """Look up skill by name."""
        for skill in self.existing_skills:
            if skill.name == name:
                return skill
        return None

    def get_view_by_name(self, name: str) -> WorkspaceView | None:
        """Look up view by name."""
        for view in self.existing_views:
            if view.name == name:
                return view
        return None
