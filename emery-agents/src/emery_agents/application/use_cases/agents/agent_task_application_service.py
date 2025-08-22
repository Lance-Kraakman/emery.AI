"""
Agent Task Application Service

AIDEV-NOTE: Main orchestration service for agent task operations.
Ported from TypeScript version in /ddd/application/use-cases/agents/agent-task-application-service.ts.
Orchestrates domain operations using repository pattern.
"""

import logging
from dataclasses import dataclass
from typing import Optional

from ....domain.agents.entities.agent import Agent
from ....domain.agents.entities.task import Task
from ....domain.agents.repositories.agent_execution_repository import (
    AgentExecutionRequest,
    AgentExecutionResult,
    IAgentExecutionRepository,
)
from ....domain.agents.repositories.agent_repository import IAgentRepository
from ....domain.agents.repositories.task_repository import ITaskRepository
from ....domain.agents.value_objects.agent_id import AgentId
from ....domain.agents.value_objects.task_id import TaskId
from ....domain.shared.value_objects.organization_id import OrganizationId
from ....domain.shared.value_objects.user_id import UserId
from ...commands.create_task_command import CreateTaskCommand
from ...commands.execute_task_command import ExecuteTaskCommand

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class TaskExecutionResult:
    """Result of task execution operation."""
    task: Task
    execution_result: AgentExecutionResult


class AgentTaskApplicationService:
    """
    Application service for agent task operations.
    
    AIDEV-NOTE: Orchestrates domain operations using repository pattern.
    Handles task creation, execution, status tracking, and lifecycle management.
    """
    
    def __init__(
        self,
        agent_repository: IAgentRepository,
        task_repository: ITaskRepository,
        execution_repository: IAgentExecutionRepository
    ):
        self._agent_repository = agent_repository
        self._task_repository = task_repository
        self._execution_repository = execution_repository
    
    async def create_task(self, command: CreateTaskCommand) -> Task:
        """
        Create a new task for an agent.
        
        AIDEV-NOTE: Orchestrates task creation with domain validation.
        """
        logger.info(f"Creating task for agent {command.agent_id}: {command.name}")
        
        # 1. Validate agent exists and is active
        agent = await self._agent_repository.find_by_id(AgentId(command.agent_id))
        if not agent:
            raise ValueError(f"Agent {command.agent_id} not found")
        
        if not agent.is_active():
            raise ValueError(f"Agent {command.agent_id} is not active (status: {agent.status.value})")
        
        # 2. Use agent's organization or override
        organization_id = OrganizationId(command.organization_id or agent.organization_id.value)
        
        # 3. Create task using domain entity
        from ....domain.agents.entities.task import TaskConfig
        task_config = TaskConfig(
            agent_id=command.agent_id,
            organization_id=organization_id.value,
            name=command.name,
            capability_name=command.capability_name,
            instructions=command.instructions,
            created_by=command.created_by,
            status="pending"
        )
        
        task = Task.create(task_config)
        
        # 4. Save task
        saved_task = await self._task_repository.save(task)
        
        logger.info(f"Created task {saved_task.short_id()} for agent {agent.display_name()}")
        return saved_task
    
    async def execute_task(self, command: ExecuteTaskCommand) -> TaskExecutionResult:
        """
        Execute an existing pending task.
        
        AIDEV-NOTE: Orchestrates task execution with domain validation and business rules.
        """
        task_id = TaskId.from_string(command.normalized_task_id)
        
        logger.info(f"Executing task {task_id.short_id()}")
        
        # 1. Load and validate task
        task = await self._task_repository.find_by_id(task_id)
        if not task:
            raise ValueError(f"Task {task_id.value} not found")
        
        if not task.is_pending():
            raise ValueError(f"Task {task_id.value} is not pending (status: {task.status.value})")
        
        # 2. Load and validate agent
        agent = await self._agent_repository.find_by_id(task.agent_id)
        if not agent:
            raise ValueError(f"Agent {task.agent_id.value} not found")
        
        if not agent.is_active():
            raise ValueError(f"Agent {task.agent_id.value} is not active")
        
        # Validate agent can execute tasks (business rule)
        agent.validate_for_execution()
        
        try:
            # 3. Start task execution (domain logic)
            running_task = task.start()
            await self._task_repository.save(running_task)
            
            # 4. Execute via execution repository
            from ....domain.tools.value_objects.tool_config import ToolConfig
            from ....domain.agents.value_objects.server_config import ServerConfig
            
            tools = [
                ToolConfig.from_dict(tool) for tool in (running_task.instructions.tools or [])
            ]
            servers = [
                ServerConfig.from_dict(server) for server in (running_task.instructions.servers or [])
            ]
            
            execution_request = AgentExecutionRequest(
                agent_id=running_task.agent_id,
                instructions=running_task.instructions.instructions,
                tools=tools,
                servers=servers,
                execution_id=running_task.id.value,
                organization_id=running_task.organization_id,
                owner_id=agent.owner_id,
                timeout_seconds=command.timeout_seconds
            )
            
            execution_result = await self._execution_repository.execute_agent(execution_request)
            
            # 5. Update task based on execution result (domain logic)
            if execution_result.success:
                completed_task = running_task.complete(execution_result.output_data)
                logger.info(f"Task {task_id.short_id()} completed successfully")
            else:
                error_msg = execution_result.error or "Execution failed"
                completed_task = running_task.fail(error_msg)
                logger.error(f"Task {task_id.short_id()} failed: {error_msg}")
            
            # 6. Save final task state
            final_task = await self._task_repository.save(completed_task)
            
            return TaskExecutionResult(
                task=final_task,
                execution_result=execution_result
            )
            
        except Exception as error:
            logger.exception(f"Error executing task {task_id.short_id()}: {error}")
            
            # Mark task as failed (domain logic)
            error_message = str(error) if isinstance(error, Exception) else "Unknown error"
            failed_task = running_task.fail(error_message) if 'running_task' in locals() else task.fail(error_message)
            await self._task_repository.save(failed_task)
            
            raise error
    
    async def create_and_execute_task(
        self, 
        create_command: CreateTaskCommand, 
        timeout_seconds: Optional[int] = None
    ) -> TaskExecutionResult:
        """
        Create and execute a task in one operation (convenience method).
        
        AIDEV-NOTE: Combines creation and execution for immediate task processing.
        """
        # 1. Create task
        task = await self.create_task(create_command)
        
        # 2. Execute immediately
        execute_command = ExecuteTaskCommand(
            task_id=task.id.value,
            timeout_seconds=timeout_seconds
        )
        
        return await self.execute_task(execute_command)
    
    async def cancel_task(self, task_id: str, reason: Optional[str] = None) -> None:
        """
        Cancel a running task.
        
        AIDEV-NOTE: Handles both execution cancellation and domain state updates.
        """
        task_id_vo = TaskId.from_string(task_id)
        logger.info(f"Cancelling task {task_id_vo.short_id()}: {reason or 'No reason provided'}")
        
        # 1. Load task
        task = await self._task_repository.find_by_id(task_id_vo)
        if not task:
            raise ValueError(f"Task {task_id} not found")
        
        # 2. Cancel execution if running
        if task.is_running():
            await self._execution_repository.cancel_execution(task_id, reason)
        
        # 3. Update task status (domain logic)
        cancelled_task = task.cancel(reason)
        await self._task_repository.save(cancelled_task)
        
        logger.info(f"Cancelled task {task_id_vo.short_id()}")
    
    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID."""
        task_id_vo = TaskId.from_string(task_id)
        return await self._task_repository.find_by_id(task_id_vo)
    
    async def get_tasks_for_agent(self, agent_id: int) -> list[Task]:
        """Get tasks for agent."""
        agent_id_vo = AgentId(agent_id)
        return await self._task_repository.find_by_agent_id(agent_id_vo)
    
    async def get_tasks_for_organization(self, organization_id: int) -> list[Task]:
        """Get tasks for organization."""
        org_id_vo = OrganizationId(organization_id)
        return await self._task_repository.find_by_organization_id(org_id_vo)
    
    async def get_pending_tasks(self, limit: Optional[int] = None) -> list[Task]:
        """Get pending tasks (for scheduler)."""
        return await self._task_repository.find_pending_tasks(limit)
    
    async def get_running_tasks(self) -> list[Task]:
        """Get running tasks (for monitoring)."""
        return await self._task_repository.find_running_tasks()
    
    async def get_recent_tasks_for_organization(
        self, 
        organization_id: int, 
        limit: Optional[int] = None
    ) -> list[Task]:
        """Get recent tasks for organization (for dashboard)."""
        org_id_vo = OrganizationId(organization_id)
        return await self._task_repository.find_recent_by_organization(org_id_vo, limit)
    
    async def is_execution_available(self, organization_id: int) -> bool:
        """Check if agent execution is available for organization."""
        return await self._execution_repository.is_execution_available(str(organization_id))
    
    async def get_worker_health(self, organization_id: int):
        """Get execution worker health for organization."""
        return await self._execution_repository.get_worker_health(str(organization_id))