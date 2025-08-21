from ...domain.entities.models import Agent, TaskInstructions, OrchestratorResult
from ...integrations.smolagents_orcha import SmolAgentsOrchestrator

class AgentService:
    """
    Handles the application logic for agents and tasks.
    """
    def __init__(self):
        self.orchestrator = SmolAgentsOrchestrator()

    async def execute_task(self, agent: Agent, instructions: TaskInstructions, capability_name: str) -> OrchestratorResult:
        """
        Orchestrates the execution of a task for a given agent.
        """
        self.orchestrator.setup_agent_orchestrator(agent)

        if not instructions:
            instructions = TaskInstructions(instructions=f"Execute capability: {capability_name}")

        task_result = await self.orchestrator.execute_with_orchestrator(instructions=instructions)
        
        return task_result
