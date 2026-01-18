"""
Coordinator Event Converter

Extracted from chat_processing_service.py for single responsibility.
Handles conversion of ExecutionCoordinator events to frontend SSE events.
"""

import json
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
    # Cascade planning events
    SubPlanCreatedEvent,
    QuestionsCollectedEvent,
    CascadingPlanCompleteEvent,
    # Unified message handling events (Step 1 additions)
    PlanRejectedEvent,
    PlanFeedbackEvent,
    ErrorEvent,
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

    # Cascade planning events
    elif isinstance(event, SubPlanCreatedEvent):
        return {
            "type": "step_progress",
            "step_type": "PLANNING",
            "step_name": f"Sub-plan: {event.agent_name}",
            "content": f"Created detailed plan for: {event.sub_plan_goal} ({event.sub_plan_step_count} steps)",
            "metadata": {
                "type": "sub_plan_created",
                "plan_id": event.plan_id,
                "step_id": event.step_id,
                "agent_name": event.agent_name,
            },
            "step_index": step_index
        }

    elif isinstance(event, QuestionsCollectedEvent):
        # Convert batched questions to awaiting_input for user response
        # Format questions grouped by agent for clear presentation
        questions_by_agent = event.questions.group_by_agent()

        # Build content showing questions grouped by agent
        content_parts = ["The following agents need clarification before proceeding:\n"]
        for agent_name, agent_questions in questions_by_agent.items():
            content_parts.append(f"\n**{agent_name}:**")
            for q in agent_questions:
                content_parts.append(f"- {q.question}")
                if q.context:
                    content_parts.append(f"  _(Context: {q.context})_")

        return {
            "type": "awaiting_input",
            "data": {
                "input_type": "batched_questions",
                "title": "Questions",
                "content": "\n".join(content_parts),
                "options": [],  # Free-form JSON response expected with question_id → answer mapping
                "plan_json": json.dumps(event.questions.to_dict())  # Contains structured questions for form rendering
            }
        }

    elif isinstance(event, CascadingPlanCompleteEvent):
        return {
            "type": "step_progress",
            "step_type": "PLANNING",
            "step_name": "Cascade Planning Complete",
            "content": f"All {event.total_sub_plans} sub-agent plans are ready",
            "metadata": {
                "type": "cascade_complete",
                "plan_id": event.plan_id,
                "total_sub_plans": str(event.total_sub_plans),
            },
            "step_index": step_index
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

    return None  # Unknown event type
