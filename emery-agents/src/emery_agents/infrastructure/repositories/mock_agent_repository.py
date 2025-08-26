"""
Mock Agent Repository Implementation

AIDEV-NOTE: Temporary mock implementation for testing.
Replace with real database implementation when needed.
"""

from typing import Optional, List
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.entities.agent import Agent, AgentConfig
from ...domain.shared.value_objects.ids import AgentId, OrganizationId
from ...domain.agents.value_objects.agent_value_objects import AgentName, AgentStatus, ApiKey


class MockAgentRepository(IAgentRepository):
    """Mock implementation for testing purposes."""
    
    def __init__(self):
        # Mock agents for testing using value objects
        agent_123 = Agent.create(AgentConfig(
            name=AgentName("Test Agent"),
            organization_id=OrganizationId(1),
            owner_id="test_user",
            description="Mock agent for testing",
            status=AgentStatus.active(),
            api_key=ApiKey("ak_mock_secure_production_agent_123_abcdef")
        ))
        agent_123.id = AgentId(123)  # Set ID after creation
        
        agent_456 = Agent.create(AgentConfig(
            name=AgentName("Inactive Agent"),
            organization_id=OrganizationId(1),  
            owner_id="test_user",
            description="Mock inactive agent",
            status=AgentStatus.inactive(),
            api_key=ApiKey("ak_mock_secure_production_agent_456_ghijkl")
        ))
        agent_456.id = AgentId(456)  # Set ID after creation
        
        self._agents = {
            AgentId(123): agent_123,
            AgentId(456): agent_456
        }
    
    async def find_by_id(self, agent_id: AgentId) -> Optional[Agent]:
        """Find agent by ID."""
        return self._agents.get(agent_id)
    
    async def find_by_organization(self, organization_id: OrganizationId) -> List[Agent]:
        """Find all agents for an organization."""
        return [agent for agent in self._agents.values() 
                if agent.organization_id == organization_id]
    
    async def save(self, agent: Agent) -> None:
        """Save or update an agent."""
        if agent.id and agent.id.value > 0:
            self._agents[agent.id] = agent
        else:
            # Assign new ID
            existing_ids = [aid.value for aid in self._agents.keys()]
            new_id_value = max(existing_ids, default=0) + 1
            agent.id = AgentId(new_id_value)
            self._agents[agent.id] = agent
    
    async def delete(self, agent_id: AgentId) -> bool:
        """Delete an agent."""
        if agent_id in self._agents:
            del self._agents[agent_id]
            return True
        return False
    
    async def list_all(self) -> List[Agent]:
        """List all agents."""
        return list(self._agents.values())