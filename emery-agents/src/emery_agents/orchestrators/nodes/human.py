"""
Human-in-the-Loop Node

Handles plan approval, clarification, and recovery responses using LangGraph interrupt.
"""

import logging
from typing import Any

from langgraph.types import interrupt

from ...services.execution.events import (
    ErrorEvent,
    PlanApprovedEvent,
    PlanFeedbackEvent,
    PlanRejectedEvent,
)
from ..state import PlanExecuteState

logger = logging.getLogger(__name__)


async def await_approval_node(state: PlanExecuteState) -> dict[str, Any]:
    """
    Pause execution for human input using LangGraph interrupt.

    Replaces ExecutionCoordinator._handle_approval_response() and
    _handle_clarification_response().

    The interrupt() call pauses the graph. When the graph is resumed
    with Command(resume=response), execution continues from here.
    """
    awaiting_type = state.get("awaiting_input")
    plan = state.get("plan")
    task = state.get("task", "")

    events: list[Any] = []

    if awaiting_type == "approval":
        # Pause for plan approval
        if plan is None:
            logger.error("Cannot await approval without a plan")
            events.append(ErrorEvent(error="No plan available for approval"))
            return {"awaiting_input": None, "events": events}

        response = interrupt(
            {
                "type": "approval",
                "plan_id": plan.id,
                "plan": plan.to_dict() if hasattr(plan, "to_dict") else str(plan),
                "message": "Please approve this plan before execution begins.",
            }
        )

        response_lower = str(response).lower().strip()

        if response_lower in ("approve", "yes", "y", "ok", "proceed", "approved"):
            logger.info(f"Plan {plan.id} approved by user")

            # Approve the plan
            approved_plan = plan.approve()

            events.append(PlanApprovedEvent(plan_id=plan.id))

            # Start execution
            executing_plan = approved_plan.start_execution()

            # Record approval in ledger
            ledger = state.get("ledger")
            if ledger:
                ledger.record_plan_approved()

            return {
                "plan": executing_plan,
                "awaiting_input": None,
                "user_response": None,
                "events": events,
            }

        elif response_lower in ("reject", "no", "n", "cancel", "rejected"):
            logger.info(f"Plan {plan.id} rejected by user")
            events.append(PlanRejectedEvent(plan_id=plan.id))
            return {
                "awaiting_input": None,
                "user_response": None,
                "error": "Plan rejected by user",
                "success": False,
                "events": events,
            }

        else:
            # Feedback - re-plan with feedback
            logger.info(f"Received feedback on plan {plan.id}")
            events.append(PlanFeedbackEvent(plan_id=plan.id, feedback=response))
            return {
                "task": f"{task}\n\nUser feedback on plan: {response}",
                "awaiting_input": None,
                "user_response": str(response),
                "plan": None,  # Clear plan so generate_plan runs again
                "events": events,
            }

    elif awaiting_type == "clarification":
        # Pause for clarification
        questions = state.get("clarifying_questions", [])

        response = interrupt(
            {
                "type": "clarification",
                "questions": questions,
                "message": "Please provide clarification.",
            }
        )

        logger.info("Clarification received, will re-plan with combined task")

        return {
            "task": f"{task}\n\nUser's clarification: {response}",
            "awaiting_input": None,
            "user_response": str(response),
            "clarifying_questions": [],
            "plan": None,  # Clear plan to re-generate
            "events": events,
        }

    elif awaiting_type == "recovery":
        # Pause for recovery decision
        response = interrupt(
            {
                "type": "recovery",
                "error": state.get("error"),
                "message": "How would you like to handle this error?",
            }
        )

        logger.info(f"Recovery response received: {str(response)[:50]}")

        return {
            "task": f"{task}\n\nUser's recovery guidance: {response}",
            "awaiting_input": None,
            "user_response": str(response),
            "error": None,
            "events": events,
        }

    else:
        logger.warning(f"Unknown awaiting_input type: {awaiting_type}")
        events.append(ErrorEvent(error=f"Unknown input type: {awaiting_type}"))
        return {
            "awaiting_input": None,
            "events": events,
        }
