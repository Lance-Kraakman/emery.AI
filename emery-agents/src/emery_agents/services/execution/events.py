"""
Execution Coordinator Events

All event dataclasses emitted by ExecutionCoordinator during planning and execution.
These events enable UI feedback and external monitoring.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Any, Dict

from ...entities.models.plan import Plan


@dataclass
class PendingContext:
    """
    Context preserved across user interactions.

    AIDEV-NOTE: Replaces the `original_task` hack in SessionManager.
    All state needed for resumption after user input lives here.
    """
    original_task: str
    tools: List[Any]
    managed_agents: List[Any]
    clarification_response: Optional[str] = None


@dataclass
class PlanCreatedEvent:
    """Event emitted when a plan has been created."""
    plan_id: str
    plan: Plan


@dataclass
class PlanApprovedEvent:
    """Event emitted when a plan is approved."""
    plan_id: str


@dataclass
class StepStartedEvent:
    """Event emitted when a step starts execution."""
    plan_id: str
    step_id: str
    step_description: str


@dataclass
class StepCompletedEvent:
    """Event emitted when a step completes."""
    plan_id: str
    step_id: str
    result: Optional[str]


@dataclass
class StepFailedEvent:
    """Event emitted when a step fails."""
    plan_id: str
    step_id: str
    error: str


@dataclass
class ExecutionCompletedEvent:
    """Event emitted when all execution is complete."""
    plan_id: str
    success: bool


@dataclass
class FinalSynthesisEvent:
    """Event emitted with synthesized final answer from all step results."""
    plan_id: str
    synthesis: str


@dataclass
class EvaluationResult:
    """Result from evaluator agent."""
    goal_achieved: bool
    blocking_issues: bool
    should_continue: bool
    needs_replan: bool
    reason: str


@dataclass
class EvaluationCompletedEvent:
    """Event emitted when an evaluation completes."""
    plan_id: str
    evaluation: EvaluationResult
    evaluation_number: int


@dataclass
class ReplanTriggeredEvent:
    """Event emitted when replanning is triggered."""
    plan_id: str
    reason: str
    replan_number: int


@dataclass
class PlanUpdatedEvent:
    """Event emitted when the plan has been dynamically updated."""
    plan_id: str
    reason: str
    added_steps: int
    removed_steps: int
    replan_number: int


@dataclass
class PhaseStartedEvent:
    """Event emitted when a new phase begins execution."""
    plan_id: str
    phase_name: str
    phase_goal: str
    step_count: int


@dataclass
class PhaseCompletedEvent:
    """Event emitted when a phase completes execution."""
    plan_id: str
    phase_name: str
    results_summary: str
    needs_replan: bool  # True if subsequent phases should be replanned


@dataclass
class GoalAchievedEvent:
    """Event emitted when the goal is detected as achieved."""
    plan_id: str
    reason: str


@dataclass
class ExecutionBlockedEvent:
    """Event emitted when execution is blocked."""
    plan_id: str
    reason: str


# Recovery analysis events (confidence-based error recovery)
@dataclass
class RecoveryAnalysisEvent:
    """Event emitted when recovery analysis completes."""
    step_id: str
    confidence: float  # 0.0-1.0


@dataclass
class AutoFixStartedEvent:
    """Event emitted when auto-fix begins (high confidence ≥0.8)."""
    step_id: str
    fix_description: str
    confidence: float


@dataclass
class AutoFixCompletedEvent:
    """Event emitted when auto-fix completes successfully."""
    step_id: str
    result: str


@dataclass
class RecoveryPlanProposedEvent:
    """Event emitted when recovery plan needs approval (medium confidence 0.5-0.8)."""
    step_id: str
    fix_description: str
    confidence: float
    gathered_context: Dict[str, Any]


@dataclass(frozen=True)
class PlanRejectedEvent:
    """Event emitted when user rejects the plan."""
    plan_id: str


@dataclass(frozen=True)
class PlanFeedbackEvent:
    """Event emitted when user provides feedback on plan (not approval/rejection)."""
    plan_id: str
    feedback: str


@dataclass(frozen=True)
class ErrorEvent:
    """Generic error event for handle_message() routing errors."""
    error: str
    recoverable: bool = True


# Interrupt handling events
@dataclass
class InterruptQueuedEvent:
    """User sent message during planning - queued for processing after plan completes."""
    message: str
    phase: str  # "planning" or "executing"


@dataclass
class InterruptReceivedEvent:
    """User interrupt received during execution - being incorporated."""
    message: str
    step_index: int  # Which step we were about to execute


@dataclass
class InterruptProcessingEvent:
    """Processing queued interrupt after planning completed."""
    message: str
    classification: str  # CONTEXT_ADD | SCOPE_CHANGE | CANCEL


@dataclass
class PlanCancelledEvent:
    """User cancelled the plan via interrupt."""
    plan_id: str
    reason: str


@dataclass
class ContextInjectedEvent:
    """User's context was injected into execution."""
    message: str
    step_index: int


@dataclass
class ClarifyingQuestion:
    """A structured clarifying question with optional choices.

    Attributes:
        question: The question text to display
        question_type: 'text' | 'single_select' | 'multi_select'
        options: List of answer options (for single_select/multi_select)
        context: Optional explanation of why this info is needed
        required: Whether the question must be answered
        allow_other: Show "Or type your own..." option (default: True, like Claude)
    """
    question: str
    question_type: str = "text"  # 'text' | 'single_select' | 'multi_select'
    options: Optional[List[str]] = None
    context: Optional[str] = None
    required: bool = True
    allow_other: bool = True  # Show custom input option (like Claude)

    @classmethod
    def from_string(cls, question: str) -> "ClarifyingQuestion":
        """Create from a simple string question."""
        return cls(question=question)


@dataclass
class AwaitingClarificationEvent:
    """Event emitted when clarifying questions need to be asked before proceeding."""
    questions: List[ClarifyingQuestion]
    reasoning: str = "Need more information to proceed"

    def __init__(
        self,
        questions: "List[ClarifyingQuestion] | List[str]",
        reasoning: str = "Need more information to proceed"
    ):
        """Initialize with either ClarifyingQuestion objects or strings for backward compatibility."""
        if questions and isinstance(questions[0], str):
            # Backward compatibility: convert strings to ClarifyingQuestion
            self.questions = [ClarifyingQuestion.from_string(q) for q in questions]  # type: ignore
        else:
            self.questions = questions  # type: ignore
        self.reasoning = reasoning

    @classmethod
    def from_dict_list(cls, questions: List[Dict[str, Any]], reasoning: str = "") -> "AwaitingClarificationEvent":
        """Create from list of question dicts (from AskQuestionTool)."""
        structured_questions = [
            ClarifyingQuestion(
                question=q.get("question", ""),
                question_type=q.get("question_type", "text"),
                options=q.get("options"),
                context=q.get("context"),
                required=q.get("required", True),
                allow_other=q.get("allow_other", True),
            )
            for q in questions
        ]
        return cls(questions=structured_questions, reasoning=reasoning)


@dataclass
class ReflectionCompletedEvent:
    """Event emitted when step reflection completes (Reflexion pattern)."""
    step_id: str
    quality_score: float  # 0.0-1.0
    was_suboptimal: bool
    pattern_learned: str


@dataclass
class PlanningStartedEvent:
    """Event emitted when planning begins."""
    goal: str
