"""
Protocol definitions for type-safe dependency injection.

AIDEV-NOTE: Protocols enable structural subtyping - any class that implements
the required methods/attributes satisfies the protocol, without explicit inheritance.
This allows type-safe dependency injection while keeping classes decoupled.
"""

from typing import Protocol, Optional, Any, Dict, List, runtime_checkable


@runtime_checkable
class ModelProvider(Protocol):
    """
    Protocol for model provider services.

    Implementors: SmolagentsModelProvider
    """

    def resolve_model_selection(
        self,
        skill_model: Optional[str] = None,
        agent_model: Optional[str] = None,
        org_model: Optional[str] = None,
        has_images: bool = False,
    ) -> str:
        """Resolve model ID using hierarchy: skill > agent > org > default."""
        ...

    def get_model(self, model_id: Optional[str] = None) -> Any:
        """Get model instance by ID."""
        ...


@runtime_checkable
class GRPCClient(Protocol):
    """
    Protocol for gRPC communication with Next.js server.

    Implementors: ChatProcessingClient (or similar)
    """

    async def update_agent_plan(self, agent_id: int, plan: Dict[str, Any]) -> None:
        """Save plan to agent entity."""
        ...

    async def get_agent(self, agent_id: int) -> Optional[Any]:
        """Get agent by ID."""
        ...

    async def update_step_plan(
        self, skill_id: int, step_id: str, plan: Dict[str, Any]
    ) -> None:
        """Save plan to skill step."""
        ...

    async def get_skill_step(self, skill_id: int, step_id: str) -> Optional[Any]:
        """Get skill step by IDs."""
        ...


@runtime_checkable
class EvaluatorAgent(Protocol):
    """
    Protocol for evaluator agents that assess task progress.

    Implementors: ToolCallingAgent configured as evaluator
    """

    def run(self, task: str) -> str:
        """Run evaluation and return JSON result."""
        ...


@runtime_checkable
class Tool(Protocol):
    """
    Protocol for smolagents tools.

    Implementors: All smolagents Tool subclasses
    """

    name: str
    description: str

    def forward(self, *args: Any, **kwargs: Any) -> Any:
        """Execute the tool."""
        ...


@runtime_checkable
class ManagedAgent(Protocol):
    """
    Protocol for managed agents that can be delegated to.

    AIDEV-NOTE: Used for typing in ExecutionCoordinator and TaskClassifier
    to avoid getattr() patterns. Any smolagents ManagedAgent or similar
    class with name/description attributes satisfies this protocol.

    Implementors: smolagents.ManagedAgent, StatefulManagedAgent
    """

    name: str
    description: str
