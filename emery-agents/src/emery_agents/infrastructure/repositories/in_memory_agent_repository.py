from typing import Optional, Dict
from ...domain.entities.models import Agent
from ...domain.repositories.agent_repository import IAgentRepository

class InMemoryAgentRepository(IAgentRepository):
    """In-memory implementation of the agent repository for testing and development."""

    def __init__(self):
        self._agents: Dict[int, Agent] = {}
        self._next_id = 1

    async def find_by_id(self, agent_id: int) -> Optional[Agent]:
        return self._agents.get(agent_id)

    async def create(self, agent_data: dict) -> Agent:
        agent_id = self._next_id
        agent = Agent(id=agent_id, **agent_data)
        self._agents[agent_id] = agent
        self._next_id += 1
        return agent

    async def update(self, agent_id: int, update_data: dict) -> Optional[Agent]:
        if agent_id in self._agents:
            agent = self._agents[agent_id]
            for key, value in update_data.items():
                setattr(agent, key, value)
            return agent
        return None
