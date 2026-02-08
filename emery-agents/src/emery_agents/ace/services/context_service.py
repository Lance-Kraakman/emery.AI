"""
Execution Context Service - DSPy-based step result curation.

Curates step execution results into actionable insights (ACE pattern).

Uses DSPy ChainOfThought with ExtractExecutionInsights signature.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime

import dspy

from emery_agents.ace.models.execution_context import (
    ExecutionContext,
    ExecutionInsight,
    InsightType,
    StepResult,
    create_insight,
)
from emery_agents.reasoning.signatures.evaluation import (
    ExecutionInsightsResult,
    ExtractExecutionInsights,
)
from emery_agents.services.protocols import ModelProviderProtocol

logger = logging.getLogger(__name__)


class InsightExtractionModule(dspy.Module):
    """DSPy module for extracting execution insights from step results."""

    def __init__(self) -> None:
        super().__init__()
        self.extractor = dspy.ChainOfThought(ExtractExecutionInsights)

    def forward(self, step_results_json: str) -> ExecutionInsightsResult:
        """Extract insights from step execution results."""
        result = self.extractor(step_results_json=step_results_json)
        return result.result


@dataclass
class ExecutionContextService:
    """
    DSPy-based step result curation into actionable insights.

    Runs periodically during execution (every N steps) to distill
    raw step results into token-efficient insights.

    Part of the ACE (Agentic Context Engineering) pattern.
    """

    lm: dspy.LM | None = None
    curate_after_steps: int = 3
    model_provider: ModelProviderProtocol | None = None
    org_model: str | None = None

    def __post_init__(self) -> None:
        self._module = InsightExtractionModule()

    def curate(
        self,
        execution_context: ExecutionContext,
        step_results: list[StepResult],
    ) -> ExecutionContext:
        """
        Curate step results into insights.

        Args:
            execution_context: Current execution context to update
            step_results: Results from completed steps to process

        Returns:
            Updated ExecutionContext with new insights
        """
        if not step_results:
            logger.info("📋 No new steps to curate")
            return execution_context

        logger.info(f"📋 Curating {len(step_results)} steps...")

        # Decay existing insights (older = less relevant)
        execution_context.decay_all_relevance(factor=0.9)

        # Extract new insights using DSPy
        new_insights = self._extract_insights(step_results)

        # Add insights
        for insight in new_insights:
            execution_context.add_insight(insight)

        # Update curation metadata
        execution_context.last_curation_at = datetime.utcnow()
        execution_context.curation_count += 1

        logger.info(
            f"✅ Curation complete: {len(new_insights)} new insights, "
            f"{len(execution_context.insights)} total"
        )

        return execution_context

    def _extract_insights(
        self,
        step_results: list[StepResult],
    ) -> list[ExecutionInsight]:
        """
        Use DSPy to extract insights from step results.
        """
        if not step_results:
            return []

        # Prepare step results as JSON for the signature
        results_data = {step.step_id: str(step.result) for step in step_results}
        step_ids = [step.step_id for step in step_results]
        results_json = json.dumps(results_data)

        try:
            # Use provided LM or global settings
            if self.lm:
                with dspy.context(lm=self.lm):
                    result = self._module(step_results_json=results_json)
            else:
                result = self._module(step_results_json=results_json)

            return self._parse_insights(result, step_ids)

        except Exception as e:
            logger.error(f"Insight extraction failed: {e}")
            return []

    def _parse_insights(
        self,
        result: ExecutionInsightsResult,
        step_ids: list[str],
    ) -> list[ExecutionInsight]:
        """Parse DSPy result into ExecutionInsight objects."""
        insights: list[ExecutionInsight] = []

        # Map string to InsightType enum
        type_map = {t.value.upper(): t for t in InsightType}

        for raw in result.insights:
            type_str = raw.insight_type.upper()
            insight_type = type_map.get(type_str, InsightType.DISCOVERY)

            insight = create_insight(
                insight_type=insight_type,
                summary=raw.summary,
                key_facts=raw.key_facts,
                source_step_ids=raw.source_step_ids or step_ids,
            )
            insights.append(insight)

        logger.info(f"📋 Extracted {len(insights)} insights from step results")
        return insights


def create_execution_context_service(
    lm: dspy.LM | None = None,
    curate_after_steps: int = 3,
    model_provider: ModelProviderProtocol | None = None,
    org_model: str | None = None,
) -> ExecutionContextService:
    """
    Factory function to create ExecutionContextService.

    Args:
        lm: DSPy language model (uses global settings if not provided)
        curate_after_steps: Number of steps between curation runs
        model_provider: Model provider for LM resolution
        org_model: Organization model ID

    Returns:
        Configured ExecutionContextService
    """
    return ExecutionContextService(
        lm=lm,
        curate_after_steps=curate_after_steps,
        model_provider=model_provider,
        org_model=org_model,
    )
