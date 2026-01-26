"""
Task Classifier - DSPy-based task classification for routing decisions.

Uses DSPy ChainOfThought with ClassifyTask signature for intelligent
classification. Determines execution mode and clarification needs.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, List, Optional

import dspy

from ..reasoning.signatures.planning import ClassifyTask, TaskClassificationResult
from ..utils.session_logger import get_session_logger

logger = logging.getLogger(__name__)


@dataclass
class TaskClassification:
    """Result of task classification."""

    mode: str  # "DIRECT" or "PLAN_AND_APPROVE"
    needs_clarification: bool
    clarification_questions: List[str] = field(default_factory=list)
    reasoning: str = ""

    @classmethod
    def from_result(cls, result: TaskClassificationResult) -> "TaskClassification":
        """Convert from DSPy result model."""
        return cls(
            mode=result.mode,
            needs_clarification=result.needs_clarification,
            clarification_questions=result.clarification_questions,
            reasoning=result.reasoning,
        )


class TaskClassifierModule(dspy.Module):
    """DSPy module for task classification."""

    def __init__(self) -> None:
        super().__init__()
        self.classifier = dspy.ChainOfThought(ClassifyTask)

    def forward(self, task: str, context: str) -> TaskClassificationResult:
        """Classify a task to determine execution mode."""
        result = self.classifier(task=task, context=context)
        return result.classification


class TaskClassifier:
    """
    DSPy-based task classification for routing decisions.

    Uses ChainOfThought with ClassifyTask signature for intelligent
    classification. Replaces smolagents ToolCallingAgent pattern.

    Classification decisions:
    - DIRECT: Simple, clear command with all details provided
    - PLAN_AND_APPROVE: Complex task, multiple steps, or needs clarification
    """

    def __init__(
        self,
        lm: Optional[dspy.LM] = None,
        research_module: Optional[dspy.Module] = None,
    ):
        """
        Initialize the task classifier.

        Args:
            lm: DSPy language model (uses global settings if not provided)
            research_module: Optional research module for context gathering
        """
        self.lm = lm
        self.research_module = research_module
        self._module = TaskClassifierModule()

    def classify(
        self,
        task: str,
        context: Optional[str] = None,
        org_model: Optional[str] = None,
    ) -> TaskClassification:
        """
        Classify a task to determine execution mode and questions.

        Uses DSPy ChainOfThought for structured classification.

        Args:
            task: The user's task/request text
            context: Additional context (e.g., existing databases)
            org_model: Organization model ID (used to get LM if not provided)

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

        context_str = context or "No additional context provided."

        try:
            # Use provided LM or global settings
            if self.lm:
                with dspy.context(lm=self.lm):
                    result = self._module(task=task, context=context_str)
            else:
                result = self._module(task=task, context=context_str)

            classification = TaskClassification.from_result(result)

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

        except Exception as e:
            logger.error(f"❌ Classification failed: {e}")
            raise
