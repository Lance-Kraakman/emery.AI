"""
Base Domain Planner

Protocol and base class for domain-specific planners.
Each domain planner generates steps for a specific area (schema, app, automation).

AIDEV-NOTE: Domain planners are LLM-driven. They:
1. Use PlannerClassifier (LLM) to classify which domain(s) a request belongs to
2. Generate domain-specific plans with correct agent routing via LLM
3. Compose multi-domain plans when request spans domains

All planning requires model_provider - no static fallback.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

from emery_agents.models.plan import PlanStep


@dataclass
class DomainPlanResult:
    """
    Result from a domain planner.

    Contains the generated steps and metadata about what was planned.
    """
    steps: List[PlanStep]
    context: str = ""  # Gathered context relevant to this domain
    analysis: str = ""  # Analysis of how to achieve domain goals
    target_agents: List[str] = field(default_factory=list)  # Agents this domain routes to


@dataclass
class ACEContext:
    """
    Agentic Context Engineering (ACE) variables for planning.

    These provide contextual information from the conversation and past executions.
    """
    strategy_guidance: Optional[str] = None  # Proven patterns from past executions
    recent_tool_results: Optional[List[Dict[str, str]]] = None  # Recent context from conversation
    conversation_history: Optional[List[Any]] = None  # Full conversation for reference resolution


@dataclass
class TemplateGenerationContext:
    """
    Context for generating reusable skill templates.

    When is_template_generation=True, plans use {{ variable }} placeholders
    instead of hardcoded IDs.
    """
    is_template_generation: bool = False
    skill_inputs: Optional[List[Dict[str, Any]]] = None  # Skill input definitions
    skill_outputs: Optional[List[Dict[str, Any]]] = None  # Skill output definitions


@runtime_checkable
class DomainPlanner(Protocol):
    """
    Protocol for domain-specific planners.

    Each planner handles a specific domain (schema, app, automation)
    and generates steps that route to the appropriate managed agents.
    """

    domain: str  # "schema", "app", "automation"
    target_agents: List[str]  # Agents this planner routes to

    async def generate_steps(
        self,
        instructions: str,
        domain_context: Optional[str] = None,
        ace_context: Optional[ACEContext] = None,
        template_context: Optional[TemplateGenerationContext] = None,
        org_model: Optional[str] = None,
    ) -> DomainPlanResult:
        """
        Generate domain-specific plan steps.

        Args:
            instructions: The user's instructions
            domain_context: Context from earlier domains
            ace_context: ACE variables (strategy_guidance, recent_tool_results)
            template_context: Template generation settings (is_template_generation, skill_inputs/outputs)
            org_model: Organization model ID for model resolution

        Returns:
            DomainPlanResult with steps and metadata
        """
        ...


class BaseDomainPlanner(ABC):
    """
    Base class for domain planners with common functionality.

    All domain planners require model_provider for LLM-based planning.
    No static fallback - if no model_provider, operations will fail.
    """

    domain: str = ""
    target_agents: List[str] = []

    def __init__(self, model_provider: Optional["ModelProvider"] = None):
        """
        Initialize planner.

        Args:
            model_provider: Model provider for LLM-based planning (required for generate_steps)
        """
        self.model_provider = model_provider

    @abstractmethod
    async def generate_steps(
        self,
        instructions: str,
        domain_context: Optional[str] = None,
        ace_context: Optional[ACEContext] = None,
        template_context: Optional[TemplateGenerationContext] = None,
        org_model: Optional[str] = None,
    ) -> DomainPlanResult:
        """
        Generate domain-specific plan steps using LLM.

        Args:
            instructions: The user's instructions
            domain_context: Context from earlier domains
            ace_context: ACE variables (strategy_guidance, recent_tool_results)
            template_context: Template generation settings
            org_model: Organization model ID for model resolution

        Raises:
            ValueError: If no model_provider is available
        """
        ...


# Type hint for optional import
if False:  # TYPE_CHECKING
    from emery_agents.services.protocols import ModelProvider
