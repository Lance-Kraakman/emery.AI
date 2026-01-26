"""
Gap Analyzer Service - DSPy-based gap analysis.

Analyzes user requests against domain concerns to identify what's clear
vs. what needs clarification. Uses DSPy ChainOfThought with AnalyzeGaps signature.
"""

import json
import logging
from typing import Any, Dict, List, Optional

import dspy

from ..dspy_modules.signatures.planning import AnalyzeGaps, GapAnalysisResultModel
from ..models.domain_concerns import (
    ConcernGap,
    DomainConcern,
    GapAnalysisResult,
    get_concerns_for_agent,
)

logger = logging.getLogger(__name__)


class GapAnalyzerModule(dspy.Module):
    """DSPy module for gap analysis."""

    def __init__(self) -> None:
        super().__init__()
        self.analyzer = dspy.ChainOfThought(AnalyzeGaps)

    def forward(
        self,
        agent_name: str,
        user_request: str,
        gathered_context: str,
        concerns_json: str,
    ) -> GapAnalysisResultModel:
        """Analyze gaps between request and domain concerns."""
        result = self.analyzer(
            agent_name=agent_name,
            user_request=user_request,
            gathered_context=gathered_context,
            concerns_json=concerns_json,
        )
        return result.analysis


class GapAnalyzer:
    """
    DSPy-based gap analysis for user requests.

    Analyzes requests against domain concerns to identify what's clear
    vs. what needs clarification. Uses ChainOfThought with AnalyzeGaps signature.
    """

    def __init__(
        self,
        lm: Optional[dspy.LM] = None,
        org_model: Optional[str] = None,
    ):
        """
        Initialize gap analyzer.

        Args:
            lm: DSPy language model (uses global settings if not provided)
            org_model: Organization model ID for model resolution
        """
        self.lm = lm
        self.org_model = org_model
        self._module = GapAnalyzerModule()

    def analyze(
        self,
        agent_name: str,
        user_request: str,
        gathered_context: Optional[str] = None,
    ) -> GapAnalysisResult:
        """
        Analyze user request against domain concerns.

        Args:
            agent_name: Name of agent (e.g., "schema_builder")
            user_request: The user's original request
            gathered_context: Any additional context gathered (e.g., existing tables)

        Returns:
            GapAnalysisResult with clear concerns and gaps
        """
        concerns = get_concerns_for_agent(agent_name)
        if not concerns:
            logger.warning(f"No domain concerns defined for agent: {agent_name}")
            return GapAnalysisResult(agent_name=agent_name)

        # Serialize concerns to JSON for the signature
        concerns_data = [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "question_template": c.question_template,
                "required": c.required,
            }
            for c in concerns
        ]
        concerns_json = json.dumps(concerns_data)

        context_str = gathered_context or "No additional context available."

        logger.info(f"📋 Running gap analysis for {agent_name}...")

        try:
            # Use provided LM or global settings
            if self.lm:
                with dspy.context(lm=self.lm):
                    result = self._module(
                        agent_name=agent_name,
                        user_request=user_request,
                        gathered_context=context_str,
                        concerns_json=concerns_json,
                    )
            else:
                result = self._module(
                    agent_name=agent_name,
                    user_request=user_request,
                    gathered_context=context_str,
                    concerns_json=concerns_json,
                )

            return self._parse_analysis_result(agent_name, result, concerns)

        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            raise

    def _parse_analysis_result(
        self,
        agent_name: str,
        result: GapAnalysisResultModel,
        concerns: List[DomainConcern],
    ) -> GapAnalysisResult:
        """Parse DSPy analysis result into GapAnalysisResult."""
        # Build concern lookup
        concern_map = {c.id: c for c in concerns}

        # Parse clear concerns
        clear_concerns = result.clear_concerns

        # Parse gaps
        gaps: List[ConcernGap] = []
        for gap_data in result.gaps:
            concern_id = gap_data.get("concern_id", "")
            concern = concern_map.get(concern_id)
            if concern:
                gaps.append(ConcernGap(
                    concern=concern,
                    context_found=gap_data.get("context_found", ""),
                    reason_unclear=gap_data.get("reason_unclear", ""),
                    suggested_question=gap_data.get("suggested_question", ""),
                    suggested_options=gap_data.get("suggested_options"),
                ))

        logger.info(f"✅ Gap analysis: {len(clear_concerns)} clear, {len(gaps)} gaps")

        return GapAnalysisResult(
            agent_name=agent_name,
            clear_concerns=clear_concerns,
            gaps=gaps,
            context_summary=result.context_summary,
        )


class GapAnalyzerFactory:
    """Factory for creating GapAnalyzer instances."""

    def __init__(
        self,
        lm: Optional[dspy.LM] = None,
        org_model: Optional[str] = None,
    ):
        self.lm = lm
        self.org_model = org_model

    def create(self) -> GapAnalyzer:
        """Create a GapAnalyzer instance."""
        return GapAnalyzer(
            lm=self.lm,
            org_model=self.org_model,
        )
