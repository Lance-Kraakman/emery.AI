"""
Dependency Injection Container

AIDEV-NOTE: Simple DI container following YAGNI principles.
Wires up domain interfaces with infrastructure implementations.
"""

from typing import Dict, Any, Type
from emery_agents.domain.agents.repositories.agent_repository import IAgentRepository
from emery_agents.domain.agents.repositories.task_repository import ITaskRepository
from emery_agents.domain.execution.repositories.execution_repository import IExecutionRepository
from emery_agents.domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
from emery_agents.application.services.agent_task_service import AgentTaskApplicationService

# Import infrastructure implementations at top level
from emery_agents.infrastructure.db.repositories.tools.tool_registry_repository import ToolRegistryRepository
from emery_agents.infrastructure.execution.smolagents_execution_repository import SmolAgentsExecutionRepository
from emery_agents.infrastructure.ai.smolagents_model_provider import SmolagentsModelProvider
from emery_agents.infrastructure.repositories.mock_agent_repository import MockAgentRepository
from emery_agents.infrastructure.repositories.mock_task_repository import MockTaskRepository


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
        """Initialize with default pure infrastructure implementations."""
        if self._initialized:
            return

        # Create dependencies first (imports are now at top level)
        tool_registry_repo = ToolRegistryRepository()
        model_provider = SmolagentsModelProvider()

        # Register pure implementations
        self.register_repository(IToolRegistryRepository, tool_registry_repo)
        self.register_repository(IExecutionRepository, SmolAgentsExecutionRepository(tool_registry_repo, model_provider))

        # Register mock implementations for testing
        self.register_repository(IAgentRepository, MockAgentRepository())
        self.register_repository(ITaskRepository, MockTaskRepository())

        self._initialized = True


# Global container instance
container = Container()