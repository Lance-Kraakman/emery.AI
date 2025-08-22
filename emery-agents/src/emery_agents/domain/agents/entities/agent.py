"""
Agent Domain Entity

AIDEV-NOTE: Simple DDD entity following TypeScript patterns.
No complex value objects, just business logic in domain entities.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional


@dataclass
class AgentConfig:
    """Configuration for creating a new agent."""
    name: str
    role: Optional[str] = None
    description: Optional[str] = None
    persona: Optional[str] = None
    tools: Optional[Dict[str, Any]] = None
    servers: Optional[Dict[str, Any]] = None
    trigger: Optional[Dict[str, Any]] = None
    capabilities: Optional[Dict[str, Any]] = None
    database_id: Optional[str] = None
    status: Optional[str] = None
    organization_id: int = 1
    owner_id: str = ""
    role_id: Optional[int] = None
    api_key: Optional[str] = None


class Agent:
    """Agent domain entity with business logic."""
    
    def __init__(
        self,
        id: int,
        name: str,
        role: Optional[str],
        description: Optional[str],
        persona: Optional[str],
        tools: Optional[Dict[str, Any]],
        servers: Optional[Dict[str, Any]],
        trigger: Optional[Dict[str, Any]],
        capabilities: Optional[Dict[str, Any]],
        database_id: Optional[str],
        status: Optional[str],
        organization_id: int,
        owner_id: str,
        role_id: Optional[int],
        api_key: Optional[str],
        created_at: Optional[datetime] = None,
    ):
        self.id = id
        self.name = name
        self.role = role
        self.description = description
        self.persona = persona
        self.tools = tools
        self.servers = servers
        self.trigger = trigger
        self.capabilities = capabilities
        self.database_id = database_id
        self.status = status or "active"
        self.organization_id = organization_id
        self.owner_id = owner_id
        self.role_id = role_id
        self.api_key = api_key
        self.created_at = created_at
    
    @classmethod
    def create(cls, config: AgentConfig) -> "Agent":
        """Create a new agent instance."""
        return cls(
            id=0,  # Will be set by repository
            name=config.name,
            role=config.role,
            description=config.description,
            persona=config.persona,
            tools=config.tools,
            servers=config.servers,
            trigger=config.trigger,
            capabilities=config.capabilities,
            database_id=config.database_id,
            status=config.status or "active",
            organization_id=config.organization_id,
            owner_id=config.owner_id,
            role_id=config.role_id,
            api_key=config.api_key
        )
    
    @classmethod
    def from_persistence(cls, data: Dict[str, Any]) -> "Agent":
        """Create agent from persistence data."""
        return cls(
            id=data["id"],
            name=data["name"],
            role=data.get("role"),
            description=data.get("description"),
            persona=data.get("persona"),
            tools=data.get("tools"),
            servers=data.get("servers"),
            trigger=data.get("trigger"),
            capabilities=data.get("capabilities"),
            database_id=data.get("database_id"),
            status=data.get("status"),
            organization_id=data["organization_id"],
            owner_id=data["owner_id"],
            role_id=data.get("role_id"),
            api_key=data.get("api_key"),
            created_at=data.get("created_at")
        )
    
    # Business logic methods
    @property
    def display_name(self) -> str:
        """Get agent's display name with role if available."""
        return f"{self.name} ({self.role})" if self.role else self.name
    
    @property
    def is_active(self) -> bool:
        """Check if agent is active."""
        return self.status not in ["inactive", "disabled"]
    
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
        return self.is_active and self.api_key is not None and len(self.api_key.strip()) > 0
    
    def validate_for_execution(self) -> None:
        """Validate agent can execute tasks, raise if not."""
        if not self.is_active:
            raise ValueError(f"Agent {self.display_name} is not active (status: {self.status})")
        
        if not self.api_key:
            raise ValueError(f"Agent {self.display_name} has no API key configured")
        
        if not self.api_key.strip():
            raise ValueError(f"Agent {self.display_name} has empty API key")