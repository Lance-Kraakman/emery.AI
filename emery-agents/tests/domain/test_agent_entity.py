"""
Tests for Agent Domain Entity

AIDEV-NOTE: Domain entity tests focus on business logic and rules.
No external dependencies - pure domain testing.
"""

import pytest
from datetime import datetime

from src.emery_agents.domain.agents.entities.agent import Agent, AgentConfig, AgentStatus
from src.emery_agents.domain.agents.value_objects.agent_id import AgentId
from src.emery_agents.domain.shared.value_objects.organization_id import OrganizationId
from src.emery_agents.domain.shared.value_objects.user_id import UserId


class TestAgentEntity:
    """Test Agent domain entity business logic."""
    
    def test_create_agent_with_valid_config(self):
        """Test creating agent with valid configuration."""
        config = AgentConfig(
            name="Test Agent",
            role="Assistant",
            description="A test agent",
            persona="Helpful assistant",
            organization_id=1,
            owner_id="user_123",
            status="active"
        )
        
        agent = Agent.create(config)
        
        assert agent.name == "Test Agent"
        assert agent.role == "Assistant"
        assert agent.description == "A test agent"
        assert agent.persona == "Helpful assistant"
        assert agent.organization_id.value == 1
        assert agent.owner_id.value == "user_123"
        assert agent.status == AgentStatus.ACTIVE
    
    def test_create_agent_validates_name(self):
        """Test agent name validation."""
        config = AgentConfig(
            name="",  # Empty name
            organization_id=1,
            owner_id="user_123"
        )
        
        with pytest.raises(ValueError, match="Agent name cannot be empty"):
            Agent.create(config)
    
    def test_create_agent_validates_name_length(self):
        """Test agent name length validation."""
        long_name = "x" * 256  # Too long
        config = AgentConfig(
            name=long_name,
            organization_id=1,
            owner_id="user_123"
        )
        
        with pytest.raises(ValueError, match="Agent name cannot exceed 255 characters"):
            Agent.create(config)
    
    def test_agent_display_name_with_role(self):
        """Test display name includes role when available."""
        agent = self._create_test_agent(name="Test Agent", role="Assistant")
        
        assert agent.display_name() == "Test Agent (Assistant)"
    
    def test_agent_display_name_without_role(self):
        """Test display name without role."""
        agent = self._create_test_agent(name="Test Agent", role=None)
        
        assert agent.display_name() == "Test Agent"
    
    def test_agent_is_active_when_active_status(self):
        """Test is_active returns True for active agents."""
        agent = self._create_test_agent(status="active")
        
        assert agent.is_active() is True
    
    def test_agent_is_not_active_when_inactive_status(self):
        """Test is_active returns False for inactive agents."""
        agent = self._create_test_agent(status="inactive")
        
        assert agent.is_active() is False
    
    def test_agent_is_not_active_when_disabled_status(self):
        """Test is_active returns False for disabled agents."""
        agent = self._create_test_agent(status="disabled")
        
        assert agent.is_active() is False
    
    def test_agent_can_execute_task_when_active_with_api_key(self):
        """Test can_execute_task returns True for active agent with API key."""
        agent = self._create_test_agent(status="active", api_key="valid_key")
        
        assert agent.can_execute_task() is True
    
    def test_agent_cannot_execute_task_when_inactive(self):
        """Test can_execute_task returns False for inactive agents."""
        agent = self._create_test_agent(status="inactive", api_key="valid_key")
        
        assert agent.can_execute_task() is False
    
    def test_agent_cannot_execute_task_without_api_key(self):
        """Test can_execute_task returns False without API key."""
        agent = self._create_test_agent(status="active", api_key=None)
        
        assert agent.can_execute_task() is False
    
    def test_agent_cannot_execute_task_with_empty_api_key(self):
        """Test can_execute_task returns False with empty API key."""
        agent = self._create_test_agent(status="active", api_key="  ")
        
        assert agent.can_execute_task() is False
    
    def test_validate_for_execution_succeeds_when_valid(self):
        """Test validate_for_execution passes for valid agent."""
        agent = self._create_test_agent(status="active", api_key="valid_key")
        
        # Should not raise exception
        agent.validate_for_execution()
    
    def test_validate_for_execution_fails_when_inactive(self):
        """Test validate_for_execution fails for inactive agent."""
        agent = self._create_test_agent(status="inactive", api_key="valid_key")
        
        with pytest.raises(ValueError, match="is not active"):
            agent.validate_for_execution()
    
    def test_validate_for_execution_fails_without_api_key(self):
        """Test validate_for_execution fails without API key."""
        agent = self._create_test_agent(status="active", api_key=None)
        
        with pytest.raises(ValueError, match="has no API key configured"):
            agent.validate_for_execution()
    
    def test_validate_for_execution_fails_with_empty_api_key(self):
        """Test validate_for_execution fails with empty API key."""
        agent = self._create_test_agent(status="active", api_key="  ")
        
        with pytest.raises(ValueError, match="has empty API key"):
            agent.validate_for_execution()
    
    def test_capabilities_count_with_dict(self):
        """Test capabilities count with dictionary."""
        capabilities = {"cap1": {}, "cap2": {}}
        agent = self._create_test_agent(capabilities=capabilities)
        
        assert agent.capabilities_count() == 2
    
    def test_capabilities_count_with_list(self):
        """Test capabilities count with list."""
        capabilities = ["cap1", "cap2", "cap3"]
        agent = self._create_test_agent(capabilities=capabilities)
        
        assert agent.capabilities_count() == 3
    
    def test_capabilities_count_with_none(self):
        """Test capabilities count with None."""
        agent = self._create_test_agent(capabilities=None)
        
        assert agent.capabilities_count() == 0
    
    def test_has_capability_with_dict(self):
        """Test has_capability with dictionary capabilities."""
        capabilities = {"email": {}, "slack": {}}
        agent = self._create_test_agent(capabilities=capabilities)
        
        assert agent.has_capability("email") is True
        assert agent.has_capability("slack") is True
        assert agent.has_capability("discord") is False
    
    def test_has_capability_with_list(self):
        """Test has_capability with list capabilities."""
        capabilities = ["email", "slack"]
        agent = self._create_test_agent(capabilities=capabilities)
        
        assert agent.has_capability("email") is True
        assert agent.has_capability("slack") is True
        assert agent.has_capability("discord") is False
    
    def test_agent_equality_by_id(self):
        """Test agent equality is based on ID."""
        agent1 = self._create_test_agent_with_id(1)
        agent2 = self._create_test_agent_with_id(1)
        agent3 = self._create_test_agent_with_id(2)
        
        assert agent1 == agent2
        assert agent1 != agent3
    
    def test_agent_hash_by_id(self):
        """Test agent hash is based on ID."""
        agent1 = self._create_test_agent_with_id(1)
        agent2 = self._create_test_agent_with_id(1)
        
        assert hash(agent1) == hash(agent2)
    
    def test_from_persistence_creates_agent(self):
        """Test creating agent from persistence data."""
        data = {
            "id": 123,
            "name": "Persisted Agent",
            "role": "Assistant",
            "description": "From database",
            "persona": None,
            "tools": {"tool1": {}},
            "servers": {"server1": {}},
            "trigger": {"type": "manual"},
            "capabilities": {"cap1": {}},
            "database_id": "db_123",
            "status": "active",
            "organization_id": 1,
            "owner_id": "user_123",
            "role_id": 5,
            "api_key": "api_key_123",
            "created_at": datetime(2024, 1, 1, 12, 0, 0)
        }
        
        agent = Agent.from_persistence(data)
        
        assert agent.id.value == 123
        assert agent.name == "Persisted Agent"
        assert agent.role == "Assistant"
        assert agent.description == "From database"
        assert agent.persona is None
        assert agent.tools == {"tool1": {}}
        assert agent.servers == {"server1": {}}
        assert agent.trigger == {"type": "manual"}
        assert agent.capabilities == {"cap1": {}}
        assert agent.database_id == "db_123"
        assert agent.status == AgentStatus.ACTIVE
        assert agent.organization_id.value == 1
        assert agent.owner_id.value == "user_123"
        assert agent.role_id == 5
        assert agent.api_key == "api_key_123"
        assert agent.created_at == datetime(2024, 1, 1, 12, 0, 0)
    
    def _create_test_agent(self, **kwargs) -> Agent:
        """Helper to create test agent with defaults."""
        defaults = {
            "name": "Test Agent",
            "role": None,
            "description": None,
            "persona": None,
            "tools": None,
            "servers": None,
            "trigger": None,
            "capabilities": None,
            "database_id": None,
            "status": "active",
            "organization_id": 1,
            "owner_id": "user_123",
            "role_id": None,
            "api_key": None
        }
        defaults.update(kwargs)
        
        config = AgentConfig(**defaults)
        return Agent.create(config)
    
    def _create_test_agent_with_id(self, agent_id: int) -> Agent:
        """Helper to create test agent with specific ID."""
        config = AgentConfig(
            name="Test Agent",
            organization_id=1,
            owner_id="user_123"
        )
        
        agent = Agent.create(config)
        
        # Create new agent with specific ID (simulating from persistence)
        return Agent(
            agent_id=AgentId(agent_id),
            name=agent.name,
            role=agent.role,
            description=agent.description,
            persona=agent.persona,
            tools=agent.tools,
            servers=agent.servers,
            trigger=agent.trigger,
            capabilities=agent.capabilities,
            database_id=agent.database_id,
            status=agent.status.value,
            organization_id=agent.organization_id,
            owner_id=agent.owner_id,
            role_id=agent.role_id,
            api_key=agent.api_key,
            created_at=agent.created_at
        )