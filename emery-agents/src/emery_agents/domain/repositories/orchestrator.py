from abc import ABC, abstractmethod
from ..entities.models import Agent, TaskInstructions, OrchestratorResult

class IOrchestrator(ABC):
    """
    Abstract interface for an agent orchestrator.
    """

    @abstractmethod
    def setup_agent_orchestrator(self, agent: Agent) -> None:
        """
        Sets up the agent hierarchy and prepares the orchestrator for execution.
        """
        pass

    @abstractmethod
    async def execute_with_orchestrator(
        self,
        instructions: TaskInstructions,
    ) -> OrchestratorResult:
        """
        Executes a task using the configured agent orchestrator.
        """
        pass
