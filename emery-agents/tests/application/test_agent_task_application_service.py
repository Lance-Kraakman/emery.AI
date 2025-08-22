"""
Tests for Agent Task Application Service

AIDEV-NOTE: Application service tests focus on orchestration logic.
Uses mock repositories to isolate application logic from infrastructure.
"""

import pytest
from unittest.mock import AsyncMock, Mock

from src.emery_agents.application.use_cases.agents.agent_task_application_service import (
    AgentTaskApplicationService,
    TaskExecutionResult,
)
from src.emery_agents.application.commands.create_task_command import CreateTaskCommand
from src.emery_agents.application.commands.execute_task_command import ExecuteTaskCommand
from src.emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from src.emery_agents.domain.agents.entities.task import Task, TaskConfig, TaskInstructions
from src.emery_agents.domain.agents.repositories.agent_execution_repository import (
    AgentExecutionResult,
)
from src.emery_agents.domain.agents.value_objects.agent_id import AgentId
from src.emery_agents.domain.agents.value_objects.task_id import TaskId


class TestAgentTaskApplicationService:
    """Test application service orchestration logic."""
    
    @pytest.fixture
    def mock_agent_repository(self):
        """Mock agent repository."""
        return AsyncMock()
    
    @pytest.fixture
    def mock_task_repository(self):
        """Mock task repository."""
        return AsyncMock()
    
    @pytest.fixture
    def mock_execution_repository(self):
        """Mock execution repository."""
        return AsyncMock()
    
    @pytest.fixture
    def service(self, mock_agent_repository, mock_task_repository, mock_execution_repository):
        """Create service with mock dependencies."""
        return AgentTaskApplicationService(
            agent_repository=mock_agent_repository,
            task_repository=mock_task_repository,
            execution_repository=mock_execution_repository
        )
    
    @pytest.fixture
    def test_agent(self):
        """Create test agent."""
        config = AgentConfig(
            name="Test Agent",
            organization_id=1,
            owner_id="user_123",
            status="active",
            api_key="test_key"
        )
        return Agent.create(config)
    
    @pytest.fixture
    def test_task(self):
        """Create test task."""
        config = TaskConfig(
            agent_id=123,
            organization_id=1,
            name="Test Task",
            instructions=TaskInstructions(instructions="Test instruction")
        )
        return Task.create(config)
    
    @pytest.mark.asyncio
    async def test_create_task_with_valid_agent(
        self, 
        service, 
        mock_agent_repository, 
        mock_task_repository,
        test_agent
    ):
        """Test creating task with valid active agent."""
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = test_agent
        mock_task_repository.save.return_value = AsyncMock()
        
        # Create command
        instructions = TaskInstructions(instructions="Send email to team")
        command = CreateTaskCommand(
            agent_id=123,
            name="Email Task",
            instructions=instructions,
            created_by="user_123"
        )
        
        # Execute
        result = await service.create_task(command)
        
        # Verify
        assert isinstance(result, Task)
        assert result.name == "Email Task"
        assert result.agent_id.value == 123
        
        # Verify repository interactions
        mock_agent_repository.find_by_id.assert_called_once_with(AgentId(123))
        mock_task_repository.save.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_create_task_with_nonexistent_agent(
        self,
        service,
        mock_agent_repository
    ):
        """Test creating task with non-existent agent fails."""
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = None
        
        # Create command
        instructions = TaskInstructions(instructions="Test")
        command = CreateTaskCommand(
            agent_id=999,
            name="Test Task",
            instructions=instructions
        )
        
        # Execute and verify exception
        with pytest.raises(ValueError, match="Agent 999 not found"):
            await service.create_task(command)
    
    @pytest.mark.asyncio
    async def test_create_task_with_inactive_agent(
        self,
        service,
        mock_agent_repository
    ):
        """Test creating task with inactive agent fails."""
        # Create inactive agent
        config = AgentConfig(
            name="Inactive Agent",
            organization_id=1,
            owner_id="user_123",
            status="inactive"  # Not active
        )
        inactive_agent = Agent.create(config)
        
        # Setup mocks
        mock_agent_repository.find_by_id.return_value = inactive_agent
        
        # Create command
        instructions = TaskInstructions(instructions="Test")
        command = CreateTaskCommand(
            agent_id=123,
            name="Test Task",
            instructions=instructions
        )
        
        # Execute and verify exception
        with pytest.raises(ValueError, match="Agent 123 is not active"):
            await service.create_task(command)
    
    @pytest.mark.asyncio
    async def test_execute_task_successful_execution(
        self,
        service,
        mock_agent_repository,
        mock_task_repository,
        mock_execution_repository,
        test_agent,
        test_task
    ):
        """Test successful task execution."""
        # Setup mocks
        mock_task_repository.find_by_id.return_value = test_task
        mock_agent_repository.find_by_id.return_value = test_agent
        mock_task_repository.save.return_value = AsyncMock()
        
        # Mock successful execution
        execution_result = AgentExecutionResult(
            success=True,
            execution_id=test_task.id.value,
            status="completed",
            output_data={"result": "Email sent successfully"}
        )
        mock_execution_repository.execute_agent.return_value = execution_result
        
        # Create command
        command = ExecuteTaskCommand(task_id=test_task.id.value)
        
        # Execute
        result = await service.execute_task(command)
        
        # Verify
        assert isinstance(result, TaskExecutionResult)
        assert result.execution_result.success is True
        assert result.task.is_successful() is True
        assert result.task.result == {"result": "Email sent successfully"}
        
        # Verify repository interactions
        mock_task_repository.find_by_id.assert_called_with(test_task.id)
        mock_agent_repository.find_by_id.assert_called_with(test_task.agent_id)
        mock_execution_repository.execute_agent.assert_called_once()
        assert mock_task_repository.save.call_count == 2  # Start and complete
    
    @pytest.mark.asyncio
    async def test_execute_task_failed_execution(
        self,
        service,
        mock_agent_repository,
        mock_task_repository,
        mock_execution_repository,
        test_agent,
        test_task
    ):
        """Test failed task execution."""
        # Setup mocks
        mock_task_repository.find_by_id.return_value = test_task
        mock_agent_repository.find_by_id.return_value = test_agent
        mock_task_repository.save.return_value = AsyncMock()
        
        # Mock failed execution
        execution_result = AgentExecutionResult(
            success=False,
            execution_id=test_task.id.value,
            status="failed",
            error="SMTP server not available"
        )
        mock_execution_repository.execute_agent.return_value = execution_result
        
        # Create command
        command = ExecuteTaskCommand(task_id=test_task.id.value)
        
        # Execute
        result = await service.execute_task(command)
        
        # Verify
        assert isinstance(result, TaskExecutionResult)
        assert result.execution_result.success is False
        assert result.task.is_failed() is True
        assert result.task.error == "SMTP server not available"
    
    @pytest.mark.asyncio
    async def test_execute_task_with_nonexistent_task(
        self,
        service,
        mock_task_repository
    ):
        """Test executing non-existent task fails."""
        # Setup mocks
        mock_task_repository.find_by_id.return_value = None
        
        # Create command
        task_id = TaskId.generate()
        command = ExecuteTaskCommand(task_id=task_id.value)
        
        # Execute and verify exception
        with pytest.raises(ValueError, match=f"Task {task_id.value} not found"):
            await service.execute_task(command)
    
    @pytest.mark.asyncio
    async def test_execute_task_with_non_pending_task(
        self,
        service,
        mock_task_repository,
        test_task
    ):
        """Test executing non-pending task fails."""
        # Create running task
        running_task = test_task.start()
        
        # Setup mocks
        mock_task_repository.find_by_id.return_value = running_task
        
        # Create command
        command = ExecuteTaskCommand(task_id=running_task.id.value)
        
        # Execute and verify exception
        with pytest.raises(ValueError, match="is not pending"):
            await service.execute_task(command)
    
    @pytest.mark.asyncio
    async def test_execute_task_with_invalid_agent(
        self,
        service,
        mock_task_repository,
        mock_agent_repository,
        test_task
    ):
        """Test executing task with invalid agent."""
        # Create agent without API key (invalid for execution)
        config = AgentConfig(
            name="Invalid Agent",
            organization_id=1,
            owner_id="user_123",
            status="active",
            api_key=None  # No API key
        )
        invalid_agent = Agent.create(config)
        
        # Setup mocks
        mock_task_repository.find_by_id.return_value = test_task
        mock_agent_repository.find_by_id.return_value = invalid_agent
        
        # Create command
        command = ExecuteTaskCommand(task_id=test_task.id.value)
        
        # Execute and verify exception
        with pytest.raises(ValueError, match="has no API key configured"):
            await service.execute_task(command)
    
    @pytest.mark.asyncio
    async def test_create_and_execute_task(
        self,
        service,
        mock_agent_repository,
        mock_task_repository,
        mock_execution_repository,
        test_agent
    ):
        """Test create and execute task in one operation."""
        # Setup mocks for creation
        mock_agent_repository.find_by_id.return_value = test_agent
        mock_task_repository.save.return_value = AsyncMock()
        
        # Mock successful execution
        execution_result = AgentExecutionResult(
            success=True,
            execution_id="test_id",
            status="completed",
            output_data={"result": "Success"}
        )
        mock_execution_repository.execute_agent.return_value = execution_result
        
        # Create command
        instructions = TaskInstructions(instructions="Test task")
        command = CreateTaskCommand(
            agent_id=123,
            name="Test Task",
            instructions=instructions
        )
        
        # Execute
        result = await service.create_and_execute_task(command)
        
        # Verify
        assert isinstance(result, TaskExecutionResult)
        assert result.execution_result.success is True
        assert result.task.is_successful() is True
        
        # Verify both creation and execution happened
        mock_agent_repository.find_by_id.assert_called()
        mock_execution_repository.execute_agent.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_cancel_task(
        self,
        service,
        mock_task_repository,
        mock_execution_repository
    ):
        """Test cancelling a running task."""
        # Create running task
        config = TaskConfig(
            agent_id=123,
            organization_id=1,
            name="Running Task",
            instructions=TaskInstructions(instructions="Test")
        )
        task = Task.create(config)
        running_task = task.start()
        
        # Setup mocks
        mock_task_repository.find_by_id.return_value = running_task
        mock_task_repository.save.return_value = AsyncMock()
        
        # Execute
        await service.cancel_task(running_task.id.value, "User requested")
        
        # Verify
        mock_execution_repository.cancel_execution.assert_called_once_with(
            running_task.id.value, "User requested"
        )
        mock_task_repository.save.assert_called_once()
        
        # Verify the saved task was cancelled
        saved_task = mock_task_repository.save.call_args[0][0]
        assert saved_task.status.value == "cancelled"
        assert "User requested" in saved_task.error