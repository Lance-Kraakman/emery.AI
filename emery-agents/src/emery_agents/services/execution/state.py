"""
Unified Execution State

Consolidates scattered state across ExecutionCoordinator, CoordinatorStateMachine,
and PendingContext into a single source of truth.

AIDEV-NOTE: This replaces:
- ExecutionPhase enum (execution_coordinator.py)
- Phase enum (execution_coordinator.py, coordinator_state_machine.py)
- PendingContext dataclass (execution_coordinator.py)
- Scattered state in ExecutionCoordinator._current_phase, etc.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from ...entities.models.plan import Plan, PlanStep
from ..protocols import ManagedAgent, Tool


class Phase(str, Enum):
    """
    Unified execution phase.

    Simplified from 8+ phases to 5 essential states:
    - IDLE: Ready for new task
    - WORKING: Agent is processing (planning OR executing)
    - AWAITING_INPUT: Need user approval or clarification
    - COMPLETE: Task finished successfully
    - FAILED: Task failed with error
    """

    IDLE = "idle"
    WORKING = "working"
    AWAITING_INPUT = "awaiting_input"
    COMPLETE = "complete"
    FAILED = "failed"


class InputType(str, Enum):
    """Type of user input being awaited."""

    APPROVAL = "approval"  # Plan approval
    CLARIFICATION = "clarification"  # Clarifying question
    QUESTIONS = "questions"  # Managed agent HITL questions
    RECOVERY = "recovery"  # Recovery from failure


class WorkMode(str, Enum):
    """What kind of work the agent is doing when in WORKING phase."""

    PLANNING = "planning"  # Read-only tools, generating plan
    EXECUTING = "executing"  # Full tools, running steps


@dataclass
class ClarifyingQuestion:
    """A question to ask the user."""

    question: str
    options: list[str] | None = None
    context: str | None = None
    required: bool = True


@dataclass
class PendingInput:
    """Details about what input is being awaited."""

    input_type: InputType
    questions: list[ClarifyingQuestion] = field(default_factory=list)
    reasoning: str = ""
    failed_step_id: str | None = None  # For recovery


@dataclass
class StepResult:
    """Result from executing a step."""

    step_id: str
    success: bool
    output: str | None = None
    error: str | None = None
    skipped: bool = False


@dataclass
class ExecutionState:
    """
    Single source of truth for execution state.

    All state needed to:
    - Track current phase
    - Store plan and step results
    - Handle resumption after user input
    - Provide context for prompts
    """

    phase: Phase = Phase.IDLE

    # Task context
    original_task: str = ""
    conversation_id: str | None = None

    # Plan state
    plan: Plan | None = None
    current_step_index: int = 0
    step_results: dict[str, StepResult] = field(default_factory=dict)

    # Input state
    pending_input: PendingInput | None = None

    # Error state
    error: str | None = None

    # Tools/agents available (resolved at start)
    tools: list[Tool] = field(default_factory=list)
    managed_agents: list[ManagedAgent] = field(default_factory=list)

    def reset(self) -> None:
        """Reset state for new task."""
        self.phase = Phase.IDLE
        self.original_task = ""
        self.plan = None
        self.current_step_index = 0
        self.step_results = {}
        self.pending_input = None
        self.error = None

    def start_task(
        self, task: str, tools: list[Tool], managed_agents: list[ManagedAgent]
    ) -> None:
        """Initialize state for new task."""
        self.phase = Phase.WORKING
        self.original_task = task
        self.tools = tools
        self.managed_agents = managed_agents
        self.plan = None
        self.current_step_index = 0
        self.step_results = {}
        self.pending_input = None
        self.error = None

    def set_plan(self, plan: Plan) -> None:
        """Set plan and prepare for approval."""
        self.plan = plan
        self.current_step_index = 0
        self.step_results = {}

    def await_approval(self) -> None:
        """Transition to awaiting plan approval."""
        self.phase = Phase.AWAITING_INPUT
        self.pending_input = PendingInput(
            input_type=InputType.APPROVAL,
            reasoning="Plan requires approval before execution",
        )

    def await_clarification(
        self, questions: list[ClarifyingQuestion], reasoning: str = ""
    ) -> None:
        """Transition to awaiting clarification."""
        self.phase = Phase.AWAITING_INPUT
        self.pending_input = PendingInput(
            input_type=InputType.CLARIFICATION,
            questions=questions,
            reasoning=reasoning,
        )

    def await_questions(
        self, questions: list[ClarifyingQuestion], reasoning: str = ""
    ) -> None:
        """Transition to awaiting managed agent HITL questions."""
        self.phase = Phase.AWAITING_INPUT
        self.pending_input = PendingInput(
            input_type=InputType.QUESTIONS,
            questions=questions,
            reasoning=reasoning,
        )

    def await_recovery(
        self,
        failed_step_id: str,
        questions: list[ClarifyingQuestion],
        reasoning: str = "",
    ) -> None:
        """Transition to awaiting recovery input."""
        self.phase = Phase.AWAITING_INPUT
        self.pending_input = PendingInput(
            input_type=InputType.RECOVERY,
            questions=questions,
            reasoning=reasoning,
            failed_step_id=failed_step_id,
        )

    def resume_execution(self) -> None:
        """Resume execution after user input."""
        self.phase = Phase.WORKING
        self.pending_input = None

    def complete_step(
        self,
        step_id: str,
        success: bool,
        output: str | None = None,
        error: str | None = None,
        skipped: bool = False,
    ) -> None:
        """Record step completion."""
        self.step_results[step_id] = StepResult(
            step_id=step_id,
            success=success,
            output=output,
            error=error,
            skipped=skipped,
        )
        if success or skipped:
            self.current_step_index += 1

    def complete(self) -> None:
        """Mark execution as complete."""
        self.phase = Phase.COMPLETE
        self.pending_input = None

    def fail(self, error: str) -> None:
        """Mark execution as failed."""
        self.phase = Phase.FAILED
        self.error = error
        self.pending_input = None

    @property
    def is_awaiting_input(self) -> bool:
        """Check if waiting for user input."""
        return self.phase == Phase.AWAITING_INPUT

    @property
    def is_working(self) -> bool:
        """Check if actively processing."""
        return self.phase == Phase.WORKING

    @property
    def is_complete(self) -> bool:
        """Check if execution finished (success or failure)."""
        return self.phase in (Phase.COMPLETE, Phase.FAILED)

    @property
    def current_step(self) -> PlanStep | None:
        """Get current step being executed."""
        if self.plan and 0 <= self.current_step_index < len(self.plan.steps):
            return self.plan.steps[self.current_step_index]
        return None

    @property
    def pending_steps(self) -> list[PlanStep]:
        """Get remaining steps to execute."""
        if self.plan:
            return self.plan.steps[self.current_step_index :]
        return []

    def to_prompt_context(self) -> dict[str, Any]:
        """Build context dict for prompt templates."""
        return {
            "phase": self.phase.value,
            "task": self.original_task,
            "plan": self.plan,
            "current_step": self.current_step,
            "step_results": {
                k: {"success": v.success, "output": v.output, "error": v.error}
                for k, v in self.step_results.items()
            },
            "tools": [getattr(t, "name", str(t)) for t in self.tools],
            "agents": [getattr(a, "name", str(a)) for a in self.managed_agents],
        }
