"""
Planning Models

Dataclasses for plan generation requests and results.
Replaces the 13+ parameter method signature with typed, immutable objects.

AIDEV-NOTE: These dataclasses are immutable configs that capture all inputs
and outputs for plan generation. This enables:
- Type-safe parameter passing
- Easy serialization/deserialization
- Clear separation of concerns
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from emery_agents.entities.models.context_mapping import ResolvedContext
from emery_agents.entities.models.plan import (
    Plan,
    SkillInputDefinition,
    SkillOutputDefinition,
)
from emery_agents.services.analysis.token_accumulator import TokenAccumulator
from emery_agents.services.context import SessionConfig, WorkspaceContext
from emery_agents.services.protocols import ManagedAgent, Tool
from emery_agents.tools.capability_registry import CapabilityRegistry

if TYPE_CHECKING:
    from emery_agents.services.context import ConversationMessage


@dataclass(frozen=True)
class ToolResultSummary:
    """Summary of a tool result for context injection."""

    tool: str
    summary: str

    def to_dict(self) -> dict[str, str]:
        """Convert to dict for Jinja template."""
        return {"tool": self.tool, "summary": self.summary}


@dataclass
class PlanGenerationRequest:
    """
    All inputs for plan generation.

    Replaces the 13+ parameter method signature with a typed, grouped structure.
    Optional fields have sensible defaults.

    AIDEV-NOTE: This is NOT frozen because some fields may need to be
    modified during request processing (e.g., resolving tools).
    """

    # Required
    basic_instructions: str

    # Context
    context_tables: ResolvedContext | None = None
    goal: str | None = None
    conversation_history: list[ConversationMessage] | None = None

    # Available resources
    tools: list[Tool] = field(default_factory=list)
    managed_agents: list[ManagedAgent] = field(default_factory=list)

    # Template generation mode (for reusable skills with {{ variable }} placeholders)
    skill_inputs: list[SkillInputDefinition] = field(default_factory=list)
    skill_outputs: list[SkillOutputDefinition] = field(default_factory=list)
    is_template_generation: bool = False

    # Regeneration
    previous_plan_json: str | None = None
    user_feedback: str | None = None

    # Auth & identity (unified in SessionConfig)
    config: SessionConfig | None = None

    # Capability discovery
    capability_registry: CapabilityRegistry | None = None

    # Pre-resolved workspace state (agents, tables - eliminates discovery calls)
    workspace: WorkspaceContext | None = None

    # Memory context (relevant memories, passed separately from task)
    memory_context: str = ""

    # Pre-computed triage analysis (intent, entities, approach, external_services)
    # Avoids duplicate AnalyzeTask call in PlannerModule
    triage_analysis: dict[str, Any] | None = None

    # Tools explicitly configured for the skill (from UI tools[] array).
    # Passed to the planner so it uses these tools in generated plan steps.
    configured_tools: list[dict[str, Any]] | None = None

    token_accumulator: TokenAccumulator | None = None

    # Retrieved context from KNN retrievers (formatted strings)
    # Replaces custom FAISS search with DSPy KNNFewShot retrieval
    retrieved_capabilities: str = ""
    retrieved_patterns: str = ""
    retrieved_knowledge: str = ""
    retrieved_strategies: str = ""

    @property
    def configured_tools_json(self) -> str:
        """Format configured_tools as JSON string for DSPy signature input."""
        if not self.configured_tools:
            return ""
        return json.dumps(self.configured_tools)


@dataclass
class PlanGenerationResult:
    """
    All outputs from plan generation.

    Encapsulates the plan and any metadata gathered during generation.
    May contain clarifying_questions instead of a plan if the planner
    needs more information from the user.
    """

    plan: Plan | None = None
    strategy_guidance: str | None = None
    context_gathered: str | None = None
    analysis: str | None = None
    tool_results: list[dict[str, Any]] = field(default_factory=list)
    clarifying_questions: list[dict[str, Any]] | None = None

    @property
    def needs_clarification(self) -> bool:
        """Check if we need clarification from user instead of having a plan."""
        return (
            self.clarifying_questions is not None and len(self.clarifying_questions) > 0
        )


@dataclass
class FailureAnalysisRequest:
    """
    Inputs for step failure analysis.

    Encapsulates all context needed to analyze a failed step
    and determine recovery strategy.
    """

    # Failed step info
    step_id: str
    step_description: str
    error_message: str

    # Plan context
    plan_goal: str
    plan_context: str | None = None

    # Execution state (serialized ledger summary)
    ledger_summary: str = ""

    # Auth & identity (unified in SessionConfig)
    config: SessionConfig | None = None
