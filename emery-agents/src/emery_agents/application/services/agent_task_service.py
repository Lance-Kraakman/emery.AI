"""
Agent Task Application Service

AIDEV-NOTE: Main application service orchestrating agent task execution.
Coordinates between domain services and infrastructure repositories.
"""

from typing import AsyncIterator, Dict, Any
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.repositories.task_repository import ITaskRepository
from ...domain.execution.repositories.execution_repository import IExecutionRepository
from ...domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
from ...domain.execution.services.capability_routing_service import CapabilityRoutingService
from ...domain.execution.entities.execution_context import ExecutionContext
from ...core.entities import TaskRequest


class AgentTaskApplicationService:
    """
    Application service for coordinating agent task execution.
    
    This service orchestrates the complete workflow:
    1. Route execution mode (capability vs instruction)
    2. Validate agent and task
    3. Execute task with progress tracking
    4. Handle errors and state management
    """
    
    def __init__(
        self,
        agent_repository: IAgentRepository,
        task_repository: ITaskRepository,
        execution_repository: IExecutionRepository,
        tool_registry_repository: IToolRegistryRepository
    ):
        self.agent_repository = agent_repository
        self.task_repository = task_repository
        self.execution_repository = execution_repository
        self.tool_registry_repository = tool_registry_repository
        
        # Domain services
        self.capability_routing_service = CapabilityRoutingService()
    
    async def execute_task(self, request: TaskRequest) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute a task with full orchestration.
        
        Args:
            request: Task request with execution details
            
        Yields:
            Progress updates during execution
            
        Raises:
            ValueError: If request is invalid
            Exception: If execution fails
        """
        # Step 1: Validate agent exists and is active
        agent = await self._validate_agent(request)
        
        # Step 2: Determine execution context using domain service
        execution_context = self.capability_routing_service.determine_execution_context(request)
        
        # Step 3: Validate tools are available
        await self._validate_tools(execution_context)
        
        # Step 4: Execute task via infrastructure
        async for progress in self.execution_repository.execute_task(execution_context):
            yield progress
    
    async def _validate_agent(self, request: TaskRequest):
        """Validate that agent exists and is active for execution."""
        if not request.agent_config or not request.agent_config.id:
            raise ValueError("Agent configuration is required")
        
        agent = await self.agent_repository.find_by_id(request.agent_config.id)
        if not agent:
            raise ValueError(f"Agent {request.agent_config.id} not found")
        
        if not agent.is_active:
            raise ValueError(f"Agent {agent.name} is not active")
        
        return agent
    
    async def _validate_tools(self, context: ExecutionContext):
        """Validate that required tools are available."""
        if not context.available_tools:
            return  # No tools required
        
        available_tool_names = self.tool_registry_repository.list_available_tools()
        
        missing_tools = []
        for tool_name in context.available_tools:
            if not self.tool_registry_repository.is_tool_available(tool_name):
                missing_tools.append(tool_name)
        
        if missing_tools:
            raise ValueError(f"Required tools not available: {missing_tools}")
    
    async def get_execution_status(self) -> Dict[str, Any]:
        """Get current execution system status."""
        return await self.execution_repository.health_check()