"""
Mock Task Repository Implementation

AIDEV-NOTE: Temporary mock implementation for testing.
Replace with real database implementation when needed.
"""

from typing import Optional, List, Dict
from ...domain.agents.repositories.task_repository import ITaskRepository
from ...domain.agents.entities.task import Task
from ...domain.shared.value_objects.ids import AgentId, TaskId


class MockTaskRepository(ITaskRepository):
    """Mock implementation for testing purposes."""
    
    def __init__(self):
        self._tasks: Dict[TaskId, Task] = {}
    
    async def find_by_id(self, task_id: TaskId) -> Optional[Task]:
        """Find task by ID."""
        return self._tasks.get(task_id)
    
    async def find_by_agent(self, agent_id: AgentId) -> List[Task]:
        """Find all tasks for an agent."""
        return [task for task in self._tasks.values() 
                if task.agent_id == agent_id]
    
    async def find_pending_tasks(self) -> List[Task]:
        """Find all pending tasks."""
        return [task for task in self._tasks.values() 
                if task.status == "pending"]
    
    async def save(self, task: Task) -> None:
        """Save or update a task."""
        self._tasks[task.id] = task
    
    async def update_status(self, task_id: TaskId, status: str) -> bool:
        """Update task status."""
        if task_id in self._tasks:
            self._tasks[task_id].status = status
            return True
        return False
    
    async def delete(self, task_id: TaskId) -> bool:
        """Delete a task."""
        if task_id in self._tasks:
            del self._tasks[task_id]
            return True
        return False