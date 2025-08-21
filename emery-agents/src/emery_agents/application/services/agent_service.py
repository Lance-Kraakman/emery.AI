from ...domain.repositories.agent_repository import IAgentRepository
from ...domain.repositories.task_repository import ITaskRepository
from ...domain.repositories.orchestrator import IOrchestrator
from ...domain.entities.models import TaskInstructions, TaskStatus, OrchestratorResult

class AgentService:
    """
    Handles the application logic for agents and tasks.
    """
    def __init__(
        self, 
        agent_repository: IAgentRepository, 
        task_repository: ITaskRepository,
        orchestrator: IOrchestrator
    ):
        self.agent_repository = agent_repository
        self.task_repository = task_repository
        self.orchestrator = orchestrator

    async def execute_task(self, task_id: str, agent_id: int, instructions: TaskInstructions, capability_name: str) -> OrchestratorResult:
        """
        Orchestrates the execution of a task for a given agent.
        """
        agent = await self.agent_repository.find_by_id(agent_id)
        if not agent:
            raise ValueError(f"Agent with ID {agent_id} not found.")

        await self.task_repository.update_status(task_id, TaskStatus.IN_PROGRESS)

        self.orchestrator.setup_agent_orchestrator(agent)

        if not instructions:
            instructions = TaskInstructions(instructions=f"Execute capability: {capability_name}")

        task_result = await self.orchestrator.execute_with_orchestrator(instructions=instructions)

        if task_result["status"] == "success":
            await self.task_repository.update_status(
                task_id, TaskStatus.COMPLETED, result=task_result.get("result")
            )
        else:
            await self.task_repository.update_status(
                task_id, TaskStatus.FAILED, error=task_result.get("error")
            )
        
        return task_result
