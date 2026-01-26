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

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from emery_agents.entities.models.context_mapping import ResolvedContext
from emery_agents.entities.models.plan import Plan, SkillInputDefinition, SkillOutputDefinition
from emery_agents.services.protocols import Tool, ManagedAgent
from emery_agents.services.capability_registry import CapabilityRegistry
from emery_agents.services.context import SessionConfig, WorkspaceContext


@dataclass(frozen=True)
class ToolResultSummary:
    """Summary of a tool result for context injection."""

    tool: str
    summary: str

    def to_dict(self) -> Dict[str, str]:
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
    context_tables: Optional[ResolvedContext] = None
    goal: Optional[str] = None
    conversation_history: Optional[List[Dict[str, Any]]] = None

    # Available resources
    tools: List[Tool] = field(default_factory=list)
    managed_agents: List[ManagedAgent] = field(default_factory=list)
    research_tools: Optional[List[Tool]] = None

    # Template generation mode (for reusable skills with {{ variable }} placeholders)
    skill_inputs: List[SkillInputDefinition] = field(default_factory=list)
    skill_outputs: List[SkillOutputDefinition] = field(default_factory=list)
    is_template_generation: bool = False

    # Regeneration
    previous_plan_json: Optional[str] = None
    user_feedback: Optional[str] = None

    # Auth & identity (unified in SessionConfig)
    config: Optional[SessionConfig] = None

    # Capability discovery
    capability_registry: Optional[CapabilityRegistry] = None

    # Pre-resolved workspace state (agents, tables - eliminates discovery calls)
    workspace: Optional[WorkspaceContext] = None


@dataclass
class PlanGenerationResult:
    """
    All outputs from plan generation.

    Encapsulates the plan and any metadata gathered during generation.
    May contain clarifying_questions instead of a plan if the planner
    needs more information from the user.
    """

    plan: Optional[Plan] = None
    strategy_guidance: Optional[str] = None
    context_gathered: Optional[str] = None
    analysis: Optional[str] = None
    tool_results: List[Dict[str, Any]] = field(default_factory=list)
    clarifying_questions: Optional[List[Dict[str, Any]]] = None

    @property
    def needs_clarification(self) -> bool:
        """Check if we need clarification from user instead of having a plan."""
        return self.clarifying_questions is not None and len(self.clarifying_questions) > 0


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
    plan_context: Optional[str] = None

    # Execution state (serialized ledger summary)
    ledger_summary: str = ""

    # Auth & identity (unified in SessionConfig)
    config: Optional[SessionConfig] = None
