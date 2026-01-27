"""
Coordinator State Machine - Encapsulates phase transitions and context management.

AIDEV-NOTE: This module extracts the scattered state machine logic from
chat_processing_service.py and session_manager.py into a dedicated class that:
- Validates all state transitions
- Stores all context data (coordinator, plan, task, answers)
- Provides clear handlers for each phase
- Returns typed actions instead of scattered yields/returns

Usage:
    sm = CoordinatorStateMachine(session_id)

    # Handle user input
    action = sm.handle_input(input_type="approval", data="approve")

    match action.action_type:
        case ActionType.EXECUTE_PLAN:
            # Execute the plan
            ...
        case ActionType.FALL_THROUGH:
            # Let agent.run() handle
            ...
"""

import logging
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, Dict, Optional, Set, TYPE_CHECKING

if TYPE_CHECKING:
    from .execution_coordinator import ExecutionCoordinator
    from ..entities.models.plan import Plan

logger = logging.getLogger(__name__)


class Phase(Enum):
    """
    State machine phases for gRPC routing.

    NOTE: This is separate from execution.Phase (5-state). This enum is used
    for gRPC layer routing decisions, while execution.Phase tracks the
    coordinator's execution state. They serve different purposes.
    """
    IDLE = auto()                       # No active coordination, accepts new tasks
    AWAITING_CLARIFICATION = auto()     # Waiting for task classifier clarification
    AWAITING_APPROVAL = auto()          # Waiting for user to approve a plan
    AWAITING_QUESTIONS = auto()         # Waiting for managed agent HITL response
    EXECUTING = auto()                  # Plan execution in progress
    AWAITING_RECOVERY = auto()          # Waiting for user to help resolve blocked execution


class ActionType(Enum):
    """Actions returned by state machine handlers."""
    FALL_THROUGH = auto()     # Let agent.run() handle (no coordinator intervention)
    RUN_COORDINATOR = auto()  # Run coordinator.execute() for new task
    EXECUTE_PLAN = auto()     # Call coordinator.execute_plan() after approval
    YIELD_EVENT = auto()      # Yield an event to frontend
    ERROR = auto()            # Return error response
    COMPLETE = auto()         # Execution complete, clear state
    # Recovery actions for AWAITING_RECOVERY phase
    RETRY_STEP = auto()       # Retry the failed step as-is
    SKIP_STEP = auto()        # Skip the failed step and continue
    RETRY_WITH_INPUT = auto() # Retry with user-provided context/input


@dataclass
class StateAction:
    """Result from state machine handler - tells caller what to do."""
    action_type: ActionType
    event: Optional[Any] = None              # For YIELD_EVENT
    error_message: Optional[str] = None      # For ERROR
    next_phase: Optional[Phase] = None       # Phase to transition to (if any)
    context_updates: Optional[Dict[str, Any]] = None  # Fields to update
    combined_task: Optional[str] = None      # For clarification - combined task text


@dataclass
class StateContext:
    """All context needed for state machine decisions."""
    phase: Phase = field(default=Phase.IDLE)
    original_task: Optional[str] = None
    coordinator: Optional["ExecutionCoordinator"] = None
    plan: Optional["Plan"] = None
    # Recovery context (for AWAITING_RECOVERY phase)
    blocked_reason: Optional[str] = None
    failed_step: Optional[Any] = None
    recovery_input: Optional[str] = None

    def clear(self) -> None:
        """Reset to idle state."""
        self.phase = Phase.IDLE
        self.original_task = None
        self.coordinator = None
        self.plan = None
        self.blocked_reason = None
        self.failed_step = None
        self.recovery_input = None


class InvalidTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


# Valid state transitions matrix
VALID_TRANSITIONS: Dict[Phase, Set[Phase]] = {
    Phase.IDLE: {
        Phase.AWAITING_CLARIFICATION,
        Phase.AWAITING_APPROVAL,
        Phase.AWAITING_QUESTIONS,  # Direct HITL from agent.run()
        Phase.EXECUTING,           # AUTONOMOUS mode (skip approval)
    },
    Phase.AWAITING_CLARIFICATION: {
        Phase.IDLE,  # User answers, replan with combined task
    },
    Phase.AWAITING_APPROVAL: {
        Phase.EXECUTING,  # User approves plan
        Phase.IDLE,       # User provides feedback (replan)
    },
    Phase.AWAITING_QUESTIONS: {
        Phase.IDLE,  # Resume via FALL_THROUGH to agent.run()
    },
    Phase.EXECUTING: {
        Phase.IDLE,               # Execution complete or error
        Phase.AWAITING_QUESTIONS, # Managed agent pauses for HITL
        Phase.AWAITING_RECOVERY,  # Execution blocked, needs user help
    },
    Phase.AWAITING_RECOVERY: {
        Phase.EXECUTING,  # User provides input, retry step
        Phase.IDLE,       # User chooses to replan/cancel
    },
}


class CoordinatorStateMachine:
    """
    Encapsulates coordinator state transitions and context management.

    Centralizes all phase handling logic that was previously scattered across
    chat_processing_service.py and session_manager.py.

    The state machine:
    1. Validates all transitions against VALID_TRANSITIONS
    2. Stores all context (coordinator, plan, task, answers) in StateContext
    3. Returns typed StateAction objects telling the caller what to do
    4. Provides on_* methods for coordinator events to trigger transitions

    Example:
        sm = CoordinatorStateMachine("session-123")

        # User sends a new task
        action = sm.handle_input("task", "Create a CRM app")
        # action.action_type == ActionType.RUN_COORDINATOR

        # Coordinator creates plan
        sm.on_plan_created(coordinator, plan, task)
        # sm.context.phase == Phase.AWAITING_APPROVAL

        # User approves
        action = sm.handle_input("approval", "approve")
        # action.action_type == ActionType.EXECUTE_PLAN
    """

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.context = StateContext()
        self._handlers: Dict[Phase, Callable[[str, Any], StateAction]] = {
            Phase.IDLE: self._handle_idle,
            Phase.AWAITING_CLARIFICATION: self._handle_clarification,
            Phase.AWAITING_APPROVAL: self._handle_approval,
            Phase.AWAITING_QUESTIONS: self._handle_managed_agent_hitl,
            Phase.EXECUTING: self._handle_executing,
            Phase.AWAITING_RECOVERY: self._handle_recovery,
        }

    @property
    def phase(self) -> Phase:
        """Current phase (convenience accessor)."""
        return self.context.phase

    def transition(self, to_phase: Phase, **context_updates: Any) -> None:
        """
        Validate and perform state transition.

        Args:
            to_phase: Target phase
            **context_updates: Fields to update on context (original_task, coordinator, etc.)

        Raises:
            InvalidTransitionError: If transition is not allowed
        """
        valid_targets = VALID_TRANSITIONS.get(self.context.phase, set())
        if to_phase not in valid_targets:
            raise InvalidTransitionError(
                f"Cannot transition from {self.context.phase.name} to {to_phase.name}. "
                f"Valid targets: {[p.name for p in valid_targets]}"
            )

        old_phase = self.context.phase
        self.context.phase = to_phase

        # Apply context updates
        for key, value in context_updates.items():
            if hasattr(self.context, key):
                setattr(self.context, key, value)
            else:
                logger.warning(f"Unknown context field: {key}")

        logger.info(f"📊 State machine [{self.session_id}]: {old_phase.name} → {to_phase.name}")

    def handle_input(self, input_type: str, data: Any) -> StateAction:
        """
        Handle user input based on current phase.

        Args:
            input_type: Type of input ("task", "approval", "feedback", "answers")
            data: The input data (task text, answer dict, etc.)

        Returns:
            StateAction describing what the caller should do
        """
        handler = self._handlers.get(self.context.phase)
        if not handler:
            return StateAction(
                action_type=ActionType.ERROR,
                error_message=f"No handler for phase {self.context.phase.name}"
            )

        logger.debug(f"📊 State machine [{self.session_id}]: handling {input_type} in {self.context.phase.name}")
        return handler(input_type, data)

    # ============================================================
    # Phase Handlers
    # ============================================================

    def _handle_idle(self, input_type: str, data: Any) -> StateAction:
        """
        Handle input in IDLE phase - new task.

        The coordinator will analyze the task and determine the mode
        (DIRECT, PLAN_AND_APPROVE, PASSTHROUGH, etc.)
        """
        self.context.original_task = data
        return StateAction(
            action_type=ActionType.RUN_COORDINATOR,
            context_updates={"original_task": data}
        )

    def _handle_clarification(self, input_type: str, data: Any) -> StateAction:
        """
        Handle input in AWAITING_CLARIFICATION phase.

        User answered clarifying questions from TaskClassifier.
        Combine with original task and replan.
        """
        combined_task = f"{self.context.original_task}\n\nUser clarification: {data}"

        # Clear state and return combined task for replanning
        self.context.clear()

        return StateAction(
            action_type=ActionType.RUN_COORDINATOR,
            next_phase=Phase.IDLE,
            combined_task=combined_task
        )

    def _handle_approval(self, input_type: str, data: Any) -> StateAction:
        """
        Handle input in AWAITING_APPROVAL phase.

        User either approves the plan or provides feedback.
        """
        if self._is_approval(data):
            # User approved - execute the plan
            return StateAction(
                action_type=ActionType.EXECUTE_PLAN,
                next_phase=Phase.EXECUTING
            )
        else:
            # User provided feedback - combine and replan
            combined_task = f"{self.context.original_task}\n\nUser feedback: {data}"
            self.context.clear()

            return StateAction(
                action_type=ActionType.RUN_COORDINATOR,
                next_phase=Phase.IDLE,
                combined_task=combined_task
            )

    def _handle_managed_agent_hitl(self, input_type: str, data: Any) -> StateAction:
        """
        Handle input in AWAITING_QUESTIONS phase.

        User responded to managed agent HITL (e.g., app_builder paused for approval).
        Prepare task for agent.run() resume.
        """
        # Determine what to pass to agent.run()
        if self._is_approval(data):
            task_for_resume = "approve"
        else:
            # Free-form feedback - combine with original task
            task_for_resume = f"{self.context.original_task}\n\nUser feedback: {data}"

        # Clear state - agent.run() will resume with the prepared task
        self.context.clear()

        return StateAction(
            action_type=ActionType.FALL_THROUGH,
            next_phase=Phase.IDLE,
            combined_task=task_for_resume
        )

    def _handle_executing(self, input_type: str, data: Any) -> StateAction:
        """
        Handle input during EXECUTING phase.

        This shouldn't happen normally - execution is in progress.
        """
        logger.warning(f"📊 State machine [{self.session_id}]: unexpected input during execution")
        return StateAction(
            action_type=ActionType.ERROR,
            error_message="Execution in progress. Please wait for completion."
        )

    def _handle_recovery(self, input_type: str, data: Any) -> StateAction:
        """
        Handle input in AWAITING_RECOVERY phase.

        User can:
        - Type "retry" to retry the failed step as-is
        - Type "skip" to skip the failed step and continue
        - Type "replan" or "cancel" to abort and start over
        - Provide helpful context/input for retry
        """
        data_lower = str(data).lower().strip()

        if data_lower == "retry":
            logger.info(f"📊 State machine [{self.session_id}]: user chose retry")
            return StateAction(
                action_type=ActionType.RETRY_STEP,
                next_phase=Phase.EXECUTING,
            )
        elif data_lower == "skip":
            logger.info(f"📊 State machine [{self.session_id}]: user chose skip")
            return StateAction(
                action_type=ActionType.SKIP_STEP,
                next_phase=Phase.EXECUTING,
            )
        elif data_lower in ("replan", "cancel"):
            logger.info(f"📊 State machine [{self.session_id}]: user chose {data_lower}")
            self.context.clear()
            return StateAction(
                action_type=ActionType.RUN_COORDINATOR,
                next_phase=Phase.IDLE,
            )
        else:
            # User provided helpful input - store and retry with it
            logger.info(f"📊 State machine [{self.session_id}]: user provided recovery input")
            return StateAction(
                action_type=ActionType.RETRY_WITH_INPUT,
                next_phase=Phase.EXECUTING,
                context_updates={"recovery_input": data},
            )

    # ============================================================
    # Event Handlers (called by coordinator event processing)
    # ============================================================

    def on_clarification_needed(self, task: str) -> None:
        """
        Coordinator/TaskClassifier needs clarification before proceeding.

        Transitions: IDLE → AWAITING_CLARIFICATION
        """
        self.transition(
            Phase.AWAITING_CLARIFICATION,
            original_task=task
        )

    def on_plan_created(
        self,
        coordinator: "ExecutionCoordinator",
        plan: "Plan",
        task: str
    ) -> None:
        """
        Coordinator created a plan ready for user approval.

        Transitions: IDLE → AWAITING_APPROVAL
        """
        self.transition(
            Phase.AWAITING_APPROVAL,
            coordinator=coordinator,
            plan=plan,
            original_task=task
        )

    def on_managed_agent_hitl(self, task: str) -> None:
        """
        Managed agent (e.g., app_builder) paused for HITL.

        Transitions: IDLE/EXECUTING → AWAITING_QUESTIONS
        """
        self.transition(
            Phase.AWAITING_QUESTIONS,
            original_task=task
        )

    def on_execution_started(self) -> None:
        """
        Plan execution has started.

        Transitions: AWAITING_APPROVAL → EXECUTING
        """
        self.transition(Phase.EXECUTING)

    def on_execution_blocked(
        self,
        reason: str,
        failed_step: Optional[Any] = None,
    ) -> None:
        """
        Execution blocked, needs user help to proceed.

        Transitions: EXECUTING → AWAITING_RECOVERY

        Args:
            reason: Why execution is blocked
            failed_step: The step that failed (for context)
        """
        self.transition(
            Phase.AWAITING_RECOVERY,
            blocked_reason=reason,
            failed_step=failed_step,
        )

    def on_execution_complete(self) -> None:
        """
        Execution finished (success or failure).

        Transitions: EXECUTING → IDLE
        """
        self.context.clear()
        logger.info(f"📊 State machine [{self.session_id}]: execution complete, state cleared")

    def on_error(self, error_message: str, fatal: bool = False) -> None:
        """
        Error occurred - preserve state by default for retry.

        Can be called from any phase.

        Args:
            error_message: Error description for logging
            fatal: If True, clears all context (unrecoverable). Default False preserves state.
        """
        logger.error(f"📊 State machine [{self.session_id}]: error - {error_message}")

        if fatal:
            # Only clear on truly fatal errors (auth failures, etc.)
            self.context.clear()
            logger.info(f"📊 State machine [{self.session_id}]: fatal error, context cleared")
        else:
            # Preserve state - user can say "retry" or continue naturally
            logger.info(f"📊 State machine [{self.session_id}]: non-fatal error, context preserved for retry")

    # ============================================================
    # Helpers
    # ============================================================

    def _is_approval(self, data: Any) -> bool:
        """Check if the input is an approval response."""
        return str(data).lower().strip() == "approve"

    # ============================================================
    # Serialization (for persistence/debugging)
    # ============================================================

    def to_dict(self) -> Dict[str, Any]:
        """Serialize state machine state for debugging/logging."""
        return {
            "session_id": self.session_id,
            "phase": self.context.phase.name,
            "has_coordinator": self.context.coordinator is not None,
            "has_plan": self.context.plan is not None,
            "has_original_task": self.context.original_task is not None,
            "blocked_reason": self.context.blocked_reason,
            "has_failed_step": self.context.failed_step is not None,
            "has_recovery_input": self.context.recovery_input is not None,
        }

    def __repr__(self) -> str:
        return f"CoordinatorStateMachine(session={self.session_id}, phase={self.context.phase.name})"
