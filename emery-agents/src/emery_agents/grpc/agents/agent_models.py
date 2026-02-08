"""
Agent Models - DSPy-compatible replacements for smolagents agents.

These dataclasses replace smolagents ToolCallingAgent and related types.
Execution happens via DSPy ExecutorModule, not agent.run().

AIDEV-NOTE: The smolagents agents were only used for:
- .name and .description in prompt templates
- .memory.steps for conversation history
- .managed_agents dict for routing hints
- .system_prompt for logging

These models provide the same interface without smolagents dependency.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from .agent_descriptors import AgentDescriptor, get_builder_descriptors


@dataclass
class MemoryStep:
    """A single step in agent memory (replaces smolagents TaskStep/ActionStep)."""

    role: Literal["user", "assistant"]
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    step_number: int | None = None
    # Optional metadata for compatibility
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentMemory:
    """
    Replacement for smolagents agent.memory.

    Provides a simple list of steps that can be appended to and cleared.
    """

    steps: list[MemoryStep] = field(default_factory=list)

    def clear(self) -> None:
        """Clear all memory steps."""
        self.steps.clear()

    def append(self, step: MemoryStep) -> None:
        """Add a step to memory."""
        self.steps.append(step)

    def __len__(self) -> int:
        return len(self.steps)


@dataclass
class ChatAgent:
    """
    Replacement for smolagents ToolCallingAgent.

    This is a data-only class - execution happens via DSPy ExecutorModule.
    Provides the same interface as smolagents agent for compatibility with
    existing code that reads agent properties.
    """

    name: str = "chat_planner"
    description: str = "Plans and coordinates tasks"
    memory: AgentMemory = field(default_factory=AgentMemory)
    managed_agents: dict[str, AgentDescriptor] = field(default_factory=dict)
    system_prompt: str = ""

    @classmethod
    def create(
        cls,
        managed_agents: list[AgentDescriptor] | None = None,
        system_prompt: str = "",
    ) -> "ChatAgent":
        """
        Create a ChatAgent with managed agents.

        Args:
            managed_agents: List of AgentDescriptor for available specialists
            system_prompt: Optional system prompt (for logging)

        Returns:
            Configured ChatAgent instance
        """
        agents_dict = {}
        if managed_agents:
            agents_dict = {a.name: a for a in managed_agents}
        else:
            # Use default builder descriptors
            agents_dict = {a.name: a for a in get_builder_descriptors()}

        return cls(
            managed_agents=agents_dict,
            system_prompt=system_prompt,
        )


__all__ = [
    "ChatAgent",
    "AgentMemory",
    "MemoryStep",
    "AgentDescriptor",
    "get_builder_descriptors",
]
