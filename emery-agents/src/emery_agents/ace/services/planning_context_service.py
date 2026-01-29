"""
Planning Context Service - DSPy-based context curation between planning phases.

Part of ACE (Agentic Context Engineering).

Uses DSPy ChainOfThought with ExtractPlanningInsights signature.
"""

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import dspy


from emery_agents.ace.models.planning_context import PlanningContext, PlanningInsight, PlanningInsightType
from emery_agents.reasoning.signatures.evaluation import (
    ExtractPlanningInsights,
    PlanningInsightsResult,
)

logger = logging.getLogger(__name__)


class PlanningInsightExtractorModule(dspy.Module):
    """DSPy module for extracting planning insights from phase output."""

    def __init__(self) -> None:
        super().__init__()
        self.extractor = dspy.ChainOfThought(ExtractPlanningInsights)

    def forward(
        self,
        phase_name: str,
        context: str,
        analysis: str,
    ) -> PlanningInsightsResult:
        """Extract planning insights from phase output."""
        result = self.extractor(
            phase_name=phase_name,
            context=context,
            analysis=analysis,
        )
        return result.result


@dataclass
class PlanningContextService:
    """
    DSPy-based context curation between planning phases.

    Extracts insights from raw phase output and adds them to the
    PlanningContext for use by subsequent phases.
    """

    lm: Optional[dspy.LM] = None

    def __post_init__(self) -> None:
        self._module = PlanningInsightExtractorModule()

    def curate_after_phase(
        self,
        planning_context: PlanningContext,
        phase_name: str,
        raw_context: str,
        raw_analysis: str,
    ) -> PlanningContext:
        """
        Curate context after a phase completes.

        Uses DSPy to extract insights from raw context/analysis,
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

        # Extract insights via DSPy
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
        Use DSPy to extract planning insights from phase output.

        Args:
            phase_name: Name of the phase
            context: Raw context from the phase
            analysis: Raw analysis from the phase

        Returns:
            List of PlanningInsight objects
        """
        try:
            # Use provided LM or global settings
            if self.lm:
                with dspy.context(lm=self.lm):
                    result = self._module(
                        phase_name=phase_name,
                        context=context or "",
                        analysis=analysis or "",
                    )
            else:
                result = self._module(
                    phase_name=phase_name,
                    context=context or "",
                    analysis=analysis or "",
                )

            return self._convert_to_planning_insights(phase_name, result)

        except Exception as e:
            logger.warning(f"Failed to extract insights from phase '{phase_name}': {e}")
            return []

    def _convert_to_planning_insights(
        self,
        phase_name: str,
        result: PlanningInsightsResult,
    ) -> List[PlanningInsight]:
        """Convert DSPy result to PlanningInsight objects."""
        insights = []
        for i, ins in enumerate(result.insights):
            try:
                insight_type_str = ins.insight_type.lower()
                # Map to valid enum value
                if insight_type_str not in ("entity", "decision", "constraint", "dependency"):
                    insight_type_str = "entity"

                insights.append(
                    PlanningInsight(
                        insight_id=f"{phase_name}_{i}",
                        insight_type=PlanningInsightType(insight_type_str),
                        summary=ins.summary,
                        key_facts=tuple(ins.key_facts),
                        source_phase=phase_name,
                    )
                )
            except Exception as e:
                logger.warning(f"Failed to convert insight {i}: {e}")
                continue

        return insights
