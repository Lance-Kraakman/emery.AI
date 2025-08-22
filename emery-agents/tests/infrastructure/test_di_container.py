"""
Tests for Dependency Injection Container

AIDEV-NOTE: Tests DI container configuration and dependency resolution.
Infrastructure tests focus on wiring and composition root functionality.
"""

import pytest
from unittest.mock import Mock, patch

from src.emery_agents.application.di.container import DIContainer
from src.emery_agents.application.di.agent_container import AgentContainer, create_agent_container
from src.emery_agents.application.use_cases.agents.agent_task_application_service import AgentTaskApplicationService
from src.emery_agents.application.use_cases.agents.execute_agent_task_use_case import ExecuteAgentTaskUseCase
from src.emery_agents.domain.agents.repositories.agent_repository import IAgentRepository
from src.emery_agents.domain.agents.repositories.task_repository import ITaskRepository
from src.emery_agents.domain.agents.repositories.agent_execution_repository import IAgentExecutionRepository


class TestDIContainer:
    """Test dependency injection container functionality."""
    
    def test_container_creates_singleton_instances(self):
        """Test container creates singleton instances by default."""
        container = DIContainer()
        
        # Same instance should be returned for multiple calls
        repo1 = container.get_agent_repository()
        repo2 = container.get_agent_repository()
        
        assert repo1 is repo2
    
    def test_container_creates_different_services(self):
        """Test container creates different service types."""
        container = DIContainer()
        
        agent_repo = container.get_agent_repository()
        task_repo = container.get_task_repository()
        execution_repo = container.get_agent_execution_repository()
        
        # Should be different types
        assert type(agent_repo) != type(task_repo)
        assert type(task_repo) != type(execution_repo)
        assert type(agent_repo) != type(execution_repo)
    
    def test_container_injects_dependencies_into_services(self):
        """Test container properly injects dependencies into application services."""
        container = DIContainer()
        
        # Get application service
        service = container.get_agent_task_application_service()
        
        assert isinstance(service, AgentTaskApplicationService)
        # Service should have been created with repository dependencies
        assert service is not None
    
    def test_container_creates_use_cases(self):
        """Test container creates use case instances."""
        container = DIContainer()
        
        use_case = container.get_execute_agent_task_use_case()
        
        assert isinstance(use_case, ExecuteAgentTaskUseCase)
    
    def test_container_clear_cache_resets_instances(self):
        """Test clearing cache creates new instances."""
        container = DIContainer()
        
        # Get initial instances
        repo1 = container.get_agent_repository()
        service1 = container.get_agent_task_application_service()
        
        # Clear cache
        container.clear_cache()
        
        # Get new instances
        repo2 = container.get_agent_repository()
        service2 = container.get_agent_task_application_service()
        
        # Should be different instances
        assert repo1 is not repo2
        assert service1 is not service2
    
    def test_container_with_config(self):
        """Test container accepts configuration."""
        config = {
            "grpc_endpoint": "localhost:50051",
            "timeout_seconds": 60
        }
        
        container = DIContainer(config)
        
        # Should still create services with config
        service = container.get_agent_task_application_service()
        assert service is not None


class TestAgentContainer:
    """Test agent-specific dependency injection container."""
    
    def test_agent_container_wraps_base_container(self):
        """Test AgentContainer wraps DIContainer."""
        base_container = DIContainer()
        agent_container = AgentContainer(base_container)
        
        assert agent_container.base_container is base_container
    
    def test_agent_container_creates_default_base_container(self):
        """Test AgentContainer creates default base container if none provided."""
        agent_container = AgentContainer()
        
        assert agent_container.base_container is not None
        assert isinstance(agent_container.base_container, DIContainer)
    
    def test_agent_container_provides_repositories(self):
        """Test AgentContainer provides repository access."""
        container = AgentContainer()
        
        agent_repo = container.agent_repository()
        task_repo = container.task_repository()
        execution_repo = container.execution_repository()
        tool_repo = container.tool_repository()
        
        assert isinstance(agent_repo, IAgentRepository)
        assert isinstance(task_repo, ITaskRepository)
        assert isinstance(execution_repo, IAgentExecutionRepository)
        # tool_repo interface check would be similar
    
    def test_agent_container_provides_services(self):
        """Test AgentContainer provides application services."""
        container = AgentContainer()
        
        task_service = container.agent_task_service()
        execute_use_case = container.execute_task_use_case()
        load_tools_use_case = container.load_tools_use_case()
        
        assert isinstance(task_service, AgentTaskApplicationService)
        assert isinstance(execute_use_case, ExecuteAgentTaskUseCase)
        # Additional service type checks
    
    @pytest.mark.asyncio
    async def test_create_task_and_execute_convenience_method(self):
        """Test convenience method for creating and executing tasks."""
        container = AgentContainer()
        
        # Mock the application service
        with patch.object(container, 'agent_task_service') as mock_service_getter:
            mock_service = Mock()
            mock_service.create_and_execute_task.return_value = Mock()
            mock_service_getter.return_value = mock_service
            
            # Call convenience method
            result = await container.create_task_and_execute(
                agent_id=123,
                task_name="Test Task",
                instructions="Do something",
                tools=[{"name": "gmail"}],
                created_by="user_123"
            )
            
            # Verify service was called
            mock_service.create_and_execute_task.assert_called_once()
            assert result is not None
    
    @pytest.mark.asyncio
    async def test_get_agent_with_validation_convenience_method(self):
        """Test convenience method for getting and validating agents."""
        container = AgentContainer()
        
        # Mock the repository and agent
        with patch.object(container, 'agent_repository') as mock_repo_getter:
            mock_repo = Mock()
            mock_agent = Mock()
            mock_agent.validate_for_execution.return_value = None
            mock_repo.find_by_id.return_value = mock_agent
            mock_repo_getter.return_value = mock_repo
            
            # Call convenience method
            agent = await container.get_agent_with_validation(123)
            
            # Verify validation was called
            mock_agent.validate_for_execution.assert_called_once()
            assert agent is mock_agent
    
    @pytest.mark.asyncio
    async def test_get_agent_with_validation_raises_for_missing_agent(self):
        """Test validation convenience method raises for missing agent."""
        container = AgentContainer()
        
        # Mock the repository to return None
        with patch.object(container, 'agent_repository') as mock_repo_getter:
            mock_repo = Mock()
            mock_repo.find_by_id.return_value = None
            mock_repo_getter.return_value = mock_repo
            
            # Should raise ValueError
            with pytest.raises(ValueError, match="Agent 123 not found"):
                await container.get_agent_with_validation(123)
    
    def test_create_agent_container_factory(self):
        """Test factory function for creating agent containers."""
        # Without config
        container1 = create_agent_container()
        assert isinstance(container1, AgentContainer)
        assert isinstance(container1.base_container, DIContainer)
        
        # With config
        config = {"test": "value"}
        container2 = create_agent_container(config)
        assert isinstance(container2, AgentContainer)
        assert isinstance(container2.base_container, DIContainer)
    
    def test_agent_container_clear_cache(self):
        """Test AgentContainer delegates cache clearing to base container."""
        base_container = Mock()
        agent_container = AgentContainer(base_container)
        
        agent_container.clear_cache()
        
        base_container.clear_cache.assert_called_once()