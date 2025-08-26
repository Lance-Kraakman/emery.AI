"""
Agent Domain Entity

AIDEV-NOTE: Proper DDD entity using value objects for type safety and validation.
Contains business logic with rich domain types.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional
from ..value_objects.agent_value_objects import AgentName, AgentStatus, ApiKey, AgentRole
from ...shared.value_objects.ids import AgentId, OrganizationId, RoleId


@dataclass
class AgentConfig:
    """Configuration for creating a new agent with value objects."""
    name: AgentName
    organization_id: OrganizationId
    owner_id: str
    role: Optional[AgentRole] = None
    description: Optional[str] = None
    persona: Optional[str] = None
    tools: Optional[Dict[str, Any]] = None
    servers: Optional[Dict[str, Any]] = None
    trigger: Optional[Dict[str, Any]] = None
    capabilities: Optional[Dict[str, Any]] = None
    database_id: Optional[str] = None
    status: Optional[AgentStatus] = None
    role_id: Optional[RoleId] = None
    api_key: Optional[ApiKey] = None


class Agent:
    """Agent domain entity with business logic and value objects."""
    
    def __init__(
        self,
        id: Optional[AgentId],
        name: AgentName,
        organization_id: OrganizationId,
        owner_id: str,
        role: Optional[AgentRole] = None,
        description: Optional[str] = None,
        persona: Optional[str] = None,
        tools: Optional[Dict[str, Any]] = None,
        servers: Optional[Dict[str, Any]] = None,
        trigger: Optional[Dict[str, Any]] = None,
        capabilities: Optional[Dict[str, Any]] = None,
        database_id: Optional[str] = None,
        status: Optional[AgentStatus] = None,
        role_id: Optional[RoleId] = None,
        api_key: Optional[ApiKey] = None,
        created_at: Optional[datetime] = None,
    ):
        self.id = id
        self.name = name
        self.organization_id = organization_id
        self.owner_id = owner_id
        self.role = role
        self.description = description
        self.persona = persona
        self.tools = tools
        self.servers = servers
        self.trigger = trigger
        self.capabilities = capabilities
        self.database_id = database_id
        self.status = status or AgentStatus.active()
        self.role_id = role_id
        self.api_key = api_key
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
            capabilities=config.capabilities,
            database_id=config.database_id,
            status=config.status or AgentStatus.active(),
            role_id=config.role_id,
            api_key=config.api_key
        )
    
    @classmethod
    def from_persistence(cls, data: Dict[str, Any]) -> "Agent":
        """Create agent from persistence data."""
        return cls(
            id=AgentId(data["id"]),
            name=AgentName(data["name"]),
            organization_id=OrganizationId(data["organization_id"]),
            owner_id=data["owner_id"],
            role=AgentRole(data["role"]) if data.get("role") else None,
            description=data.get("description"),
            persona=data.get("persona"),
            tools=data.get("tools"),
            servers=data.get("servers"),
            trigger=data.get("trigger"),
            capabilities=data.get("capabilities"),
            database_id=data.get("database_id"),
            status=AgentStatus(data["status"]) if data.get("status") else AgentStatus.active(),
            role_id=RoleId(data["role_id"]) if data.get("role_id") else None,
            api_key=ApiKey(data["api_key"]) if data.get("api_key") else None,
            created_at=data.get("created_at")
        )
    
    # Business logic methods
    @property
    def display_name(self) -> str:
        """Get agent's display name with role if available."""
        if self.role:
            return f"{self.name.value} ({self.role.value})"
        return self.name.value
    
    @property
    def is_active(self) -> bool:
        """Check if agent is active."""
        return self.status.is_active if self.status else False
    
    @property
    def capabilities_count(self) -> int:
        """Get agent capabilities count."""
        if not self.capabilities or not isinstance(self.capabilities, (dict, list)):
            return 0
        
        if isinstance(self.capabilities, list):
            return len(self.capabilities)
        
        return len(self.capabilities.keys()) if isinstance(self.capabilities, dict) else 0
    
    def can_execute_task(self) -> bool:
        """Check if agent can execute tasks."""
        return self.is_active and self.api_key is not None
    
    def validate_for_execution(self) -> None:
        """Validate agent can execute tasks, raise if not."""
        if not self.is_active:
            status_value = self.status.value if self.status else "unknown"
            raise ValueError(f"Agent {self.display_name} is not active (status: {status_value})")
        
        if not self.api_key:
            raise ValueError(f"Agent {self.display_name} has no API key configured")