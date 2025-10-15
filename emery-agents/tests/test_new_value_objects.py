"""
Test New Value Objects

AIDEV-NOTE: Tests for newly added value objects to ensure DDD compliance.
"""

import pytest
from emery_agents.domain.shared.value_objects.ids import UserId, OwnerId, DatabaseId
from emery_agents.domain.execution.value_objects.execution_value_objects import (
    CapabilityName, TimeoutSeconds, MaxSteps, ProgressPercent
)


class TestNewIdValueObjects:
    """Test newly added ID value objects."""
    
    def test_user_id_creation(self):
        """Test UserId creation and validation."""
        user_id = UserId("user_123")
        assert user_id.value == "user_123"
        
        # Test email format
        email_user_id = UserId.from_email("test@example.com")
        assert email_user_id.value == "test@example.com"
    
    def test_user_id_validation(self):
        """Test UserId validation rules."""
        # Too short
        with pytest.raises(ValueError):
            UserId("ab")
        
        # Invalid email
        with pytest.raises(ValueError):
            UserId.from_email("invalid-email")
        
        # Too long
        with pytest.raises(ValueError):
            UserId("x" * 256)
    
    def test_owner_id(self):
        """Test OwnerId inherits from UserId."""
        owner_id = OwnerId("owner_123")
        assert owner_id.value == "owner_123"
        
        # Test conversion from UserId
        user_id = UserId("user_456")
        owner_from_user = OwnerId.from_user_id(user_id)
        assert owner_from_user.value == "user_456"
    
    def test_database_id(self):
        """Test DatabaseId validation."""
        db_id = DatabaseId("my_table_123")
        assert db_id.value == "my_table_123"
        
        # Test generation
        generated = DatabaseId.generate_for_table("My Complex Table Name!")
        assert generated.value.startswith("my_complex_table_name")
        assert len(generated.value) <= 64
        
        # Test starting with letter rule
        generated_with_number = DatabaseId.generate_for_table("123_table")
        assert generated_with_number.value.startswith("t_")
    
    def test_database_id_validation(self):
        """Test DatabaseId validation rules."""
        # Must start with letter
        with pytest.raises(ValueError):
            DatabaseId("123invalid")
        
        # Invalid characters
        with pytest.raises(ValueError):
            DatabaseId("invalid-name")
        
        # Too short
        with pytest.raises(ValueError):
            DatabaseId("ab")


class TestExecutionValueObjects:
    """Test execution-related value objects."""
    
    def test_capability_name(self):
        """Test CapabilityName validation."""
        cap = CapabilityName("email.send")
        assert cap.value == "email.send"
        assert cap.namespace == "email"
        assert cap.action == "send"
        
        # Simple name
        simple = CapabilityName("calculator")
        assert simple.namespace == "calculator"
        assert simple.action == "calculator"
    
    def test_capability_name_validation(self):
        """Test CapabilityName validation rules."""
        # Too short
        with pytest.raises(ValueError):
            CapabilityName("ab")
        
        # Must start with letter
        with pytest.raises(ValueError):
            CapabilityName("123invalid")
        
        # Invalid characters
        with pytest.raises(ValueError):
            CapabilityName("invalid@name")
    
    def test_timeout_seconds(self):
        """Test TimeoutSeconds validation."""
        timeout = TimeoutSeconds(300)
        assert timeout.value == 300
        assert timeout.in_minutes == 5.0
        assert timeout.in_milliseconds == 300000
        
        # Test factory methods
        default_timeout = TimeoutSeconds.default()
        assert default_timeout.value == 300
        
        from_minutes = TimeoutSeconds.from_minutes(10)
        assert from_minutes.value == 600
    
    def test_timeout_seconds_validation(self):
        """Test TimeoutSeconds validation rules."""
        # Too small
        with pytest.raises(ValueError):
            TimeoutSeconds(0)
        
        # Too large
        with pytest.raises(ValueError):
            TimeoutSeconds(3700)
    
    def test_max_steps(self):
        """Test MaxSteps validation."""
        steps = MaxSteps(10)
        assert steps.value == 10
        assert not steps.is_minimal
        assert not steps.is_maximum
        
        minimal = MaxSteps(1)
        assert minimal.is_minimal
        
        maximal = MaxSteps(100)
        assert maximal.is_maximum
    
    def test_max_steps_validation(self):
        """Test MaxSteps validation rules."""
        # Too small
        with pytest.raises(ValueError):
            MaxSteps(0)
        
        # Too large
        with pytest.raises(ValueError):
            MaxSteps(101)
    
    def test_progress_percent(self):
        """Test ProgressPercent validation."""
        progress = ProgressPercent(50.0)
        assert progress.value == 50.0
        assert progress.as_decimal == 0.5
        assert progress.is_started
        assert not progress.is_complete
        
        # Test factory methods
        zero = ProgressPercent.zero()
        assert zero.value == 0.0
        assert not zero.is_started
        
        complete = ProgressPercent.complete()
        assert complete.value == 100.0
        assert complete.is_complete
        
        from_fraction = ProgressPercent.from_fraction(3, 4)
        assert from_fraction.value == 75.0
    
    def test_progress_percent_validation(self):
        """Test ProgressPercent validation rules."""
        # Negative
        with pytest.raises(ValueError):
            ProgressPercent(-1.0)
        
        # Too large
        with pytest.raises(ValueError):
            ProgressPercent(101.0)
        
        # Wrong type
        with pytest.raises(ValueError):
            ProgressPercent("50%")


class TestIntegrationWithEntities:
    """Test integration of new value objects with domain entities."""
    
    def test_agent_with_new_value_objects(self):
        """Test Agent entity uses new value objects properly."""
        from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
        from emery_agents.domain.agents.value_objects.agent_value_objects import AgentName, AgentStatus
        from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId
        
        config = AgentConfig(
            name=AgentName("Test Agent"),
            organization_id=OrganizationId(1),
            owner_id=OwnerId("user_123"),
            database_id=DatabaseId("agent_db_test")
        )
        
        agent = Agent.create(config)
        assert isinstance(agent.owner_id, OwnerId)
        assert isinstance(agent.database_id, DatabaseId)
        assert agent.owner_id.value == "user_123"
        assert agent.database_id.value == "agent_db_test"
    
    def test_task_with_new_value_objects(self):
        """Test Task entity uses new value objects properly."""
        from emery_agents.domain.agents.entities.task import Task, TaskConfig, TaskInstructions
        from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId, TaskId
        
        instructions = TaskInstructions(instructions="Test task")
        config = TaskConfig(
            agent_id=AgentId(123),
            organization_id=OrganizationId(1),
            name="Test Task",
            instructions=instructions,
            capability_name=CapabilityName("test.execute"),
            created_by=OwnerId("user_456")
        )
        
        task = Task.create(config)
        assert isinstance(task.capability_name, CapabilityName)
        assert isinstance(task.created_by, OwnerId)
        assert task.capability_name.value == "test.execute"
        assert task.created_by.value == "user_456"
    
    def test_execution_context_with_value_objects(self):
        """Test ExecutionContext uses new value objects properly."""
        from emery_agents.domain.execution.entities.execution_context import ExecutionContext, ExecutionMode
        from emery_agents.domain.shared.value_objects.ids import AgentId, OrganizationId
        
        context = ExecutionContext(
            mode=ExecutionMode.CAPABILITY_BASED,
            instructions="Test execution",
            available_tools=["calculator"],
            agent_id=AgentId(123),
            organization_id=OrganizationId(1),
            capability_name=CapabilityName("math.calculate"),
            max_steps=MaxSteps(15),
            timeout_seconds=TimeoutSeconds(600)
        )
        
        assert isinstance(context.capability_name, CapabilityName)
        assert isinstance(context.max_steps, MaxSteps)
        assert isinstance(context.timeout_seconds, TimeoutSeconds)
        assert context.capability_name.value == "math.calculate"
        assert context.max_steps.value == 15
        assert context.timeout_seconds.value == 600