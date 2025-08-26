"""
Agent Repository Interface

AIDEV-NOTE: Domain layer repository interface for agents.
Defines contracts without implementation details.
"""

from abc import ABC, abstractmethod
from typing import Optional, List
from ..entities.agent import Agent
from ...shared.value_objects.ids import AgentId, OrganizationId


class IAgentRepository(ABC):
    """Repository interface for agent persistence operations."""
    
    @abstractmethod
    async def find_by_id(self, agent_id: AgentId) -> Optional[Agent]:
        """Find agent by ID."""
        pass
    
    @abstractmethod
    async def find_by_organization(self, organization_id: OrganizationId) -> List[Agent]:
        """Find all agents for an organization."""
        pass
    
    @abstractmethod
    async def save(self, agent: Agent) -> None:
        """Save or update an agent."""
        pass
    
    @abstractmethod
    async def delete(self, agent_id: AgentId) -> bool:
        """Delete an agent. Returns True if deleted."""
        pass
    
    @abstractmethod
    async def list_all(self) -> List[Agent]:
        """List all agents (for admin purposes)."""
        pass