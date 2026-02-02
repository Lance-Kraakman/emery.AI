"""
DSPy Task Classifier Module.

Classifies tasks to determine execution mode: DIRECT (simple) or PLAN_AND_APPROVE (complex).
"""

from __future__ import annotations

import logging

import dspy

from emery_agents.reasoning.signatures.planning import (
    ClassifyTask,
    TaskClassificationResult,
    TaskExecutionMode,
)

logger = logging.getLogger(__name__)


class TaskClassifierModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for task classification.

    Determines whether a task should be:
    - DIRECT: Simple response without planning
    - PLAN_AND_APPROVE: Full plan-execute flow with human approval
    """

    def __init__(self) -> None:
        """Initialize the classifier module."""
        super().__init__()
        self.classifier = dspy.ChainOfThought(ClassifyTask)

    def classify(
        self,
        task: str,
        context: str = "",
    ) -> TaskClassificationResult:
        """
        Classify a task to determine execution mode.

        Args:
            task: The user's task or request
            context: Available context about the system state (optional)

        Returns:
            TaskClassificationResult with mode, complexity, and reasoning
        """
        result = self.classifier(
            task=task,
            context=context,
        )
        classification = result.classification

        logger.info(
            f"📋 Task classified as {classification.mode.value}: {classification.reasoning[:100]}..."
        )

        return classification

    def is_direct(self, task: str, context: str = "") -> bool:
        """
        Check if a task should be handled directly (no planning).

        Args:
            task: The user's task or request
            context: Available context about the system state

        Returns:
            True if task should be handled directly, False otherwise
        """
        result = self.classify(task, context)
        return result.mode == TaskExecutionMode.DIRECT
