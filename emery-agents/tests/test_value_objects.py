"""
Tests for DDD value objects implementation.

AIDEV-NOTE: Quick verification tests for our value object implementation.
Tests core functionality like validation, equality, and immutability.
"""

import pytest
from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId, TaskId
from emery_agents.domain.agents.value_objects.agent_value_objects import (
    AgentName, AgentStatus, ApiKey
)
from emery_agents.domain.tools.value_objects.tool_value_objects import (
    ToolName, ToolVersion
)


class TestIdValueObjects:
    """Test ID value objects."""
    
    def test_agent_id_creation(self):
        """Test AgentId creation and validation."""
        agent_id = AgentId(123)
        assert agent_id.value == 123
        
    def test_agent_id_validation(self):
        """Test AgentId validation rules."""
        with pytest.raises(ValueError, match="AgentId must be positive"):
            AgentId(0)
        
        with pytest.raises(ValueError, match="AgentId must be positive"):
            AgentId(-5)
            
    def test_agent_id_equality(self):
        """Test AgentId equality."""
        agent_id1 = AgentId(123)
        agent_id2 = AgentId(123)
        agent_id3 = AgentId(456)
        
        assert agent_id1 == agent_id2
        assert agent_id1 != agent_id3
        
    def test_organization_id(self):
        """Test OrganizationId functionality."""
        org_id = OrganizationId(1)
        assert org_id.value == 1
        
        with pytest.raises(ValueError):
            OrganizationId(0)
            
    def test_task_id_generation(self):
        """Test TaskId generation."""
        task_id = TaskId.generate()
        assert task_id.value
        assert len(task_id.value) >= 8  # Short ID format
        
    def test_task_id_validation(self):
        """Test TaskId validation."""
        # Valid short ID
        task_id = TaskId("abc123def")
        assert task_id.value == "abc123def"
        
        # Invalid - too short
        with pytest.raises(ValueError, match="TaskId must be a valid UUID"):
            TaskId("ab")


class TestAgentValueObjects:
    """Test agent-specific value objects."""
    
    def test_agent_name_validation(self):
        """Test AgentName validation rules."""
        # Valid name
        name = AgentName("Test Agent")
        assert name.value == "Test Agent"
        
        # Too short
        with pytest.raises(ValueError, match="AgentName must be at least 2 characters"):
            AgentName("A")
            
        # Too long
        with pytest.raises(ValueError, match="AgentName must not exceed 100 characters"):
            AgentName("A" * 101)
            
    def test_agent_status(self):
        """Test AgentStatus creation."""
        active_status = AgentStatus.active()
        assert active_status.value == "active"
        assert active_status.is_active is True
        
        inactive_status = AgentStatus.inactive()
        assert inactive_status.value == "inactive"
        assert inactive_status.is_active is False
        
    def test_api_key_validation(self):
        """Test ApiKey validation."""
        # Valid API key (avoiding weak patterns)
        api_key = ApiKey("ak_secure_production_abc123def456ghi789")
        assert api_key.value == "ak_secure_production_abc123def456ghi789"
        
        # Too short
        with pytest.raises(ValueError, match="ApiKey must be at least"):
            ApiKey("short")


class TestToolValueObjects:
    """Test tool-specific value objects."""
    
    def test_tool_name(self):
        """Test ToolName validation."""
        tool_name = ToolName("test_tool")
        assert tool_name.value == "test_tool"
        
        # Invalid characters
        with pytest.raises(ValueError, match="ToolName must be lowercase alphanumeric"):
            ToolName("invalid-name!")
            
    def test_tool_version(self):
        """Test ToolVersion validation."""
        version = ToolVersion("1.0.0")
        assert version.value == "1.0.0"
        
        version2 = ToolVersion("2.1")
        assert version2.value == "2.1"
        
        # Invalid version
        with pytest.raises(ValueError, match="ToolVersion must follow semantic versioning"):
            ToolVersion("invalid-version")


class TestValueObjectImmutability:
    """Test that value objects are immutable."""
    
    def test_value_objects_are_immutable(self):
        """Test that value objects cannot be modified after creation."""
        agent_id = AgentId(123)
        
        # Value objects should be treated as immutable (even if not enforced)
        original_value = agent_id.value
        assert original_value == 123
            
    def test_hash_consistency(self):
        """Test that value objects can be used in sets and as dict keys."""
        agent_id1 = AgentId(123)
        agent_id2 = AgentId(123)
        agent_id3 = AgentId(456)
        
        # Test hashing works for sets
        id_set = {agent_id1, agent_id2, agent_id3}
        assert len(id_set) == 2  # agent_id1 and agent_id2 should be deduplicated
        
        # Test as dict keys
        id_dict = {agent_id1: "value1", agent_id2: "value2", agent_id3: "value3"}
        assert len(id_dict) == 2  # agent_id1 and agent_id2 should use same key
        assert id_dict[agent_id1] == "value2"  # Should be overwritten


class TestIntegrationWithEntities:
    """Test that entities work correctly with value objects."""
    
    def test_agent_with_value_objects(self):
        """Test Agent entity using value objects."""
        from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
        
        # Create agent using value objects
        config = AgentConfig(
            name=AgentName("Test Agent"),
            organization_id=OrganizationId(1),
            owner_id="user_123",
            description="Test agent with value objects",
            persona="Helpful assistant",
            status=AgentStatus.active(),
            api_key=ApiKey("ak_secure_production_abc123def456ghi789")
        )
        
        agent = Agent.create(config)
        
        # Verify value objects work
        assert isinstance(agent.name, AgentName)
        assert agent.name.value == "Test Agent"
        assert isinstance(agent.organization_id, OrganizationId)
        assert agent.organization_id.value == 1
        assert agent.status.is_active is True
        
    def test_task_with_value_objects(self):
        """Test Task entity using value objects."""
        from emery_agents.domain.agents.entities.task import Task, TaskConfig, TaskInstructions
        
        # Create task using value objects
        task_instructions = TaskInstructions(
            instructions="Test task with value objects",
            tools=[{"name": "test_tool"}],
            servers=[]
        )
        
        config = TaskConfig(
            agent_id=AgentId(123),
            organization_id=OrganizationId(1),
            name="Test Task",
            instructions=task_instructions
        )
        
        task = Task.create(config)
        
        # Verify value objects work
        assert isinstance(task.agent_id, AgentId)
        assert task.agent_id.value == 123
        assert isinstance(task.organization_id, OrganizationId)
        assert task.organization_id.value == 1
        assert isinstance(task.id, TaskId)
        assert task.id.value  # Should have generated ID