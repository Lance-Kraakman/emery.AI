"""
PlanningPattern model for searchable planning strategies.

This replaces static PLANNING_GUIDANCE strings with a searchable, dynamic
registry of planning patterns that include auto-approve policies.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any


class AutoApprovePolicy(StrEnum):
    """Auto-approve policy for a planning pattern."""

    AUTO = "auto"  # Auto-approve if all conditions met
    CONFIRM = "confirm"  # Default to require approval, but can auto if explicit
    EXPLICIT = "explicit"  # Always require approval (destructive, OAuth)


@dataclass
class PlanningPattern:
    """
    Searchable planning pattern with auto-approve policy.

    Contains strategy, examples, and auto-approve rules for a type of task.
    Replaces static PLANNING_GUIDANCE strings with a dynamic, searchable pattern.

    Example:
        PlanningPattern(
            id="plan:schema_design",
            name="Database Schema Design",
            description="Planning patterns for creating database tables and fields",
            triggers=["create table", "database schema", "track data"],
            capability_ids=["agent:schema_builder"],
            strategy="1. Identify entities\\n2. Define fields with EXPLICIT types",
            tool_sequence=["schema_builder"],
            step_templates=["Create table '[name]' with fields: ..."],
            examples=[...],
            common_mistakes=["Not specifying field types explicitly"],
            auto_approve_policy=AutoApprovePolicy.CONFIRM,
            auto_approve_conditions=["single_resource", "explicit_values"],
        )
    """

    # Identity
    id: str  # "plan:schema_design"
    name: str  # "Database Schema Design"
    description: str  # For semantic search

    # When to use this pattern
    triggers: list[str]  # ["create table", "database schema", "track data"]
    capability_ids: list[str]  # ["agent:schema_builder"]

    # How to plan
    strategy: str  # Planning approach text
    tool_sequence: list[str] = field(default_factory=list)  # Typical tool order
    step_templates: list[str] = field(default_factory=list)  # Step description templates

    # Examples (serialized dspy.Example format for compatibility)
    examples: list[dict[str, Any]] = field(default_factory=list)

    # Gotchas
    common_mistakes: list[str] = field(default_factory=list)

    # Auto-approve policy
    auto_approve_policy: AutoApprovePolicy = AutoApprovePolicy.CONFIRM
    auto_approve_conditions: list[str] = field(default_factory=list)
    # Valid conditions: "single_resource", "explicit_values", "additive_only"

    # Embedding for semantic search
    embedding: tuple[float, ...] | None = None

    def __post_init__(self) -> None:
        """Validate pattern ID format."""
        if ":" not in self.id:
            raise ValueError(
                f"Pattern ID must have prefix (e.g., 'plan:name'), got: {self.id}"
            )
        prefix = self.id.split(":")[0]
        if prefix != "plan":
            raise ValueError(f"Pattern ID prefix must be 'plan', got: {prefix}")

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "triggers": self.triggers,
            "capabilityIds": self.capability_ids,
            "strategy": self.strategy,
            "toolSequence": self.tool_sequence,
            "stepTemplates": self.step_templates,
            "examples": self.examples,
            "commonMistakes": self.common_mistakes,
            "autoApprovePolicy": self.auto_approve_policy.value,
            "autoApproveConditions": self.auto_approve_conditions,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> PlanningPattern:
        """Create from dictionary."""
        policy_str = data.get("autoApprovePolicy", data.get("auto_approve_policy", "confirm"))
        return cls(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            triggers=data.get("triggers", []),
            capability_ids=data.get("capabilityIds", data.get("capability_ids", [])),
            strategy=data.get("strategy", ""),
            tool_sequence=data.get("toolSequence", data.get("tool_sequence", [])),
            step_templates=data.get("stepTemplates", data.get("step_templates", [])),
            examples=data.get("examples", []),
            common_mistakes=data.get("commonMistakes", data.get("common_mistakes", [])),
            auto_approve_policy=AutoApprovePolicy(policy_str),
            auto_approve_conditions=data.get(
                "autoApproveConditions", data.get("auto_approve_conditions", [])
            ),
        )

    def to_planning_guidance(self) -> str:
        """
        Format pattern as planning guidance string for the planner.

        Returns the pattern in a format compatible with existing CreatePlan signature.
        """
        parts = [f"## {self.name} ({self.id})"]

        # Triggers
        parts.append(f"\n**When to use**: {', '.join(self.triggers)}")

        # Strategy
        if self.strategy:
            parts.append(f"\n### Strategy\n{self.strategy}")

        # Step templates
        if self.step_templates:
            parts.append("\n### Step Templates")
            for template in self.step_templates:
                parts.append(f"- {template}")

        # Common mistakes
        if self.common_mistakes:
            parts.append("\n### Avoid These Mistakes")
            for mistake in self.common_mistakes:
                parts.append(f"- {mistake}")

        # Auto-approve policy
        parts.append(f"\n### Auto-Approve Policy: {self.auto_approve_policy.value}")
        if self.auto_approve_conditions:
            parts.append(f"Conditions: {', '.join(self.auto_approve_conditions)}")

        return "\n".join(parts)
