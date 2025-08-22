"""
Tests for Agent Task Service (Proper DDD)

AIDEV-NOTE: Tests the simplified DDD patterns following TypeScript structure.
Uses mock repositories to test application service orchestration.
"""

import pytest
from unittest.mock import AsyncMock

from src.emery_agents.domain.agents.entities.agent import Agent, AgentConfig
from src.emery_agents.domain.agents.entities.task import Task, TaskInstructions
from src.emery_agents.application.services.agent_task_service import (
    AgentTaskApplicationService,
    CreateTaskRequest,
    ExecuteTaskRequest
)


class TestAgentTaskService:
    """Test the simplified DDD application service."""
    
    @pytest.fixture
    def mock_agent_repository(self):
        """Mock agent repository."""
        return AsyncMock()
    
    @pytest.fixture
    def mock_task_repository(self):
        """Mock task repository."""
        return AsyncMock()
    
    @pytest.fixture
    def service(self, mock_agent_repository, mock_task_repository):
        """Create service with mock dependencies."""
        return AgentTaskApplicationService(
            agent_repository=mock_agent_repository,
            task_repository=mock_task_repository
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
        mock_task_repository.save.return_value = None
        
        # Create request
        instructions = TaskInstructions(instructions="Send email to team")
        request = CreateTaskRequest(
            agent_id=123,
            name="Email Task",
            instructions=instructions,
            created_by="user_123"
        )
        
        # Execute
        result = await service.create_task(request)
        
        # Verify
        assert isinstance(result, Task)
        assert result.name == "Email Task"
        assert result.agent_id == 123
        
        # Verify repository interactions
        mock_agent_repository.find_by_id.assert_called_once_with(123)
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
        
        # Create request
        instructions = TaskInstructions(instructions="Test")
        request = CreateTaskRequest(
            agent_id=999,
            name="Test Task",
            instructions=instructions
        )
        
        # Execute and verify exception
        with pytest.raises(ValueError, match="Agent 999 not found"):
            await service.create_task(request)
    
    @pytest.mark.asyncio
    async def test_execute_task_successful_execution(
        self,
        service,
        mock_agent_repository,
        mock_task_repository,
        test_agent
    ):
        """Test successful task execution."""
        # Create a pending task
        instructions = TaskInstructions(instructions="Test task")
        from src.emery_agents.domain.agents.entities.task import TaskConfig
        task = Task.create(TaskConfig(
            agent_id=123,
            organization_id=1,
            name="Test Task",
            instructions=instructions
        ))
        
        # Setup mocks
        mock_task_repository.find_by_id.return_value = task
        mock_agent_repository.find_by_id.return_value = test_agent
        mock_task_repository.save.return_value = None
        
        # Create request
        request = ExecuteTaskRequest(task_id=task.id)
        
        # Execute
        result = await service.execute_task(request)
        
        # Verify
        assert result.task.is_successful
        assert result.execution_result["success"] is True
        
        # Verify repository interactions
        mock_task_repository.find_by_id.assert_called_with(task.id)
        mock_agent_repository.find_by_id.assert_called_with(123)
        assert mock_task_repository.save.call_count >= 2  # Start and complete
    
    @pytest.mark.asyncio
    async def test_create_and_execute_task_flow(
        self,
        service,
        mock_agent_repository,
        mock_task_repository,
        test_agent
    ):
        """Test complete flow: create task -> execute task."""
        # Setup mocks - need to capture the created task
        mock_agent_repository.find_by_id.return_value = test_agent
        mock_task_repository.save.return_value = None
        
        created_task = None
        def save_task(task):
            nonlocal created_task
            created_task = task
            
        def find_task_by_id(task_id):
            return created_task if created_task and created_task.id == task_id else None
        
        mock_task_repository.save.side_effect = save_task
        mock_task_repository.find_by_id.side_effect = find_task_by_id
        
        # Create request
        instructions = TaskInstructions(instructions="Test task")
        request = CreateTaskRequest(
            agent_id=123,
            name="Integration Test Task",
            instructions=instructions,
            created_by="user_123"
        )
        
        # Execute complete flow
        result = await service.create_and_execute_task(request)
        
        # Verify
        assert result.task.is_successful
        assert result.execution_result["success"] is True
        
        # Verify agent was validated
        mock_agent_repository.find_by_id.assert_called()
        # Verify task was saved multiple times (create, start, complete)
        assert mock_task_repository.save.call_count >= 3