"""
Execution Coordinator

Coordinates two-phase execution: planning (read-only) → approval → execution (full).
Enforces tool restrictions based on execution phase.
Includes evaluation loop for goal detection and replanning.
"""

import asyncio
import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import List, Optional, Any, AsyncIterator, Dict, Callable, Tuple, Sequence, TYPE_CHECKING
from enum import Enum

from ..agents.evaluator_agent import EvaluationTool
from ..agents.interrupt_classifier import (
    InterruptClassification,
    create_interrupt_classifier,
    build_classification_prompt,
)
from ..models.plan import Plan, PlanStep, PlanStatus, PlanStepStatus, RecoveryResult, create_plan
from ..models.task_ledger import TaskLedger, create_ledger_from_plan, LedgerEventType
from ..models.capability import CapabilityType
from ..utils.toon_format import to_toon
from ..utils.session_logger import SessionLogger, get_session_logger
from ..models.context_mapping import ResolvedContext
from ..models.execution import StepExecutionResult, EvaluatorInput, ReplanContext
from ..prompts import render_template
from ..tools.tool_modes import ToolMode, filter_tools_for_mode
from .plan_service import PlanService
from .plan_step_executor import PlanStepExecutor
from .protocols import EvaluatorAgent, Tool, ModelProvider, ManagedAgent
# AIDEV-NOTE: TaskClassifier removed - planner handles clarification inline
from .research_tools_provider import get_research_tools, detect_research_intent
from .execution import (
    InterruptHandler,
    ReplanHandler,
    StepExecutor,
    ReplanNeedsClarificationError,
    Phase,
    InputType,
    WorkMode,
    TaskBuilder,
)
from emery_agents.ace import (
    ExecutionContextService,
    create_execution_context_service,
    StrategyAccumulationService,
    create_strategy_accumulation_service,
    StrategyOutcome,
)
from ..types import ExecutionMode
from .planning.plan_differ import PlanDiffer
from .context import SessionConfig, WorkspaceContext, TableInfo, AppInfo, DatabaseInfo
from ..dspy_modules.tools.api import DatabaseAPI, TableAPI

logger = logging.getLogger(__name__)


# Phase, InputType, WorkMode now imported from .execution


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


class CoordinatorMode(Enum):
    """How coordinator handles the task."""
    PLAN_AND_APPROVE = "plan_and_approve"  # Full planning flow
    DIRECT = "direct"  # Execute immediately without plan


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
class PlanningStartedEvent:
    """Event emitted when planning begins."""
    goal: str


@dataclass
class ExecutionCoordinatorConfig:
    """
    Configuration for ExecutionCoordinator with full type safety.

    AIDEV-NOTE: Consolidates constructor params into a typed dataclass.
    """

    plan_service: PlanService
    model_provider: Optional[ModelProvider] = None  # For TaskClassifier
    evaluator_factory: Optional[Callable[[], Tuple[EvaluatorAgent, EvaluationTool]]] = None
    plan_step_executor: Optional[PlanStepExecutor] = None
    evaluate_after_steps: int = 1
    max_replans: int = 3
    org_model: Optional[str] = None

    def __post_init__(self) -> None:
        """Validate configuration."""
        if self.evaluate_after_steps < 1:
            raise ValueError("evaluate_after_steps must be >= 1")
        if self.max_replans < 0:
            raise ValueError("max_replans must be >= 0")


class ExecutionCoordinator:
    """
    Coordinates planning → approval → execution flow.

    Two-phase execution:
    1. Planning Phase: Uses read-only tools to analyze and create a plan
    2. Execution Phase: After approval, uses full tools to execute the plan

    This ensures that potentially destructive operations are only performed
    after explicit user approval of the plan.
    """

    def __init__(
        self,
        plan_service: Optional[PlanService] = None,
        model_provider: Optional[ModelProvider] = None,
        evaluator_factory: Optional[Callable[[], Tuple[EvaluatorAgent, EvaluationTool]]] = None,
        plan_step_executor: Optional[PlanStepExecutor] = None,
        evaluate_after_steps: int = 1,
        max_replans: int = 3,
        org_model: Optional[str] = None,
        api_key: Optional[str] = None,
        organization_id: Optional[int] = None,
        conversation_history: Optional[List[Any]] = None,
        capability_registry: Optional[Any] = None,
    ):
        """
        Initialize execution coordinator.

        Args:
            plan_service: Service for plan persistence
            model_provider: Provider for LLM access (used by TaskClassifier)
            evaluator_factory: Factory for creating (agent, tool) tuples for evaluation
            plan_step_executor: Executor for plan steps using smolagents routing
            evaluate_after_steps: Run evaluation after this many steps (default: 1)
            max_replans: Maximum number of replans before stopping (default: 3)
            org_model: Organization model ID for model resolution hierarchy
            api_key: API key for model providers that require authentication (e.g., Gemini)
            organization_id: Organization ID for RLS context and research agent
            conversation_history: Chat history for resolving references in planning (ACE pattern)
        """
        self.plan_service = plan_service or PlanService()
        self.evaluator_factory = evaluator_factory
        self.plan_step_executor = plan_step_executor
        self.evaluate_after_steps = evaluate_after_steps
        self.max_replans = max_replans
        self._org_model = org_model
        self._api_key = api_key
        self._organization_id = organization_id

        # Unified config (single source of truth for auth/identity)
        self._config = SessionConfig(
            org_id=str(organization_id) if organization_id else "",
            org_model=org_model,
            api_key=api_key,
        )

        self._current_plan: Optional[Plan] = None
        self._ledger: Optional[TaskLedger] = None
        self._replan_count: int = 0
        self._evaluation_count: int = 0
        self._managed_agents: Optional[List[Any]] = None  # Stored from execute() for later use

        # Unified 5-state phase for handle_message() routing
        self._phase: Phase = Phase.IDLE
        # What kind of work (PLANNING or EXECUTING) - for tool filtering
        self._work_mode: Optional[WorkMode] = None
        # What kind of input we're awaiting (APPROVAL, CLARIFICATION, QUESTIONS, RECOVERY)
        self._awaiting_type: Optional[InputType] = None
        # Execution mode (interactive vs autonomous) - set in execute() based on stored_plan
        self._execution_mode: Optional[ExecutionMode] = None
        # Pending context for resumption after user input (replaces session_manager's original_task)
        self._pending_context: Optional[PendingContext] = None

        # NOTE: Interrupt queue state is now managed by self._interrupt_handler
        # (instantiated after ACE services below)

        # AIDEV-NOTE: TaskClassifier removed - planner handles clarification inline
        # via ask_clarifying_question tool. This saves 1 LLM call per request.

        # Store model_provider for recovery analysis (via plan_service)
        self._model_provider = model_provider

        # ACE: Store conversation history for planning (resolves references like "option 1")
        self._conversation_history = conversation_history

        # Capability registry for plan generation (discovery tools)
        self._capability_registry = capability_registry

        # ACE-inspired execution tracking services
        self._execution_context_service: Optional[ExecutionContextService] = None
        self._strategy_service: Optional[StrategyAccumulationService] = None
        if model_provider:
            self._execution_context_service = create_execution_context_service(
                model_provider=model_provider,
                org_model=org_model,
                curate_after_steps=3,
            )
            self._strategy_service = create_strategy_accumulation_service(
                model_provider=model_provider,
                org_model=org_model,
            )
            logger.info("📊 ACE execution tracking services initialized")

        # Extracted handlers for maintainability
        self._interrupt_handler = InterruptHandler(
            model_provider=model_provider,
            org_model=org_model,
        )
        self._replan_handler = ReplanHandler(
            model_provider=model_provider,
            org_model=org_model,
        )
        self._step_executor = StepExecutor(
            plan_step_executor=plan_step_executor,
            session_logger=get_session_logger(),
        )

    @classmethod
    def from_config(cls, config: ExecutionCoordinatorConfig) -> "ExecutionCoordinator":
        """Create coordinator from config dataclass."""
        return cls(
            plan_service=config.plan_service,
            model_provider=config.model_provider,
            evaluator_factory=config.evaluator_factory,
            plan_step_executor=config.plan_step_executor,
            evaluate_after_steps=config.evaluate_after_steps,
            max_replans=config.max_replans,
            org_model=config.org_model,
        )

    @property
    def current_plan(self) -> Optional[Plan]:
        """Get current plan being executed."""
        return self._current_plan

    @property
    def ledger(self) -> Optional[TaskLedger]:
        """Get current task ledger for evaluator access."""
        return self._ledger

    @property
    def phase(self) -> Phase:
        """Get current phase (IDLE, WORKING, AWAITING_INPUT, COMPLETE, FAILED)."""
        return self._phase

    @property
    def work_mode(self) -> Optional[WorkMode]:
        """Get current work mode (PLANNING or EXECUTING) when phase is WORKING."""
        return self._work_mode

    @property
    def awaiting_type(self) -> Optional[InputType]:
        """Get what type of input we're awaiting when phase is AWAITING_INPUT."""
        return self._awaiting_type

    @property
    def execution_mode(self) -> Optional[ExecutionMode]:
        """Get current execution mode (autonomous or interactive).

        Returns None if execute() hasn't been called yet.
        """
        return self._execution_mode

    @property
    def is_terminal_state(self) -> bool:
        """Check if coordinator is in a terminal state (completed or failed)."""
        return self._phase in (Phase.COMPLETE, Phase.FAILED)

    @property
    def pending_context(self) -> Optional[PendingContext]:
        """Get pending context for resumption after user input."""
        return self._pending_context

    # ============================================================
    # Phase State Helpers
    # ============================================================

    def _set_idle(self) -> None:
        """Set phase to IDLE (ready for new task)."""
        self._phase = Phase.IDLE
        self._work_mode = None
        self._awaiting_type = None

    def _set_working(self, mode: WorkMode) -> None:
        """Set phase to WORKING with specified work mode."""
        self._phase = Phase.WORKING
        self._work_mode = mode
        self._awaiting_type = None

    def _set_awaiting(self, input_type: InputType) -> None:
        """Set phase to AWAITING_INPUT with specified input type."""
        self._phase = Phase.AWAITING_INPUT
        self._awaiting_type = input_type
        # Keep work_mode so we know what phase we were in

    def _set_complete(self, success: bool) -> None:
        """Set phase to COMPLETE or FAILED."""
        self._phase = Phase.COMPLETE if success else Phase.FAILED
        self._work_mode = None
        self._awaiting_type = None

    # ============================================================
    # Smart Execution - Adaptive Mode Selection
    # ============================================================

    async def execute(
        self,
        task: str,
        tools: List[Any],
        managed_agents: Optional[List[ManagedAgent]] = None,
        context: Optional[str] = None,
        stored_plan: Optional[Plan] = None,
    ) -> AsyncIterator[Any]:
        """
        Execution entry point - creates plan then executes after approval.

        Flow:
        1. Create plan (planner asks clarifying questions if needed)
        2. Wait for user approval
        3. Execute approved plan

        If stored_plan is provided, skips planning and executes
        the pre-approved plan directly (autonomous mode).

        AIDEV-NOTE: Simplified from previous flow that had separate classification
        step. Now the planner handles clarification inline via ask_clarifying_question
        tool, saving 1 LLM call per request.

        Args:
            task: The user's task/request
            tools: Available tools
            managed_agents: Available managed agents
            context: Additional context (e.g., existing databases)
            stored_plan: Pre-approved plan from skill config (enables autonomous execution)

        Yields:
            PlanningStartedEvent when planning begins
            AwaitingClarificationEvent if planner needs more info
            PlanCreatedEvent when plan is ready
            PlanApprovedEvent + execution events after approval
        """
        # Store managed_agents for later use in execute_plan
        self._managed_agents = managed_agents

        # Initialize session logger for this execution (only logs if EMERY_DEBUG_PROMPTS=1)
        session_id = self._generate_session_id()
        self._session_logger = SessionLogger.get_or_create(session_id)
        self._session_logger.log_event("execution_started", {"task_preview": task[:200]})

        # === AUTONOMOUS MODE: Execute stored plan directly ===
        if stored_plan:
            self._execution_mode = ExecutionMode.AUTONOMOUS
            logger.info(
                f"📋 Coordinator: Executing stored plan '{stored_plan.id}' "
                f"with {len(stored_plan.steps)} steps (autonomous mode)"
            )
            self._current_plan = stored_plan
            self._set_working(WorkMode.EXECUTING)
            self._session_logger.log_state_transition("IDLE", "EXECUTING", "stored_plan")
            self._session_logger.log_plan(
                action="loaded",
                plan_id=stored_plan.id,
                goal=stored_plan.goal,
                steps=[{"step_id": s.step_id, "description": s.description, "status": s.status} for s in stored_plan.steps],
                context=stored_plan.context,
                analysis=stored_plan.analysis
            )

            # Create task ledger for evaluator (same as interactive mode)
            self._ledger = create_ledger_from_plan(
                task_id=stored_plan.id,
                goal=stored_plan.goal,
                plan_steps=[{"step_id": s.step_id, "description": s.description} for s in stored_plan.steps],
            )
            self._ledger.record_plan_created({"plan_id": stored_plan.id, "step_count": len(stored_plan.steps)})
            self._ledger.record_plan_approved()  # Pre-approved for autonomous mode

            # Emit events for UI visibility
            yield PlanCreatedEvent(plan_id=stored_plan.id, plan=stored_plan)
            yield PlanApprovedEvent(plan_id=stored_plan.id)

            # Execute the pre-approved plan
            async for event in self.execute_plan(stored_plan.id, tools):
                yield event
            return

        # === INTERACTIVE MODE: Planning → Approval → Execution ===
        # AIDEV-NOTE: Simplified flow - no separate classification step.
        # The planner handles clarification inline via ask_clarifying_question tool.
        self._execution_mode = ExecutionMode.INTERACTIVE

        # Emit planning started event (for UI feedback)
        task_summary = task[:200] if len(task) > 200 else task
        yield PlanningStartedEvent(goal=task_summary)

        self._session_logger.log_state_transition("IDLE", "PLANNING", "task_received")
        logger.info("📋 Coordinator: Creating plan (planner handles clarification if needed)")

        # Go directly to planning - planner will:
        # - Use ask_clarifying_question tool if details are missing
        # - Create plan with specific steps if task is clear
        async for event in self.create_plan(
            goal=task,
            instructions=task,
            tools=tools,
        ):
            yield event
        # Session manager handles approval state

    async def create_plan_only(
        self,
        task: str,
        tools: List[Any],
        managed_agents: Optional[Sequence[ManagedAgent]] = None,
        context: Optional[str] = None,
        is_template_generation: bool = False,
    ) -> AsyncIterator[Any]:
        """
        Create plan without execution.

        Used by GeneratePlan RPC for skill editor plan generation.
        Stops after plan creation without executing it.

        AIDEV-NOTE: Renamed from classify_and_create_plan since classification
        is now handled inline by the planner.

        Args:
            task: The skill instructions to generate a plan for
            tools: Available tools (for plan context)
            managed_agents: Available managed agents
            context: Additional context (e.g., existing databases)
            is_template_generation: If True, generate template plan with {{ variable }} placeholders

        Yields:
            AwaitingClarificationEvent if questions needed (planner asks via tool)
            Events from create_plan() including PlanCreatedEvent
        """
        self._managed_agents = managed_agents

        # Initialize session logger
        session_id = self._generate_session_id()
        self._session_logger = SessionLogger.get_or_create(session_id)
        self._session_logger.log_event("create_plan_only_started", {"task_preview": task[:200]})

        # Go directly to plan creation - planner handles clarification
        self._session_logger.log_state_transition("IDLE", "PLANNING", "task_received")
        logger.info("📋 Coordinator: Creating plan for skill instructions")
        async for event in self.create_plan(
            goal=task,
            instructions=task,
            tools=tools,
            managed_agents=managed_agents,
            is_template_generation=is_template_generation,
        ):
            yield event

    def _generate_session_id(self) -> str:
        """Generate a short unique session ID for logging."""
        return str(uuid.uuid4())[:8]

    def _build_workspace_context(
        self,
        tools: Optional[List[Tool]] = None,
    ) -> WorkspaceContext:
        """
        Build workspace context using typed API layer.

        Uses DatabaseAPI and TableAPI directly for clean, typed access to
        existing workspace data. No tool interface complexity needed.

        Args:
            tools: Unused, kept for interface compatibility

        Returns:
            WorkspaceContext with existing databases, tables and apps
        """
        org_id = str(self._organization_id) if self._organization_id else ""

        # Debug: log auth context
        api_key_status = f"present ({len(self._api_key)} chars)" if self._api_key else "EMPTY/NONE"
        logger.info(
            f"📊 Building workspace context: api_key={api_key_status}, "
            f"org_id={org_id or 'MISSING'}"
        )

        # Skip API calls if no auth - avoids failed requests
        if not self._api_key or not org_id:
            logger.warning(
                f"⚠️ Cannot fetch workspace data: "
                f"api_key={'missing' if not self._api_key else 'ok'}, "
                f"org_id={'missing' if not org_id else 'ok'}"
            )
            return WorkspaceContext(
                existing_databases=[],
                existing_tables=[],
                existing_apps=[],
            )

        # Use shared typed APIs
        db_api = DatabaseAPI(self._api_key, org_id)
        table_api = TableAPI(self._api_key, org_id)

        # Fetch databases
        databases = db_api.list()
        logger.info(f"📁 Found {len(databases)} existing databases")

        # Fetch tables
        tables = table_api.list()
        logger.info(f"📋 Found {len(tables)} existing tables")

        # Build database name lookup
        db_lookup = {db.id: db.name for db in databases}

        return WorkspaceContext(
            existing_databases=[
                DatabaseInfo(
                    name=db.name,
                    id=db.id,
                    table_count=db.table_count,
                )
                for db in databases
            ],
            existing_tables=[
                TableInfo(
                    name=t.name,
                    id=t.id,
                    database_id=str(t.database_id) if t.database_id else None,
                    database_name=db_lookup.get(t.database_id, "") if t.database_id else "",
                    field_count=t.field_count,
                    fields=t.fields,
                )
                for t in tables
            ],
            existing_apps=[],
        )

    async def create_plan(
        self,
        goal: str,
        instructions: str,
        tools: List[Any],
        context_tables: Optional[ResolvedContext] = None,
        managed_agents: Optional[List[Any]] = None,
        is_template_generation: bool = False,
    ) -> AsyncIterator[Any]:
        """
        Phase 1: Create a plan using read-only tools.

        This phase analyzes the goal and creates a detailed execution plan.
        Only read-only tools are available during this phase.

        Args:
            goal: High-level goal to achieve
            instructions: Detailed instructions for planning
            tools: Available tools (will be filtered to read-only)
            context_tables: Resolved context mappings for available tables
            managed_agents: Available managed agents (for routing decisions)
            is_template_generation: If True, generate template plan with {{ variable }} placeholders

        Yields:
            PlanCreatedEvent when plan is ready for approval
        """
        self._set_working(WorkMode.PLANNING)
        logger.info(f"Starting planning phase for goal: {goal}")

        # Use passed managed_agents or fall back to stored ones
        agents = managed_agents or self._managed_agents or []

        # Filter tools to read-only for planning
        planning_tools = filter_tools_for_mode(tools, ToolMode.PLANNING)
        logger.info(
            f"Planning phase: {len(planning_tools)} read-only tools available "
            f"(filtered from {len(tools)} total)"
        )

        # Detect if research is needed and get research tools
        research_tools = None
        if detect_research_intent(goal) or detect_research_intent(instructions):
            research_tools = get_research_tools()
            if research_tools:
                logger.info(f"🔬 Research intent detected, adding {len(research_tools)} research tools")
            else:
                logger.warning("🔬 Research intent detected but research tools unavailable")

        # Build workspace context with pre-resolved agents and existing resources
        workspace_context = self._build_workspace_context(tools=planning_tools)

        # Generate plan using LLM
        # Pass managed_agents so planner knows available agents for routing
        # Pass research_tools so planner can do web research if needed
        # Pass config and workspace for pre-loaded agents and workspace state
        try:
            result = await self.plan_service.generate_plan(
                basic_instructions=instructions,
                context_tables=context_tables,
                available_tools=[getattr(t, 'name', str(t)) for t in planning_tools],
                goal=goal,
                tools=planning_tools,
                managed_agents=agents,
                research_tools=research_tools,
                is_template_generation=is_template_generation,
                conversation_history=self._conversation_history,  # ACE: Resolve references
                strategy_service=self._strategy_service,  # ACE: Proven patterns
                capability_registry=self._capability_registry,  # Capability discovery tools
                config=self._config,  # Auth and identity (single source of truth)
                workspace=workspace_context,  # Pre-resolved agents and workspace state
            )
        except Exception as e:
            logger.error(f"❌ Plan generation failed: {e}")
            self._set_complete(False)
            yield ErrorEvent(
                error=f"Failed to generate plan: {e}",
                recoverable=True,
            )
            return

        # Check if planner needs clarification instead of generating plan
        if result.needs_clarification and result.clarifying_questions:
            logger.info(f"❓ Planner needs clarification: {len(result.clarifying_questions)} question(s)")
            self._set_awaiting(InputType.CLARIFICATION)

            # Store pending context for when user responds
            self._pending_context = PendingContext(
                original_task=instructions,
                tools=tools,
                managed_agents=managed_agents or [],
            )

            yield AwaitingClarificationEvent.from_dict_list(
                questions=result.clarifying_questions,
                reasoning="Need more details to create a specific plan",
            )
            return

        plan = result.plan
        if plan is None:
            logger.error("❌ Plan generation returned no plan and no questions")
            self._set_complete(False)
            yield ErrorEvent(
                error="Plan generation failed: no plan returned",
                recoverable=True,
            )
            return

        self._current_plan = plan
        self._set_awaiting(InputType.APPROVAL)

        # Create task ledger from plan for evaluator
        self._ledger = create_ledger_from_plan(
            task_id=plan.id,
            goal=goal,
            plan_steps=[{"step_id": s.step_id, "description": s.description} for s in plan.steps],
        )
        self._ledger.record_plan_created({"plan_id": plan.id, "step_count": len(plan.steps)})

        # ACE: Store strategy guidance used during planning so evaluator can see it
        if self.plan_service.last_strategy_guidance:
            self._ledger.strategy_guidance = self.plan_service.last_strategy_guidance

        logger.info(f"Plan {plan.id} created, awaiting approval")
        yield PlanCreatedEvent(plan_id=plan.id, plan=plan)

        # Check for queued interrupts after planning completes
        if self._interrupt_handler.has_pending_interrupts():
            interrupt_msg = self._interrupt_handler.pop_interrupt()
            if interrupt_msg:  # Type guard for Optional[str]
                logger.info(f"📋 Processing queued interrupt after planning: {interrupt_msg[:50]}...")

                # Classify the interrupt
                classification = await self._interrupt_handler.classify_interrupt(interrupt_msg, self._current_plan)
                yield InterruptProcessingEvent(
                    message=interrupt_msg,
                    classification=classification.classification,
                )

                if classification.is_cancel:
                    # User wants to cancel - reset state
                    yield PlanCancelledEvent(
                        plan_id=plan.id,
                        reason=f"User cancelled: {interrupt_msg}",
                    )
                    self._reset_state()
                    return

                if classification.requires_replan:
                    # User wants to change direction - replan with new context
                    logger.info(f"📋 Replanning with user feedback: {interrupt_msg[:50]}...")
                    combined_task = TaskBuilder.with_interrupt(goal, interrupt_msg)

                    # Re-run planning with the new context
                    async for event in self.create_plan(
                        goal=combined_task,
                        instructions=f"{instructions}\n\nAdditional user input: {interrupt_msg}",
                        tools=tools,
                        context_tables=context_tables,
                        managed_agents=managed_agents,
                    ):
                        yield event
                    return

                # CONTEXT_ADD: Inject context into ledger for execution phase
                self._interrupt_handler.inject_context(self._ledger, interrupt_msg)

    async def approve_plan(self, plan_id: str) -> Plan:
        """
        Approve a plan for execution.

        Args:
            plan_id: ID of the plan to approve

        Returns:
            Approved plan

        Raises:
            ValueError: If plan doesn't exist or is already approved
        """
        if not self._current_plan or self._current_plan.id != plan_id:
            raise ValueError(f"Plan {plan_id} not found or not current")

        if self._current_plan.status != PlanStatus.DRAFT.value:
            raise ValueError(
                f"Plan {plan_id} is not in draft status "
                f"(current: {self._current_plan.status})"
            )

        self._current_plan = await self.plan_service.approve_plan(self._current_plan)

        # Record approval in ledger
        if self._ledger:
            self._ledger.record_plan_approved()

        logger.info(f"Plan {plan_id} approved")

        return self._current_plan

    async def execute_plan(
        self,
        plan_id: str,
        tools: List[Any],
        managed_agents: Optional[List[Any]] = None,
    ) -> AsyncIterator[Any]:
        """
        Phase 2: Execute an approved plan with full tools.

        This phase executes each step in the approved plan.
        All tools are available during this phase.

        Args:
            plan_id: ID of the approved plan to execute
            tools: All available tools (no filtering)
            managed_agents: Available managed agents for delegation

        Yields:
            StepStartedEvent, StepCompletedEvent, StepFailedEvent, ExecutionCompletedEvent
        """
        # Use stored managed_agents if not passed
        if managed_agents is None:
            managed_agents = self._managed_agents

        if not self._current_plan or self._current_plan.id != plan_id:
            raise ValueError(f"Plan {plan_id} not found or not current")

        if self._current_plan.status != PlanStatus.APPROVED.value:
            raise ValueError(
                f"Plan {plan_id} must be approved before execution "
                f"(current: {self._current_plan.status})"
            )

        self._set_working(WorkMode.EXECUTING)
        self._current_plan = self._current_plan.start_execution()
        logger.info(f"Starting execution of plan {plan_id}")

        # Reset counters for this execution
        self._replan_count = 0
        self._evaluation_count = 0
        steps_since_eval = 0

        # Initialize ACE execution tracking on ledger
        if self._ledger:
            self._ledger.init_execution_tracking()
            logger.info("📊 Execution tracking initialized on ledger")

        # Track steps since last context curation
        steps_since_curation = 0
        curated_step_ids: List[str] = []  # Track which steps have been curated

        # Phase tracking for hierarchical plans
        current_phase_name: Optional[str] = None
        phase_step_results: Dict[str, List[str]] = {}  # phase_name -> list of results

        # Session logging for flow tracking
        session_logger = get_session_logger()

        # Execute steps with replan support
        # The outer while loop allows restarting after a replan
        success = True
        should_restart = False
        last_evaluation = None  # Track last evaluation for end-of-plan check

        while True:
            # Get pending steps (after replan, this will return new steps)
            pending_steps = self._current_plan.get_pending_steps()

            if not pending_steps:
                # No more steps to execute
                break

            for step_index, step in enumerate(pending_steps):
                # Check for queued interrupts before each step
                if self._interrupt_handler.has_pending_interrupts() or self._interrupt_handler.is_paused:
                    self._interrupt_handler.resume_execution()
                    if self._interrupt_handler.has_pending_interrupts():
                        interrupt_msg = self._interrupt_handler.pop_interrupt()
                        if interrupt_msg:  # Type guard for Optional[str]
                            logger.info(f"⏸️ Processing interrupt before step {step_index}: {interrupt_msg[:50]}...")

                            yield InterruptReceivedEvent(
                                message=interrupt_msg,
                                step_index=step_index,
                            )

                            # Classify the interrupt
                            classification = await self._interrupt_handler.classify_interrupt(interrupt_msg, self._current_plan)
                            yield InterruptProcessingEvent(
                                message=interrupt_msg,
                                classification=classification.classification,
                            )

                            if classification.is_cancel:
                                # User wants to cancel - reset state
                                yield PlanCancelledEvent(
                                    plan_id=plan_id,
                                    reason=f"User cancelled: {interrupt_msg}",
                                )
                                self._reset_state()
                                return

                            if classification.requires_replan:
                                # User wants to change direction - trigger replan
                                logger.info(f"📋 User interrupt requires replan: {interrupt_msg[:50]}...")

                                replan_blocked = False
                                async for event in self._trigger_replan(
                                    reason=f"User interrupt: {interrupt_msg}",
                                    plan_id=plan_id,
                                    tools=tools,
                                ):
                                    yield event
                                    if isinstance(event, ExecutionBlockedEvent):
                                        replan_blocked = True

                                if replan_blocked:
                                    success = False
                                    break

                                should_restart = True
                                break

                            # CONTEXT_ADD: Inject context and continue
                            self._interrupt_handler.inject_context(self._ledger, interrupt_msg)
                            yield ContextInjectedEvent(
                                message=interrupt_msg,
                                step_index=step_index,
                            )

                # Exit the loop if we need to restart after replan
                if should_restart:
                    break

                # Phase transition tracking
                step_phase = step.phase_name  # May be None for non-phased plans
                if step_phase != current_phase_name:
                    # Log phase transition
                    if session_logger:
                        session_logger.log_state_transition(
                            from_state=f"phase:{current_phase_name}" if current_phase_name else "none",
                            to_state=f"phase:{step_phase}" if step_phase else "none",
                            trigger="step_phase_change",
                        )

                    # Emit phase completed for previous phase (if any)
                    if current_phase_name is not None:
                        phase_results = phase_step_results.get(current_phase_name, [])
                        results_summary = f"Completed {len(phase_results)} step(s)"
                        if phase_results:
                            results_summary = "; ".join(r[:100] for r in phase_results if r)[:500]

                        # Check if any step in completed phase has replan_after=True
                        phase_steps = [
                            s for s in self._current_plan.steps
                            if s.phase_name == current_phase_name
                        ]
                        needs_phase_replan = any(s.replan_after for s in phase_steps)

                        yield PhaseCompletedEvent(
                            plan_id=plan_id,
                            phase_name=current_phase_name,
                            results_summary=results_summary,
                            needs_replan=needs_phase_replan,
                        )

                        # Trigger replanning if phase has replan_after=True
                        if needs_phase_replan:
                            logger.info(
                                f"🔄 Phase '{current_phase_name}' completed with replan_after=True"
                            )
                            async for event in self._trigger_replan(
                                reason=f"Phase '{current_phase_name}' completed - replanning subsequent phases based on discoveries",
                                plan_id=plan_id,
                                tools=tools,
                            ):
                                yield event
                                # Max replans exceeded is logged by _trigger_replan but doesn't block for phases
                                # (original behavior: just log warning, don't fail)

                            # Restart step iteration with updated plan (unless max replans hit)
                            if self._replan_count <= self.max_replans:
                                should_restart = True
                                break

                    # Start new phase
                    current_phase_name = step_phase
                    if step_phase:
                        # Count steps in this phase
                        phase_step_count = sum(
                            1 for s in pending_steps if s.phase_name == step_phase
                        )
                        phase_goal = f"Executing {step_phase} phase"
                        yield PhaseStartedEvent(
                            plan_id=plan_id,
                            phase_name=step_phase,
                            phase_goal=phase_goal,
                            step_count=phase_step_count,
                        )
                        # Initialize phase results list
                        if step_phase not in phase_step_results:
                            phase_step_results[step_phase] = []

                # Update ledger - step started
                if self._ledger:
                    self._ledger.start_step(step.step_id)

                yield StepStartedEvent(
                    plan_id=plan_id,
                    step_id=step.step_id,
                    step_description=step.description,
                )

                try:
                    # Mark step as in progress
                    self._current_plan = await self.plan_service.update_step_status(
                        self._current_plan,
                        step.step_id,
                        "in_progress",
                    )

                    # Execute the step via StepExecutor
                    result = await self._step_executor.execute_step(
                        current_plan=self._current_plan,
                        step=step,
                        tools=tools,
                        managed_agents=managed_agents,
                    )

                    # Check if step needs clarification instead of completing
                    if result and "__needs_clarification__" in result:
                        try:
                            clarification_data = json.loads(result)
                            if clarification_data.get("__needs_clarification__"):
                                questions = clarification_data.get("questions", [])
                                logger.info(f"❓ Step {step.step_id} needs clarification: {len(questions)} question(s)")

                                # Store pending context for resumption
                                self._pending_context = PendingContext(
                                    original_task=self._current_plan.basic_instructions if self._current_plan else "",
                                    tools=tools,
                                    managed_agents=managed_agents or [],
                                )
                                self._set_awaiting(InputType.CLARIFICATION)

                                yield AwaitingClarificationEvent.from_dict_list(
                                    questions=questions,
                                    reasoning=f"Step '{step.description}' needs more information to complete",
                                )
                                return
                        except json.JSONDecodeError:
                            pass  # Not JSON, treat as normal result

                    # Mark step as completed
                    self._current_plan = await self.plan_service.update_step_status(
                        self._current_plan,
                        step.step_id,
                        "completed",
                        result=result,
                    )

                    # Update ledger - step completed
                    if self._ledger:
                        self._ledger.complete_step(step.step_id, result)

                    yield StepCompletedEvent(
                        plan_id=plan_id,
                        step_id=step.step_id,
                        result=result,
                    )

                    # Track result for phase summary
                    if step.phase_name and result:
                        if step.phase_name not in phase_step_results:
                            phase_step_results[step.phase_name] = []
                        phase_step_results[step.phase_name].append(result)

                    # ACE: Track execution context evolution
                    if (
                        self._ledger
                        and self._ledger.evolution_tracker
                        and self.plan_step_executor
                    ):
                        self._ledger.evolution_tracker.record_context_change(
                            step_id=step.step_id,
                            key=f"step_{step.step_id}_result",
                            before_value=None,
                            after_value=result,
                        )

                    # ACE: Run context curation periodically
                    steps_since_curation, curated_step_ids = await self._curate_context_if_needed(
                        step, steps_since_curation, curated_step_ids
                    )

                    # Evaluate progress periodically
                    steps_since_eval += 1
                    if self.evaluator_factory and steps_since_eval >= self.evaluate_after_steps:
                        evaluation = await self._evaluate_progress()
                        last_evaluation = evaluation  # Store for end-of-plan check
                        steps_since_eval = 0
                        self._evaluation_count += 1

                        # Record evaluation in ledger
                        if self._ledger:
                            self._ledger.record_evaluation(evaluation.__dict__)

                        yield EvaluationCompletedEvent(
                            plan_id=plan_id,
                            evaluation=evaluation,
                            evaluation_number=self._evaluation_count,
                        )

                        # Log evaluation result
                        if session_logger:
                            session_logger.log_event("evaluation_result", {
                                "step_id": step.step_id,
                                "goal_achieved": evaluation.goal_achieved,
                                "needs_replan": evaluation.needs_replan,
                                "should_continue": evaluation.should_continue,
                                "blocking_issues": evaluation.blocking_issues,
                                "reason": evaluation.reason[:200] if evaluation.reason else None,
                                "evaluation_number": self._evaluation_count,
                            })

                        # Handle evaluation result
                        if evaluation.goal_achieved:
                            logger.info("Goal achieved, stopping execution early")
                            yield GoalAchievedEvent(
                                plan_id=plan_id,
                                reason=evaluation.reason,
                            )
                            break

                        if evaluation.blocking_issues:
                            logger.warning(f"Blocking issues detected: {evaluation.reason}")
                            yield ExecutionBlockedEvent(
                                plan_id=plan_id,
                                reason=evaluation.reason,
                            )
                            success = False
                            break

                        if evaluation.needs_replan:
                            try:
                                replan_blocked = False
                                failed = step if step.status == PlanStepStatus.FAILED.value else None
                                async for event in self._trigger_replan(
                                    reason=evaluation.reason,
                                    plan_id=plan_id,
                                    tools=tools,
                                    failed_step=failed,
                                    session_logger=session_logger,
                                ):
                                    yield event
                                    if isinstance(event, ExecutionBlockedEvent):
                                        replan_blocked = True

                                if replan_blocked:
                                    success = False
                                    break

                                # Set flag to restart step iteration with updated plan
                                should_restart = True
                                break

                            except ReplanNeedsClarificationError as e:
                                # Replan detected missing info - ask user before proceeding
                                logger.info(f"❓ Replan needs clarification: {len(e.questions)} question(s)")
                                self._set_awaiting(InputType.CLARIFICATION)
                                self._pending_context = PendingContext(
                                    original_task=self._current_plan.basic_instructions if self._current_plan else "",
                                    tools=tools,
                                    managed_agents=managed_agents or [],
                                )
                                yield AwaitingClarificationEvent.from_dict_list(
                                    questions=e.questions,
                                    reasoning=e.reasoning or f"Need more information to continue: {evaluation.reason}",
                                )
                                return

                        if not evaluation.should_continue:
                            logger.info("Evaluator indicated stop - ending execution")
                            break

                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Step {step.step_id} failed: {error_msg}")

                    # Mark step as failed
                    self._current_plan = await self.plan_service.update_step_status(
                        self._current_plan,
                        step.step_id,
                        "failed",
                        error=error_msg,
                    )

                    # Update ledger - step failed
                    if self._ledger:
                        self._ledger.fail_step(step.step_id, error_msg)

                    yield StepFailedEvent(
                        plan_id=plan_id,
                        step_id=step.step_id,
                        error=error_msg,
                    )

                    # Attempt intelligent recovery
                    recovery_succeeded = False
                    async for recovery_event in self._handle_step_failure(step, error_msg, tools):
                        yield recovery_event
                        # If auto-fix completed, we can continue execution
                        if isinstance(recovery_event, AutoFixCompletedEvent):
                            recovery_succeeded = True

                    if recovery_succeeded:
                        # Recovery succeeded - continue to next step
                        logger.info(f"✅ Recovery succeeded for step {step.step_id}")
                        continue

                    # Recovery didn't auto-fix (waiting for user input or low confidence)
                    success = False
                    break

            # After for loop: check if we should restart (replan) or exit
            if should_restart:
                should_restart = False  # Reset flag
                last_evaluation = None  # Reset evaluation
                continue  # Restart with new pending steps

            # Check if we should auto-replan: goal not achieved but no more steps
            # This handles the case where evaluator says should_continue=True but needs_replan=False
            # and we've run out of steps to execute
            if (
                last_evaluation
                and not last_evaluation.goal_achieved
                and last_evaluation.should_continue
                and not last_evaluation.blocking_issues
                and self._replan_count < self.max_replans
            ):
                logger.info(
                    "Goal not achieved and should continue, but no more steps - auto-triggering replan"
                )
                async for event in self._trigger_replan(
                    reason="Goal not yet achieved after completing all steps",
                    plan_id=plan_id,
                    tools=tools,
                ):
                    yield event

                last_evaluation = None
                continue  # Restart with new pending steps

            break  # Exit the while loop

        # Mark plan as completed or failed
        if success:
            self._current_plan = self._current_plan.complete()
            self._set_complete(True)
        else:
            self._current_plan = self._current_plan.fail()
            self._set_complete(False)

        # ACE: Record execution pattern for future strategy guidance
        if self._strategy_service and self._current_plan:
            outcome = StrategyOutcome.SUCCESS if success else StrategyOutcome.FAILURE
            # Extract success/failure factors from ledger if available
            success_factors: List[str] = []
            failure_patterns: List[str] = []

            if self._ledger:
                # Get insights about what worked or didn't
                if self._ledger.execution_context:
                    for insight in self._ledger.execution_context.insights:
                        if insight.insight_type.value in ("decision", "artifact"):
                            success_factors.append(insight.summary)
                        elif insight.insight_type.value in ("constraint", "error_recovery"):
                            failure_patterns.append(insight.summary)

            self._strategy_service.record_execution(
                plan=self._current_plan,
                outcome=outcome,
                success_factors=success_factors[:5],  # Limit to top 5
                failure_patterns=failure_patterns[:5],
            )
            logger.info(f"📊 Recorded execution pattern ({outcome.value})")

        logger.info(
            f"Plan {plan_id} execution {'completed' if success else 'failed'}"
        )

        # Emit final PhaseCompletedEvent for the last phase (if any)
        if current_phase_name is not None:
            phase_results = phase_step_results.get(current_phase_name, [])
            results_summary = f"Completed {len(phase_results)} step(s)"
            if phase_results:
                results_summary = "; ".join(r[:100] for r in phase_results if r)[:500]
            yield PhaseCompletedEvent(
                plan_id=plan_id,
                phase_name=current_phase_name,
                results_summary=results_summary,
                needs_replan=False,
            )

        # === FINAL SYNTHESIS: Use evaluator to create coherent final answer ===
        if success and self._ledger:
            try:
                final_synthesis = await self._synthesize_final_answer()
                if final_synthesis:
                    yield FinalSynthesisEvent(
                        plan_id=plan_id,
                        synthesis=final_synthesis,
                    )
                    logger.info("📝 Final synthesis generated from all step results")
            except Exception as e:
                logger.warning(f"Final synthesis failed, using raw results: {e}")

        yield ExecutionCompletedEvent(plan_id=plan_id, success=success)

    def get_ledger_for_evaluator(self) -> Optional[Dict[str, Any]]:
        """
        Get ledger state as dict for evaluator input.

        Returns:
            Ledger state dict or None if no ledger exists
        """
        if self._ledger:
            return self._ledger.to_dict()
        return None

    async def _synthesize_final_answer(self) -> str:
        """
        ACE: Use evaluator to synthesize all step results into coherent final answer.

        This is called AFTER all steps complete, before ExecutionCompletedEvent.
        Takes all step results + curated insights and creates a unified response.

        Returns:
            Synthesized final answer string
        """
        if not self._ledger:
            return ""

        # Get all step results (including empty ones)
        step_results = self._ledger.get_step_results()
        if not step_results:
            return ""

        # Get curated insights from execution context
        curated_context = ""
        if self._ledger.execution_context:
            curated_context = self._ledger.execution_context.format_insights(max_tokens=1000)

        # Build synthesis prompt from template
        goal = self._current_plan.goal if self._current_plan else "Unknown"
        formatted_results = self._format_step_results_for_synthesis(step_results)

        synthesis_prompt = render_template(
            "execution/step_synthesis.j2",
            goal=goal,
            step_results=formatted_results,
            curated_context=curated_context,
        )

        # Use evaluator model for synthesis (runs synchronously in thread)
        if not self.evaluator_factory:
            logger.warning("No evaluator_factory for synthesis - using raw results")
            return self._format_step_results_for_synthesis(step_results)

        try:
            evaluator, _ = self.evaluator_factory()
            result = await asyncio.to_thread(evaluator.run, synthesis_prompt)
            return result if isinstance(result, str) else str(result)
        except Exception as e:
            logger.error(f"Synthesis LLM call failed: {e}")
            # Fallback: concatenate results
            return self._format_step_results_for_synthesis(step_results)

    def _format_step_results_for_synthesis(self, step_results: Dict[str, Optional[str]]) -> str:
        """Format step results for synthesis prompt."""
        if not step_results:
            return "No step results available."

        # Get ledger reference (caller guarantees this is non-None)
        ledger = self._ledger
        if not ledger:
            return "No step results available."

        parts = []
        for step_id, result in step_results.items():
            step_state = ledger.steps.get(step_id)
            step_name = step_state.step_name if step_state else step_id
            result_text = result if result else "(completed with no output)"
            parts.append(f"### {step_name}\n{result_text}")

        return "\n\n".join(parts)

    async def _evaluate_progress(self) -> EvaluationResult:
        """
        Run evaluator agent on current state.

        Uses EvaluationTool pattern - the evaluator LLM calls report_evaluation
        tool with structured output instead of returning raw JSON.

        Returns:
            EvaluationResult with goal status and recommendations
        """
        if not self.evaluator_factory:
            return EvaluationResult(
                goal_achieved=False,
                blocking_issues=False,
                should_continue=True,
                needs_replan=False,
                reason="No evaluator configured",
            )

        try:
            # Factory returns (agent, tool) tuple
            evaluator, eval_tool = self.evaluator_factory()
            ledger_data = self.get_ledger_for_evaluator() or {}

            # Build evaluation prompt from template with TOON for minimal token usage
            goal = self._current_plan.goal if self._current_plan else "Unknown"
            prompt = render_template(
                "execution/step_evaluation.j2",
                goal=goal,
                ledger_state=to_toon(ledger_data),
            )

            # Run evaluator - it will call report_evaluation tool
            # Wrap in thread since evaluator.run() is synchronous (calls blocking LLM APIs)
            await asyncio.to_thread(evaluator.run, prompt)

            # Get structured result from tool
            result = eval_tool.get_result()
            if result:
                return EvaluationResult(
                    goal_achieved=bool(result.get("goal_achieved", False)),
                    blocking_issues=bool(result.get("blocking_issues", False)),
                    should_continue=bool(result.get("should_continue", True)),
                    needs_replan=bool(result.get("needs_replan", False)),
                    reason=str(result.get("reason", "")),
                )

            # Fallback if tool wasn't called (shouldn't happen with proper instructions)
            logger.warning("Evaluator did not call report_evaluation tool")
            return EvaluationResult(
                goal_achieved=False,
                blocking_issues=True,
                should_continue=False,
                needs_replan=False,
                reason="Evaluator did not call report_evaluation tool",
            )

        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return EvaluationResult(
                goal_achieved=False,
                blocking_issues=False,
                should_continue=True,
                needs_replan=False,
                reason=f"Evaluation error: {e}",
            )

    # NOTE: _execute_step has been moved to StepExecutor.execute_step()

    async def _handle_step_failure(
        self,
        step: PlanStep,
        error: str,
        tools: List[Any],
    ) -> AsyncIterator[Any]:
        """
        Enhanced error handling with confidence-based recovery.

        Uses PlanService.analyze_step_failure to:
        1. Re-gather targeted context (LLM decides what to gather)
        2. Assess if error can be auto-fixed with confidence scoring
        3. Route based on confidence:
           - HIGH (≥0.8): Auto-fix with notification
           - MEDIUM (0.5-0.8): Propose fix for user approval
           - LOW (<0.5): Ask clarifying questions

        Args:
            step: The step that failed
            error: The error message
            tools: Available tools for recovery

        Yields:
            RecoveryAnalysisEvent, AutoFixStartedEvent/CompletedEvent,
            RecoveryPlanProposedEvent, or AwaitingClarificationEvent
        """
        if not self._ledger or not self._current_plan:
            # No ledger or plan - fall back to blocking
            logger.warning("No ledger or plan available, cannot attempt recovery")
            return

        logger.info(f"🔍 Attempting recovery analysis for step '{step.step_id}'")

        try:
            # Run recovery analysis via PlanService (LLM gathers context and analyzes)
            # Uses existing research_emery from capability_registry if available
            recovery = self.plan_service.analyze_step_failure(
                failed_step=step,
                error_message=error,
                plan=self._current_plan,
                ledger=self._ledger,
                org_model=self._org_model,
                api_key=self._api_key,
                organization_id=self._organization_id,
                capability_registry=self._capability_registry,
            )

            # Emit analysis result
            yield RecoveryAnalysisEvent(
                step_id=step.step_id,
                confidence=recovery.confidence,
            )

            # Route based on confidence
            if recovery.should_auto_fix:
                # HIGH CONFIDENCE (≥0.8): Auto-fix with notification
                logger.info(
                    f"🔧 Auto-fixing step '{step.step_id}' "
                    f"with {recovery.confidence:.0%} confidence"
                )
                yield AutoFixStartedEvent(
                    step_id=step.step_id,
                    fix_description=recovery.reasoning,
                    confidence=recovery.confidence,
                )

                # Update the step's parameters and retry
                recovery_result = await self._execute_recovery_action(
                    step=step,
                    recovery=recovery,
                    tools=tools,
                )

                yield AutoFixCompletedEvent(
                    step_id=step.step_id,
                    result=recovery_result or "Recovery action completed",
                )

            elif recovery.should_propose:
                # MEDIUM CONFIDENCE (0.5-0.8): Propose for approval
                logger.info(
                    f"📋 Proposing recovery for step '{step.step_id}' "
                    f"with {recovery.confidence:.0%} confidence"
                )
                yield RecoveryPlanProposedEvent(
                    step_id=step.step_id,
                    fix_description=recovery.reasoning,
                    confidence=recovery.confidence,
                    gathered_context={"corrected_parameters": recovery.corrected_parameters},
                )
                # Execution stops here - user must approve via separate flow

            else:
                # LOW CONFIDENCE (<0.5): Ask clarifying questions
                logger.info(
                    f"❓ Low confidence ({recovery.confidence:.0%}) for step '{step.step_id}', "
                    f"asking user for guidance"
                )
                questions = recovery.questions or [
                    "What would you like to do about this error?",
                    "Should we retry, skip this step, or try a different approach?",
                ]
                yield AwaitingClarificationEvent(
                    questions=questions,
                    reasoning=f"Error: {error}\n\n{recovery.reasoning}",
                )
                # Execution stops here - user must provide guidance

        except Exception as e:
            logger.error(f"❌ Recovery analysis failed: {e}")
            # Fall back to asking user
            yield AwaitingClarificationEvent(
                questions=[
                    "What would you like to do about this error?",
                    "Should we retry, skip this step, or try a different approach?",
                ],
                reasoning=f"Recovery analysis failed: {e}\n\nOriginal error: {error}",
            )

    async def _execute_recovery_action(
        self,
        step: PlanStep,
        recovery: RecoveryResult,
        tools: List[Any],
    ) -> Optional[str]:
        """
        Execute the recovery action by updating the step in place and retrying.

        Updates the original step's parameters with LLM-corrected values and retries.
        This is called when confidence is high enough for auto-fix.

        Args:
            step: Original failed step
            recovery: RecoveryResult with corrected_parameters from LLM
            tools: Available tools

        Returns:
            Result string from recovery execution
        """
        # Update the step's parameters in the original plan using with_parameters
        updated_step = step.with_parameters(
            {**(step.parameters or {}), **recovery.corrected_parameters}
        )

        # Update the plan with the corrected step
        if self._current_plan:
            self._current_plan = self._current_plan.update_step(
                step.step_id, updated_step
            )

        logger.info(
            f"🔧 Retrying step with corrected params: {recovery.corrected_parameters}"
        )

        try:
            assert self._current_plan is not None  # We're in execution, plan must exist
            result = await self._step_executor.execute_step(
                current_plan=self._current_plan,
                step=updated_step,
                tools=tools,
            )
            return result
        except Exception as e:
            logger.error(f"Recovery step failed: {e}")
            raise

    # NOTE: _handle_replan has been moved to ReplanHandler.handle_replan()

    async def _trigger_replan(
        self,
        reason: str,
        plan_id: str,
        tools: List[Any],
        failed_step: Optional[PlanStep] = None,
        session_logger: Optional[SessionLogger] = None,
    ) -> AsyncIterator[Any]:
        """
        Execute replan and yield events. Consolidates 4 duplicate replan patterns.

        Args:
            reason: Why replan is being triggered
            plan_id: ID of the current plan
            tools: Available tools for replanning
            failed_step: The step that failed (if any)
            session_logger: Optional session logger for event tracking

        Yields:
            ReplanTriggeredEvent, PlanUpdatedEvent
            ExecutionBlockedEvent if max replans exceeded
            AwaitingClarificationEvent if replan needs clarification

        Raises:
            ReplanNeedsClarificationError: Re-raised for caller to handle
        """
        if self._replan_count >= self.max_replans:
            logger.warning(f"Max replans ({self.max_replans}) exceeded")
            yield ExecutionBlockedEvent(
                plan_id=plan_id,
                reason=f"Max replans ({self.max_replans}) exceeded: {reason}",
            )
            return

        self._replan_count += 1

        # Optional session logging
        if session_logger:
            session_logger.log_event("replan_triggered", {
                "replan_count": self._replan_count,
                "trigger": "evaluation" if failed_step else "interrupt_or_phase",
                "reason": reason[:200] if reason else None,
            })

        yield ReplanTriggeredEvent(
            plan_id=plan_id,
            reason=reason,
            replan_number=self._replan_count,
        )

        # Perform dynamic replanning
        assert self._current_plan is not None
        old_pending_count = len(self._current_plan.get_pending_steps())

        # May raise ReplanNeedsClarificationError for caller to handle
        self._current_plan = await self._replan_handler.handle_replan(
            current_plan=self._current_plan,
            failed_step=failed_step,
            reason=reason,
            tools=tools,
        )

        new_pending_count = len(self._current_plan.get_pending_steps())

        yield PlanUpdatedEvent(
            plan_id=plan_id,
            reason=reason,
            added_steps=max(0, new_pending_count - old_pending_count),
            removed_steps=max(0, old_pending_count - new_pending_count),
            replan_number=self._replan_count,
        )

        # Update ledger with replan info
        if self._ledger:
            self._ledger._record_event(
                event_type=LedgerEventType.REPLAN_TRIGGERED,
                data={
                    "reason": reason,
                    "replan_number": self._replan_count,
                    "new_step_count": new_pending_count,
                }
            )

        logger.info(f"Replan complete ({self._replan_count}): {reason}")

    async def _curate_context_if_needed(
        self,
        step: PlanStep,
        steps_since_curation: int,
        curated_step_ids: List[str],
    ) -> Tuple[int, List[str]]:
        """
        ACE: Run context curation periodically after step completion.

        Args:
            step: Current step being processed
            steps_since_curation: Counter since last curation
            curated_step_ids: List of already curated step IDs

        Returns:
            Updated (steps_since_curation, curated_step_ids)
        """
        steps_since_curation += 1

        if not (
            self._execution_context_service
            and self._ledger
            and self._ledger.execution_context
            and self.plan_step_executor
            and steps_since_curation >= self._execution_context_service.curate_after_steps
        ):
            return steps_since_curation, curated_step_ids

        assert self._current_plan is not None

        # Get step results since last curation
        recent_step_ids = [
            s.step_id for s in self._current_plan.steps
            if s.status == PlanStepStatus.COMPLETED.value
            and s.step_id not in curated_step_ids
        ]

        if not recent_step_ids:
            return steps_since_curation, curated_step_ids

        # Collect StepResult objects for curation
        step_results_to_curate = [
            self.plan_step_executor.step_results[step_id]
            for step_id in recent_step_ids
            if step_id in self.plan_step_executor.step_results
        ]

        logger.info(f"📊 Running context curation for {len(step_results_to_curate)} steps")
        self._ledger.execution_context = self._execution_context_service.curate(
            execution_context=self._ledger.execution_context,
            step_results=step_results_to_curate,
        )
        curated_step_ids.extend(recent_step_ids)

        # Take snapshot after curation and check for degradation
        if self._ledger.evolution_tracker:
            self._ledger.evolution_tracker.take_snapshot(
                step_id=step.step_id,
                context_state=self._ledger.execution_context.to_dict(),
                summary=self._ledger.execution_context.format_insights(500),
            )
            if self._ledger.evolution_tracker.detect_degradation():
                logger.warning("📊 Context degradation detected during execution")

        return 0, curated_step_ids  # Reset counter

    async def run_with_approval(
        self,
        goal: str,
        instructions: str,
        tools: List[Any],
        context_tables: Optional[ResolvedContext] = None,
        auto_approve: bool = False,
    ) -> AsyncIterator[Any]:
        """
        Convenience method to run the full planning → approval → execution flow.

        Args:
            goal: High-level goal to achieve
            instructions: Detailed instructions
            tools: Available tools
            context_tables: Resolved context mappings for available tables
            auto_approve: If True, automatically approve the plan (for testing)

        Yields:
            All events from planning and execution phases
        """
        # Phase 1: Create plan
        async for event in self.create_plan(goal, instructions, tools, context_tables):
            yield event

            if isinstance(event, PlanCreatedEvent):
                if auto_approve:
                    # Auto-approve for testing
                    await self.approve_plan(event.plan_id)
                    yield PlanApprovedEvent(plan_id=event.plan_id)

                    # Phase 2: Execute
                    async for exec_event in self.execute_plan(event.plan_id, tools):
                        yield exec_event


    # ============================================================
    # Unified Message Handling - Single Entry Point
    # ============================================================

    def _reset_state(self) -> None:
        """
        Clean reset of all internal state.

        AIDEV-NOTE: Replaces the scattered `clear_coordinator_state()` calls
        in chat_processing_service.py with a single method.
        """
        self._set_idle()
        self._current_plan = None
        self._ledger = None
        self._pending_context = None
        self._replan_count = 0
        self._evaluation_count = 0
        self._interrupt_handler.clear_queue()
        self._interrupt_handler.resume_execution()
        logger.info("📋 Coordinator state reset to IDLE")

    def queue_interrupt(self, message: str) -> InterruptQueuedEvent:
        """
        Queue an interrupt message for processing.

        Called when a message arrives during planning or execution phase.
        Delegates to InterruptHandler.

        Args:
            message: The user's interrupt message

        Returns:
            InterruptQueuedEvent for UI feedback
        """
        # Delegate to handler, then wrap in coordinator's event type
        handler_event = self._interrupt_handler.queue_interrupt(message, self._phase.value)
        return InterruptQueuedEvent(message=handler_event.message, phase=handler_event.phase)

    # NOTE: _classify_interrupt and _inject_interrupt_context have been moved to InterruptHandler

    async def handle_message(
        self,
        message: str,
        tools: Optional[List[Any]] = None,
        managed_agents: Optional[List[Any]] = None,
    ) -> AsyncIterator[Any]:
        """
        Route message based on current phase - SINGLE ENTRY POINT.

        AIDEV-NOTE: This method replaces the phase handling logic scattered
        throughout chat_processing_service.py. All flow control lives here now.

        Args:
            message: The user's message (task, approval response, or answers)
            tools: Available tools (only needed for fresh start)
            managed_agents: Available managed agents (only needed for fresh start)

        Yields:
            Appropriate events based on current phase and message content
        """
        logger.info(f"📋 handle_message() in phase {self._phase.value}, work_mode={self._work_mode}, awaiting={self._awaiting_type}")

        # Handle interrupts during planning phase - queue for processing after plan completes
        if self._phase == Phase.WORKING and self._work_mode == WorkMode.PLANNING:
            yield self.queue_interrupt(message)
            return

        # Handle interrupts during execution phase - queue and pause
        if self._phase == Phase.WORKING and self._work_mode == WorkMode.EXECUTING:
            self._interrupt_handler.pause_execution()
            yield self.queue_interrupt(message)
            return

        if self._phase == Phase.AWAITING_INPUT and self._awaiting_type == InputType.CLARIFICATION:
            async for event in self._handle_clarification_response(message):
                yield event

        elif self._phase == Phase.AWAITING_INPUT and self._awaiting_type == InputType.APPROVAL:
            async for event in self._handle_approval_response(message, tools):
                yield event

        else:
            # IDLE or fresh start - run classification + planning
            # Store context for potential resumption
            effective_tools = tools or (self._pending_context.tools if self._pending_context else [])
            effective_agents = managed_agents or (self._pending_context.managed_agents if self._pending_context else [])

            # Store pending context for potential clarification/approval
            self._pending_context = PendingContext(
                original_task=message,
                tools=effective_tools,
                managed_agents=effective_agents,
            )

            async for event in self.execute(
                task=message,
                tools=effective_tools,
                managed_agents=effective_agents,
            ):
                # Track phase transitions based on events
                if isinstance(event, AwaitingClarificationEvent):
                    self._set_awaiting(InputType.CLARIFICATION)
                elif isinstance(event, PlanCreatedEvent):
                    self._set_awaiting(InputType.APPROVAL)
                elif isinstance(event, ExecutionCompletedEvent):
                    self._set_complete(event.success)

                yield event

    async def _handle_clarification_response(self, response: str) -> AsyncIterator[Any]:
        """
        Combine original task with clarification and re-classify.

        AIDEV-NOTE: Replaces the `original_task` handling in chat_processing_service.py.
        """
        if not self._pending_context:
            yield ErrorEvent(error="No pending context for clarification")
            return

        combined_task = TaskBuilder.with_clarification(self._pending_context.original_task, response)
        self._set_idle()
        logger.info("📋 Processing clarification response, re-executing with combined task")

        async for event in self.execute(
            task=combined_task,
            tools=self._pending_context.tools,
            managed_agents=self._pending_context.managed_agents,
        ):
            # Track phase transitions
            if isinstance(event, PlanCreatedEvent):
                self._set_awaiting(InputType.APPROVAL)
            elif isinstance(event, ExecutionCompletedEvent):
                self._set_complete(event.success)

            yield event

    async def _handle_approval_response(
        self,
        response: str,
        tools: Optional[List[Any]] = None,
    ) -> AsyncIterator[Any]:
        """
        Handle approve/reject/feedback for plan.

        AIDEV-NOTE: Replaces the `awaiting_approval` phase handling in
        chat_processing_service.py. Supports:
        - Approval keywords: approve, yes, y, ok, proceed
        - Rejection keywords: reject, no, n, cancel
        - Feedback: any other response treated as plan feedback
        """
        response_lower = response.lower().strip()

        if not self._current_plan:
            yield ErrorEvent(error="No current plan to approve/reject")
            return

        if response_lower in ("approve", "yes", "y", "ok", "proceed", "approved"):
            # Approve and execute
            logger.info(f"📋 Plan {self._current_plan.id} approved by user")
            await self.approve_plan(self._current_plan.id)
            yield PlanApprovedEvent(plan_id=self._current_plan.id)

            self._set_working(WorkMode.EXECUTING)
            effective_tools = tools or (self._pending_context.tools if self._pending_context else [])

            async for event in self.execute_plan(self._current_plan.id, effective_tools):
                if isinstance(event, ExecutionCompletedEvent):
                    self._set_complete(event.success)
                yield event

        elif response_lower in ("reject", "no", "n", "cancel", "rejected"):
            # Reject and reset
            logger.info(f"📋 Plan {self._current_plan.id} rejected by user")
            yield PlanRejectedEvent(plan_id=self._current_plan.id)
            self._reset_state()

        else:
            # Treat as feedback - re-plan with feedback context
            logger.info(f"📋 Received feedback on plan {self._current_plan.id}")
            yield PlanFeedbackEvent(plan_id=self._current_plan.id, feedback=response)

            if not self._pending_context:
                yield ErrorEvent(error="No pending context for feedback-based replan")
                return

            # Re-plan with feedback context
            feedback_task = TaskBuilder.with_feedback(self._pending_context.original_task, response)
            self._set_working(WorkMode.PLANNING)

            async for event in self.execute(
                task=feedback_task,
                tools=self._pending_context.tools,
                managed_agents=self._pending_context.managed_agents,
            ):
                if isinstance(event, PlanCreatedEvent):
                    self._set_awaiting(InputType.APPROVAL)
                yield event


class ExecutionCoordinatorFactory:
    """Factory for creating ExecutionCoordinator instances."""

    def __init__(
        self,
        plan_service: Optional[PlanService] = None,
        evaluator_factory: Optional[Callable[[], Tuple[EvaluatorAgent, EvaluationTool]]] = None,
        plan_step_executor: Optional[PlanStepExecutor] = None,
        evaluate_after_steps: int = 1,
        max_replans: int = 3,
        org_model: Optional[str] = None,
    ):
        """
        Initialize factory.

        Args:
            plan_service: Plan service for persistence
            evaluator_factory: Factory for creating (agent, tool) tuples for evaluation
            plan_step_executor: Executor for plan steps using smolagents routing
            evaluate_after_steps: Run evaluation after this many steps
            max_replans: Maximum number of replans before stopping
            org_model: Organization model ID for model resolution hierarchy
        """
        self.plan_service = plan_service
        self.evaluator_factory = evaluator_factory
        self.plan_step_executor = plan_step_executor
        self.evaluate_after_steps = evaluate_after_steps
        self.max_replans = max_replans
        self.org_model = org_model

    def create(self) -> ExecutionCoordinator:
        """Create a new ExecutionCoordinator instance."""
        return ExecutionCoordinator(
            plan_service=self.plan_service,
            evaluator_factory=self.evaluator_factory,
            plan_step_executor=self.plan_step_executor,
            evaluate_after_steps=self.evaluate_after_steps,
            max_replans=self.max_replans,
            org_model=self.org_model,
        )
