"""
Coordinator Event Converter

Extracted from chat_processing_service.py for single responsibility.
Handles conversion of ExecutionCoordinator events to frontend SSE events.
"""

import json
import logging
from typing import Any, Optional, Union

logger = logging.getLogger(__name__)

from ..services.execution_coordinator import (
    StepStartedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    EvaluationCompletedEvent,
    ReplanTriggeredEvent,
    GoalAchievedEvent,
    ExecutionBlockedEvent,
    ExecutionCompletedEvent,
    FinalSynthesisEvent,
    RecoveryAnalysisEvent,
    AutoFixStartedEvent,
    AutoFixCompletedEvent,
    RecoveryPlanProposedEvent,
    # Unified message handling events (Step 1 additions)
    PlanRejectedEvent,
    PlanFeedbackEvent,
    ErrorEvent,
    # Phase execution events
    PhaseStartedEvent,
    PhaseCompletedEvent,
    # Planning progress events (for UI feedback during thinking phase)
    ClassificationStartedEvent,
    PlanningStartedEvent,
    PlanningProgressEvent,
)
from .response_types import (
    StepProgressDict,
    ErrorResponseDict,
    AwaitingInputResponseDict,
)

# Union type for coordinator event responses
CoordinatorResponseDict = Union[StepProgressDict, ErrorResponseDict, AwaitingInputResponseDict]


def convert_coordinator_event(event: Any, step_index: int) -> Optional[CoordinatorResponseDict]:
    """Convert ExecutionCoordinator events to frontend SSE events.

    Args:
        event: Coordinator event to convert
        step_index: Current step index (must be int)

    Returns:
        Converted event dict or None if event type not recognized
    """
    # Defensive: ensure step_index is int (protects against accidental string passing)
    if not isinstance(step_index, int):
        logger.warning(f"step_index should be int, got {type(step_index).__name__}: {step_index}")
        step_index = 0

    if isinstance(event, StepStartedEvent):
        return {
            "type": "step_progress",
            "step_type": "ACTION",
            "step_name": f"Executing: {event.step_description[:50]}...",
            "content": event.step_description,
            "metadata": {"step_id": event.step_id},
            "step_index": step_index
        }

    elif isinstance(event, StepCompletedEvent):
        return {
            "type": "step_progress",
            "step_type": "ACTION",
            "step_name": f"Completed: Step {step_index + 1}",
            "content": str(event.result) if event.result else "Step completed",
            "metadata": {"result": str(event.result) if event.result else ""},
            "step_index": step_index
        }

    elif isinstance(event, StepFailedEvent):
        return {
            "type": "step_progress",
            "step_type": "ACTION",
            "step_name": f"Failed: Step {step_index + 1}",
            "content": event.error,
            "metadata": {"error": event.error},
            "step_index": step_index
        }

    elif isinstance(event, EvaluationCompletedEvent):
        if event.evaluation.goal_achieved:
            return {
                "type": "step_progress",
                "step_type": "FINAL",
                "step_name": "Goal Achieved",
                "content": event.evaluation.reason,
                "metadata": {"type": "goal_achieved"},
                "step_index": 999
            }
        # Don't show intermediate evaluations
        return None

    elif isinstance(event, ReplanTriggeredEvent):
        return {
            "type": "step_progress",
            "step_type": "REASONING",
            "step_name": f"Replanning (attempt {event.replan_number})",
            "content": event.reason,
            "metadata": {"type": "replan", "replan_number": str(event.replan_number)},
            "step_index": step_index
        }

    elif isinstance(event, GoalAchievedEvent):
        return {
            "type": "step_progress",
            "step_type": "FINAL",
            "step_name": "Goal Achieved",
            "content": event.reason,
            "metadata": {"type": "goal_achieved"},
            "step_index": 999
        }

    elif isinstance(event, ExecutionBlockedEvent):
        return {
            "type": "error",
            "error": {
                "error_code": "EXECUTION_BLOCKED",
                "error_message": event.reason,
                "error_details": {"severity": "recoverable"},
                "hint": "The plan encountered a blocking issue. You may need to provide more information.",
                "can_retry": True,
                "auto_retry": False,
                "session_reset": False
            }
        }

    elif isinstance(event, ExecutionCompletedEvent):
        status = "successfully" if event.success else "with errors"
        return {
            "type": "step_progress",
            "step_type": "FINAL",
            "step_name": "Execution Complete",
            "content": f"All steps completed {status}",
            "metadata": {"success": str(event.success)},
            "step_index": 999
        }

    elif isinstance(event, FinalSynthesisEvent):
        # ACE: Synthesized final answer from all step results
        return {
            "type": "step_progress",
            "step_type": "FINAL",
            "step_name": "Final Answer",
            "content": event.synthesis,
            "metadata": {
                "type": "final_synthesis",
                "plan_id": event.plan_id,
            },
            "step_index": 998  # Just before ExecutionCompletedEvent
        }

    # Recovery events (confidence-based error handling)
    elif isinstance(event, RecoveryAnalysisEvent):
        confidence_pct = f"{event.confidence:.0%}"
        return {
            "type": "step_progress",
            "step_type": "REASONING",
            "step_name": f"Recovery Analysis ({confidence_pct} confidence)",
            "content": f"Analyzing error for step {event.step_id}",
            "metadata": {
                "type": "recovery_analysis",
                "step_id": event.step_id,
                "confidence": str(event.confidence),
            },
            "step_index": step_index
        }

    elif isinstance(event, AutoFixStartedEvent):
        confidence_pct = f"{event.confidence:.0%}"
        return {
            "type": "step_progress",
            "step_type": "ACTION",
            "step_name": f"Auto-fixing ({confidence_pct} confidence)",
            "content": event.fix_description,
            "metadata": {
                "type": "auto_fix_started",
                "step_id": event.step_id,
                "confidence": str(event.confidence),
            },
            "step_index": step_index
        }

    elif isinstance(event, AutoFixCompletedEvent):
        return {
            "type": "step_progress",
            "step_type": "ACTION",
            "step_name": "Auto-fix Completed",
            "content": event.result,
            "metadata": {
                "type": "auto_fix_completed",
                "step_id": event.step_id,
            },
            "step_index": step_index
        }

    elif isinstance(event, RecoveryPlanProposedEvent):
        # Medium confidence: Show recovery plan for user approval
        confidence_pct = f"{event.confidence:.0%}"
        return {
            "type": "awaiting_input",
            "data": {
                "input_type": "recovery_approval",
                "title": f"Recovery Plan ({confidence_pct} confidence)",
                "content": f"**Proposed fix:** {event.fix_description}\n\nDo you want to proceed with this fix?",
                "options": [
                    {"id": "approve", "label": "Approve Fix", "description": "Execute the recovery action"},
                    {"id": "skip", "label": "Skip", "description": "Skip this step and continue"},
                ],
                "plan_json": ""
            }
        }

    # Unified message handling events (handle_message() additions)
    elif isinstance(event, PlanRejectedEvent):
        return {
            "type": "step_progress",
            "step_type": "FINAL",
            "step_name": "Plan Rejected",
            "content": "Plan was rejected by user. Ready for new request.",
            "metadata": {
                "type": "plan_rejected",
                "plan_id": event.plan_id,
            },
            "step_index": 999
        }

    elif isinstance(event, PlanFeedbackEvent):
        # Truncate long feedback for display
        feedback_preview = event.feedback[:100] + "..." if len(event.feedback) > 100 else event.feedback
        return {
            "type": "step_progress",
            "step_type": "REASONING",
            "step_name": "Processing Feedback",
            "content": f"Re-planning based on feedback: {feedback_preview}",
            "metadata": {
                "type": "plan_feedback",
                "plan_id": event.plan_id,
                "feedback": event.feedback,
            },
            "step_index": step_index
        }

    # Phase execution events
    elif isinstance(event, PhaseStartedEvent):
        return {
            "type": "step_progress",
            "step_type": "PHASE",
            "step_name": f"Phase: {event.phase_name}",
            "content": event.phase_goal,
            "metadata": {
                "type": "phase_started",
                "plan_id": event.plan_id,
                "phase_name": event.phase_name,
                "step_count": str(event.step_count),
            },
            "step_index": step_index
        }

    elif isinstance(event, PhaseCompletedEvent):
        return {
            "type": "step_progress",
            "step_type": "PHASE",
            "step_name": f"Completed: {event.phase_name}",
            "content": event.results_summary,
            "metadata": {
                "type": "phase_completed",
                "plan_id": event.plan_id,
                "phase_name": event.phase_name,
                "needs_replan": str(event.needs_replan),
            },
            "step_index": step_index
        }

    elif isinstance(event, ErrorEvent):
        return {
            "type": "error",
            "error": {
                "error_code": "COORDINATOR_ERROR",
                "error_message": event.error,
                "error_details": {"severity": "recoverable" if event.recoverable else "fatal"},
                "hint": "An error occurred during message processing.",
                "can_retry": event.recoverable,
                "auto_retry": False,
                "session_reset": not event.recoverable
            }
        }

    # Planning progress events (for UI feedback during thinking phase)
    elif isinstance(event, ClassificationStartedEvent):
        return {
            "type": "step_progress",
            "step_type": "PLANNING",
            "step_name": "Analyzing Request",
            "content": f"Understanding: {event.task_summary}",
            "metadata": {"type": "classification_started"},
            "step_index": step_index
        }

    elif isinstance(event, PlanningStartedEvent):
        return {
            "type": "step_progress",
            "step_type": "PLANNING",
            "step_name": "Creating Plan",
            "content": f"Goal: {event.goal}",
            "metadata": {"type": "planning_started"},
            "step_index": step_index
        }

    elif isinstance(event, PlanningProgressEvent):
        return {
            "type": "step_progress",
            "step_type": "PLANNING",
            "step_name": "Planning",
            "content": event.message,
            "metadata": {"type": "planning_progress"},
            "step_index": step_index
        }

    return None  # Unknown event type
