"""
Integration Tests for Agent Task Flow

AIDEV-NOTE: Integration tests verify complete DDD flow from application services 
through domain entities to infrastructure. Tests the full orchestration.
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch

from src.emery_agents.application.di.agent_container import create_agent_container
from src.emery_agents.application.commands.create_task_command import CreateTaskCommand
from src.emery_agents.application.commands.execute_task_command import ExecuteTaskCommand
from src.emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from src.emery_agents.domain.agents.entities.task import Task, TaskConfig, TaskInstructions
from src.emery_agents.domain.agents.repositories.agent_execution_repository import AgentExecutionResult
from src.emery_agents.domain.agents.value_objects.agent_id import AgentId
from src.emery_agents.domain.agents.value_objects.task_id import TaskId


class TestAgentTaskIntegrationFlow:
    """Test complete agent task execution flow through all DDD layers."""
    
    @pytest.fixture
    def mock_repositories(self):
        """Create mock repositories for integration testing."""
        return {
            'agent_repo': AsyncMock(),
            'task_repo': AsyncMock(),
            'execution_repo': AsyncMock(),
            'tool_repo': AsyncMock()
        }
    
    @pytest.fixture
    def test_agent(self):
        """Create a test agent for integration tests."""
        config = AgentConfig(
            name="Integration Test Agent",
            organization_id=1,
            owner_id="user_123",
            status="active",
            api_key="test_api_key"
        )
        return Agent.create(config)
    
    @pytest.fixture
    def container_with_mocks(self, mock_repositories):
        """Create container with mocked dependencies."""
        container = create_agent_container()
        
        # Patch the container's repository methods
        with patch.object(container, 'agent_repository', return_value=mock_repositories['agent_repo']):
            with patch.object(container, 'task_repository', return_value=mock_repositories['task_repo']):
                with patch.object(container, 'execution_repository', return_value=mock_repositories['execution_repo']):
                    yield container, mock_repositories
    
    @pytest.mark.asyncio
    async def test_complete_create_and_execute_task_flow(self, container_with_mocks, test_agent):
        """Test complete flow: create task -> validate -> execute -> record result."""
        container, mocks = container_with_mocks
        
        # Setup mocks
        mocks['agent_repo'].find_by_id.return_value = test_agent
        mocks['task_repo'].save.return_value = AsyncMock()
        
        # Mock successful execution
        execution_result = AgentExecutionResult(
            success=True,
            execution_id="test_execution_id",
            status="completed",
            output_data={"result": "Task completed successfully"}
        )
        mocks['execution_repo'].execute_agent.return_value = execution_result
        
        # Execute complete flow
        result = await container.create_task_and_execute(
            agent_id=test_agent.id.value,
            task_name="Integration Test Task",
            instructions="Test instruction for integration",
            tools=[{"name": "test_tool"}],
            created_by="user_123"
        )
        
        # Verify complete flow executed
        assert result is not None
        assert result.execution_result.success is True
        assert result.task.is_successful() is True
        
        # Verify all repository interactions
        mocks['agent_repo'].find_by_id.assert_called()
        assert mocks['task_repo'].save.call_count >= 2  # Create and complete
        mocks['execution_repo'].execute_agent.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_agent_validation_flow(self, container_with_mocks):
        """Test agent validation in the complete flow."""
        container, mocks = container_with_mocks
        
        # Create inactive agent
        inactive_config = AgentConfig(
            name="Inactive Agent",
            organization_id=1,
            owner_id="user_123",
            status="inactive"
        )
        inactive_agent = Agent.create(inactive_config)
        
        mocks['agent_repo'].find_by_id.return_value = inactive_agent
        
        # Should fail validation
        with pytest.raises(ValueError, match="is not active"):
            await container.get_agent_with_validation(inactive_agent.id.value)
    
    @pytest.mark.asyncio
    async def test_task_lifecycle_through_application_service(self, container_with_mocks, test_agent):
        """Test task moves through all states via application service."""
        container, mocks = container_with_mocks
        
        # Setup mocks
        mocks['agent_repo'].find_by_id.return_value = test_agent
        saved_tasks = []
        
        def capture_save(task):
            saved_tasks.append(task)
            return AsyncMock()
        
        mocks['task_repo'].save.side_effect = capture_save
        mocks['task_repo'].find_by_id.side_effect = lambda task_id: saved_tasks[-1] if saved_tasks else None
        
        # Mock execution result
        execution_result = AgentExecutionResult(
            success=True,
            execution_id="test_id",
            status="completed",
            output_data={"message": "Success"}
        )
        mocks['execution_repo'].execute_agent.return_value = execution_result
        
        # Get application service
        service = container.agent_task_service()
        
        # Create task
        instructions = TaskInstructions(instructions="Test task")
        create_command = CreateTaskCommand(
            agent_id=test_agent.id.value,
            name="Lifecycle Test Task",
            instructions=instructions
        )
        
        task = await service.create_task(create_command)
        
        # Execute task
        execute_command = ExecuteTaskCommand(task_id=task.id.value)
        result = await service.execute_task(execute_command)
        
        # Verify task went through lifecycle
        assert len(saved_tasks) >= 3  # Initial, started, completed
        
        # First save: pending state
        assert saved_tasks[0].is_pending()
        
        # Task should end up completed
        assert result.task.is_successful()
        assert result.execution_result.success is True
    
    @pytest.mark.asyncio
    async def test_error_handling_through_layers(self, container_with_mocks, test_agent):
        """Test error propagation through all DDD layers."""
        container, mocks = container_with_mocks
        
        # Setup mocks
        mocks['agent_repo'].find_by_id.return_value = test_agent
        mocks['task_repo'].save.return_value = AsyncMock()
        
        # Mock execution failure
        execution_result = AgentExecutionResult(
            success=False,
            execution_id="failed_execution",
            status="failed",
            error="Execution failed due to network error"
        )
        mocks['execution_repo'].execute_agent.return_value = execution_result
        
        # Execute with failure
        service = container.agent_task_service()
        
        instructions = TaskInstructions(instructions="Failing task")
        create_command = CreateTaskCommand(
            agent_id=test_agent.id.value,
            name="Error Test Task",
            instructions=instructions
        )
        
        # Create and execute
        task = await service.create_task(create_command)
        execute_command = ExecuteTaskCommand(task_id=task.id.value)
        result = await service.execute_task(execute_command)
        
        # Verify error handling
        assert result.execution_result.success is False
        assert result.task.is_failed()
        assert "network error" in result.task.error
    
    @pytest.mark.asyncio
    async def test_domain_business_rules_enforcement(self, container_with_mocks, test_agent):
        """Test domain business rules are enforced through the complete flow."""
        container, mocks = container_with_mocks
        
        # Create agent without API key
        no_api_key_config = AgentConfig(
            name="No API Key Agent",
            organization_id=1,
            owner_id="user_123",
            status="active"  # Active but no API key
        )
        no_api_key_agent = Agent.create(no_api_key_config)
        
        mocks['agent_repo'].find_by_id.return_value = no_api_key_agent
        
        # Should fail business rule validation
        service = container.agent_task_service()
        
        instructions = TaskInstructions(instructions="Test task")
        create_command = CreateTaskCommand(
            agent_id=no_api_key_agent.id.value,
            name="Business Rule Test",
            instructions=instructions
        )
        
        # Create task should work
        task = await service.create_task(create_command)
        
        # But execution should fail due to business rules
        execute_command = ExecuteTaskCommand(task_id=task.id.value)
        with pytest.raises(ValueError, match="has no API key configured"):
            await service.execute_task(execute_command)
    
    @pytest.mark.asyncio
    async def test_dependency_injection_wiring(self, container_with_mocks):
        """Test that dependency injection properly wires all components."""
        container, mocks = container_with_mocks
        
        # Get various services
        agent_task_service = container.agent_task_service()
        execute_use_case = container.execute_task_use_case()
        load_tools_use_case = container.load_tools_use_case()
        
        # All should be properly instantiated
        assert agent_task_service is not None
        assert execute_use_case is not None
        assert load_tools_use_case is not None
        
        # Should return same instances (singleton pattern)
        assert container.agent_task_service() is agent_task_service
        assert container.execute_task_use_case() is execute_use_case