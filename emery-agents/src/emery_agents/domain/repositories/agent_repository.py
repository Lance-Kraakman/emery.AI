from abc import ABC, abstractmethod
from typing import Optional
from ..entities.models import Agent

class IAgentRepository(ABC):
    """Abstract interface for agent data persistence."""

    @abstractmethod
    async def find_by_id(self, agent_id: int) -> Optional[Agent]:
        """Finds an agent by its unique ID."""
        pass

    @abstractmethod
    async def create(self, agent_data: dict) -> Agent:
        """Creates a new agent."""
        pass

    @abstractmethod
    async def update(self, agent_id: int, update_data: dict) -> Optional[Agent]:
        """Updates an existing agent."""
        pass
