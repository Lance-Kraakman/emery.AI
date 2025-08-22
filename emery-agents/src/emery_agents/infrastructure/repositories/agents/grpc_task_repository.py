"""
gRPC Task Repository Implementation

AIDEV-NOTE: Implementation of task repository using gRPC calls to parent Emery system.
Tasks are stored in the parent system's database for persistence and monitoring.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Optional

from ....domain.agents.entities.task import Task, TaskStatus
from ....domain.agents.repositories.task_repository import ITaskRepository
from ....domain.agents.value_objects.agent_id import AgentId
from ....domain.agents.value_objects.task_id import TaskId
from ....domain.shared.value_objects.organization_id import OrganizationId

logger = logging.getLogger(__name__)


class GrpcTaskRepository(ITaskRepository):
    """
    gRPC-based implementation of task repository.
    
    AIDEV-NOTE: Communicates with parent Emery system for task persistence.
    Tasks are managed in the parent system for monitoring and history.
    """
    
    def __init__(self, grpc_client):
        self._grpc_client = grpc_client
    
    async def find_by_id(self, task_id: TaskId) -> Optional[Task]:
        """Find task by ID via gRPC."""
        logger.debug(f"Finding task {task_id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_task_by_id(task_id.value)
            if grpc_response:
                return self._from_grpc_data(grpc_response)
            return None
        except Exception as error:
            logger.exception(f"Failed to find task {task_id.value}: {error}")
            return None
    
    async def find_by_agent_id(self, agent_id: AgentId) -> List[Task]:
        """Find all tasks for an agent via gRPC."""
        logger.debug(f"Finding tasks for agent {agent_id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_tasks_by_agent(agent_id.value)
            return [self._from_grpc_data(task_data) for task_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find tasks for agent {agent_id.value}: {error}")
            return []
    
    async def find_by_organization_id(self, organization_id: OrganizationId) -> List[Task]:
        """Find all tasks for an organization via gRPC."""
        logger.debug(f"Finding tasks for organization {organization_id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_tasks_by_organization(organization_id.value)
            return [self._from_grpc_data(task_data) for task_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find tasks for organization {organization_id.value}: {error}")
            return []
    
    async def find_pending_tasks(self, limit: Optional[int] = None) -> List[Task]:
        """Find pending tasks via gRPC."""
        logger.debug(f"Finding pending tasks (limit: {limit})")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_pending_tasks(limit)
            return [self._from_grpc_data(task_data) for task_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find pending tasks: {error}")
            return []
    
    async def find_running_tasks(self) -> List[Task]:
        """Find all running tasks via gRPC."""
        logger.debug("Finding running tasks")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_running_tasks()
            return [self._from_grpc_data(task_data) for task_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find running tasks: {error}")
            return []
    
    async def find_recent_by_organization(
        self, 
        organization_id: OrganizationId, 
        limit: Optional[int] = None
    ) -> List[Task]:
        """Find recent tasks for organization via gRPC."""
        logger.debug(f"Finding recent tasks for organization {organization_id.value} (limit: {limit})")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_recent_tasks_by_organization(
                organization_id.value, limit
            )
            return [self._from_grpc_data(task_data) for task_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find recent tasks for organization {organization_id.value}: {error}")
            return []
    
    async def find_by_status(self, status: TaskStatus, limit: Optional[int] = None) -> List[Task]:
        """Find tasks by status via gRPC."""
        logger.debug(f"Finding tasks with status {status.value} (limit: {limit})")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_tasks_by_status(status.value, limit)
            return [self._from_grpc_data(task_data) for task_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find tasks with status {status.value}: {error}")
            return []
    
    async def save(self, task: Task) -> Task:
        """Save task via gRPC."""
        logger.debug(f"Saving task {task.id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.save_task(self._to_grpc_data(task))
            return self._from_grpc_data(grpc_response)
        except Exception as error:
            logger.exception(f"Failed to save task {task.id.value}: {error}")
            raise
    
    async def delete(self, task_id: TaskId) -> None:
        """Delete task via gRPC."""
        logger.debug(f"Deleting task {task_id.value}")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            await self._grpc_client.delete_task(task_id.value)
        except Exception as error:
            logger.exception(f"Failed to delete task {task_id.value}: {error}")
            raise
    
    async def exists(self, task_id: TaskId) -> bool:
        """Check if task exists via gRPC."""
        task = await self.find_by_id(task_id)
        return task is not None
    
    async def count_by_organization(self, organization_id: OrganizationId) -> int:
        """Count tasks in an organization via gRPC."""
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            return await self._grpc_client.count_tasks_by_organization(organization_id.value)
        except Exception as error:
            logger.exception(f"Failed to count tasks for organization {organization_id.value}: {error}")
            return 0
    
    async def count_by_status(self, status: TaskStatus) -> int:
        """Count tasks by status via gRPC."""
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            return await self._grpc_client.count_tasks_by_status(status.value)
        except Exception as error:
            logger.exception(f"Failed to count tasks with status {status.value}: {error}")
            return 0
    
    async def count_by_agent(self, agent_id: AgentId) -> int:
        """Count tasks for an agent via gRPC."""
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            return await self._grpc_client.count_tasks_by_agent(agent_id.value)
        except Exception as error:
            logger.exception(f"Failed to count tasks for agent {agent_id.value}: {error}")
            return 0
    
    async def find_tasks_created_by(self, created_by: str) -> List[Task]:
        """Find tasks created by a specific user via gRPC."""
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            grpc_response = await self._grpc_client.get_tasks_by_creator(created_by)
            return [self._from_grpc_data(task_data) for task_data in grpc_response]
        except Exception as error:
            logger.exception(f"Failed to find tasks created by {created_by}: {error}")
            return []
    
    async def cleanup_old_tasks(self, days_old: int) -> int:
        """Clean up old completed/failed tasks via gRPC."""
        logger.info(f"Cleaning up tasks older than {days_old} days")
        
        try:
            # AIDEV-TODO: Implement gRPC call to parent Emery system
            return await self._grpc_client.cleanup_old_tasks(days_old)
        except Exception as error:
            logger.exception(f"Failed to cleanup old tasks: {error}")
            return 0
    
    def _from_grpc_data(self, grpc_data: dict) -> Task:
        """Convert gRPC response data to Task domain entity."""
        # AIDEV-TODO: Implement proper proto mapping
        return Task.from_persistence(grpc_data)
    
    def _to_grpc_data(self, task: Task) -> dict:
        """Convert Task domain entity to gRPC request data."""
        # AIDEV-TODO: Implement proper proto mapping
        return {
            "id": task.id.value,
            "agent_id": task.agent_id.value,
            "organization_id": task.organization_id.value,
            "name": task.name,
            "capability_name": task.capability_name,
            "instructions": task.instructions.to_dict() if hasattr(task.instructions, 'to_dict') else {
                "instructions": task.instructions.instructions,
                "tools": task.instructions.tools,
                "servers": task.instructions.servers,
                "metadata": task.instructions.metadata
            },
            "status": task.status.value,
            "result": task.result,
            "error": task.error,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "created_by": task.created_by,
            "created_at": task.created_at.isoformat()
        }