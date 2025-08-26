"""
SmolAgents Execution Repository Implementation

AIDEV-NOTE: Infrastructure implementation using existing SmolAgentsExecutionService.
Bridges domain interface with smolagents execution infrastructure.
"""

from typing import Dict, Any, AsyncIterator, List
from ...domain.execution.repositories.execution_repository import IExecutionRepository
from ...domain.execution.entities.execution_context import ExecutionContext, ExecutionMode
from ...infrastructure.execution.smolagents_execution_service import SmolAgentsExecutionService
from ...core.entities import TaskRequest, InstructionConfig, ToolConfig
from ...core.types import TaskStatus


class SmolAgentsExecutionRepository(IExecutionRepository):
    """Implementation using existing smolagents execution service."""
    
    def __init__(self):
        self.execution_service = SmolAgentsExecutionService()
    
    async def execute_task(self, context: ExecutionContext) -> AsyncIterator[Dict[str, Any]]:
        """Execute a task with given context."""
        # Convert execution context to TaskRequest for existing infrastructure
        task_request = self._convert_context_to_request(context)
        
        # Execute using existing service
        async for progress in self.execution_service.execute_task(task_request):
            yield progress
    
    async def validate_execution_context(self, context: ExecutionContext) -> bool:
        """Validate that execution context is valid."""
        try:
            # Basic validation
            if not context.instructions:
                return False
            
            if context.max_steps and context.max_steps <= 0:
                return False
            
            if context.timeout_seconds and context.timeout_seconds <= 0:
                return False
            
            return True
        except Exception:
            return False
    
    async def get_available_tools(self) -> List[str]:
        """Get list of available tool names."""
        # Use existing tool registry through execution service
        return self.execution_service.tool_registry.list_available_tools()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of execution system."""
        try:
            available_tools = await self.get_available_tools()
            return {
                "status": "healthy",
                "available_tools_count": len(available_tools),
                "service": "smolagents",
                "initialized": True
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "service": "smolagents",
                "initialized": False
            }
    
    def _convert_context_to_request(self, context: ExecutionContext) -> TaskRequest:
        """Convert execution context back to TaskRequest for existing infrastructure."""
        # Create tool configs from tool names
        tool_configs = []
        for tool_name in context.available_tools:
            tool_configs.append(ToolConfig(
                name=tool_name,
                version="1.0",
                config={}
            ))
        
        # Create instruction config for all modes (simplified approach)
        instruction_config = InstructionConfig(
            instructions=context.instructions,
            tools=tool_configs,
            servers=[]  # TODO: Add server support if needed
        )
        
        # Create minimal TaskRequest
        # AIDEV-NOTE: This is a bridge pattern - ideally we'd refactor the existing service
        # to work directly with ExecutionContext, but this maintains compatibility
        return TaskRequest(
            task_id=f"ctx_{hash(context.instructions) % 10000}",
            organization_id=context.organization_id or 1,
            agent_config=None,  # Will be handled by capability routing
            capability_name=context.capability_name if context.is_capability_mode else None,
            instruction_config=instruction_config if context.is_instruction_mode else None,
            trigger_data={
                "execution_mode": context.mode.value,
                "max_steps": context.max_steps,
                "timeout_seconds": context.timeout_seconds
            }
        )