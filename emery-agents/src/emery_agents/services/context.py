"""
Session Config and Workspace Context

Provides two focused dataclasses for context management:
1. SessionConfig - Auth and identity (immutable, set at session start)
2. WorkspaceContext - Pre-resolved workspace state for templates

This separates concerns:
- Config: Who is making the request (org, auth)
- Context: What's available in the workspace (agents, tables)
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class AgentInfo:
    """
    Pre-resolved agent information for prompt injection.

    Instead of discovering agents via tool calls, inject this into prompts
    at render time.
    """
    name: str
    description: str
    examples: List[str] = field(default_factory=list)
    antipatterns: List[str] = field(default_factory=list)
    capabilities: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for template rendering."""
        return {
            "name": self.name,
            "description": self.description,
            "examples": self.examples,
            "antipatterns": self.antipatterns,
            "capabilities": self.capabilities,
        }


@dataclass
class TableInfo:
    """Pre-resolved table information for context injection."""
    name: str
    id: Optional[str] = None
    field_count: int = 0
    fields: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "id": self.id,
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
    Pre-resolved workspace state for template rendering.

    Contains what's available in the workspace:
    - Available agents (from capability registry)
    - Existing tables (from workspace)
    - Existing apps (from workspace)

    This is built at planning time and passed to templates.
    """
    available_agents: List[AgentInfo] = field(default_factory=list)
    existing_tables: List[TableInfo] = field(default_factory=list)
    existing_apps: List[AppInfo] = field(default_factory=list)

    @property
    def has_tables(self) -> bool:
        return len(self.existing_tables) > 0

    @property
    def has_agents(self) -> bool:
        return len(self.available_agents) > 0

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
            "available_agents": [a.to_dict() for a in self.available_agents],
            "existing_tables": [t.to_dict() for t in self.existing_tables],
            "existing_apps": [a.to_dict() for a in self.existing_apps],
            "has_agents": self.has_agents,
            "has_tables": self.has_tables,
            "has_apps": self.has_apps,
        }

    def get_agent_by_name(self, name: str) -> Optional[AgentInfo]:
        """Look up agent by name."""
        for agent in self.available_agents:
            if agent.name == name:
                return agent
        return None

    def get_table_by_name(self, name: str) -> Optional[TableInfo]:
        """Look up table by name."""
        for table in self.existing_tables:
            if table.name == name:
                return table
        return None
