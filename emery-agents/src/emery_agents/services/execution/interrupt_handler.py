"""
Interrupt Handler

Manages interrupt queue and classification during execution.

Extracted from ExecutionCoordinator for maintainability.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Any, List, Optional

from ...agents.interrupt_classifier import (
    InterruptClassification,
    create_interrupt_classifier,
    build_classification_prompt,
)
from ...models.plan import Plan, PlanStepStatus
from ...models.task_ledger import TaskLedger, LedgerEventType
from ..protocols import ModelProvider

logger = logging.getLogger(__name__)


@dataclass
class QueuedInterrupt:
    """Internal representation of a queued interrupt."""
    message: str
    phase: str  # "planning" or "executing"


class InterruptHandler:
    """
    Manages interrupt queue and classification during execution.

    Handles:
    - Queueing interrupts that arrive during execution
    - Classifying interrupt intent (cancel, replan, context-add)
    - Injecting context into the task ledger
    """

    def __init__(
        self,
        model_provider: Optional[ModelProvider] = None,
        org_model: Optional[str] = None,
    ):
        """
        Initialize interrupt handler.

        Args:
            model_provider: Provider for getting LLM models
            org_model: Organization model ID for model resolution
        """
        self.model_provider = model_provider
        self.org_model = org_model
        self._interrupt_queue: List[str] = []
        self._execution_paused: bool = False

    def queue_interrupt(self, message: str, phase: str = "executing") -> QueuedInterrupt:
        """
        Queue an interrupt message for processing.

        Called when a message arrives during planning or execution phase.

        Args:
            message: The user's interrupt message
            phase: Current phase ("planning" or "executing")

        Returns:
            QueuedInterrupt with message and phase info
        """
        self._interrupt_queue.append(message)
        logger.info(f"⏸️ Interrupt queued during {phase}: {message[:50]}...")
        return QueuedInterrupt(message=message, phase=phase)

    def has_pending_interrupts(self) -> bool:
        """Check if there are pending interrupts in the queue."""
        return len(self._interrupt_queue) > 0

    def pop_interrupt(self) -> Optional[str]:
        """Pop the next interrupt from the queue."""
        if self._interrupt_queue:
            return self._interrupt_queue.pop(0)
        return None

    def clear_queue(self) -> None:
        """Clear all pending interrupts."""
        self._interrupt_queue.clear()

    def pause_execution(self) -> None:
        """Pause execution for interrupt processing."""
        self._execution_paused = True

    def resume_execution(self) -> None:
        """Resume execution after interrupt processing."""
        self._execution_paused = False

    @property
    def is_paused(self) -> bool:
        """Check if execution is paused."""
        return self._execution_paused

    async def classify_interrupt(
        self,
        interrupt_message: str,
        current_plan: Optional[Plan] = None,
    ) -> InterruptClassification:
        """
        Use subagent pattern to classify interrupt intent.

        Args:
            interrupt_message: The user's interrupt message
            current_plan: Current plan for context

        Returns:
            InterruptClassification with classification and reasoning
        """
        if not self.model_provider or not current_plan:
            # Fallback if no model available - default to CONTEXT_ADD
            logger.warning("No model provider available for interrupt classification")
            return InterruptClassification(
                classification="CONTEXT_ADD",
                requires_replan=False,
                is_cancel=False,
                reasoning="No classifier available, defaulting to context injection",
            )

        # Build context for classification
        completed_steps = "\n".join([
            f"- {s.description}"
            for s in current_plan.steps
            if s.status == PlanStepStatus.COMPLETED.value
        ]) or "None yet"

        remaining_steps = "\n".join([
            f"- {s.description}"
            for s in current_plan.steps
            if s.status == PlanStepStatus.PENDING.value
        ]) or "None remaining"

        prompt = build_classification_prompt(
            interrupt_message=interrupt_message,
            current_plan_summary=f"Goal: {current_plan.goal}",
            completed_steps=completed_steps,
            remaining_steps=remaining_steps,
        )

        try:
            # Create classifier and run (synchronous, wrap in thread)
            model = self.org_model or "claude-sonnet-4-20250514"
            classifier_agent, classification_tool = create_interrupt_classifier(model)

            await asyncio.to_thread(classifier_agent.run, prompt)

            result = classification_tool.get_result()
            if result:
                return result

            # Tool wasn't called - default to CONTEXT_ADD
            logger.warning("Interrupt classifier did not call report_classification tool")
            return InterruptClassification(
                classification="CONTEXT_ADD",
                requires_replan=False,
                is_cancel=False,
                reasoning="Classifier did not provide classification, defaulting to context injection",
            )

        except Exception as e:
            logger.error(f"Interrupt classification failed: {e}")
            return InterruptClassification(
                classification="CONTEXT_ADD",
                requires_replan=False,
                is_cancel=False,
                reasoning=f"Classification error: {e}, defaulting to context injection",
            )

    def inject_context(
        self,
        ledger: Optional[TaskLedger],
        interrupt_msg: str,
    ) -> None:
        """
        Add user interrupt as context for the agent to consider in next steps.

        This updates the ledger with the user's feedback so subsequent steps
        can see and act on the new information.

        Args:
            ledger: Task ledger to update
            interrupt_msg: The user's interrupt message
        """
        if ledger:
            ledger._record_event(
                event_type=LedgerEventType.USER_FEEDBACK,
                data={"feedback": interrupt_msg}
            )
            logger.info(f"💉 Injected interrupt context into ledger: {interrupt_msg[:50]}...")
