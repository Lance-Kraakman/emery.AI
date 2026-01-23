"""
Task Classifier - LLM-based task classification for routing decisions.

AIDEV-NOTE: Replaces brittle string-matching patterns with intelligent LLM-based
classification. Uses the proven tool-based structured output pattern (like
EvaluatorAgent and GapAnalyzer) for reliable results.

The classifier determines:
1. Execution mode: DIRECT (simple) or PLAN_AND_APPROVE (complex)
2. Whether clarification questions should be asked first

NOTE: This does NOT route to specific agents - that's handled by capability
discovery in the chat planner.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, List, Optional

from smolagents import ToolCallingAgent

from .protocols import ModelProvider
from ..prompts import render_template
from ..tools.task_classifier_tool import TaskClassifierTool
from ..utils.session_logger import get_session_logger

logger = logging.getLogger(__name__)


@dataclass
class TaskClassification:
    """Result of task classification."""

    mode: str  # "DIRECT" or "PLAN_AND_APPROVE"
    needs_clarification: bool
    clarification_questions: List[str] = field(default_factory=list)
    reasoning: str = ""


class TaskClassifier:
    """
    LLM-based task classification for routing decisions.

    Uses a ToolCallingAgent with TaskClassifierTool to classify tasks
    and determine execution mode. This replaces string-matching patterns
    with intelligent LLM-based classification.

    Classification decisions:
    - DIRECT: Simple, clear command with all details provided
    - PLAN_AND_APPROVE: Complex task, multiple steps, or needs clarification

    When needs_clarification is True, questions are returned to be shown
    to the user before proceeding with execution.

    NOTE: This classifier does NOT route to specific agents. Capability
    discovery happens in the chat planner using search_capabilities,
    list_capabilities, and get_capability tools.

    AIDEV-NOTE: The classifier can use research_agent as a managed agent for
    comprehensive context gathering (apps, tables, URLs) before deciding
    whether clarification is needed.
    """

    def __init__(
        self,
        model_provider: ModelProvider,
        research_agent: Optional[Any] = None,
    ):
        """
        Initialize the task classifier.

        Args:
            model_provider: Provider for LLM access
            research_agent: Optional research agent for comprehensive context gathering
                           (web research + system introspection via research_emery)
        """
        self.model_provider = model_provider
        self.research_agent = research_agent

    def classify(
        self,
        task: str,
        context: Optional[str] = None,
        org_model: Optional[str] = None,
    ) -> TaskClassification:
        """
        Classify a task to determine execution mode and questions.

        Uses ToolCallingAgent with TaskClassifierTool for structured output.
        The LLM analyzes the task and reports its classification via the tool.

        Args:
            task: The user's task/request text
            context: Additional context (e.g., existing databases)
            org_model: Organization model ID for model resolution hierarchy

        Returns:
            TaskClassification with mode, clarification needs, and questions
        """
        logger.info(f"🔍 Classifying task: {task[:100]}...")

        # Session logging for flow tracking
        session_logger = get_session_logger()
        if session_logger:
            session_logger.log_event("task_classification_started", {
                "task_preview": task[:200],
                "has_context": bool(context),
            })

        prompt = self._build_prompt(task, context)
        tool = TaskClassifierTool()

        # Log full prompt for debugging
        if session_logger:
            session_logger.log_full_content(
                content_type="prompt",
                name="task_classifier",
                content=prompt,
                metadata={"task_preview": task[:100]},
            )

        try:
            # Use resolved model from organization hierarchy
            model_id = self.model_provider.resolve_model_selection(org_model=org_model)
            model = self.model_provider.get_model(model_id=model_id)

            # Build tools list: just the classifier tool
            # Context gathering is done via research_agent (managed agent)
            tools = [tool]

            # Add research_agent as managed agent if available
            managed_agents = [self.research_agent] if self.research_agent else None
            if managed_agents:
                logger.info("🔍 Classifier has research_agent for context gathering")

            classifier = ToolCallingAgent(
                tools=tools,
                model=model,
                max_steps=8,  # Allow research + context gathering + classify
                managed_agents=managed_agents,
            )
            classifier.run(prompt)

            result = tool.get_result()
            if result:
                classification = TaskClassification(**result)
                logger.info(
                    f"✅ Classification: mode={classification.mode}, "
                    f"needs_clarification={classification.needs_clarification}"
                )
                if classification.clarification_questions:
                    logger.info(
                        f"📋 Questions to ask: {classification.clarification_questions}"
                    )

                # Log classification result
                if session_logger:
                    session_logger.log_event("task_classification_result", {
                        "mode": classification.mode,
                        "needs_clarification": classification.needs_clarification,
                        "question_count": len(classification.clarification_questions),
                        "reasoning_preview": classification.reasoning[:200] if classification.reasoning else None,
                    })

                return classification

            # Tool not called - this is an error, not a fallback scenario
            raise ValueError(
                "TaskClassifier LLM did not call the classify_task tool. "
                "This indicates an issue with the prompt or model."
            )

        except Exception as e:
            logger.error(f"❌ Classification failed: {e}")
            raise

    def _build_prompt(
        self,
        task: str,
        context: Optional[str],
    ) -> str:
        """Build the classification prompt using jinja template."""
        return render_template(
            "planning/task_classifier.j2",
            task=task,
            context=context,
        )
