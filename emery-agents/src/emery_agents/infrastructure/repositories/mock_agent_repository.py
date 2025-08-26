"""
Mock Agent Repository Implementation

AIDEV-NOTE: Temporary mock implementation for testing.
Replace with real database implementation when needed.
"""

from typing import Optional, List
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.entities.agent import Agent, AgentConfig


class MockAgentRepository(IAgentRepository):
    """Mock implementation for testing purposes."""
    
    def __init__(self):
        # Mock agents for testing
        self._agents = {
            123: Agent.create(AgentConfig(
                name="Test Agent",
                description="Mock agent for testing",
                organization_id=1,
                owner_id="test_user",
                status="active",
                api_key="test_api_key"
            )),
            456: Agent.create(AgentConfig(
                name="Inactive Agent", 
                description="Mock inactive agent",
                organization_id=1,
                owner_id="test_user",
                status="inactive",
                api_key="test_api_key_2"
            ))
        }
        
        # Set IDs for mock agents
        self._agents[123].id = 123
        self._agents[456].id = 456
    
    async def find_by_id(self, agent_id: int) -> Optional[Agent]:
        """Find agent by ID."""
        return self._agents.get(agent_id)
    
    async def find_by_organization(self, organization_id: int) -> List[Agent]:
        """Find all agents for an organization."""
        return [agent for agent in self._agents.values() 
                if agent.organization_id == organization_id]
    
    async def save(self, agent: Agent) -> None:
        """Save or update an agent."""
        if agent.id:
            self._agents[agent.id] = agent
        else:
            # Assign new ID
            new_id = max(self._agents.keys(), default=0) + 1
            agent.id = new_id
            self._agents[new_id] = agent
    
    async def delete(self, agent_id: int) -> bool:
        """Delete an agent."""
        if agent_id in self._agents:
            del self._agents[agent_id]
            return True
        return False
    
    async def list_all(self) -> List[Agent]:
        """List all agents."""
        return list(self._agents.values())