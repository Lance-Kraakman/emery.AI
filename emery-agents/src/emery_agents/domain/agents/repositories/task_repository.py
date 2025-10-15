"""
Task Repository Interface

AIDEV-NOTE: Domain layer repository interface for tasks.
Handles task persistence and querying.
"""

from abc import ABC, abstractmethod
from typing import Optional, List
from ..entities.task import Task
from ...shared.value_objects.ids import AgentId, TaskId


class ITaskRepository(ABC):
    """Repository interface for task persistence operations."""
    
    @abstractmethod
    async def find_by_id(self, task_id: TaskId) -> Optional[Task]:
        """Find task by ID."""
        pass
    
    @abstractmethod
    async def find_by_agent(self, agent_id: AgentId) -> List[Task]:
        """Find all tasks for an agent."""
        pass
    
    @abstractmethod
    async def find_pending_tasks(self) -> List[Task]:
        """Find all pending tasks."""
        pass
    
    @abstractmethod
    async def save(self, task: Task) -> None:
        """Save or update a task."""
        pass
    
    @abstractmethod
    async def update_status(self, task_id: TaskId, status: str) -> bool:
        """Update task status. Returns True if updated."""
        pass
    
    @abstractmethod
    async def delete(self, task_id: TaskId) -> bool:
        """Delete a task. Returns True if deleted."""
        pass