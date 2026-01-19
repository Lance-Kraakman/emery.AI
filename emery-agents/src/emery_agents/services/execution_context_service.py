"""
Execution Context Service

Curates step execution results into actionable insights (ACE-inspired pattern).
Source: PlanStepExecutor._step_results (NOT chat messages).

Used during EXECUTION to:
- Distill step results into actionable insights
- Archive raw results for recovery
- Provide token-efficient context to evaluator and subsequent steps
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from smolagents import Tool, ToolCallingAgent
from smolagents.monitoring import LogLevel

from ..models.execution_context import (
    ExecutionContext,
    ExecutionInsight,
    InsightType,
    create_insight,
)
from .protocols import ModelProvider

logger = logging.getLogger(__name__)


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
        raw_step_results: Dict[str, Any],
        recent_step_ids: List[str],
    ) -> ExecutionContext:
        """
        Curate recent step results into insights.

        Args:
            execution_context: Current execution context to update
            raw_step_results: Raw results from PlanStepExecutor._step_results
            recent_step_ids: Step IDs to process (steps since last curation)

        Returns:
            Updated ExecutionContext with new insights
        """
        if not recent_step_ids:
            logger.info("📋 No new steps to curate")
            return execution_context

        logger.info(f"📋 Curating {len(recent_step_ids)} steps...")

        # 1. Archive raw results (full backup for recovery)
        for step_id in recent_step_ids:
            if step_id in raw_step_results:
                execution_context.archive_raw_result(
                    step_id, raw_step_results[step_id]
                )

        # 2. Decay existing insights (older = less relevant)
        execution_context.decay_all_relevance(factor=0.9)

        # 3. Extract new insights using LLM
        new_insights = self._extract_insights(raw_step_results, recent_step_ids)

        # 4. Add insights (with merging of similar)
        for insight in new_insights:
            execution_context.add_insight(insight)

        # 5. Update curation metadata
        execution_context.last_curation_at = datetime.utcnow()
        execution_context.curation_count += 1

        logger.info(
            f"✅ Curation complete: {len(new_insights)} new insights, "
            f"{len(execution_context.insights)} total"
        )

        return execution_context

    def _extract_insights(
        self,
        raw_step_results: Dict[str, Any],
        step_ids: List[str],
    ) -> List[ExecutionInsight]:
        """
        Use LLM to extract insights from step results.

        Falls back to heuristic extraction if LLM unavailable.
        """
        # Prepare step results for analysis
        results_for_analysis = {}
        for step_id in step_ids:
            if step_id in raw_step_results:
                result = raw_step_results[step_id]
                # Truncate large results
                result_str = str(result)
                if len(result_str) > 2000:
                    result_str = result_str[:2000] + "... [truncated]"
                results_for_analysis[step_id] = result_str

        if not results_for_analysis:
            return []

        # Try LLM extraction
        try:
            return self._llm_extraction(results_for_analysis, step_ids)
        except Exception as e:
            logger.warning(f"LLM extraction failed: {e}, using heuristic")
            return self._heuristic_extraction(results_for_analysis, step_ids)

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

        # Run extractor agent
        extractor = ToolCallingAgent(
            tools=[extraction_tool],
            model=model,
            max_steps=2,
            verbosity_level=LogLevel.OFF,
        )
        extractor.run(prompt)

        # Parse captured insights
        raw_insights = extraction_tool.get_insights()
        return self._parse_insights(raw_insights, step_ids)

    def _build_extraction_prompt(
        self,
        results_for_analysis: Dict[str, str],
    ) -> str:
        """Build prompt for insight extraction."""
        results_text = "\n\n".join([
            f"### Step {step_id}\n```\n{result}\n```"
            for step_id, result in results_for_analysis.items()
        ])

        return f"""Analyze these step execution results and extract actionable insights.

## Step Results
{results_text}

## Instructions

Extract insights that will help future steps succeed:
1. **DISCOVERY**: Found something new (table, field, pattern, entity)
2. **DECISION**: Made a choice that affects later steps
3. **ARTIFACT**: Created something (new record, table, field)
4. **CONSTRAINT**: Learned a limitation (permission, schema requirement)
5. **ERROR_RECOVERY**: How an error was resolved

Focus on ACTIONABLE information:
- What was found that future steps need to know?
- What decisions were made that constrain options?
- What was created that other steps can reference?
- What limitations were discovered?

Be CONCISE - each insight should be 1-2 sentences with key facts.
Skip minor details - only capture what matters for task completion.

Call the report_insights tool with your extracted insights.
"""

    def _parse_insights(
        self,
        raw_insights: List[Dict[str, Any]],
        step_ids: List[str],
    ) -> List[ExecutionInsight]:
        """Parse raw insight dicts into ExecutionInsight objects."""
        insights: List[ExecutionInsight] = []

        for raw in raw_insights:
            try:
                # Parse insight type
                type_str = raw.get("insight_type", "DISCOVERY").upper()
                try:
                    insight_type = InsightType[type_str]
                except KeyError:
                    insight_type = InsightType.DISCOVERY

                # Get source steps (default to all analyzed if not specified)
                source_steps = raw.get("source_step_ids", step_ids)

                insight = create_insight(
                    insight_type=insight_type,
                    summary=raw.get("summary", ""),
                    key_facts=raw.get("key_facts", []),
                    source_step_ids=source_steps,
                )
                insights.append(insight)

            except Exception as e:
                logger.warning(f"Failed to parse insight: {e}")
                continue

        return insights

    def _heuristic_extraction(
        self,
        results_for_analysis: Dict[str, str],
        step_ids: List[str],
    ) -> List[ExecutionInsight]:
        """
        Simple heuristic-based insight extraction.

        Fallback when LLM is not available. Looks for keywords
        to identify insight types.
        """
        insights: List[ExecutionInsight] = []

        # Keywords indicating different insight types
        discovery_keywords = ["found", "discovered", "exists", "detected", "identified"]
        decision_keywords = ["selected", "chose", "decided", "using", "picked"]
        artifact_keywords = ["created", "added", "inserted", "made", "built"]
        constraint_keywords = ["cannot", "must", "required", "limit", "error", "failed"]
        error_keywords = ["fixed", "resolved", "recovered", "retry", "workaround"]

        for step_id, result in results_for_analysis.items():
            result_lower = result.lower()

            # Check for each type
            if any(kw in result_lower for kw in error_keywords):
                insights.append(create_insight(
                    insight_type=InsightType.ERROR_RECOVERY,
                    summary=f"Step {step_id}: {result[:100]}...",
                    key_facts=[result[:200]],
                    source_step_ids=[step_id],
                ))
            elif any(kw in result_lower for kw in constraint_keywords):
                insights.append(create_insight(
                    insight_type=InsightType.CONSTRAINT,
                    summary=f"Step {step_id}: {result[:100]}...",
                    key_facts=[result[:200]],
                    source_step_ids=[step_id],
                ))
            elif any(kw in result_lower for kw in artifact_keywords):
                insights.append(create_insight(
                    insight_type=InsightType.ARTIFACT,
                    summary=f"Step {step_id}: {result[:100]}...",
                    key_facts=[result[:200]],
                    source_step_ids=[step_id],
                ))
            elif any(kw in result_lower for kw in decision_keywords):
                insights.append(create_insight(
                    insight_type=InsightType.DECISION,
                    summary=f"Step {step_id}: {result[:100]}...",
                    key_facts=[result[:200]],
                    source_step_ids=[step_id],
                ))
            elif any(kw in result_lower for kw in discovery_keywords):
                insights.append(create_insight(
                    insight_type=InsightType.DISCOVERY,
                    summary=f"Step {step_id}: {result[:100]}...",
                    key_facts=[result[:200]],
                    source_step_ids=[step_id],
                ))
            else:
                # Default to discovery for any non-empty result
                if result.strip():
                    insights.append(create_insight(
                        insight_type=InsightType.DISCOVERY,
                        summary=f"Step {step_id} completed",
                        key_facts=[result[:200]],
                        source_step_ids=[step_id],
                    ))

        logger.info(f"📋 Heuristic extraction: {len(insights)} insights")
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
