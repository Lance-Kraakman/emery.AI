"""
Task Ledger

In-memory ledger for tracking task execution state.
Used by the evaluator to assess progress and decide on replanning.

This is the runtime orchestration state - NOT persisted to database.
Optionally serializes to JSON for evaluator input.

Extended with ACE-inspired execution tracking:
- ExecutionContext: Curated insights from step results
- StrategyRegistry: Recorded patterns for future planning
- ExecutionEvolutionTracker: Context change detection
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any, TYPE_CHECKING
from enum import Enum

import json

from emery_agents.models.plan import PlanStepStatus

if TYPE_CHECKING:
    from emery_agents.ace import ExecutionContext, ExecutionEvolutionTracker, StrategyRegistry


class LedgerEventType(Enum):
    """Types of events recorded in the ledger."""
    PLAN_CREATED = "plan_created"
    PLAN_APPROVED = "plan_approved"
    PLAN_REJECTED = "plan_rejected"
    STEP_STARTED = "step_started"
    STEP_COMPLETED = "step_completed"
    STEP_FAILED = "step_failed"
    STEP_SKIPPED = "step_skipped"
    REPLAN_TRIGGERED = "replan_triggered"
    EVALUATION_RUN = "evaluation_run"
    EXECUTION_COMPLETED = "execution_completed"
    USER_FEEDBACK = "user_feedback"  # User interrupt/feedback during execution


@dataclass
class LedgerEvent:
    """A single event in the execution ledger."""
    event_type: LedgerEventType
    timestamp: datetime
    step_id: Optional[str] = None
    step_name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "event_type": self.event_type.value,
            "timestamp": self.timestamp.isoformat(),
            "step_id": self.step_id,
            "step_name": self.step_name,
            "data": self.data,
        }


@dataclass
class StepState:
    """Current state of a step in the ledger."""
    step_id: str
    step_name: str
    status: str  # Uses PlanStepStatus.value for consistency
    result: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dictionary."""
        return {
            "step_id": self.step_id,
            "step_name": self.step_name,
            "status": self.status,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class TaskLedger:
    """
    In-memory ledger tracking execution state for a task.

    Used by the evaluator to:
    - See what steps have completed
    - Review step results
    - Decide if goal is achieved
    - Determine if replanning is needed
    """
    task_id: str
    goal: str
    steps: Dict[str, StepState] = field(default_factory=dict)
    events: List[LedgerEvent] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)

    # Execution metadata
    total_steps: int = 0
    replan_count: int = 0
    evaluation_count: int = 0

    # Planning metadata for evaluator visibility
    strategy_guidance: Optional[str] = None  # ACE: Proven patterns from past executions that influenced planning

    # ACE-inspired execution tracking (initialized via init_execution_tracking)
    execution_context: Optional["ExecutionContext"] = None
    strategy_registry: Optional["StrategyRegistry"] = None
    evolution_tracker: Optional["ExecutionEvolutionTracker"] = None

    def init_execution_tracking(self) -> None:
        """
        Initialize ACE-inspired execution tracking.

        Call this at the start of plan execution to enable:
        - Context curation (distill step results into insights)
        - Strategy accumulation (record patterns for future planning)
        - Evolution tracking (detect context degradation)
        """
        # Import from ACE package (avoid circular imports at module level)
        from emery_agents.ace import ExecutionContext, ExecutionEvolutionTracker, StrategyRegistry

        if self.execution_context is None:
            self.execution_context = ExecutionContext(task_id=self.task_id)
        if self.strategy_registry is None:
            self.strategy_registry = StrategyRegistry()
        if self.evolution_tracker is None:
            self.evolution_tracker = ExecutionEvolutionTracker(task_id=self.task_id)

    def add_step(self, step_id: str, step_name: str) -> None:
        """Add a step to track."""
        self.steps[step_id] = StepState(
            step_id=step_id,
            step_name=step_name,
            status=PlanStepStatus.PENDING.value,
        )
        self.total_steps += 1

    def start_step(self, step_id: str) -> None:
        """Mark a step as started."""
        if step_id not in self.steps:
            raise ValueError(f"Step {step_id} not found in ledger")

        self.steps[step_id].status = PlanStepStatus.IN_PROGRESS.value
        self.steps[step_id].started_at = datetime.utcnow()

        self._record_event(
            LedgerEventType.STEP_STARTED,
            step_id=step_id,
            step_name=self.steps[step_id].step_name,
        )

    def complete_step(self, step_id: str, result: Optional[str] = None) -> None:
        """Mark a step as completed."""
        if step_id not in self.steps:
            raise ValueError(f"Step {step_id} not found in ledger")

        step = self.steps[step_id]
        step.status = PlanStepStatus.COMPLETED.value
        step.result = result
        step.completed_at = datetime.utcnow()

        self._record_event(
            LedgerEventType.STEP_COMPLETED,
            step_id=step_id,
            step_name=step.step_name,
            data={"result": result} if result else None,
        )

    def fail_step(self, step_id: str, error: str) -> None:
        """Mark a step as failed."""
        if step_id not in self.steps:
            raise ValueError(f"Step {step_id} not found in ledger")

        step = self.steps[step_id]
        step.status = PlanStepStatus.FAILED.value
        step.error = error
        step.completed_at = datetime.utcnow()

        self._record_event(
            LedgerEventType.STEP_FAILED,
            step_id=step_id,
            step_name=step.step_name,
            data={"error": error},
        )

    def skip_step(self, step_id: str, reason: Optional[str] = None) -> None:
        """Mark a step as skipped."""
        if step_id not in self.steps:
            raise ValueError(f"Step {step_id} not found in ledger")

        step = self.steps[step_id]
        step.status = PlanStepStatus.SKIPPED.value
        step.completed_at = datetime.utcnow()

        self._record_event(
            LedgerEventType.STEP_SKIPPED,
            step_id=step_id,
            step_name=step.step_name,
            data={"reason": reason} if reason else None,
        )

    def record_plan_created(self, plan_data: Optional[Dict[str, Any]] = None) -> None:
        """Record that a plan was created."""
        self._record_event(LedgerEventType.PLAN_CREATED, data=plan_data)

    def record_plan_approved(self) -> None:
        """Record that the plan was approved."""
        self._record_event(LedgerEventType.PLAN_APPROVED)

    def record_replan(self, reason: str) -> None:
        """Record that a replan was triggered."""
        self.replan_count += 1
        self._record_event(
            LedgerEventType.REPLAN_TRIGGERED,
            data={"reason": reason, "replan_number": self.replan_count},
        )

    def record_evaluation(self, evaluation_result: Dict[str, Any]) -> None:
        """Record an evaluation run."""
        self.evaluation_count += 1
        self._record_event(
            LedgerEventType.EVALUATION_RUN,
            data={
                "evaluation_number": self.evaluation_count,
                **evaluation_result,
            },
        )

    def _record_event(
        self,
        event_type: LedgerEventType,
        step_id: Optional[str] = None,
        step_name: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record an event in the ledger."""
        self.events.append(LedgerEvent(
            event_type=event_type,
            timestamp=datetime.utcnow(),
            step_id=step_id,
            step_name=step_name,
            data=data,
        ))

    # Query methods for evaluator

    @property
    def completed_steps(self) -> int:
        """Count of completed steps."""
        return sum(1 for s in self.steps.values() if s.status == PlanStepStatus.COMPLETED.value)

    @property
    def failed_steps(self) -> int:
        """Count of failed steps."""
        return sum(1 for s in self.steps.values() if s.status == PlanStepStatus.FAILED.value)

    @property
    def pending_steps(self) -> int:
        """Count of pending steps."""
        return sum(1 for s in self.steps.values() if s.status == PlanStepStatus.PENDING.value)

    @property
    def is_complete(self) -> bool:
        """Check if all steps are done (completed, failed, or skipped)."""
        terminal_statuses = (
            PlanStepStatus.COMPLETED.value,
            PlanStepStatus.FAILED.value,
            PlanStepStatus.SKIPPED.value,
        )
        return all(s.status in terminal_statuses for s in self.steps.values())

    @property
    def has_failures(self) -> bool:
        """Check if any steps failed."""
        return any(s.status == PlanStepStatus.FAILED.value for s in self.steps.values())

    @property
    def progress_percentage(self) -> float:
        """Calculate progress as percentage."""
        if self.total_steps == 0:
            return 0.0
        terminal_statuses = (
            PlanStepStatus.COMPLETED.value,
            PlanStepStatus.FAILED.value,
            PlanStepStatus.SKIPPED.value,
        )
        done = sum(1 for s in self.steps.values() if s.status in terminal_statuses)
        return (done / self.total_steps) * 100

    def get_step_results(self) -> Dict[str, Optional[str]]:
        """Get results from all completed steps (including empty results)."""
        return {
            step_id: step.result
            for step_id, step in self.steps.items()
            if step.status == PlanStepStatus.COMPLETED.value
        }

    def get_recent_events(self, limit: int = 10) -> List[LedgerEvent]:
        """Get most recent events."""
        return self.events[-limit:] if self.events else []

    # Serialization for evaluator

    def to_dict(self) -> Dict[str, Any]:
        """
        Serialize ledger to dictionary for evaluator input.

        This is what gets passed to the evaluator agent to assess progress.
        """
        result: Dict[str, Any] = {
            "task_id": self.task_id,
            "goal": self.goal,
            "created_at": self.created_at.isoformat(),
            "summary": {
                "total_steps": self.total_steps,
                "completed_steps": self.completed_steps,
                "failed_steps": self.failed_steps,
                "pending_steps": self.pending_steps,
                "progress_percentage": self.progress_percentage,
                "is_complete": self.is_complete,
                "has_failures": self.has_failures,
                "replan_count": self.replan_count,
                "evaluation_count": self.evaluation_count,
            },
            "steps": {
                step_id: step.to_dict()
                for step_id, step in self.steps.items()
            },
            "recent_events": [e.to_dict() for e in self.get_recent_events()],
            "step_results": self.get_step_results(),
        }

        # Include ACE execution tracking data if initialized
        if self.execution_context:
            result["execution_context"] = self.execution_context.to_dict()

        if self.evolution_tracker:
            result["evolution_summary"] = self.evolution_tracker.get_evolution_summary()
            if self.evolution_tracker.detect_degradation():
                result["degradation_detected"] = True

        # Include strategy guidance if it was used during planning
        if self.strategy_guidance:
            result["strategy_guidance"] = self.strategy_guidance

        return result

    def to_json_summary(self) -> str:
        """
        Generate a compact JSON summary for the evaluator.

        Uses compact JSON format - DSPy adapters handle token efficiency.
        Smaller than full to_dict() - focuses on what evaluator needs.

        Includes ACE execution context if available:
        - Curated insights from step results
        - Degradation warnings if context is degrading
        """
        summary: Dict[str, Any] = {
            "goal": self.goal,
            "progress": f"{self.completed_steps}/{self.total_steps}",
            "has_failures": self.has_failures,
            "is_complete": self.is_complete,
            "step_results": self.get_step_results(),
        }

        # Add execution context insights if available
        if self.execution_context and self.execution_context.insights:
            # Format insights for LLM consumption
            summary["curated_context"] = self.execution_context.format_insights(
                max_tokens=500
            )

        # Add degradation warning if context is degrading
        if self.evolution_tracker and self.evolution_tracker.detect_degradation():
            summary["context_warning"] = "Context degradation detected - consider recovery"
            summary["degradation_warnings"] = self.evolution_tracker.degradation_warnings[-3:]

        return json.dumps(summary, separators=(',', ':'))


def create_ledger_from_plan(task_id: str, goal: str, plan_steps: List[Dict[str, Any]]) -> TaskLedger:
    """
    Create a TaskLedger from a plan's steps.

    Args:
        task_id: Unique task identifier
        goal: The goal being achieved
        plan_steps: List of step dicts with step_id and description

    Returns:
        TaskLedger initialized with steps from the plan
    """
    ledger = TaskLedger(task_id=task_id, goal=goal)

    for step in plan_steps:
        step_id = step.get("step_id") or step.get("stepId", "")
        step_name = step.get("description") or step.get("step_name", "")
        ledger.add_step(step_id, step_name)

    return ledger
