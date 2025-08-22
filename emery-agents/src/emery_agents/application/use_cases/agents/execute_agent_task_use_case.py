"""
Execute Agent Task Use Case

AIDEV-NOTE: Single-responsibility use case for task execution.
Focused on just the execution logic without creation concerns.
"""

import logging
from typing import Optional

from ....domain.agents.entities.agent import Agent
from ....domain.agents.entities.task import Task
from ....domain.agents.repositories.agent_execution_repository import (
    AgentExecutionRequest,
    IAgentExecutionRepository,
)
from ....domain.agents.repositories.agent_repository import IAgentRepository
from ....domain.agents.repositories.task_repository import ITaskRepository
from ....domain.agents.value_objects.task_id import TaskId
from ....domain.agents.value_objects.server_config import ServerConfig
from ....domain.tools.value_objects.tool_config import ToolConfig
from ...commands.execute_task_command import ExecuteTaskCommand
from .agent_task_application_service import TaskExecutionResult

logger = logging.getLogger(__name__)


class ExecuteAgentTaskUseCase:
    """
    Use case for executing agent tasks.
    
    AIDEV-NOTE: Single responsibility - just task execution.
    Separates execution concerns from creation and management.
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
    
    async def execute(self, command: ExecuteTaskCommand) -> TaskExecutionResult:
        """
        Execute a task with the given command.
        
        AIDEV-NOTE: Focused on execution workflow with proper error handling.
        """
        task_id = TaskId.from_string(command.normalized_task_id)
        
        logger.info(f"[EXECUTE-TASK-USE-CASE] Starting execution of task {task_id.short_id()}")
        
        # 1. Load and validate task
        task = await self._load_and_validate_task(task_id)
        
        # 2. Load and validate agent
        agent = await self._load_and_validate_agent(task.agent_id)
        
        # 3. Execute task
        try:
            return await self._execute_task_with_agent(task, agent, command.timeout_seconds)
        except Exception as error:
            await self._handle_execution_error(task, error)
            raise
    
    async def _load_and_validate_task(self, task_id: TaskId) -> Task:
        """Load task and validate it can be executed."""
        task = await self._task_repository.find_by_id(task_id)
        if not task:
            raise ValueError(f"Task {task_id.value} not found")
        
        if not task.is_pending():
            raise ValueError(
                f"Task {task_id.value} is not pending (status: {task.status.value})"
            )
        
        return task
    
    async def _load_and_validate_agent(self, agent_id) -> Agent:
        """Load agent and validate it can execute tasks."""
        agent = await self._agent_repository.find_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent {agent_id.value} not found")
        
        if not agent.is_active():
            raise ValueError(f"Agent {agent_id.value} is not active")
        
        # Apply business rule validation
        agent.validate_for_execution()
        
        return agent
    
    async def _execute_task_with_agent(
        self, 
        task: Task, 
        agent: Agent, 
        timeout_seconds: Optional[int]
    ) -> TaskExecutionResult:
        """Execute the task with the validated agent."""
        # Start task execution (domain state transition)
        running_task = task.start()
        await self._task_repository.save(running_task)
        
        # Prepare execution request
        execution_request = self._build_execution_request(
            running_task, agent, timeout_seconds
        )
        
        # Execute via execution repository
        execution_result = await self._execution_repository.execute_agent(execution_request)
        
        # Update task based on execution result
        final_task = await self._update_task_with_result(running_task, execution_result)
        
        return TaskExecutionResult(
            task=final_task,
            execution_result=execution_result
        )
    
    def _build_execution_request(
        self, 
        task: Task, 
        agent: Agent, 
        timeout_seconds: Optional[int]
    ) -> AgentExecutionRequest:
        """Build execution request from task and agent."""
        tools = [
            ToolConfig.from_dict(tool) for tool in (task.instructions.tools or [])
        ]
        servers = [
            ServerConfig.from_dict(server) for server in (task.instructions.servers or [])
        ]
        
        return AgentExecutionRequest(
            agent_id=task.agent_id,
            instructions=task.instructions.instructions,
            tools=tools,
            servers=servers,
            execution_id=task.id.value,
            organization_id=task.organization_id,
            owner_id=agent.owner_id,
            timeout_seconds=timeout_seconds
        )
    
    async def _update_task_with_result(self, task: Task, execution_result) -> Task:
        """Update task with execution result using domain logic."""
        if execution_result.success:
            completed_task = task.complete(execution_result.output_data)
            logger.info(f"[EXECUTE-TASK-USE-CASE] Task {task.short_id()} completed successfully")
        else:
            error_msg = execution_result.error or "Execution failed"
            completed_task = task.fail(error_msg)
            logger.error(f"[EXECUTE-TASK-USE-CASE] Task {task.short_id()} failed: {error_msg}")
        
        return await self._task_repository.save(completed_task)
    
    async def _handle_execution_error(self, task: Task, error: Exception) -> None:
        """Handle execution error by updating task state."""
        logger.exception(f"[EXECUTE-TASK-USE-CASE] Error executing task {task.short_id()}: {error}")
        
        error_message = str(error) if isinstance(error, Exception) else "Unknown error"
        failed_task = task.fail(error_message)
        await self._task_repository.save(failed_task)