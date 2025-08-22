"""
Agent Execution Repository Interface

AIDEV-NOTE: Repository interface for agent execution operations.
Abstracts the actual execution mechanism (gRPC, local, etc.) behind repository pattern.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ...shared.value_objects.organization_id import OrganizationId
from ...shared.value_objects.user_id import UserId
from ..value_objects.agent_id import AgentId
from ..value_objects.execution_context import ExecutionContext
from ..value_objects.server_config import ServerConfig
from ...tools.value_objects.tool_config import ToolConfig


@dataclass(frozen=True)
class AgentExecutionRequest:
    """Request for agent execution."""
    agent_id: AgentId
    instructions: str
    tools: Optional[List[ToolConfig]] = None
    servers: Optional[List[ServerConfig]] = None
    execution_id: str = ""
    organization_id: Optional[OrganizationId] = None
    owner_id: Optional[UserId] = None
    timeout_seconds: Optional[int] = None
    context: Optional[ExecutionContext] = None


@dataclass(frozen=True)
class AgentExecutionResult:
    """Result of agent execution."""
    success: bool
    execution_id: str
    status: str
    output_data: Optional[Any] = None
    error: Optional[str] = None
    context: Optional[ExecutionContext] = None
    duration_ms: Optional[int] = None


class IAgentExecutionRepository(ABC):
    """
    Repository interface for agent execution operations.
    
    AIDEV-NOTE: Treats execution as a repository operation.
    Implementations can be gRPC-based, local, or other execution mechanisms.
    """
    
    @abstractmethod
    async def execute_agent(self, request: AgentExecutionRequest) -> AgentExecutionResult:
        """Execute an agent with given instructions and context."""
        pass
    
    @abstractmethod
    async def cancel_execution(self, execution_id: str, reason: Optional[str] = None) -> None:
        """Cancel a running execution."""
        pass
    
    @abstractmethod
    async def get_execution_status(self, execution_id: str) -> Optional[str]:
        """Get current status of an execution."""
        pass
    
    @abstractmethod
    async def is_execution_available(self, organization_id: str) -> bool:
        """Check if execution service is available for organization."""
        pass
    
    @abstractmethod
    async def get_worker_health(self, organization_id: str) -> Dict[str, Any]:
        """Get health status of execution workers."""
        pass
    
    @abstractmethod
    async def list_active_executions(self, organization_id: OrganizationId) -> List[str]:
        """List active execution IDs for an organization."""
        pass
    
    @abstractmethod
    async def get_execution_logs(self, execution_id: str) -> List[str]:
        """Get execution logs for debugging."""
        pass