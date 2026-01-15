"""
Task Classifier - LLM-based task classification for routing decisions.

AIDEV-NOTE: Replaces brittle string-matching patterns with intelligent LLM-based
classification. Uses the proven tool-based structured output pattern (like
EvaluatorAgent and GapAnalyzer) for reliable results.

The classifier determines:
1. Execution mode: DIRECT (simple) or PLAN_AND_APPROVE (complex)
2. Whether clarification questions should be asked first
3. Which agent should handle the task (if clear)
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from smolagents import ToolCallingAgent

from .protocols import ModelProvider
from ..prompts import render_template
from ..tools.task_classifier_tool import TaskClassifierTool

logger = logging.getLogger(__name__)


@dataclass
class TaskClassification:
    """Result of task classification."""

    mode: str  # "DIRECT" or "PLAN_AND_APPROVE"
    needs_clarification: bool
    target_agent: Optional[str] = None
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
    """

    def __init__(
        self,
        model_provider: ModelProvider,
        context_tools: Optional[List[Any]] = None,
    ):
        """
        Initialize the task classifier.

        Args:
            model_provider: Provider for LLM access
            context_tools: Tools for gathering context (database_crud, table_crud)
        """
        self.model_provider = model_provider
        self.context_tools = context_tools or []

    def classify(
        self,
        task: str,
        available_agents: Optional[List[Dict[str, Any]]] = None,
        context: Optional[str] = None,
        org_model: Optional[str] = None,
    ) -> TaskClassification:
        """
        Classify a task to determine execution mode and questions.

        Uses ToolCallingAgent with TaskClassifierTool for structured output.
        The LLM analyzes the task and reports its classification via the tool.

        Args:
            task: The user's task/request text
            available_agents: Agent info dicts with 'name' and 'description' keys
            context: Additional context (e.g., existing databases)
            org_model: Organization model ID for model resolution hierarchy

        Returns:
            TaskClassification with mode, clarification needs, and questions
        """
        logger.info(f"🔍 Classifying task: {task[:100]}...")

        prompt = self._build_prompt(task, available_agents, context)
        tool = TaskClassifierTool()

        try:
            # Use resolved model from organization hierarchy
            model_id = self.model_provider.resolve_model_selection(org_model=org_model)
            model = self.model_provider.get_model(model_id=model_id)

            # Build tools list: context tools + classifier tool
            tools = list(self.context_tools) + [tool]
            logger.info(f"🔍 Classifier has {len(self.context_tools)} context tools")

            classifier = ToolCallingAgent(
                tools=tools,
                model=model,
                max_steps=4,  # Allow context gathering + classify
            )
            classifier.run(prompt)

            result = tool.get_result()
            if result:
                classification = TaskClassification(**result)
                logger.info(
                    f"✅ Classification: mode={classification.mode}, "
                    f"needs_clarification={classification.needs_clarification}, "
                    f"target_agent={classification.target_agent}"
                )
                if classification.clarification_questions:
                    logger.info(
                        f"📋 Questions to ask: {classification.clarification_questions}"
                    )
                return classification

            # Fallback if tool not called
            logger.warning("⚠️ Classifier did not call tool, using fallback")
            return self._fallback_classification(task)

        except Exception as e:
            logger.error(f"❌ Classification failed: {e}")
            return self._fallback_classification(task)

    def _build_prompt(
        self,
        task: str,
        available_agents: Optional[List[Dict[str, Any]]],
        context: Optional[str],
    ) -> str:
        """Build the classification prompt using jinja template."""
        return render_template(
            "planning/task_classifier.j2",
            task=task,
            available_agents=available_agents or [],
            context=context,
        )

    def _fallback_classification(self, task: str) -> TaskClassification:
        """
        Fallback classification when LLM fails.

        Defaults to PLAN_AND_APPROVE without clarification questions.
        Classification is an optimization, not a requirement - if it fails,
        we should proceed with planning rather than blocking the user.
        """
        return TaskClassification(
            mode="PLAN_AND_APPROVE",
            needs_clarification=False,
            target_agent=None,
            clarification_questions=[],
            reasoning="Proceeding with planning (classification unavailable)",
        )
