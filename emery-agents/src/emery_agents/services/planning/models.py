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

# Forward references for type hints (actual imports would create cycles)
if False:  # TYPE_CHECKING
    from emery_agents.models.context_mapping import ResolvedContext
    from emery_agents.models.skill_definition import SkillInputDefinition, SkillOutputDefinition
    from emery_agents.models.plan import Plan


@dataclass(frozen=True)
class AgentInfo:
    """Agent information for template rendering."""

    name: str
    description: str
    capabilities: str
    tools: tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for Jinja template."""
        return {
            "name": self.name,
            "description": self.description,
            "capabilities": self.capabilities,
            "tools": list(self.tools),
        }


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
    context_tables: Optional["ResolvedContext"] = None
    goal: Optional[str] = None
    conversation_history: Optional[List[Any]] = None

    # Available resources
    tools: List[Any] = field(default_factory=list)
    managed_agents: List[Any] = field(default_factory=list)
    research_tools: Optional[List[Any]] = None

    # Template generation mode (for reusable skills with {{ variable }} placeholders)
    skill_inputs: List["SkillInputDefinition"] = field(default_factory=list)
    skill_outputs: List["SkillOutputDefinition"] = field(default_factory=list)
    is_template_generation: bool = False

    # Regeneration
    previous_plan_json: Optional[str] = None
    user_feedback: Optional[str] = None

    # Auth & model
    org_model: Optional[str] = None
    api_key: Optional[str] = None
    organization_id: Optional[int] = None


@dataclass
class PlanGenerationResult:
    """
    All outputs from plan generation.

    Encapsulates the plan and any metadata gathered during generation.
    """

    plan: "Plan"
    strategy_guidance: Optional[str] = None
    context_gathered: Optional[str] = None
    analysis: Optional[str] = None
    tool_results: List[Dict[str, Any]] = field(default_factory=list)


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

    # Auth & model
    org_model: Optional[str] = None
    api_key: Optional[str] = None
    organization_id: Optional[int] = None
