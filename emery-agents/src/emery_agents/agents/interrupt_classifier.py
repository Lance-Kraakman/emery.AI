"""
Interrupt Classifier - DSPy-based interrupt classification.

Classifies user interrupts during plan execution to determine appropriate action.
Uses DSPy ChainOfThought with ClassifyInterrupt signature.

Classification categories:
- CONTEXT_ADD: User provides additional info/clarification - continue with new context
- SCOPE_CHANGE: User wants to change direction - requires replanning
- CANCEL: User wants to stop execution entirely
"""

import logging
from collections.abc import Callable
from dataclasses import dataclass

import dspy

from ..reasoning.signatures.evaluation import (
    ClassifyInterrupt,
    InterruptClassificationResult,
)

logger = logging.getLogger(__name__)


@dataclass
class InterruptClassification:
    """Result of DSPy-based interrupt classification."""

    classification: str  # CONTEXT_ADD | SCOPE_CHANGE | CANCEL
    requires_replan: bool
    is_cancel: bool
    reasoning: str
    suggested_action: str | None = None

    @classmethod
    def from_result(
        cls, result: InterruptClassificationResult
    ) -> "InterruptClassification":
        """Convert from DSPy result model."""
        # Normalize classification
        classification_upper = result.classification.upper().strip()
        if classification_upper not in ("CONTEXT_ADD", "SCOPE_CHANGE", "CANCEL"):
            classification_upper = "CONTEXT_ADD"  # Safe default

        return cls(
            classification=classification_upper,
            requires_replan=classification_upper == "SCOPE_CHANGE",
            is_cancel=classification_upper == "CANCEL",
            reasoning=result.reasoning,
            suggested_action=result.suggested_action or None,
        )


class InterruptClassifierModule(dspy.Module):
    """DSPy module for interrupt classification."""

    def __init__(self) -> None:
        super().__init__()
        self.classifier = dspy.ChainOfThought(ClassifyInterrupt)

    def forward(
        self,
        interrupt_message: str,
        current_plan_summary: str,
        completed_steps: str,
        remaining_steps: str,
    ) -> InterruptClassificationResult:
        """Classify an interrupt message."""
        result = self.classifier(
            interrupt_message=interrupt_message,
            current_plan_summary=current_plan_summary,
            completed_steps=completed_steps,
            remaining_steps=remaining_steps,
        )
        return result.classification


class InterruptClassifier:
    """
    DSPy-based interrupt classification.

    Classifies user interrupts during plan execution using
    ChainOfThought with ClassifyInterrupt signature.
    """

    def __init__(self, lm: dspy.LM | None = None):
        """
        Initialize classifier.

        Args:
            lm: DSPy language model (uses global settings if not provided)
        """
        self.lm = lm
        self._module = InterruptClassifierModule()

    def classify(
        self,
        interrupt_message: str,
        current_plan_summary: str,
        completed_steps: str,
        remaining_steps: str,
    ) -> InterruptClassification:
        """
        Classify a user interrupt.

        Args:
            interrupt_message: The user's interrupt message
            current_plan_summary: Summary of current plan goal
            completed_steps: Summary of completed steps
            remaining_steps: Summary of remaining steps

        Returns:
            InterruptClassification with classification and reasoning
        """
        logger.info(f"🔍 Classifying interrupt: {interrupt_message[:50]}...")

        try:
            # Use provided LM or global settings
            if self.lm:
                with dspy.context(lm=self.lm):
                    result = self._module(
                        interrupt_message=interrupt_message,
                        current_plan_summary=current_plan_summary,
                        completed_steps=completed_steps or "None yet",
                        remaining_steps=remaining_steps or "None remaining",
                    )
            else:
                result = self._module(
                    interrupt_message=interrupt_message,
                    current_plan_summary=current_plan_summary,
                    completed_steps=completed_steps or "None yet",
                    remaining_steps=remaining_steps or "None remaining",
                )

            classification = InterruptClassification.from_result(result)

            logger.info(
                f"✅ Interrupt classified: {classification.classification} - "
                f"{classification.reasoning[:50]}"
            )
            return classification

        except Exception as e:
            logger.error(f"❌ Interrupt classification failed: {e}")
            # Default to CONTEXT_ADD on error (safest option)
            return InterruptClassification(
                classification="CONTEXT_ADD",
                requires_replan=False,
                is_cancel=False,
                reasoning=f"Classification failed, defaulting to CONTEXT_ADD: {e}",
            )


def create_interrupt_classifier(
    lm: dspy.LM | None = None,
) -> InterruptClassifier:
    """
    Create an interrupt classifier.

    Args:
        lm: DSPy language model (uses global settings if not provided)

    Returns:
        InterruptClassifier instance
    """
    return InterruptClassifier(lm=lm)


def create_interrupt_classifier_factory(
    lm: dspy.LM | None = None,
) -> Callable[[], InterruptClassifier]:
    """
    Create a factory function for interrupt classifiers.

    Args:
        lm: DSPy language model

    Returns:
        Callable that creates InterruptClassifier instances
    """

    def factory() -> InterruptClassifier:
        return create_interrupt_classifier(lm=lm)

    return factory


def build_classification_prompt(
    interrupt_message: str,
    current_plan_summary: str,
    completed_steps: str,
    remaining_steps: str,
) -> str:
    """
    Build context string for interrupt classification (for debugging/logging).

    Args:
        interrupt_message: The user's interrupt message
        current_plan_summary: Summary of current plan goal
        completed_steps: Summary of completed steps
        remaining_steps: Summary of remaining steps

    Returns:
        Formatted context string
    """
    return f"""## Current Plan
{current_plan_summary}

## Progress
Completed steps:
{completed_steps or "None yet"}

Remaining steps:
{remaining_steps or "None remaining"}

## User Interrupt
{interrupt_message}"""
