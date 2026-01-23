"""
Planner Classifier

LLM-based classification of requests into planning domains.
Determines which domain planners should handle a request.

AIDEV-NOTE: This is like TaskClassifier but for planning domains.
It analyzes the request and identifies which domains are needed.
All classification is LLM-driven - no static keyword fallback.
"""

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from smolagents import ToolCallingAgent, Tool

from emery_agents.prompts import render_template
from emery_agents.utils.session_logger import get_session_logger

logger = logging.getLogger(__name__)


@dataclass
class DomainClassification:
    """
    Result of classifying a request into planning domains.

    Includes specific goals for each phase (Planning meta-phase output).
    """
    domains: List[str]  # ["schema", "app", "automation"]
    primary_domain: str  # The main domain
    confidence: float  # 0.0-1.0
    reasoning: str = ""
    phase_goals: Dict[str, str] = field(default_factory=dict)  # {"Schema": "Create...", "App": "Build..."}


class ClassificationOutputTool(Tool):  # type: ignore[misc]
    """Tool for LLM to output domain classification."""

    skip_forward_signature_validation = True

    name = "classify_domains"
    description = """Classify the request into planning domains.

Analyze the request and identify which domains are needed:
- schema: databases, tables, fields, relations, data modeling
- app: apps, pages, visual components, forms, dashboards, data binding
- automation: agents, skills, triggers, workflows, scheduled tasks

Return your classification with reasoning.
"""

    inputs = {
        "domains": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of domains needed (e.g., ['schema', 'app'])",
        },
        "primary": {
            "type": "string",
            "description": "The primary/main domain",
        },
        "confidence": {
            "type": "number",
            "description": "Confidence score 0.0-1.0",
        },
        "reasoning": {
            "type": "string",
            "description": "Brief explanation of the classification",
        },
        "phase_goals": {
            "type": "object",
            "description": "Specific goal for each domain phase (e.g., {'Schema': 'Create customers table...', 'App': 'Build CRM dashboard...'})",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self.result: Optional[DomainClassification] = None

    def forward(
        self,
        domains: List[str],
        primary: str,
        confidence: float,
        reasoning: str,
        phase_goals: Optional[Dict[str, str]] = None,
    ) -> str:
        """Capture the classification with phase goals."""
        self.result = DomainClassification(
            domains=domains,
            primary_domain=primary,
            confidence=confidence,
            reasoning=reasoning,
            phase_goals=phase_goals or {},
        )
        goals_str = f" with goals for {list(phase_goals.keys())}" if phase_goals else ""
        logger.info(f"📋 Classified request: {domains} (primary: {primary}, conf: {confidence:.0%}){goals_str}")
        return f"Classified as {domains} with {confidence:.0%} confidence{goals_str}"


class PlannerClassifier:
    """
    Uses LLM to classify requests into planning domains.

    Determines which domain planners (schema, app, automation) should
    handle a given request. Requires model_provider - no static fallback.
    """

    # Valid domains (direct is for pure LLM tasks without platform operations)
    VALID_DOMAINS = {"schema", "app", "automation", "direct"}

    def __init__(self, model_provider: Optional[Any] = None):
        """
        Initialize classifier.

        Args:
            model_provider: Model provider for LLM access (required for classify)
        """
        self.model_provider = model_provider

    async def classify(
        self,
        instructions: str,
        org_model: Optional[str] = None,
        strategy_guidance: Optional[str] = None,
        recent_tool_results: Optional[List[Dict[str, str]]] = None,
    ) -> DomainClassification:
        """
        Classify a request into planning domains using LLM.

        Args:
            instructions: The user's instructions
            org_model: Optional organization model ID
            strategy_guidance: ACE - Proven patterns from past executions
            recent_tool_results: ACE - Recent context from conversation

        Returns:
            DomainClassification with domains and confidence

        Raises:
            ValueError: If no model_provider is available
        """
        if not self.model_provider:
            raise ValueError("PlannerClassifier requires model_provider for LLM-based classification")

        # Session logging for flow tracking
        session_logger = get_session_logger()
        if session_logger:
            session_logger.log_event("domain_classification_started", {
                "instructions_preview": instructions[:200],
                "has_strategy_guidance": bool(strategy_guidance),
                "has_recent_tool_results": bool(recent_tool_results),
            })

        model_id = self.model_provider.resolve_model_selection(org_model=org_model)
        model = self.model_provider.get_model(model_id=model_id)

        classification_tool = ClassificationOutputTool()

        # Build prompt using Jinja2 template
        prompt = render_template(
            "planning/domain_classifier.j2",
            instructions=instructions,
            strategy_guidance=strategy_guidance,
            recent_tool_results=recent_tool_results,
        )

        # Log full prompt for debugging
        if session_logger:
            session_logger.log_full_content(
                content_type="prompt",
                name="domain_classifier",
                content=prompt,
                metadata={"instructions_preview": instructions[:100]},
            )

        classifier = ToolCallingAgent(
            tools=[classification_tool],
            model=model,
            max_steps=2,
        )
        classifier.run(prompt)

        if classification_tool.result:
            # Validate domains - fail fast if LLM returned invalid domains
            result = classification_tool.result
            valid_domains = [d for d in result.domains if d in self.VALID_DOMAINS]
            invalid_domains = [d for d in result.domains if d not in self.VALID_DOMAINS]

            if not valid_domains:
                raise ValueError(
                    f"LLM returned no valid domains. Got: {result.domains}. "
                    f"Valid domains are: {self.VALID_DOMAINS}"
                )

            if invalid_domains:
                logger.warning(
                    f"LLM returned invalid domains that were filtered: {invalid_domains}. "
                    f"Continuing with valid domains: {valid_domains}"
                )

            if result.primary_domain not in self.VALID_DOMAINS:
                raise ValueError(
                    f"LLM returned invalid primary_domain: '{result.primary_domain}'. "
                    f"Valid domains are: {self.VALID_DOMAINS}"
                )

            # Normalize phase_goals keys to Title Case (LLM may return lowercase)
            # planner_router.py expects "Schema", "App", etc. but LLM may return "schema", "app"
            normalized_goals = {k.title(): v for k, v in result.phase_goals.items()}

            classification = DomainClassification(
                domains=valid_domains,
                primary_domain=result.primary_domain,
                confidence=result.confidence,
                reasoning=result.reasoning,
                phase_goals=normalized_goals,
            )

            # Log classification result
            if session_logger:
                session_logger.log_event("domain_classification_result", {
                    "domains": classification.domains,
                    "primary_domain": classification.primary_domain,
                    "confidence": classification.confidence,
                    "phase_goals": classification.phase_goals,
                    "reasoning_preview": classification.reasoning[:200] if classification.reasoning else None,
                })

            return classification

        # Tool not called - this is an error, not a fallback scenario
        raise ValueError("Classification LLM did not call the classify_domains tool")
