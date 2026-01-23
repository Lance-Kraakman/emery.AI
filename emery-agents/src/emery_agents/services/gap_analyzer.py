"""
Gap Analyzer Service

Analyzes user requests against domain concerns to identify what's clear
vs. what needs clarification.

AIDEV-NOTE: This runs BEFORE planning. It checks each domain concern
against the user's request + gathered context, and only generates
questions for genuine gaps - not for things already specified.
"""

import json
import logging
import re
from typing import Any, Dict, List, Optional

from smolagents import ToolCallingAgent

from ..models.domain_concerns import (
    ConcernGap,
    DomainConcern,
    GapAnalysisResult,
    get_concerns_for_agent,
)
from ..prompts import render_template
from .protocols import ModelProvider

logger = logging.getLogger(__name__)


class GapAnalysisTool:
    """
    Tool for LLM to report gap analysis results.

    The analyzer LLM calls this tool with structured analysis of each concern.
    """

    name = "report_gap_analysis"
    description = """Report the results of analyzing domain concerns.

For each concern, report whether it's CLEAR or UNCLEAR from the context.
If UNCLEAR, provide a suggested question to ask the user.

Call this tool with:
- clear_concerns: List of concern IDs that are clearly addressed
- gaps: List of gaps needing questions, each with:
  - concern_id: ID of the unclear concern
  - context_found: What (if anything) was found in context
  - reason_unclear: Why it's still unclear
  - suggested_question: Question to ask the user
  - suggested_options: Optional list of answer options
- context_summary: Brief summary of what you understood from the request
"""

    inputs = {
        "clear_concerns": {
            "type": "array",
            "items": {"type": "string"},
            "description": "IDs of concerns that are clearly addressed",
        },
        "gaps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "concern_id": {"type": "string"},
                    "context_found": {"type": "string"},
                    "reason_unclear": {"type": "string"},
                    "suggested_question": {"type": "string"},
                    "suggested_options": {
                        "type": "array",
                        "items": {"type": "string"},
                        "nullable": True,
                    },
                },
                "required": ["concern_id", "reason_unclear", "suggested_question"],
            },
            "description": "List of unclear concerns needing questions",
        },
        "context_summary": {
            "type": "string",
            "description": "Brief summary of what you understood from the request",
        },
    }
    output_type = "string"

    def __init__(self) -> None:
        self.captured_result: Optional[Dict[str, Any]] = None

    def forward(
        self,
        clear_concerns: List[str],
        gaps: List[Dict[str, Any]],
        context_summary: str,
    ) -> str:
        """Capture the gap analysis result."""
        self.captured_result = {
            "clear_concerns": clear_concerns,
            "gaps": gaps,
            "context_summary": context_summary,
        }
        gap_count = len(gaps)
        clear_count = len(clear_concerns)
        logger.info(f"📋 Gap analysis: {clear_count} clear, {gap_count} gaps")
        return f"Analysis recorded: {clear_count} clear, {gap_count} gaps"

    def get_result(self) -> Optional[Dict[str, Any]]:
        """Retrieve captured result."""
        return self.captured_result


class GapAnalyzer:
    """
    Analyzes user requests against domain concerns.

    Uses an LLM to intelligently check which concerns are already
    addressed by the user's request and which need clarification.
    """

    def __init__(
        self,
        model_provider: Optional[ModelProvider] = None,
        org_model: Optional[str] = None,
    ):
        """
        Initialize gap analyzer.

        Args:
            model_provider: Provider for LLM access
            org_model: Organization model ID for model resolution
        """
        self.model_provider = model_provider
        self.org_model = org_model

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

        # Require model provider - no heuristic fallback
        if not self.model_provider:
            raise ValueError(
                "GapAnalyzer requires model_provider for LLM-based analysis. "
                "Heuristic fallback has been removed."
            )

        # Use LLM for intelligent gap analysis
        return self._llm_analysis(
            agent_name, user_request, gathered_context, concerns
        )

    def _llm_analysis(
        self,
        agent_name: str,
        user_request: str,
        gathered_context: Optional[str],
        concerns: List[DomainConcern],
    ) -> GapAnalysisResult:
        """
        Use LLM to analyze concerns against request.

        The LLM reads the request and context, then for each concern
        determines if it's clear or needs a question.
        """
        # Resolve model (model_provider guaranteed non-None by caller)
        assert self.model_provider is not None
        model_id = self.model_provider.resolve_model_selection(org_model=self.org_model)
        model = self.model_provider.get_model(model_id=model_id)

        # Create analysis tool
        analysis_tool = GapAnalysisTool()

        # Build prompt
        prompt = self._build_analysis_prompt(
            agent_name, user_request, gathered_context, concerns
        )

        logger.info(f"📋 Running gap analysis for {agent_name}...")

        try:
            # Run analyzer agent
            analyzer = ToolCallingAgent(
                tools=[analysis_tool],
                model=model,
                max_steps=2,
            )
            analyzer.run(prompt)

            # Get captured result
            result = analysis_tool.get_result()
            if result:
                return self._parse_analysis_result(agent_name, result, concerns)

        except Exception as e:
            logger.error(f"Gap analysis failed: {e}")
            raise

        # If tool wasn't called, raise an error
        raise ValueError(
            "GapAnalyzer LLM did not call the gap_analysis tool. "
            "This indicates an issue with the prompt or model."
        )

    def _build_analysis_prompt(
        self,
        agent_name: str,
        user_request: str,
        gathered_context: Optional[str],
        concerns: List[DomainConcern],
    ) -> str:
        """Build prompt for gap analysis using J2 template."""
        return render_template(
            "planning/gap_analysis.j2",
            agent_name=agent_name,
            user_request=user_request,
            gathered_context=gathered_context,
            concerns=concerns,
        )

    def _parse_analysis_result(
        self,
        agent_name: str,
        result: Dict[str, Any],
        concerns: List[DomainConcern],
    ) -> GapAnalysisResult:
        """Parse LLM analysis result into GapAnalysisResult."""
        # Build concern lookup
        concern_map = {c.id: c for c in concerns}

        # Parse clear concerns
        clear_concerns = result.get("clear_concerns", [])

        # Parse gaps
        gaps: List[ConcernGap] = []
        for gap_data in result.get("gaps", []):
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

        return GapAnalysisResult(
            agent_name=agent_name,
            clear_concerns=clear_concerns,
            gaps=gaps,
            context_summary=result.get("context_summary", ""),
        )

class GapAnalyzerFactory:
    """Factory for creating GapAnalyzer instances."""

    def __init__(
        self,
        model_provider: Optional[ModelProvider] = None,
        org_model: Optional[str] = None,
    ):
        self.model_provider = model_provider
        self.org_model = org_model

    def create(self) -> GapAnalyzer:
        """Create a GapAnalyzer instance."""
        return GapAnalyzer(
            model_provider=self.model_provider,
            org_model=self.org_model,
        )
