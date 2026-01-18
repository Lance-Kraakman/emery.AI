"""
Execution result dataclasses for type-safe data flow.

AIDEV-NOTE: These dataclasses provide structured types for data flowing
through the execution coordinator, replacing untyped dicts and strings.
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .plan import Plan, PlanStep
    from ..services.protocols import Tool


@dataclass
class StepExecutionResult:
    """
    Structured result from plan step execution.

    Replaces raw string returns from _execute_step().
    """

    step_id: str
    success: bool
    result: str
    tool_used: Optional[str] = None
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for logging/persistence."""
        return asdict(self)


@dataclass
class EvaluatorInput:
    """
    Structured input to evaluator agent.

    Provides all context needed for evaluation decisions.
    """

    goal: str
    completed_steps: List[Dict[str, Any]]
    pending_steps: List[str]
    current_status: str
    replans_done: int
    evaluations_done: int = 0
    last_step_result: Optional[str] = None

    def to_prompt(self) -> str:
        """Format as evaluator prompt."""
        completed_summary = "\n".join(
            f"- {s.get('description', 'Unknown')}: {s.get('result', 'No result')}"
            for s in self.completed_steps
        ) or "No steps completed yet"

        pending_summary = "\n".join(
            f"- {desc}" for desc in self.pending_steps
        ) or "No pending steps"

        return f"""
Evaluate the current execution state:

Goal: {self.goal}
Status: {self.current_status}
Replans: {self.replans_done}
Evaluations: {self.evaluations_done}

Completed Steps:
{completed_summary}

Pending Steps:
{pending_summary}

Last Step Result: {self.last_step_result or 'N/A'}
"""

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for JSON."""
        return asdict(self)


@dataclass
class ReplanContext:
    """
    Context for replanning operation.

    Consolidates all data needed to generate recovery steps.
    """

    goal: str
    completed_steps: List[Dict[str, Any]]
    pending_steps: List[str]
    failed_step_description: Optional[str]
    failed_step_error: Optional[str]
    reason: str
    available_tool_names: List[str]

    def build_recovery_prompt(self) -> str:
        """Build prompt for replanning LLM call."""
        completed_summary = "\n".join(
            f"- {s.get('description', 'Unknown')} (result: {s.get('result', 'completed')})"
            for s in self.completed_steps
        ) or "No steps completed yet"

        pending_summary = "\n".join(
            f"- {desc}" for desc in self.pending_steps
        ) or "No pending steps"

        failed_info = ""
        if self.failed_step_description:
            failed_info = f"""
The following step triggered replanning:
- Step: {self.failed_step_description}
- Error: {self.failed_step_error or 'N/A'}
"""

        return f"""
The plan needs adjustment. Please generate recovery steps.

Original Goal: {self.goal}
{failed_info}
Reason for replanning: {self.reason}

Completed Steps:
{completed_summary}

Remaining Pending Steps:
{pending_summary}

Available Tools: {self.available_tool_names}

Generate new steps to recover and achieve the original goal.
Consider what has already been done and what still needs to happen.
"""

    @classmethod
    def from_plan(
        cls,
        plan: "Plan",
        failed_step: Optional["PlanStep"],
        reason: str,
        tools: List["Tool"],
    ) -> "ReplanContext":
        """Create context from plan state."""
        from .plan import PlanStepStatus

        completed = [
            {"description": s.description, "result": s.result}
            for s in plan.steps
            if s.status == PlanStepStatus.COMPLETED.value
        ]
        pending = [
            s.description
            for s in plan.steps
            if s.status == PlanStepStatus.PENDING.value
        ]

        return cls(
            goal=plan.goal,
            completed_steps=completed,
            pending_steps=pending,
            failed_step_description=failed_step.description if failed_step else None,
            failed_step_error=failed_step.error if failed_step else None,
            reason=reason,
            available_tool_names=[getattr(t, "name", str(t)) for t in tools],
        )
