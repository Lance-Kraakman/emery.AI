"""
Agent-Specific Dependency Injection Container

AIDEV-NOTE: Specialized DI container for agent-related operations.
Follows the same pattern as TypeScript version with agent-specific configuration.
"""

from typing import Optional

from ...domain.agents.repositories.agent_execution_repository import IAgentExecutionRepository
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.repositories.task_repository import ITaskRepository
from ...domain.tools.repositories.tool_repository import IToolRepository
from ..use_cases.agents.agent_task_application_service import AgentTaskApplicationService
from ..use_cases.agents.execute_agent_task_use_case import ExecuteAgentTaskUseCase
from ..use_cases.tools.load_tools_use_case import LoadToolsUseCase
from .container import DIContainer


class AgentContainer:
    """
    Agent-specific dependency injection container.
    
    AIDEV-NOTE: Provides agent-focused services with specialized configuration.
    Wraps the main container with agent-specific convenience methods.
    """
    
    def __init__(self, base_container: Optional[DIContainer] = None):
        self._container = base_container or DIContainer()
    
    # Repository interfaces
    def agent_repository(self) -> IAgentRepository:
        """Get agent repository."""
        return self._container.get_agent_repository()
    
    def task_repository(self) -> ITaskRepository:
        """Get task repository."""
        return self._container.get_task_repository()
    
    def execution_repository(self) -> IAgentExecutionRepository:
        """Get agent execution repository."""
        return self._container.get_agent_execution_repository()
    
    def tool_repository(self) -> IToolRepository:
        """Get tool repository."""
        return self._container.get_tool_repository()
    
    # Application services
    def agent_task_service(self) -> AgentTaskApplicationService:
        """Get agent task application service."""
        return self._container.get_agent_task_application_service()
    
    # Use cases
    def execute_task_use_case(self) -> ExecuteAgentTaskUseCase:
        """Get execute agent task use case."""
        return self._container.get_execute_agent_task_use_case()
    
    def load_tools_use_case(self) -> LoadToolsUseCase:
        """Get load tools use case."""
        return self._container.get_load_tools_use_case()
    
    # Convenience methods for common operations
    async def create_task_and_execute(
        self, 
        agent_id: int, 
        task_name: str, 
        instructions: str, 
        **kwargs
    ):
        """
        Convenience method for creating and executing a task.
        
        AIDEV-NOTE: High-level operation combining creation and execution.
        """
        from ...domain.agents.entities.task import TaskInstructions
        from ..commands.create_task_command import CreateTaskCommand
        
        # Create task instructions
        task_instructions = TaskInstructions(
            instructions=instructions,
            tools=kwargs.get("tools"),
            servers=kwargs.get("servers"),
            metadata=kwargs.get("metadata")
        )
        
        # Create command
        create_command = CreateTaskCommand(
            agent_id=agent_id,
            name=task_name,
            instructions=task_instructions,
            capability_name=kwargs.get("capability_name"),
            created_by=kwargs.get("created_by"),
            organization_id=kwargs.get("organization_id")
        )
        
        # Execute via application service
        service = self.agent_task_service()
        return await service.create_and_execute_task(
            create_command, 
            timeout_seconds=kwargs.get("timeout_seconds")
        )
    
    async def get_agent_with_validation(self, agent_id: int):
        """
        Get agent and validate it can execute tasks.
        
        AIDEV-NOTE: Business rule validation wrapper.
        """
        from ...domain.agents.value_objects.agent_id import AgentId
        
        agent = await self.agent_repository().find_by_id(AgentId(agent_id))
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")
        
        # Apply business rule validation
        agent.validate_for_execution()
        
        return agent
    
    async def load_compatible_tools(self, agent_type: str = "default"):
        """
        Load all tools compatible with an agent type.
        
        AIDEV-NOTE: Convenience method for tool loading.
        """
        tools_use_case = self.load_tools_use_case()
        return await tools_use_case.get_available_tools(agent_type)
    
    def clear_cache(self) -> None:
        """Clear cached instances."""
        self._container.clear_cache()
    
    @property
    def base_container(self) -> DIContainer:
        """Get access to the base container for advanced operations."""
        return self._container


# Factory function for creating agent containers
def create_agent_container(config: Optional[dict] = None) -> AgentContainer:
    """
    Create a new agent container with optional configuration.
    
    Args:
        config: Optional configuration dictionary
        
    Returns:
        Configured AgentContainer instance
    """
    base_container = DIContainer(config) if config else None
    return AgentContainer(base_container)