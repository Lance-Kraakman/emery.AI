"""
Dependency Injection Container

AIDEV-NOTE: Simple DI container following YAGNI principles.
Wires up domain interfaces with infrastructure implementations.
"""

from typing import Dict, Any, Type
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.repositories.task_repository import ITaskRepository
from ...domain.execution.repositories.execution_repository import IExecutionRepository
from ...domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
from ...application.services.agent_task_service import AgentTaskApplicationService


class Container:
    """Simple dependency injection container."""
    
    def __init__(self):
        self._repositories: Dict[Type, Any] = {}
        self._services: Dict[Type, Any] = {}
        self._initialized = False
    
    def register_repository(self, interface: Type, implementation: Any):
        """Register a repository implementation."""
        self._repositories[interface] = implementation
    
    def get_repository(self, interface: Type) -> Any:
        """Get repository implementation by interface."""
        if interface not in self._repositories:
            raise ValueError(f"Repository {interface.__name__} not registered")
        return self._repositories[interface]
    
    def get_agent_task_service(self) -> AgentTaskApplicationService:
        """Get configured agent task service."""
        if AgentTaskApplicationService not in self._services:
            self._services[AgentTaskApplicationService] = AgentTaskApplicationService(
                agent_repository=self.get_repository(IAgentRepository),
                task_repository=self.get_repository(ITaskRepository),
                execution_repository=self.get_repository(IExecutionRepository),
                tool_registry_repository=self.get_repository(IToolRegistryRepository)
            )
        
        return self._services[AgentTaskApplicationService]
    
    def initialize_defaults(self):
        """Initialize with default infrastructure implementations."""
        if self._initialized:
            return
        
        # Import infrastructure implementations
        from ...infrastructure.repositories.smolagents_execution_repository import SmolAgentsExecutionRepository
        from ...infrastructure.repositories.tool_registry_repository_impl import ToolRegistryRepositoryImpl
        
        # Register implementations
        self.register_repository(IExecutionRepository, SmolAgentsExecutionRepository())
        self.register_repository(IToolRegistryRepository, ToolRegistryRepositoryImpl())
        
        # TODO: Add agent and task repository implementations
        # For now, create mock implementations for testing
        from ...infrastructure.repositories.mock_agent_repository import MockAgentRepository
        from ...infrastructure.repositories.mock_task_repository import MockTaskRepository
        
        self.register_repository(IAgentRepository, MockAgentRepository())
        self.register_repository(ITaskRepository, MockTaskRepository())
        
        self._initialized = True


# Global container instance
container = Container()