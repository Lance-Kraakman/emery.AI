"""
Capability model - unified abstraction for agents, skills, and tools.

This addresses the fragmentation of having managed agents, user agents,
skills, and tools as separate concepts with different routing logic.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class CapabilityType(Enum):
    """Type of capability - determines execution pattern."""

    AGENT = "agent"
    SKILL = "skill"
    TOOL = "tool"


@dataclass
class Capability:
    """
    Unified representation of anything that can perform work.

    Examples:
        # Managed agent
        Capability(
            id="agent:schema_builder",
            name="schema_builder",
            type=CapabilityType.AGENT,
            domain="emery",
            description="Creates database tables and fields",
            actions=["create", "update", "delete"],
            entities=["tables", "fields"],
        )

        # External integration tool
        Capability(
            id="tool:gmail-send-email",
            domain="gmail",
            description="Send emails via Gmail",
            actions=["send"],
            entities=["emails", "contacts"],
        )

        # User-defined skill
        Capability(
            id="skill:weekly-report",
            domain="user",
            description="Generate and send weekly reports",
            actions=["analyze", "format", "send"],
            entities=["reports"],
        )

        # Generic capability (no specific entities)
        Capability(
            id="agent:research_agent",
            domain="web",
            description="Search the web for information",
            actions=["search", "read"],
            entities=[],  # Works on anything
        )

    Attributes:
        id: Unique identifier with type prefix (e.g., "agent:schema_builder")
        name: Human-readable name
        type: AGENT, SKILL, or TOOL
        domain: Source/origin - "emery", "gmail", "slack", "shopify", "user", "web", etc.
                Not an enum since there are 30K+ possible integrations.
        description: What this capability does (used by planner for selection)
        actions: What it can do - ["create", "read", "send", "analyze"]
        entities: What it works with - ["tables", "fields", "emails"]
                  Can be empty for generic capabilities.
        metadata: Type-specific data (executor, inputs, outputs, skills, etc.)
    """

    id: str
    name: str
    type: CapabilityType
    domain: str
    description: str
    actions: list[str]
    entities: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Validate capability ID format."""
        if ":" not in self.id:
            raise ValueError(
                f"Capability ID must have type prefix (e.g., 'agent:name'), got: {self.id}"
            )
        prefix = self.id.split(":")[0]
        valid_prefixes = {"agent", "skill", "tool"}
        if prefix not in valid_prefixes:
            raise ValueError(
                f"Capability ID prefix must be one of {valid_prefixes}, got: {prefix}"
            )

    @property
    def type_prefix(self) -> str:
        """Extract type prefix from ID."""
        return self.id.split(":")[0]

    @property
    def short_name(self) -> str:
        """Extract name without type prefix."""
        return self.id.split(":", 1)[1]

    def to_summary(self) -> dict[str, Any]:
        """Convert to summary dict for planner context.

        Note: Planning guidance is now provided by reasoning/capabilities/
        instead of the old Jinja templates. This method returns basic capability
        info only.
        """
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "domain": self.domain,
            "description": self.description,
            "actions": self.actions,
            "entities": self.entities,
        }
