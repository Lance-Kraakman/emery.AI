"""
Protocol definitions for type-safe dependency injection.

AIDEV-NOTE: Protocols enable structural subtyping - any class that implements
the required methods/attributes satisfies the protocol, without explicit inheritance.
This allows type-safe dependency injection while keeping classes decoupled.
"""

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class ModelProviderProtocol(Protocol):
    """
    Protocol for model provider services.

    Implementors: ModelProvider
    """

    def resolve_model_selection(
        self,
        skill_model: str | None = None,
        agent_model: str | None = None,
        org_model: str | None = None,
        has_images: bool = False,
    ) -> str:
        """Resolve model ID using hierarchy: skill > agent > org > default."""
        ...

    def get_dspy_lm(self, model_id: str | None = None) -> Any:
        """Get a DSPy LM instance for the given model."""
        ...

    def configure_dspy(self, model_id: str | None = None) -> None:
        """Configure DSPy global settings with the specified model."""
        ...


@runtime_checkable
class GRPCClient(Protocol):
    """
    Protocol for gRPC communication with Next.js server.

    Implementors: ChatProcessingClient (or similar)
    """

    async def update_agent_plan(self, agent_id: int, plan: dict[str, Any]) -> None:
        """Save plan to agent entity."""
        ...

    async def get_agent(self, agent_id: int) -> Any | None:
        """Get agent by ID."""
        ...

    async def update_step_plan(
        self, skill_id: int, step_id: str, plan: dict[str, Any]
    ) -> None:
        """Save plan to skill step."""
        ...

    async def get_skill_step(self, skill_id: int, step_id: str) -> Any | None:
        """Get skill step by IDs."""
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

    Optional attributes (accessed via getattr with fallback):
    - capabilities: Detailed capabilities for planner context

    Implementors: smolagents.ManagedAgent, StatefulManagedAgent
    """

    name: str
    description: str
    # Note: capabilities is optional, accessed via getattr(agent, "capabilities", "")
