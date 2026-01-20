"""
Planning Context Service - curates context between planning phases.

Part of ACE (Agentic Context Engineering).

AIDEV-NOTE: This complements context_service.py (ExecutionContextService)
which handles execution phase. This service:
- Extracts insights from phase output using LLM
- Curates context between planning phases
- Manages token budget for context passing

Usage:
    planning_context_service = PlanningContextService(model_provider, org_model)
    planning_context = PlanningContext(overall_goal=instructions)

    # After each phase completes:
    planning_context = planning_context_service.curate_after_phase(
        planning_context=planning_context,
        phase_name="Schema",
        raw_context=result.context,
        raw_analysis=result.analysis,
    )

    # Before next phase:
    curated_context = planning_context.format_for_phase("App")
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from smolagents import Tool, ToolCallingAgent
from smolagents.monitoring import LogLevel

from ..models.planning_context import (
    PlanningContext,
    PlanningInsight,
    PlanningInsightType,
)
from emery_agents.services.protocols import ModelProvider
from emery_agents.prompts import render_template

logger = logging.getLogger(__name__)


class PlanningInsightTool(Tool):  # type: ignore[misc]
    """Tool for LLM to report planning insights extracted from phase output."""

    skip_forward_signature_validation = True
    name = "report_planning_insights"
    description = """Extract planning insights from phase output.

For each significant finding, create an insight with:
- type: One of "entity", "decision", "constraint", "dependency"
- summary: Brief description of the insight
- key_facts: List of key facts related to this insight

Types:
- entity: Found entity (table, app, field, skill)
- decision: Planning decision that affects other phases
- constraint: Limitation discovered
- dependency: Dependency between phases
"""
    inputs = {
        "insights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "description": "Type: entity, decision, constraint, or dependency",
                    },
                    "summary": {
                        "type": "string",
                        "description": "Brief description of the insight",
                    },
                    "key_facts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Key facts related to this insight",
                    },
                },
            },
            "description": "List of planning insights",
        }
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self._insights: List[Dict[str, Any]] = []

    def forward(self, insights: List[Dict[str, Any]]) -> str:
        """Capture the insights reported by the LLM."""
        self._insights = insights
        return f"Recorded {len(insights)} planning insights"

    def get_insights(self) -> List[Dict[str, Any]]:
        """Get the captured insights."""
        return self._insights


@dataclass
class PlanningContextService:
    """
    Curates context between planning phases using LLM.

    Extracts insights from raw phase output and adds them to the
    PlanningContext for use by subsequent phases.
    """
    model_provider: ModelProvider
    org_model: Optional[str] = None

    def curate_after_phase(
        self,
        planning_context: PlanningContext,
        phase_name: str,
        raw_context: str,
        raw_analysis: str,
    ) -> PlanningContext:
        """
        Curate context after a phase completes.

        Uses LLM to extract insights from raw context/analysis,
        then adds them to the planning context.

        Args:
            planning_context: Current planning context
            phase_name: Name of the phase that just completed
            raw_context: Raw context output from the phase
            raw_analysis: Raw analysis output from the phase

        Returns:
            Updated PlanningContext with new insights
        """
        # Skip curation if there's no content
        if not raw_context and not raw_analysis:
            logger.debug(f"No content to curate for phase: {phase_name}")
            planning_context.mark_phase_completed(phase_name)
            return planning_context

        # Extract insights via LLM
        new_insights = self._extract_insights(phase_name, raw_context, raw_analysis)

        # Add insights to context
        for insight in new_insights:
            planning_context.add_insight(insight)

        # Mark phase as completed
        planning_context.mark_phase_completed(phase_name)

        logger.info(
            f"Curated {len(new_insights)} insights from phase '{phase_name}'"
        )

        return planning_context

    def _extract_insights(
        self,
        phase_name: str,
        context: str,
        analysis: str,
    ) -> List[PlanningInsight]:
        """
        Use LLM to extract planning insights from phase output.

        Args:
            phase_name: Name of the phase
            context: Raw context from the phase
            analysis: Raw analysis from the phase

        Returns:
            List of PlanningInsight objects
        """
        model_id = self.model_provider.resolve_model_selection(org_model=self.org_model)
        model = self.model_provider.get_model(model_id=model_id)
        tool = PlanningInsightTool()

        prompt = render_template(
            "ace/planning_insight_extraction.j2",
            phase_name=phase_name,
            context=context,
            analysis=analysis,
        )

        try:
            agent = ToolCallingAgent(
                tools=[tool],
                model=model,
                max_steps=2,
                verbosity_level=LogLevel.OFF,
            )
            agent.run(task=prompt, reset=True)

            raw_insights = tool.get_insights()
            return self._convert_to_planning_insights(phase_name, raw_insights)

        except Exception as e:
            logger.warning(f"Failed to extract insights from phase '{phase_name}': {e}")
            return []

    def _convert_to_planning_insights(
        self,
        phase_name: str,
        raw_insights: List[Dict[str, Any]],
    ) -> List[PlanningInsight]:
        """Convert raw insight dicts to PlanningInsight objects."""
        insights = []
        for i, ins in enumerate(raw_insights):
            try:
                insight_type_str = ins.get("type", "entity").lower()
                # Map to valid enum value
                if insight_type_str not in ("entity", "decision", "constraint", "dependency"):
                    insight_type_str = "entity"

                # Type-safe key_facts extraction (LLM may return string instead of list)
                key_facts_raw = ins.get("key_facts", [])
                if isinstance(key_facts_raw, str):
                    key_facts_raw = [key_facts_raw]
                elif not isinstance(key_facts_raw, list):
                    key_facts_raw = []

                insights.append(
                    PlanningInsight(
                        insight_id=f"{phase_name}_{i}",
                        insight_type=PlanningInsightType(insight_type_str),
                        summary=ins.get("summary", ""),
                        key_facts=tuple(key_facts_raw),
                        source_phase=phase_name,
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to convert insight {i}: {e}")
                continue

        return insights
