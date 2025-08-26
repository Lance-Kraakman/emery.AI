"""
Integration Tests for Agent Task Flow

AIDEV-NOTE: Integration tests verify complete DDD flow from application services 
through domain entities to infrastructure. Tests the full orchestration.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch

from emery_agents.application.di.container import Container, container
from emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from emery_agents.domain.agents.entities.task import Task, TaskConfig, TaskInstructions
from emery_agents.domain.execution.entities.execution_context import ExecutionContext, ExecutionMode
from emery_agents.domain.shared.value_objects.ids import AgentId, TaskId, OrganizationId
from emery_agents.domain.agents.value_objects.agent_value_objects import AgentName, AgentStatus, ApiKey


class TestAgentTaskIntegrationFlow:
    """Test complete agent task execution flow through all DDD layers."""
    
    @pytest.fixture
    def mock_repositories(self):
        """Create mock repositories for integration testing."""
        return {
            'agent_repo': AsyncMock(),
            'task_repo': AsyncMock(),
            'execution_repo': Mock(),  # Use regular Mock for execute_task returning async iterator
            'tool_repo': Mock()  # Tool repo methods are sync, not async
        }
    
    @pytest.fixture
    def test_agent(self):
        """Create a test agent for integration tests with value objects."""
        config = AgentConfig(
            name=AgentName("Integration Test Agent"),
            organization_id=OrganizationId(1),
            owner_id="user_123",
            status=AgentStatus.active(),
            api_key=ApiKey("ak_integration_secure_production_abcdef789")
        )
        agent = Agent.create(config)
        agent.id = AgentId(123)  # Set test ID
        return agent
    
    @pytest.fixture
    def container_with_mocks(self, mock_repositories):
        """Create container with mocked dependencies."""
        from emery_agents.domain.agents.repositories.agent_repository import IAgentRepository
        from emery_agents.domain.agents.repositories.task_repository import ITaskRepository
        from emery_agents.domain.execution.repositories.execution_repository import IExecutionRepository
        from emery_agents.domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
        
        test_container = Container()
        
        # Register mock repositories
        test_container.register_repository(IAgentRepository, mock_repositories['agent_repo'])
        test_container.register_repository(ITaskRepository, mock_repositories['task_repo'])
        test_container.register_repository(IExecutionRepository, mock_repositories['execution_repo'])
        test_container.register_repository(IToolRegistryRepository, mock_repositories['tool_repo'])
        
        yield test_container, mock_repositories
    
    @pytest.mark.asyncio
    async def test_complete_agent_task_service_flow(self, container_with_mocks, test_agent):
        """Test complete AgentTaskApplicationService flow with value objects."""
        container, mocks = container_with_mocks
        
        # Setup mocks
        mocks['agent_repo'].find_by_id.return_value = test_agent
        mocks['tool_repo'].is_tool_available.return_value = True
        mocks['tool_repo'].list_available_tools.return_value = ["test_tool"]
        
        # Create proper async iterator mock
        class AsyncIteratorMock:
            def __init__(self, values):
                self.values = values
                self.index = 0
                
            def __aiter__(self):
                return self
                
            async def __anext__(self):
                if self.index >= len(self.values):
                    raise StopAsyncIteration
                value = self.values[self.index]
                self.index += 1
                return value
        
        # Mock execution repository to return async iterator
        mocks['execution_repo'].execute_task.return_value = AsyncIteratorMock([
            {"status": "initializing", "progress": 0},
            {"status": "executing", "progress": 50},
            {"status": "completed", "progress": 100, "result": "Task completed"}
        ])
        
        # Create TaskRequest with core entities (not DDD entities yet)
        from emery_agents.core.entities import TaskRequest, AgentConfig as CoreAgentConfig, InstructionConfig, ToolConfig
        
        task_request = TaskRequest(
            task_id="test-task-123",
            agent_id=test_agent.id.value,
            agent_config=CoreAgentConfig(
                name=test_agent.name.value,
                role="test",
                description="Test agent",
                persona="Helpful assistant", 
                tools=[ToolConfig(name="test_tool", version="1.0", config={})],
                servers=[],
                capabilities=[]
            ),
            trigger_data=None,
            organization_id="1", 
            owner_id="user_123",
            timeout_seconds=30,
            name="Integration Test Task",
            instruction_config=InstructionConfig(
                instructions="Test instruction for integration",
                tools=[ToolConfig(name="test_tool", version="1.0", config={})],
                servers=[]
            )
        )
        
        # Execute via application service  
        service = container.get_agent_task_service()
        
        # Collect progress updates
        progress_updates = []
        async for progress in service.execute_task(task_request):
            progress_updates.append(progress)
        
        # Verify complete flow executed
        assert len(progress_updates) >= 2  # At least initialization and completion
        assert progress_updates[-1]["status"] == "completed"
        
        # Verify repository interactions  
        mocks['agent_repo'].find_by_id.assert_called_once_with(test_agent.id)
        mocks['tool_repo'].is_tool_available.assert_called()
    
    @pytest.mark.asyncio
    async def test_agent_validation_flow(self, container_with_mocks):
        """Test agent validation through application service."""
        container, mocks = container_with_mocks
        
        # Create inactive agent with value objects
        inactive_config = AgentConfig(
            name=AgentName("Inactive Agent"),
            organization_id=OrganizationId(1),
            owner_id="user_123",
            status=AgentStatus.inactive()  # Inactive status
        )
        inactive_agent = Agent.create(inactive_config)
        inactive_agent.id = AgentId(456)
        
        mocks['agent_repo'].find_by_id.return_value = inactive_agent
        
        # Create TaskRequest for inactive agent
        from emery_agents.core.entities import TaskRequest, AgentConfig as CoreAgentConfig, InstructionConfig
        
        task_request = TaskRequest(
            task_id="test-validation-task",
            agent_id=inactive_agent.id.value,
            agent_config=CoreAgentConfig(
                name=inactive_agent.name.value,
                role="test",
                description="Test agent",
                persona="Assistant",
                tools=[],
                servers=[],
                capabilities=[]
            ),
            trigger_data=None,
            organization_id="1",
            owner_id="user_123", 
            timeout_seconds=30,
            name="Validation Test",
            instruction_config=InstructionConfig(
                instructions="This should fail validation",
                tools=[],
                servers=[]
            )
        )
        
        service = container.get_agent_task_service()
        
        # Should fail validation because agent is inactive
        with pytest.raises(ValueError, match="is not active"):
            async for _ in service.execute_task(task_request):
                pass  # Should not reach here
    
    @pytest.mark.asyncio  
    async def test_ddd_value_objects_integration(self, container_with_mocks, test_agent):
        """Test that value objects work correctly through the complete flow."""
        container, mocks = container_with_mocks
        
        # Setup mocks with value object validation
        mocks['agent_repo'].find_by_id.return_value = test_agent
        mocks['tool_repo'].is_tool_available.return_value = True
        
        # Mock execution that returns value object compatible data
        async def mock_execute_with_value_objects(context):
            # Verify context has value objects
            assert context.agent_id is None or isinstance(context.agent_id, AgentId) 
            assert context.organization_id is None or isinstance(context.organization_id, OrganizationId)
            yield {"status": "completed", "result": "Value objects working"}
            
        mocks['execution_repo'].execute_task.side_effect = mock_execute_with_value_objects
        
        # Create request using current core entities interface  
        from emery_agents.core.entities import TaskRequest, AgentConfig as CoreAgentConfig, InstructionConfig
        
        task_request = TaskRequest(
            task_id="value-object-test",
            agent_id=test_agent.id.value,  # Extract value from value object
            agent_config=CoreAgentConfig(
                name=test_agent.name.value,  # Extract value from value object
                role="test",
                description="DDD value object test",
                persona="Assistant",
                tools=[],
                servers=[], 
                capabilities=[]
            ),
            trigger_data=None,
            organization_id=str(test_agent.organization_id.value),  # Extract value from value object
            owner_id="user_123",
            timeout_seconds=30,
            name="Value Object Integration Test", 
            instruction_config=InstructionConfig(
                instructions="Test value objects integration",
                tools=[],
                servers=[]
            )
        )
        
        service = container.get_agent_task_service()
        
        # Execute and verify value objects work
        progress_updates = []
        async for progress in service.execute_task(task_request):
            progress_updates.append(progress)
        
        # Verify execution completed
        assert len(progress_updates) >= 1
        assert progress_updates[-1]["status"] == "completed"
        
        # Verify agent repository was called with value object
        mocks['agent_repo'].find_by_id.assert_called_once_with(test_agent.id)
    
    @pytest.mark.asyncio
    async def test_error_handling_through_ddd_layers(self, container_with_mocks, test_agent):
        """Test error propagation through DDD layers with value objects."""
        container, mocks = container_with_mocks
        
        # Setup mocks
        mocks['agent_repo'].find_by_id.return_value = test_agent
        mocks['tool_repo'].is_tool_available.return_value = True
        
        # Mock execution that raises an error
        async def mock_execution_error(context):
            yield {"status": "initializing", "progress": 0}
            raise Exception("Simulated execution failure")
            
        mocks['execution_repo'].execute_task.side_effect = mock_execution_error
        
        from emery_agents.core.entities import TaskRequest, AgentConfig as CoreAgentConfig, InstructionConfig
        
        task_request = TaskRequest(
            task_id="error-test-task",
            agent_id=test_agent.id.value,
            agent_config=CoreAgentConfig(
                name=test_agent.name.value,
                role="test",
                description="Error test",
                persona="Assistant",
                tools=[],
                servers=[],
                capabilities=[]
            ),
            trigger_data=None,
            organization_id=str(test_agent.organization_id.value),
            owner_id="user_123",
            timeout_seconds=30,
            name="Error Test Task",
            instruction_config=InstructionConfig(
                instructions="This should fail",
                tools=[],
                servers=[]
            )
        )
        
        service = container.get_agent_task_service()
        
        # Should propagate the exception
        with pytest.raises(Exception, match="Simulated execution failure"):
            async for _ in service.execute_task(task_request):
                pass
    
    @pytest.mark.asyncio
    async def test_dependency_injection_wiring(self, container_with_mocks):
        """Test that DI container properly wires DDD components."""
        container, mocks = container_with_mocks
        
        # Test that service can be retrieved and properly configured
        service = container.get_agent_task_service()
        assert service is not None
        
        # Verify service has all required dependencies
        assert service.agent_repository is not None
        assert service.task_repository is not None  
        assert service.execution_repository is not None
        assert service.tool_registry_repository is not None
        assert service.capability_routing_service is not None
        
        # Should return same instance (singleton pattern)
        service2 = container.get_agent_task_service()
        assert service is service2