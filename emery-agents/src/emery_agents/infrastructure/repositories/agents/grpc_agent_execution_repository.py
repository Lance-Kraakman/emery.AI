"""
gRPC Agent Execution Repository Implementation

AIDEV-NOTE: Concrete implementation of agent execution using gRPC.
Implements the domain repository interface with gRPC communication.
"""

import logging
from typing import Any, Dict, List, Optional

from ....domain.agents.repositories.agent_execution_repository import (
    AgentExecutionRequest,
    AgentExecutionResult,
    IAgentExecutionRepository,
)
from ....domain.shared.value_objects.organization_id import OrganizationId
from ...grpc.server import AgentExecutionService  # Will need to create this

logger = logging.getLogger(__name__)


class GrpcAgentExecutionRepository(IAgentExecutionRepository):
    """
    gRPC-based implementation of agent execution repository.
    
    AIDEV-NOTE: Infrastructure implementation using gRPC for distributed execution.
    """
    
    def __init__(self, grpc_service: AgentExecutionService):
        self._grpc_service = grpc_service
    
    async def execute_agent(self, request: AgentExecutionRequest) -> AgentExecutionResult:
        """Execute agent via gRPC service."""
        logger.info(f"Executing agent {request.agent_id.value} via gRPC")
        
        try:
            # Convert domain request to gRPC request
            grpc_request = self._to_grpc_request(request)
            
            # Execute via gRPC
            grpc_result = await self._grpc_service.execute_agent(grpc_request)
            
            # Convert gRPC result to domain result
            return self._to_domain_result(grpc_result)
            
        except Exception as error:
            logger.exception(f"gRPC execution failed for agent {request.agent_id.value}: {error}")
            
            # Return failed execution result
            return AgentExecutionResult(
                success=False,
                execution_id=request.execution_id,
                status="failed",
                error=str(error)
            )
    
    async def cancel_execution(self, execution_id: str, reason: Optional[str] = None) -> None:
        """Cancel execution via gRPC."""
        logger.info(f"Cancelling execution {execution_id} via gRPC")
        
        try:
            await self._grpc_service.cancel_execution(execution_id, reason)
        except Exception as error:
            logger.exception(f"Failed to cancel execution {execution_id}: {error}")
            raise
    
    async def get_execution_status(self, execution_id: str) -> Optional[str]:
        """Get execution status via gRPC."""
        try:
            return await self._grpc_service.get_execution_status(execution_id)
        except Exception as error:
            logger.exception(f"Failed to get status for execution {execution_id}: {error}")
            return None
    
    async def is_execution_available(self, organization_id: str) -> bool:
        """Check if execution service is available."""
        try:
            return await self._grpc_service.is_available(organization_id)
        except Exception as error:
            logger.exception(f"Failed to check execution availability for org {organization_id}: {error}")
            return False
    
    async def get_worker_health(self, organization_id: str) -> Dict[str, Any]:
        """Get worker health via gRPC."""
        try:
            return await self._grpc_service.get_worker_health(organization_id)
        except Exception as error:
            logger.exception(f"Failed to get worker health for org {organization_id}: {error}")
            return {"status": "unhealthy", "error": str(error)}
    
    async def list_active_executions(self, organization_id: OrganizationId) -> List[str]:
        """List active executions via gRPC."""
        try:
            return await self._grpc_service.list_active_executions(str(organization_id.value))
        except Exception as error:
            logger.exception(f"Failed to list active executions for org {organization_id.value}: {error}")
            return []
    
    async def get_execution_logs(self, execution_id: str) -> List[str]:
        """Get execution logs via gRPC."""
        try:
            return await self._grpc_service.get_execution_logs(execution_id)
        except Exception as error:
            logger.exception(f"Failed to get logs for execution {execution_id}: {error}")
            return []
    
    def _to_grpc_request(self, request: AgentExecutionRequest) -> Dict[str, Any]:
        """Convert domain request to gRPC request format."""
        # AIDEV-TODO: Implement proper proto mapping
        return {
            "agent_id": request.agent_id.value,
            "instructions": request.instructions,
            "tools": [tool.to_dict() for tool in (request.tools or [])],
            "servers": [server.to_dict() for server in (request.servers or [])],
            "execution_id": request.execution_id,
            "organization_id": request.organization_id.value if request.organization_id else None,
            "owner_id": request.owner_id.value if request.owner_id else None,
            "timeout_seconds": request.timeout_seconds,
            "context": request.context.to_dict() if request.context else None
        }
    
    def _to_domain_result(self, grpc_result: Dict[str, Any]) -> AgentExecutionResult:
        """Convert gRPC result to domain result."""
        # AIDEV-TODO: Implement proper proto mapping
        return AgentExecutionResult(
            success=grpc_result.get("success", False),
            execution_id=grpc_result.get("execution_id", ""),
            status=grpc_result.get("status", "unknown"),
            output_data=grpc_result.get("output_data"),
            error=grpc_result.get("error"),
            duration_ms=grpc_result.get("duration_ms")
        )