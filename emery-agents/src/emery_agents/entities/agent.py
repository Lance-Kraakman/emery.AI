"""
Agent Entity (Simplified)

Represents an AI agent without DDD value object overhead.
Uses direct types (int, str) with validation in constructors.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from ..types import AgentId, DatabaseId, OrganizationId, OwnerId, RoleId


@dataclass
class AgentConfig:
    """Configuration for creating a new agent - simplified."""

    name: str
    organization_id: OrganizationId
    owner_id: OwnerId
    role: str | None = None
    description: str | None = None
    persona: str | None = None
    tools: dict[str, Any] | None = None
    servers: dict[str, Any] | None = None
    trigger: dict[str, Any] | None = None
    skills: dict[str, Any] | None = None
    database_id: DatabaseId | None = None
    status: str | None = None
    role_id: RoleId | None = None
    api_key: str | None = None
    default_model: str | None = None  # For AI model selection hierarchy


class Agent:
    """Agent entity with business logic - simplified without value objects."""

    def __init__(
        self,
        id: AgentId | None,
        name: str,
        organization_id: OrganizationId,
        owner_id: OwnerId,
        role: str | None = None,
        description: str | None = None,
        persona: str | None = None,
        tools: dict[str, Any] | None = None,
        servers: dict[str, Any] | None = None,
        trigger: dict[str, Any] | None = None,
        skills: dict[str, Any] | None = None,
        database_id: DatabaseId | None = None,
        status: str | None = None,
        role_id: RoleId | None = None,
        api_key: str | None = None,
        default_model: str | None = None,
        created_at: datetime | None = None,
    ):
        # Validation
        if not name or not name.strip():
            raise ValueError("Agent name cannot be empty")
        if organization_id is None:
            raise ValueError("Organization ID is required")
        if owner_id is None:
            raise ValueError("Owner ID is required")

        self.id = id
        self.name = name
        self.organization_id = organization_id
        self.owner_id = owner_id
        self.role = role
        self.description = description
        self.persona = persona
        self.tools = tools or {}
        self.servers = servers or {}
        self.trigger = trigger
        self.skills = skills or {}
        self.database_id = database_id
        self.status = status or "active"
        self.role_id = role_id
        self.api_key = api_key
        self.default_model = default_model
        self.created_at = created_at or datetime.utcnow()

    @classmethod
    def create(cls, config: AgentConfig) -> "Agent":
        """Create a new agent instance."""
        return cls(
            id=None,  # Will be set by repository
            name=config.name,
            organization_id=config.organization_id,
            owner_id=config.owner_id,
            role=config.role,
            description=config.description,
            persona=config.persona,
            tools=config.tools,
            servers=config.servers,
            trigger=config.trigger,
            skills=config.skills,
            database_id=config.database_id,
            status=config.status or "active",
            role_id=config.role_id,
            api_key=config.api_key,
            default_model=config.default_model,
        )

    @classmethod
    def from_persistence(cls, data: dict[str, Any]) -> "Agent":
        """Create agent from persistence data (dict from gRPC/DB)."""
        return cls(
            id=data.get("id"),
            name=data["name"],
            organization_id=data["organization_id"],
            owner_id=data["owner_id"],
            role=data.get("role"),
            description=data.get("description"),
            persona=data.get("persona"),
            tools=data.get("tools"),
            servers=data.get("servers"),
            trigger=data.get("trigger"),
            skills=data.get("skills"),
            database_id=data.get("database_id"),
            status=data.get("status", "active"),
            role_id=data.get("role_id"),
            api_key=data.get("api_key"),
            default_model=data.get("default_model"),
            created_at=data.get("created_at"),
        )

    def to_dict(self) -> dict[str, Any]:
        """Convert agent to dictionary for persistence/serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "organization_id": self.organization_id,
            "owner_id": self.owner_id,
            "role": self.role,
            "description": self.description,
            "persona": self.persona,
            "tools": self.tools,
            "servers": self.servers,
            "trigger": self.trigger,
            "skills": self.skills,
            "database_id": self.database_id,
            "status": self.status,
            "role_id": self.role_id,
            "api_key": self.api_key,
            "default_model": self.default_model,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    # Business logic
    @property
    def is_active(self) -> bool:
        """Check if agent is active."""
        return self.status not in ["inactive", "disabled", "deleted"]

    def validate_for_execution(self) -> None:
        """Validate agent can execute tasks."""
        if not self.is_active:
            raise ValueError(f"Agent {self.name} is not active (status: {self.status})")
        if not self.api_key:
            raise ValueError(f"Agent {self.name} has no API key configured")
