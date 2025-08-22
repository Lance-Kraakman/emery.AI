"""
Task Repository Interface

AIDEV-NOTE: Simple DDD repository interface following TypeScript patterns.
Defines data access operations for Task entities.
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from ..entities.task import Task


class ITaskRepository(ABC):
    """Task repository interface for data access operations."""
    
    @abstractmethod
    async def find_by_id(self, id: str) -> Optional[Task]:
        """Find task by ID."""
        pass
    
    @abstractmethod
    async def find_by_agent_id(self, agent_id: int) -> List[Task]:
        """Find tasks by agent ID."""
        pass
    
    @abstractmethod
    async def find_by_organization_id(self, organization_id: int) -> List[Task]:
        """Find tasks by organization ID."""
        pass
    
    @abstractmethod
    async def find_pending_tasks(self, limit: Optional[int] = None) -> List[Task]:
        """Find pending tasks (for scheduler processing)."""
        pass
    
    @abstractmethod
    async def find_running_tasks(self) -> List[Task]:
        """Find running tasks (for monitoring)."""
        pass
    
    @abstractmethod
    async def find_by_status(self, status: str, organization_id: Optional[int] = None) -> List[Task]:
        """Find tasks by status."""
        pass
    
    @abstractmethod
    async def save(self, task: Task) -> None:
        """Save task (create or update)."""
        pass
    
    @abstractmethod
    async def delete(self, id: str) -> None:
        """Delete task."""
        pass
    
    @abstractmethod
    async def count_by_status(self, status: str, organization_id: int) -> int:
        """Count tasks by status for organization."""
        pass
    
    @abstractmethod
    async def find_recent_by_organization(self, organization_id: int, limit: Optional[int] = None) -> List[Task]:
        """Find recent tasks for organization (for dashboard)."""
        pass