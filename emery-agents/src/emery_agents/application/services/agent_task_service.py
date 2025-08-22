"""
Agent Task Application Service

AIDEV-NOTE: Simple DDD application service following TypeScript patterns.
Orchestrates agent task operations using domain repositories.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ...domain.agents.entities.agent import Agent
from ...domain.agents.entities.task import Task, TaskInstructions, TaskConfig
from ...domain.agents.repositories.agent_repository import IAgentRepository
from ...domain.agents.repositories.task_repository import ITaskRepository


@dataclass
class CreateTaskRequest:
    """Request to create a new task."""
    agent_id: int
    name: str
    instructions: TaskInstructions
    capability_name: Optional[str] = None
    created_by: Optional[str] = None
    organization_id: Optional[int] = None


@dataclass
class ExecuteTaskRequest:
    """Request to execute a task."""
    task_id: str
    timeout_seconds: Optional[int] = None


@dataclass
class TaskExecutionResult:
    """Result of task execution."""
    task: Task
    execution_result: Dict[str, Any]


class AgentTaskApplicationService:
    """Application service for agent task operations."""
    
    def __init__(
        self,
        agent_repository: IAgentRepository,
        task_repository: ITaskRepository
    ):
        self.agent_repository = agent_repository
        self.task_repository = task_repository
    
    async def create_task(self, request: CreateTaskRequest) -> Task:
        """Create a new task for an agent."""
        print(f"[AGENT-TASK-SERVICE] Creating task for agent {request.agent_id}: {request.name}")
        
        # 1. Validate agent exists and is active
        agent = await self.agent_repository.find_by_id(request.agent_id)
        if not agent:
            raise ValueError(f"Agent {request.agent_id} not found")
        
        if not agent.is_active:
            raise ValueError(f"Agent {request.agent_id} is not active (status: {agent.status})")
        
        # 2. Use agent's organization or override
        organization_id = request.organization_id or agent.organization_id
        
        # 3. Create task using domain entity
        task = Task.create(TaskConfig(
            agent_id=request.agent_id,
            organization_id=organization_id,
            name=request.name,
            instructions=request.instructions,
            capability_name=request.capability_name,
            created_by=request.created_by,
            status="pending"
        ))
        
        # 4. Save task
        await self.task_repository.save(task)
        
        print(f"[AGENT-TASK-SERVICE] Created task {task.short_id} for agent {agent.display_name}")
        return task
    
    async def execute_task(self, request: ExecuteTaskRequest) -> TaskExecutionResult:
        """Execute an existing pending task."""
        task_id = request.task_id
        
        print(f"[AGENT-TASK-SERVICE] Executing task {task_id[:8]}")
        
        # 1. Load and validate task
        task = await self.task_repository.find_by_id(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        
        if not task.is_pending:
            raise ValueError(f"Task {task_id} is not pending (status: {task.status})")
        
        # 2. Load and validate agent
        agent = await self.agent_repository.find_by_id(task.agent_id)
        if not agent:
            raise ValueError(f"Agent {task.agent_id} not found")
        
        if not agent.is_active:
            raise ValueError(f"Agent {task.agent_id} is not active")
        
        try:
            # 3. Start task execution (domain logic)
            task.start()
            await self.task_repository.save(task)
            
            # 4. Execute task (mock implementation for now)
            # TODO: Implement actual execution logic
            execution_result = {
                "success": True,
                "execution_id": task.id,
                "status": "completed",
                "output_data": {"result": "Mock execution successful"}
            }
            
            # 5. Update task based on execution result (domain logic)
            if execution_result["success"]:
                task.complete(execution_result["output_data"])
            else:
                task.fail(execution_result.get("error", "Execution failed"))
            
            # 6. Save final task state
            await self.task_repository.save(task)
            
            print(f"[AGENT-TASK-SERVICE] Completed task {task_id[:8]}: {'SUCCESS' if execution_result['success'] else 'FAILED'}")
            
            return TaskExecutionResult(
                task=task,
                execution_result=execution_result
            )
            
        except Exception as error:
            print(f"[AGENT-TASK-SERVICE] Error executing task {task_id[:8]}: {error}")
            
            # Mark task as failed (domain logic)
            task.fail(str(error))
            await self.task_repository.save(task)
            
            raise
    
    async def create_and_execute_task(
        self, 
        request: CreateTaskRequest, 
        timeout_seconds: Optional[int] = None
    ) -> TaskExecutionResult:
        """Create and execute a task in one operation (convenience method)."""
        # 1. Create task
        task = await self.create_task(request)
        
        # 2. Execute immediately
        return await self.execute_task(ExecuteTaskRequest(
            task_id=task.id,
            timeout_seconds=timeout_seconds
        ))
    
    async def cancel_task(self, task_id: str, reason: Optional[str] = None) -> None:
        """Cancel a running task."""
        print(f"[AGENT-TASK-SERVICE] Cancelling task {task_id[:8]}: {reason or 'No reason provided'}")
        
        # 1. Load task
        task = await self.task_repository.find_by_id(task_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        
        # 2. Update task status (domain logic)
        task.cancel(reason)
        await self.task_repository.save(task)
        
        print(f"[AGENT-TASK-SERVICE] Cancelled task {task_id[:8]}")
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID."""
        return await self.task_repository.find_by_id(task_id)
    
    async def get_tasks_for_agent(self, agent_id: int) -> List[Task]:
        """Get tasks for agent."""
        return await self.task_repository.find_by_agent_id(agent_id)
    
    async def get_tasks_for_organization(self, organization_id: int) -> List[Task]:
        """Get tasks for organization."""
        return await self.task_repository.find_by_organization_id(organization_id)
    
    async def get_pending_tasks(self, limit: Optional[int] = None) -> List[Task]:
        """Get pending tasks (for scheduler)."""
        return await self.task_repository.find_pending_tasks(limit)
    
    async def get_running_tasks(self) -> List[Task]:
        """Get running tasks (for monitoring)."""
        return await self.task_repository.find_running_tasks()
    
    async def get_recent_tasks_for_organization(
        self, 
        organization_id: int, 
        limit: Optional[int] = None
    ) -> List[Task]:
        """Get recent tasks for organization (for dashboard)."""
        return await self.task_repository.find_recent_by_organization(organization_id, limit)