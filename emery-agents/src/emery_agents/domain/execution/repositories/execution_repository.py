"""
Execution Repository Interface

AIDEV-NOTE: Domain interface for task execution operations.
Abstracts away infrastructure details like gRPC, smolagents, etc.
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, AsyncIterator, List
from ..entities.execution_context import ExecutionContext


class IExecutionRepository(ABC):
    """Repository interface for task execution operations."""
    
    @abstractmethod
    async def execute_task(self, context: ExecutionContext) -> AsyncIterator[Dict[str, Any]]:
        """
        Execute a task with given context.
        
        Args:
            context: Execution context with instructions, tools, etc.
            
        Returns:
            AsyncIterator of progress updates
        """
        pass
    
    @abstractmethod
    async def validate_execution_context(self, context: ExecutionContext) -> bool:
        """
        Validate that execution context is valid for execution.
        
        Args:
            context: Execution context to validate
            
        Returns:
            True if valid, False otherwise
        """
        pass
    
    @abstractmethod
    async def get_available_tools(self) -> List[str]:
        """Get list of available tool names."""
        pass
    
    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Check health of execution system."""
        pass