"""
gRPC Agent Repository Implementation

AIDEV-NOTE: Implementation of agent repository using gRPC calls to parent Emery system.
Agents are stored in the parent system's database, accessed via gRPC.
"""

import logging
from typing import List, Optional

from ....domain.agents.entities.agent import Agent
from ....domain.agents.repositories.agent_repository import IAgentRepository
from ....domain.agents.value_objects.agent_id import AgentId
from ....domain.shared.value_objects.organization_id import OrganizationId
from ....domain.shared.value_objects.user_id import UserId

logger = logging.getLogger(__name__)


class GrpcAgentRepository(IAgentRepository):
    """
    gRPC-based implementation of agent repository.
    
    AIDEV-NOTE: Communicates with parent Emery system for agent data.
    Agents are managed in the parent system, not locally.
    """
    
    def __init__(self, grpc_client):
        self._grpc_client = grpc_client
    
    async def find_by_organization(self, organization_id: OrganizationId) -> List[Agent]:
        """Find all agents in an organization via gRPC."""
        logger.debug(f"Finding agents for organization {organization_id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_agents_by_organization(organization_id.value)
            return [self._from_grpc_data(agent_data) for agent_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find agents for organization {organization_id.value}: {error}")
            return []
    
    async def find_by_id(self, agent_id: AgentId) -> Optional[Agent]:
        """Find agent by ID via gRPC."""
        logger.debug(f"Finding agent {agent_id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_agent_by_id(agent_id.value)
            if grpc_response:
                return self._from_grpc_data(grpc_response)
            return None
        except Exception as error:
            logger.exception(f"Failed to find agent {agent_id.value}: {error}")
            return None
    
    async def find_by_owner(self, owner_id: UserId) -> List[Agent]:
        """Find all agents owned by a user via gRPC."""
        logger.debug(f"Finding agents for owner {owner_id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_agents_by_owner(owner_id.value)
            return [self._from_grpc_data(agent_data) for agent_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find agents for owner {owner_id.value}: {error}")
            return []
    
    async def find_active_by_organization(self, organization_id: OrganizationId) -> List[Agent]:
        """Find all active agents in an organization via gRPC."""
        logger.debug(f"Finding active agents for organization {organization_id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_active_agents_by_organization(organization_id.value)
            return [self._from_grpc_data(agent_data) for agent_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find active agents for organization {organization_id.value}: {error}")
            return []
    
    async def save(self, agent: Agent) -> Agent:
        """Save agent via gRPC (not typically used in agent execution system)."""
        logger.warning("Save operation not typically used in agent execution system")
        
        # AIDEV-NOTE: Agent management happens in parent Emery system
        # This implementation would be used if we need to update agent state
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.save_agent(self._to_grpc_data(agent))
            return self._from_grpc_data(grpc_response)
        except Exception as error:
            logger.exception(f"Failed to save agent {agent.id.value}: {error}")
            raise
    
    async def delete(self, agent_id: AgentId) -> None:
        """Delete agent via gRPC (not typically used in agent execution system)."""
        logger.warning("Delete operation not typically used in agent execution system")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            await self._grpc_client.delete_agent(agent_id.value)
        except Exception as error:
            logger.exception(f"Failed to delete agent {agent_id.value}: {error}")
            raise
    
    async def count_by_organization(self, organization_id: OrganizationId) -> int:
        """Count agents in an organization via gRPC."""
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            return await self._grpc_client.count_agents_by_organization(organization_id.value)
        except Exception as error:
            logger.exception(f"Failed to count agents for organization {organization_id.value}: {error}")
            return 0
    
    async def exists(self, agent_id: AgentId) -> bool:
        """Check if agent exists via gRPC."""
        agent = await self.find_by_id(agent_id)
        return agent is not None
    
    async def find_by_api_key(self, api_key: str) -> Optional[Agent]:
        """Find agent by API key via gRPC."""
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_agent_by_api_key(api_key)
            if grpc_response:
                return self._from_grpc_data(grpc_response)
            return None
        except Exception as error:
            logger.exception(f"Failed to find agent by API key: {error}")
            return None
    
    def _from_grpc_data(self, grpc_data: dict) -> Agent:
        """Convert gRPC response data to Agent domain entity."""
        # AIDEV-TODO: Implement proper proto mapping
        return Agent.from_persistence(grpc_data)
    
    def _to_grpc_data(self, agent: Agent) -> dict:
        """Convert Agent domain entity to gRPC request data."""
        # AIDEV-TODO: Implement proper proto mapping
        return {
            "id": agent.id.value,
            "name": agent.name,
            "role": agent.role,
            "description": agent.description,
            "persona": agent.persona,
            "tools": agent.tools,
            "servers": agent.servers,
            "trigger": agent.trigger,
            "capabilities": agent.capabilities,
            "database_id": agent.database_id,
            "status": agent.status.value,
            "organization_id": agent.organization_id.value,
            "owner_id": agent.owner_id.value,
            "role_id": agent.role_id,
            "api_key": agent.api_key,
            "created_at": agent.created_at.isoformat() if agent.created_at else None
        }