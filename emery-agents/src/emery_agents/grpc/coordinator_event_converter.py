"""
Coordinator Event Converter

Extracted from chat_processing_service.py for single responsibility.
Handles conversion of ExecutionCoordinator events to frontend SSE events.
"""

from typing import Any, Optional, Union

from ..services.execution_coordinator import (
    StepStartedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    EvaluationCompletedEvent,
    ReplanTriggeredEvent,
    GoalAchievedEvent,
    ExecutionBlockedEvent,
    ExecutionCompletedEvent,
    RecoveryAnalysisEvent,
    AutoFixStartedEvent,
    AutoFixCompletedEvent,
    RecoveryPlanProposedEvent,
)
from .response_types import (
    StepProgressDict,
    ErrorResponseDict,
    AwaitingInputResponseDict,
)

# Union type for coordinator event responses
CoordinatorResponseDict = Union[StepProgressDict, ErrorResponseDict, AwaitingInputResponseDict]


def convert_coordinator_event(event: Any, step_index: int) -> Optional[CoordinatorResponseDict]:
    """Convert ExecutionCoordinator events to frontend SSE events."""

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

    return None  # Unknown event type
