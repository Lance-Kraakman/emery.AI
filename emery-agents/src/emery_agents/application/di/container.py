"""
Main Dependency Injection Container

AIDEV-NOTE: Central DI container for configuring all dependencies.
Follows composition root pattern - all dependencies configured here.
"""

import os
from typing import Any, Dict, Optional

from ...domain.agents.repositories.agent_execution_repository import IAgentExecutionRepository
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.repositories.task_repository import ITaskRepository
from ...domain.tools.repositories.tool_repository import IToolRepository
from ...infrastructure.repositories.agents.grpc_agent_execution_repository import GrpcAgentExecutionRepository
from ...infrastructure.repositories.agents.grpc_agent_repository import GrpcAgentRepository
from ...infrastructure.repositories.agents.grpc_task_repository import GrpcTaskRepository
from ...infrastructure.repositories.tools.smolagents_tool_repository import SmolagentsToolRepository
from ..use_cases.agents.agent_task_application_service import AgentTaskApplicationService
from ..use_cases.agents.execute_agent_task_use_case import ExecuteAgentTaskUseCase
from ..use_cases.tools.load_tools_use_case import LoadToolsUseCase


class DIContainer:
    """
    Dependency injection container.
    
    AIDEV-NOTE: Composition root for all dependencies.
    Configure all implementations and wire dependencies here.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self._config = config or self._load_config_from_env()
        self._instances: Dict[str, Any] = {}
    
    def _load_config_from_env(self) -> Dict[str, Any]:
        """Load configuration from environment variables."""
        return {
            "emery_api_url": os.getenv("EMERY_API_URL", "http://localhost:3000"),
            "emery_agent_id": os.getenv("EMERY_AGENT_ID"),
            "emery_api_key": os.getenv("EMERY_API_KEY"),
            "hf_token": os.getenv("HF_TOKEN"),
            "log_level": os.getenv("EMERY_AGENTS_LOG_LEVEL", "INFO"),
            "smolagents_model": os.getenv("SMOLAGENTS_MODEL", "claude-3-sonnet-20240229")
        }
    
    def get_agent_repository(self) -> IAgentRepository:
        """Get configured agent repository."""
        if "agent_repository" not in self._instances:
            # AIDEV-TODO: Configure gRPC client properly
            grpc_client = self._get_grpc_client()
            self._instances["agent_repository"] = GrpcAgentRepository(grpc_client)
        
        return self._instances["agent_repository"]
    
    def get_task_repository(self) -> ITaskRepository:
        """Get configured task repository."""
        if "task_repository" not in self._instances:
            # AIDEV-TODO: Configure gRPC client properly
            grpc_client = self._get_grpc_client()
            self._instances["task_repository"] = GrpcTaskRepository(grpc_client)
        
        return self._instances["task_repository"]
    
    def get_agent_execution_repository(self) -> IAgentExecutionRepository:
        """Get configured agent execution repository."""
        if "agent_execution_repository" not in self._instances:
            # AIDEV-TODO: Configure gRPC execution service properly
            grpc_service = self._get_grpc_execution_service()
            self._instances["agent_execution_repository"] = GrpcAgentExecutionRepository(grpc_service)
        
        return self._instances["agent_execution_repository"]
    
    def get_tool_repository(self) -> IToolRepository:
        """Get configured tool repository."""
        if "tool_repository" not in self._instances:
            self._instances["tool_repository"] = SmolagentsToolRepository(
                hf_token=self._config.get("hf_token"),
                default_model=self._config.get("smolagents_model")
            )
        
        return self._instances["tool_repository"]
    
    def get_agent_task_application_service(self) -> AgentTaskApplicationService:
        """Get configured agent task application service."""
        if "agent_task_application_service" not in self._instances:
            self._instances["agent_task_application_service"] = AgentTaskApplicationService(
                agent_repository=self.get_agent_repository(),
                task_repository=self.get_task_repository(),
                execution_repository=self.get_agent_execution_repository()
            )
        
        return self._instances["agent_task_application_service"]
    
    def get_execute_agent_task_use_case(self) -> ExecuteAgentTaskUseCase:
        """Get configured execute agent task use case."""
        if "execute_agent_task_use_case" not in self._instances:
            self._instances["execute_agent_task_use_case"] = ExecuteAgentTaskUseCase(
                agent_repository=self.get_agent_repository(),
                task_repository=self.get_task_repository(),
                execution_repository=self.get_agent_execution_repository()
            )
        
        return self._instances["execute_agent_task_use_case"]
    
    def get_load_tools_use_case(self) -> LoadToolsUseCase:
        """Get configured load tools use case."""
        if "load_tools_use_case" not in self._instances:
            self._instances["load_tools_use_case"] = LoadToolsUseCase(
                tool_repository=self.get_tool_repository()
            )
        
        return self._instances["load_tools_use_case"]
    
    def _get_grpc_client(self):
        """Get configured gRPC client for repository operations."""
        if "grpc_client" not in self._instances:
            # AIDEV-TODO: Implement proper gRPC client configuration
            # This would connect to the parent Emery system's gRPC endpoints
            # for agent and task data access
            from ...infrastructure.grpc.client import EmeryGrpcClient
            
            self._instances["grpc_client"] = EmeryGrpcClient(
                server_url=self._config.get("emery_api_url"),
                api_key=self._config.get("emery_api_key")
            )
        
        return self._instances["grpc_client"]
    
    def _get_grpc_execution_service(self):
        """Get configured gRPC execution service."""
        if "grpc_execution_service" not in self._instances:
            # AIDEV-TODO: Implement proper gRPC execution service
            from ...infrastructure.grpc.server import AgentExecutionService
            
            self._instances["grpc_execution_service"] = AgentExecutionService(
                config=self._config
            )
        
        return self._instances["grpc_execution_service"]
    
    def clear_cache(self) -> None:
        """Clear cached instances (useful for testing)."""
        self._instances.clear()
    
    def override_instance(self, key: str, instance: Any) -> None:
        """Override a specific instance (useful for testing)."""
        self._instances[key] = instance


# Global container instance
_container: Optional[DIContainer] = None


def get_container() -> DIContainer:
    """Get the global container instance."""
    global _container
    if _container is None:
        _container = DIContainer()
    return _container


def set_container(container: DIContainer) -> None:
    """Set the global container instance (useful for testing)."""
    global _container
    _container = container