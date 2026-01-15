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

        # If no model provider, use simple heuristic analysis
        if not self.model_provider:
            logger.warning("No model_provider - using heuristic gap analysis")
            return self._heuristic_analysis(agent_name, user_request, concerns)

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

        # Fallback to heuristic if LLM fails
        return self._heuristic_analysis(agent_name, user_request, concerns)

    def _build_analysis_prompt(
        self,
        agent_name: str,
        user_request: str,
        gathered_context: Optional[str],
        concerns: List[DomainConcern],
    ) -> str:
        """Build prompt for gap analysis."""
        # Format concerns for the prompt
        concerns_text = "\n".join([
            f"- **{c.id}** ({c.category}): {c.description}\n"
            f"  Check: {c.check_prompt}\n"
            f"  Question template: {c.question_template}\n"
            f"  Required: {'Yes' if c.required else 'No'}"
            for c in concerns
        ])

        context_section = ""
        if gathered_context:
            context_section = f"""
## Gathered Context
{gathered_context}
"""

        return f"""Analyze the user's request to determine what information is clear vs. what needs clarification.

## User Request
{user_request}
{context_section}

## Domain Concerns for {agent_name}
These are the things this agent needs to know to do its job:

{concerns_text}

## Instructions

For EACH concern above:
1. Check if the user's request clearly addresses it
2. If CLEAR: Add the concern ID to clear_concerns
3. If UNCLEAR: Add to gaps with:
   - The concern_id
   - What context you found (if any)
   - Why it's still unclear
   - A specific question to ask (use the template but make it specific to this request)
   - Optional answer options if applicable

Be CONSERVATIVE - only mark as unclear if truly ambiguous.
If the user gave specific details, respect them as clear.

Call the report_gap_analysis tool with your analysis.
"""

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

    def _heuristic_analysis(
        self,
        agent_name: str,
        user_request: str,
        concerns: List[DomainConcern],
    ) -> GapAnalysisResult:
        """
        Simple heuristic-based gap analysis.

        Fallback when LLM is not available. Uses keyword matching
        to estimate what's clear vs unclear.
        """
        request_lower = user_request.lower()
        clear_concerns: List[str] = []
        gaps: List[ConcernGap] = []

        # Simple keyword matching per concern category
        category_keywords = {
            "structure": ["table", "entity", "create", "add"],
            "fields": ["field", "column", "attribute", "property", "with"],
            "relationships": ["relate", "link", "connect", "reference", "foreign"],
            "workflow": ["step", "process", "when", "trigger", "then"],
            "purpose": ["for", "to", "goal", "purpose", "need"],
            "data": ["data", "input", "from", "source"],
        }

        for concern in concerns:
            # Check if keywords for this category appear in request
            keywords = category_keywords.get(concern.category, [])
            has_keywords = any(kw in request_lower for kw in keywords)

            # If request is long and has relevant keywords, assume clearer
            is_detailed = len(user_request) > 100

            if has_keywords and is_detailed:
                clear_concerns.append(concern.id)
            elif concern.required:
                # Required concerns without clear keywords -> gap
                gaps.append(ConcernGap(
                    concern=concern,
                    context_found="",
                    reason_unclear="Could not determine from request",
                    suggested_question=concern.question_template,
                    suggested_options=None,
                ))

        return GapAnalysisResult(
            agent_name=agent_name,
            clear_concerns=clear_concerns,
            gaps=gaps,
            context_summary="Heuristic analysis (no LLM available)",
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
