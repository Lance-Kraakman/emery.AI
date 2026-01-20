"""
Execution Context Service

Curates step execution results into actionable insights (ACE pattern).
Source: PlanStepExecutor._step_results (NOT chat messages).

Used during EXECUTION to:
- Distill step results into actionable insights
- Provide token-efficient context to evaluator and subsequent steps
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from jinja2 import Environment, FileSystemLoader
from smolagents import Tool, ToolCallingAgent
from smolagents.monitoring import LogLevel

from ..models.execution_context import (
    ExecutionContext,
    ExecutionInsight,
    InsightType,
    StepResult,
    create_insight,
)
from emery_agents.services.protocols import ModelProvider

logger = logging.getLogger(__name__)

# Load Jinja environment for templates
_PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts" / "ace"
_jinja_env = Environment(loader=FileSystemLoader(str(_PROMPTS_DIR)))


class InsightExtractionTool(Tool):  # type: ignore[misc]
    """
    Tool for LLM to report extracted insights from step results.

    The curation LLM calls this tool with structured insights extracted
    from raw step execution results.
    """

    # Skip smolagents' forward signature validation
    skip_forward_signature_validation = True

    name = "report_insights"
    description = """Report insights extracted from step execution results.

For each significant finding in the step results, create an insight with:
- insight_type: One of DISCOVERY, DECISION, ARTIFACT, CONSTRAINT, ERROR_RECOVERY
- summary: 1-2 sentence actionable summary
- key_facts: List of bullet points with essential facts
- source_step_ids: List of step IDs this insight came from

Focus on ACTIONABLE insights that help future steps:
- DISCOVERY: Found something new (entity, pattern, relationship)
- DECISION: Made a choice affecting future steps
- ARTIFACT: Created something (record, field, table)
- CONSTRAINT: Learned a limitation or requirement
- ERROR_RECOVERY: How an error was resolved

Example:
{
    "insights": [
        {
            "insight_type": "DISCOVERY",
            "summary": "Found 3 existing customer tables with different schemas",
            "key_facts": ["customers table has email field", "legacy_customers missing phone", "customer_archive has full history"],
            "source_step_ids": ["step_1"]
        },
        {
            "insight_type": "DECISION",
            "summary": "Using customers table as primary source due to complete schema",
            "key_facts": ["customers table selected", "will migrate from legacy_customers"],
            "source_step_ids": ["step_1", "step_2"]
        }
    ]
}
"""

    inputs = {
        "insights": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "insight_type": {
                        "type": "string",
                        "description": "One of: DISCOVERY, DECISION, ARTIFACT, CONSTRAINT, ERROR_RECOVERY",
                    },
                    "summary": {
                        "type": "string",
                        "description": "1-2 sentence actionable summary",
                    },
                    "key_facts": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Bullet points of essential facts",
                    },
                    "source_step_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Step IDs that contributed to this insight",
                    },
                },
                "required": ["insight_type", "summary", "key_facts", "source_step_ids"],
            },
            "description": "List of extracted insights",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        super().__init__()
        self.captured_insights: List[Dict[str, Any]] = []

    def forward(self, insights: List[Dict[str, Any]]) -> str:
        """Capture the extracted insights."""
        self.captured_insights = insights
        count = len(insights)
        logger.info(f"📋 Extracted {count} insights from step results")

        # Log insight types for debugging
        types = [i.get("insight_type", "unknown") for i in insights]
        logger.info(f"   Insight types: {types}")

        return f"Recorded {count} insights: {', '.join(types)}"

    def get_insights(self) -> List[Dict[str, Any]]:
        """Retrieve captured insights."""
        return self.captured_insights


@dataclass
class ExecutionContextService:
    """
    Curates step execution results into actionable insights.

    Runs periodically during execution (every N steps) to distill
    raw step results into token-efficient insights.

    Part of the ACE (Agentic Context Engineering) pattern.
    """

    model_provider: ModelProvider
    org_model: Optional[str] = None
    curate_after_steps: int = 3

    def curate(
        self,
        execution_context: ExecutionContext,
        step_results: List[StepResult],
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

        # Extract new insights using LLM
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
        step_results: List[StepResult],
    ) -> List[ExecutionInsight]:
        """
        Use LLM to extract insights from step results.
        """
        if not step_results:
            return []

        # Prepare for LLM analysis
        results_for_analysis = {
            step.step_id: str(step.result) for step in step_results
        }
        step_ids = [step.step_id for step in step_results]

        return self._llm_extraction(results_for_analysis, step_ids)

    def _llm_extraction(
        self,
        results_for_analysis: Dict[str, str],
        step_ids: List[str],
    ) -> List[ExecutionInsight]:
        """
        Extract insights using LLM with InsightExtractionTool.
        """
        # Resolve model
        model_id = self.model_provider.resolve_model_selection(
            org_model=self.org_model
        )
        model = self.model_provider.get_model(model_id=model_id)

        # Create extraction tool
        extraction_tool = InsightExtractionTool()

        # Build prompt
        prompt = self._build_extraction_prompt(results_for_analysis)

        logger.info(f"📋 Running insight extraction...")

        # Run extractor agent (reset=True for clean context each invocation)
        extractor = ToolCallingAgent(
            tools=[extraction_tool],
            model=model,
            max_steps=2,
            verbosity_level=LogLevel.OFF,
        )
        extractor.run(task=prompt, reset=True)

        # Parse captured insights
        raw_insights = extraction_tool.get_insights()
        return self._parse_insights(raw_insights, step_ids)

    def _build_extraction_prompt(
        self,
        results_for_analysis: Dict[str, str],
    ) -> str:
        """Build prompt for insight extraction using Jinja template."""
        template = _jinja_env.get_template("insight_extraction.j2")
        return template.render(step_results=results_for_analysis)

    def _parse_insights(
        self,
        raw_insights: List[Dict[str, Any]],
        step_ids: List[str],
    ) -> List[ExecutionInsight]:
        """Parse raw insight dicts from LLM into ExecutionInsight objects."""
        insights: List[ExecutionInsight] = []

        # Map string to InsightType enum
        type_map = {t.value.upper(): t for t in InsightType}

        for raw in raw_insights:
            type_str = raw.get("insight_type", "discovery").upper()
            insight_type = type_map.get(type_str, InsightType.DISCOVERY)

            insight = create_insight(
                insight_type=insight_type,
                summary=raw.get("summary", ""),
                key_facts=raw.get("key_facts", []),
                source_step_ids=raw.get("source_step_ids", step_ids),
            )
            insights.append(insight)

        return insights


def create_execution_context_service(
    model_provider: ModelProvider,
    org_model: Optional[str] = None,
    curate_after_steps: int = 3,
) -> ExecutionContextService:
    """
    Factory function to create ExecutionContextService.

    Args:
        model_provider: Provider for LLM access
        org_model: Organization model ID for model resolution
        curate_after_steps: Number of steps between curation runs

    Returns:
        Configured ExecutionContextService
    """
    return ExecutionContextService(
        model_provider=model_provider,
        org_model=org_model,
        curate_after_steps=curate_after_steps,
    )
 