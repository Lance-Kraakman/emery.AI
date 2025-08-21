from typing import Optional, Dict, List
import uuid
from ...domain.entities.models import Task, CreateTaskData, TaskStatus
from ...domain.repositories.task_repository import ITaskRepository

class InMemoryTaskRepository(ITaskRepository):
    """In-memory implementation of the task repository for testing and development."""

    def __init__(self):
        self._tasks: Dict[str, Task] = {}

    async def find_by_id(self, task_id: str) -> Optional[Task]:
        return self._tasks.get(task_id)

    async def create(self, task_data: CreateTaskData) -> Task:
        task_id = str(uuid.uuid4())
        task = Task(id=task_id, status=TaskStatus.PENDING, **task_data.__dict__)
        self._tasks[task_id] = task
        return task

    async def update_status(self, task_id: str, status: TaskStatus, result: Optional[dict] = None, error: Optional[str] = None) -> Optional[Task]:
        if task_id in self._tasks:
            task = self._tasks[task_id]
            task.status = status
            if result:
                task.result = result
            if error:
                task.error = error
            return task
        return None

    async def find_by_agent(self, agent_id: int) -> List[Task]:
        return [task for task in self._tasks.values() if task.agentId == agent_id]
