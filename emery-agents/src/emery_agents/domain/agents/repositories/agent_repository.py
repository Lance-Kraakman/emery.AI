"""
Agent Repository Interface

AIDEV-NOTE: Simple DDD repository interface following TypeScript patterns.
Defines data access operations for Agent entities.
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from ..entities.agent import Agent


class IAgentRepository(ABC):
    """Agent repository interface for data access operations."""
    
    @abstractmethod
    async def find_by_organization(self, organization_id: int) -> List[Agent]:
        """Find agents by organization ID."""
        pass
    
    @abstractmethod
    async def find_by_id(self, id: int) -> Optional[Agent]:
        """Find agent by ID."""
        pass
    
    @abstractmethod
    async def find_by_owner(self, owner_id: str) -> List[Agent]:
        """Find agents by owner ID."""
        pass
    
    @abstractmethod
    async def find_active_by_organization(self, organization_id: int) -> List[Agent]:
        """Find active agents by organization."""
        pass
    
    @abstractmethod
    async def save(self, agent: Agent) -> None:
        """Save agent."""
        pass
    
    @abstractmethod
    async def delete(self, id: int) -> None:
        """Delete agent."""
        pass
    
    @abstractmethod
    async def count_by_organization(self, organization_id: int) -> int:
        """Count agents by organization."""
        pass