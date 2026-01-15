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
from typing import List, Optional

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

    def __init__(self, model_provider: ModelProvider):
        """
        Initialize the task classifier.

        Args:
            model_provider: Provider for LLM access
        """
        self.model_provider = model_provider

    def classify(
        self,
        task: str,
        available_agents: Optional[List[str]] = None,
        context: Optional[str] = None,
    ) -> TaskClassification:
        """
        Classify a task to determine execution mode and questions.

        Uses ToolCallingAgent with TaskClassifierTool for structured output.
        The LLM analyzes the task and reports its classification via the tool.

        Args:
            task: The user's task/request text
            available_agents: Names of available managed agents
            context: Additional context (e.g., existing databases)

        Returns:
            TaskClassification with mode, clarification needs, and questions
        """
        logger.info(f"🔍 Classifying task: {task[:100]}...")

        prompt = self._build_prompt(task, available_agents, context)
        tool = TaskClassifierTool()

        try:
            # Use ToolCallingAgent for structured output
            model = self.model_provider.get_model()
            classifier = ToolCallingAgent(
                tools=[tool],
                model=model,
                max_steps=2,  # Plan + tool call
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
        available_agents: Optional[List[str]],
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

        Defaults to PLAN_AND_APPROVE with a generic clarification question
        to ensure we don't make assumptions.
        """
        return TaskClassification(
            mode="PLAN_AND_APPROVE",
            needs_clarification=True,
            target_agent=None,
            clarification_questions=[
                "Could you provide more details about what you'd like to do?"
            ],
            reasoning="Fallback classification due to LLM error",
        )
