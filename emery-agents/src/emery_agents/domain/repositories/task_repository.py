from abc import ABC, abstractmethod
from typing import Optional, List
from ..entities.models import Task, CreateTaskData

class ITaskRepository(ABC):
    """Abstract interface for task data persistence."""

    @abstractmethod
    async def find_by_id(self, task_id: str) -> Optional[Task]:
        """Finds a task by its unique ID."""
        pass

    @abstractmethod
    async def create(self, task_data: CreateTaskData) -> Task:
        """Creates a new task."""
        pass

    @abstractmethod
    async def update_status(self, task_id: str, status: str, result: Optional[dict] = None, error: Optional[str] = None) -> Optional[Task]:
        """Updates the status of a task."""
        pass

    @abstractmethod
    async def find_by_agent(self, agent_id: int) -> List[Task]:
        """Finds all tasks associated with a specific agent."""
        pass
