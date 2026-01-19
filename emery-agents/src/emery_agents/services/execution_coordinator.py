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
from typing import List, Optional, Any, AsyncIterator, Dict, Callable, Tuple, TYPE_CHECKING
from enum import Enum

from ..agents.evaluator_agent import EvaluationTool
from ..agents.interrupt_classifier import (
    InterruptClassification,
    create_interrupt_classifier,
    build_classification_prompt,
)
from ..models.plan import Plan, PlanStep, PlanStatus, PlanStepStatus, SubPlan, RecoveryResult, create_plan
from ..models.task_ledger import TaskLedger, create_ledger_from_plan, LedgerEventType
from ..utils.toon_format import to_toon
from ..utils.session_logger import SessionLogger, get_session_logger
from ..models.context_mapping import ResolvedContext
from ..models.execution import StepExecutionResult, EvaluatorInput, ReplanContext
from ..models.planning_questions import BatchedQuestions, QuestionAnswers
from ..tools.tool_modes import ToolMode, filter_tools_for_mode
from .plan_service import PlanService
from .plan_step_executor import PlanStepExecutor
from .sub_agent_planner import SubAgentPlanner, SubAgentPlanningResult
from .protocols import EvaluatorAgent, Tool, ModelProvider, ManagedAgent
from .task_classifier import TaskClassifier, TaskClassification
from .research_tools_provider import get_research_tools, detect_research_intent
from .execution_context_service import ExecutionContextService, create_execution_context_service
from .strategy_accumulation_service import StrategyAccumulationService, create_strategy_accumulation_service
from ..models.strategy_accumulation import StrategyOutcome
from ..types import ExecutionMode

logger = logging.getLogger(__name__)


class ExecutionPhase(Enum):
    """Current phase of execution."""
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


class Phase(str, Enum):
    """
    Unified phase enum for handle_message() routing.

    AIDEV-NOTE: This merges SessionManager's string phases with ExecutionPhase enum.
    The string inheritance allows direct comparison with string values.
    """
    IDLE = "idle"
    CLASSIFYING = "classifying"
    AWAITING_CLARIFICATION = "awaiting_clarification"
    PLANNING = "planning"
    AWAITING_CASCADE_QUESTIONS = "awaiting_cascade_questions"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


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
    agent_factories: Optional[Dict[str, Callable[..., Any]]] = None
    clarification_response: Optional[str] = None
    cascade_answers: Optional[Dict[str, str]] = None


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
class AwaitingClarificationEvent:
    """Event emitted when clarifying questions need to be asked before proceeding."""
    questions: List[str]
    reasoning: str


@dataclass
class DirectExecutionStartedEvent:
    """Event emitted when coordinator starts direct execution (no plan)."""
    task: str


# Cascading planning events
@dataclass
class SubPlanCreatedEvent:
    """Event emitted when a sub-agent creates its detailed plan."""
    plan_id: str
    step_id: str
    agent_name: str
    sub_plan_goal: str
    sub_plan_step_count: int


@dataclass
class QuestionsCollectedEvent:
    """Event emitted when sub-agents have questions for user."""
    plan_id: str
    questions: BatchedQuestions


@dataclass
class CascadingPlanCompleteEvent:
    """Event emitted when all planning (high-level + sub-agent) is complete."""
    plan_id: str
    total_sub_plans: int


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
        self._current_phase = ExecutionPhase.PLANNING
        self._current_plan: Optional[Plan] = None
        self._ledger: Optional[TaskLedger] = None
        self._replan_count: int = 0
        self._evaluation_count: int = 0
        self._managed_agents: Optional[List[Any]] = None  # Stored from execute() for later use
        self._agent_factories: Optional[Dict[str, Callable[..., Any]]] = None  # For cascade planning
        self._sub_planner: Optional[SubAgentPlanner] = None  # For cascading planning resume

        # Unified phase for handle_message() routing (replaces session_manager's coordinator_phase)
        self._unified_phase: Phase = Phase.IDLE
        # Execution mode (interactive vs autonomous) - set in execute() based on stored_plan
        self._execution_mode: Optional[ExecutionMode] = None
        # Pending context for resumption after user input (replaces session_manager's original_task)
        self._pending_context: Optional[PendingContext] = None

        # Interrupt handling queue for messages received during planning/execution
        self._interrupt_queue: List[str] = []
        self._execution_paused: bool = False

        # LLM-based task classifier (replaces string matching)
        # Includes research_agent for comprehensive context gathering before classification
        self._task_classifier: Optional[TaskClassifier] = None
        if model_provider:
            # Create research_agent for classifier to gather context (apps, tables, URLs)
            research_agent = None
            if api_key and organization_id:
                try:
                    from ..agents.research_agent import create_research_agent
                    model = model_provider.get_model(model_id=org_model) if org_model else model_provider.get_model()
                    research_agent = create_research_agent(
                        model=model,
                        api_key=api_key,
                        organization_id=organization_id,
                        max_steps=6,
                    )
                    logger.info("📋 Created research_agent for task classifier")
                except Exception as e:
                    logger.warning(f"📋 Could not create research_agent for classifier: {e}")

            self._task_classifier = TaskClassifier(
                model_provider=model_provider,
                research_agent=research_agent,
            )

        # Store model_provider for recovery analysis (via plan_service)
        self._model_provider = model_provider

        # ACE: Store conversation history for planning (resolves references like "option 1")
        self._conversation_history = conversation_history

        # ACE-inspired execution tracking services
        self._execution_context_service: Optional[ExecutionContextService] = None
        self._strategy_service: Optional[StrategyAccumulationService] = None
        if model_provider:
            self._execution_context_service = create_execution_context_service(
                model_provider=model_provider,
                org_model=org_model,
                curate_after_steps=3,
            )
            self._strategy_service = create_strategy_accumulation_service()
            logger.info("📊 ACE execution tracking services initialized")

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
    def current_phase(self) -> ExecutionPhase:
        """Get current execution phase."""
        return self._current_phase

    @property
    def current_plan(self) -> Optional[Plan]:
        """Get current plan being executed."""
        return self._current_plan

    @property
    def ledger(self) -> Optional[TaskLedger]:
        """Get current task ledger for evaluator access."""
        return self._ledger

    @property
    def unified_phase(self) -> Phase:
        """Get current unified phase for handle_message() routing."""
        return self._unified_phase

    @property
    def execution_mode(self) -> Optional[ExecutionMode]:
        """Get current execution mode (autonomous or interactive).

        Returns None if execute() hasn't been called yet.
        """
        return self._execution_mode

    @property
    def is_terminal_state(self) -> bool:
        """Check if coordinator is in a terminal state (completed or failed)."""
        return self._unified_phase in (Phase.COMPLETED, Phase.FAILED)

    @property
    def pending_context(self) -> Optional[PendingContext]:
        """Get pending context for resumption after user input."""
        return self._pending_context

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
        agent_factories: Optional[Dict[str, Callable[..., Any]]] = None,
    ) -> AsyncIterator[Any]:
        """
        Smart execution entry point - decides mode based on LLM task analysis.

        Uses TaskClassifier (LLM-based) to determine:
        - Whether task is simple (DIRECT) or complex (PLAN_AND_APPROVE)
        - Whether clarifying questions should be asked first
        - Which agent should handle the task (if clear)

        If stored_plan is provided, skips classification and executes
        the pre-approved plan directly (autonomous mode).

        AIDEV-NOTE: Replaces brittle string matching patterns with intelligent
        LLM-based classification. If needs_clarification is True, questions
        are yielded before proceeding.

        Args:
            task: The user's task/request
            tools: Available tools
            managed_agents: Available managed agents (for classification)
            context: Additional context (e.g., existing databases)
            stored_plan: Pre-approved plan from skill config (enables autonomous execution)
            agent_factories: Factory functions for cascade planning (SubAgentPlanner)

        Yields:
            AwaitingClarificationEvent if questions needed
            DirectExecutionStartedEvent for simple tasks
            PlanCreatedEvent for complex tasks
            PlanApprovedEvent + execution events for stored plans
        """
        # Store managed_agents and agent_factories for later use in execute_plan
        self._managed_agents = managed_agents
        self._agent_factories = agent_factories

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
            self._current_phase = ExecutionPhase.EXECUTING
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
        self._execution_mode = ExecutionMode.INTERACTIVE

        # Use LLM-based classification
        self._session_logger.log_state_transition("IDLE", "CLASSIFYING", "task_received")
        classification = self._classify_task(task, managed_agents or [], context)
        self._session_logger.log_event("task_classified", {
            "mode": classification.mode,
            "needs_clarification": classification.needs_clarification,
            "target_agent": classification.target_agent,
            "use_cascade_planning": classification.use_cascade_planning,
            "reasoning": classification.reasoning[:200] if classification.reasoning else ""
        })

        # If clarification questions are needed, ask them first
        if classification.needs_clarification and classification.clarification_questions:
            logger.info(
                f"📋 Coordinator: Task needs clarification - "
                f"{len(classification.clarification_questions)} questions"
            )
            yield AwaitingClarificationEvent(
                questions=classification.clarification_questions,
                reasoning=classification.reasoning,
            )
            return

        # Map classification mode to coordinator mode
        if classification.mode == "DIRECT":
            logger.info("📋 Coordinator: Direct execution (no plan needed)")
            yield DirectExecutionStartedEvent(task=task)
            return

        # PLAN_AND_APPROVE: Full planning flow
        # Check if cascade planning is needed (multi-agent complex tasks)
        # Requires agent_factories for SubAgentPlanner to create agents with planning callbacks
        if classification.use_cascade_planning and agent_factories:
            logger.info("📋 Coordinator: Cascade planning mode (multi-agent complex task)")
            async for event in self.create_cascading_plan(
                goal=task,
                instructions=task,
                tools=tools,
                agent_factories=agent_factories,
            ):
                yield event
        else:
            logger.info("📋 Coordinator: Plan and approve mode (complex task)")
            async for event in self.create_plan(
                goal=task,
                instructions=task,
                tools=tools,
            ):
                yield event
        # Session manager handles approval state

    async def classify_and_create_plan(
        self,
        task: str,
        tools: List[Any],
        managed_agents: Optional[List[ManagedAgent]] = None,
        context: Optional[str] = None,
        is_skill_template: bool = False,
    ) -> AsyncIterator[Any]:
        """
        Classify task and create plan without execution.

        Used by GeneratePlan RPC for skill editor plan generation.
        Reuses the exact same classification and planning logic as execute(),
        but stops after plan creation without executing it.

        Args:
            task: The skill instructions to generate a plan for
            tools: Available tools (for plan context)
            managed_agents: Available managed agents (for classification context)
            context: Additional context (e.g., existing databases)
            is_skill_template: If True, plan won't hardcode IDs (for reusable skills)

        Yields:
            AwaitingClarificationEvent if questions needed (caller should pause)
            Events from create_plan() including PlanCreatedEvent
        """
        self._managed_agents = managed_agents

        # Initialize session logger
        session_id = self._generate_session_id()
        self._session_logger = SessionLogger.get_or_create(session_id)
        self._session_logger.log_event("classify_and_create_plan_started", {"task_preview": task[:200]})

        # === CLASSIFICATION (same as execute()) ===
        self._session_logger.log_state_transition("IDLE", "CLASSIFYING", "task_received")
        classification = self._classify_task(task, managed_agents or [], context)
        self._session_logger.log_event("task_classified", {
            "mode": classification.mode,
            "needs_clarification": classification.needs_clarification,
            "target_agent": classification.target_agent,
            "reasoning": classification.reasoning[:200] if classification.reasoning else ""
        })

        # If clarification questions are needed, ask them first
        if classification.needs_clarification and classification.clarification_questions:
            logger.info(
                f"📋 Coordinator: Task needs clarification - "
                f"{len(classification.clarification_questions)} questions"
            )
            yield AwaitingClarificationEvent(
                questions=classification.clarification_questions,
                reasoning=classification.reasoning,
            )
            return

        # === PLAN CREATION (same as execute() for PLAN_AND_APPROVE) ===
        # Always use create_plan for skill generation (no DIRECT mode)
        logger.info("📋 Coordinator: Creating plan for skill instructions")
        async for event in self.create_plan(
            goal=task,
            instructions=task,
            tools=tools,
            managed_agents=managed_agents,
            is_skill_template=is_skill_template,
        ):
            yield event

        # NOTE: Does NOT call execute_plan() - that's the key difference from execute()

    def _generate_session_id(self) -> str:
        """Generate a short unique session ID for logging."""
        return str(uuid.uuid4())[:8]

    def _classify_task(
        self,
        task: str,
        managed_agents: List[ManagedAgent],
        context: Optional[str] = None,
    ) -> TaskClassification:
        """
        Classify task using LLM-based TaskClassifier.

        AIDEV-NOTE: Replaces brittle string matching (_get_target_agent,
        _is_multi_step_task, _is_ambiguous_request) with intelligent LLM-based
        classification. The LLM is much better at detecting ambiguity and
        determining appropriate execution mode.

        Args:
            task: User's task text
            managed_agents: Available managed agents (typed via ManagedAgent protocol)
            context: Additional context (e.g., existing databases)

        Returns:
            TaskClassification with mode, clarification needs, and questions
        """
        if not self._task_classifier:
            # Fallback if no classifier configured - default to PLAN_AND_APPROVE
            logger.warning("📋 No TaskClassifier configured, defaulting to PLAN_AND_APPROVE")
            return TaskClassification(
                mode="PLAN_AND_APPROVE",
                needs_clarification=False,
                target_agent=None,
                clarification_questions=[],
                reasoning="No classifier configured",
                use_cascade_planning=False,
            )

        # Get agent info for classification context
        # ManagedAgent protocol guarantees .name and .description attributes exist
        available_agents_info: List[Dict[str, str]] = [
            {"name": a.name, "description": a.description}
            for a in managed_agents
        ]

        # Run LLM-based classification with resolved model
        return self._task_classifier.classify(
            task=task,
            available_agents=available_agents_info,
            context=context,
            org_model=self._org_model,
        )

    async def create_plan(
        self,
        goal: str,
        instructions: str,
        tools: List[Any],
        context_tables: Optional[ResolvedContext] = None,
        managed_agents: Optional[List[Any]] = None,
        is_skill_template: bool = False,
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
            is_skill_template: If True, plan is for a reusable skill (no hardcoded IDs)

        Yields:
            PlanCreatedEvent when plan is ready for approval
        """
        self._current_phase = ExecutionPhase.PLANNING
        self._unified_phase = Phase.PLANNING
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

        # Generate plan using LLM
        # Pass managed_agents so planner knows available agents for routing
        # Pass research_tools so planner can do web research if needed
        # Context gathering is done via research_emery (created inside PlanService)
        try:
            plan = await self.plan_service.generate_plan(
                basic_instructions=instructions,
                context_tables=context_tables,
                available_tools=[getattr(t, 'name', str(t)) for t in planning_tools],
                goal=goal,
                org_model=self._org_model,
                tools=planning_tools,
                managed_agents=agents,
                research_tools=research_tools,
                api_key=self._api_key,
                organization_id=self._organization_id,
                is_skill_template=is_skill_template,
                conversation_history=self._conversation_history,  # ACE: Resolve references
                strategy_service=self._strategy_service,  # ACE: Proven patterns
            )
        except Exception as e:
            logger.error(f"❌ Plan generation failed: {e}")
            self._current_phase = ExecutionPhase.FAILED
            self._unified_phase = Phase.FAILED
            yield ErrorEvent(
                error=f"Failed to generate plan: {e}",
                recoverable=True,
            )
            return

        self._current_plan = plan
        self._current_phase = ExecutionPhase.AWAITING_APPROVAL

        # Create task ledger from plan for evaluator
        self._ledger = create_ledger_from_plan(
            task_id=plan.id,
            goal=goal,
            plan_steps=[{"step_id": s.step_id, "description": s.description} for s in plan.steps],
        )
        self._ledger.record_plan_created({"plan_id": plan.id, "step_count": len(plan.steps)})

        logger.info(f"Plan {plan.id} created, awaiting approval")
        yield PlanCreatedEvent(plan_id=plan.id, plan=plan)

        # Check for queued interrupts after planning completes
        if self._interrupt_queue:
            interrupt_msg = self._interrupt_queue.pop(0)
            logger.info(f"📋 Processing queued interrupt after planning: {interrupt_msg[:50]}...")

            # Classify the interrupt
            classification = await self._classify_interrupt(interrupt_msg)
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
                combined_task = f"{goal}\n\nUser feedback: {interrupt_msg}"

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
            self._inject_interrupt_context(interrupt_msg)

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

        self._current_phase = ExecutionPhase.EXECUTING
        self._unified_phase = Phase.EXECUTING
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
                if self._interrupt_queue or self._execution_paused:
                    self._execution_paused = False
                    if self._interrupt_queue:
                        interrupt_msg = self._interrupt_queue.pop(0)
                        logger.info(f"⏸️ Processing interrupt before step {step_index}: {interrupt_msg[:50]}...")

                        yield InterruptReceivedEvent(
                            message=interrupt_msg,
                            step_index=step_index,
                        )

                        # Classify the interrupt
                        classification = await self._classify_interrupt(interrupt_msg)
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

                            if self._replan_count >= self.max_replans:
                                logger.warning(f"Max replans ({self.max_replans}) exceeded")
                                yield ExecutionBlockedEvent(
                                    plan_id=plan_id,
                                    reason=f"Max replans exceeded after user interrupt: {interrupt_msg}",
                                )
                                success = False
                                break

                            self._replan_count += 1
                            yield ReplanTriggeredEvent(
                                plan_id=plan_id,
                                reason=f"User interrupt: {interrupt_msg}",
                                replan_number=self._replan_count,
                            )

                            # Replan with interrupt context
                            old_pending_count = len(self._current_plan.get_pending_steps())
                            self._current_plan = await self._handle_replan(
                                current_plan=self._current_plan,
                                failed_step=None,
                                reason=f"User interrupt: {interrupt_msg}",
                                tools=tools,
                            )
                            new_pending_count = len(self._current_plan.get_pending_steps())

                            yield PlanUpdatedEvent(
                                plan_id=plan_id,
                                reason=f"User interrupt: {interrupt_msg}",
                                added_steps=new_pending_count,
                                removed_steps=old_pending_count - new_pending_count if old_pending_count > new_pending_count else 0,
                                replan_number=self._replan_count,
                            )

                            should_restart = True
                            break

                        # CONTEXT_ADD: Inject context and continue
                        self._inject_interrupt_context(interrupt_msg)
                        yield ContextInjectedEvent(
                            message=interrupt_msg,
                            step_index=step_index,
                        )

                # Exit the loop if we need to restart after replan
                if should_restart:
                    break

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

                    # Execute the step
                    result = await self._execute_step(step, tools, managed_agents)

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
                    steps_since_curation += 1
                    if (
                        self._execution_context_service
                        and self._ledger
                        and self._ledger.execution_context
                        and self.plan_step_executor
                        and steps_since_curation >= self._execution_context_service.curate_after_steps
                    ):
                        # Get step results since last curation
                        recent_step_ids = [
                            s.step_id for s in self._current_plan.steps
                            if s.status == PlanStepStatus.COMPLETED.value
                            and s.step_id not in curated_step_ids
                        ]

                        if recent_step_ids:
                            logger.info(f"📊 Running context curation for {len(recent_step_ids)} steps")
                            self._ledger.execution_context = self._execution_context_service.curate(
                                execution_context=self._ledger.execution_context,
                                raw_step_results=self.plan_step_executor.step_results,
                                recent_step_ids=recent_step_ids,
                            )
                            curated_step_ids.extend(recent_step_ids)
                            steps_since_curation = 0

                            # Take snapshot after curation and check for degradation
                            if self._ledger.evolution_tracker:
                                self._ledger.evolution_tracker.take_snapshot(
                                    step_id=step.step_id,
                                    context_state=self._ledger.execution_context.to_dict(),
                                    summary=self._ledger.execution_context.get_relevant_context(500),
                                )

                                # Check for degradation
                                if self._ledger.evolution_tracker.detect_degradation():
                                    logger.warning("📊 Context degradation detected during execution")

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
                            if self._replan_count >= self.max_replans:
                                logger.warning(f"Max replans ({self.max_replans}) exceeded")
                                yield ExecutionBlockedEvent(
                                    plan_id=plan_id,
                                    reason=f"Max replans ({self.max_replans}) exceeded: {evaluation.reason}",
                                )
                                success = False
                                break

                            self._replan_count += 1
                            yield ReplanTriggeredEvent(
                                plan_id=plan_id,
                                reason=evaluation.reason,
                                replan_number=self._replan_count,
                            )

                            # Perform dynamic replanning
                            old_pending_count = len(self._current_plan.get_pending_steps())
                            self._current_plan = await self._handle_replan(
                                current_plan=self._current_plan,
                                failed_step=step if step.status == PlanStepStatus.FAILED.value else None,
                                reason=evaluation.reason,
                                tools=tools,
                            )
                            new_pending_count = len(self._current_plan.get_pending_steps())

                            yield PlanUpdatedEvent(
                                plan_id=plan_id,
                                reason=evaluation.reason,
                                added_steps=new_pending_count,
                                removed_steps=old_pending_count - new_pending_count if old_pending_count > new_pending_count else 0,
                                replan_number=self._replan_count,
                            )

                            # Update ledger with replan info
                            if self._ledger:
                                self._ledger._record_event(
                                    event_type=LedgerEventType.REPLAN_TRIGGERED,
                                    data={
                                        "reason": evaluation.reason,
                                        "replan_number": self._replan_count,
                                        "new_step_count": new_pending_count,
                                    }
                                )

                            logger.info(f"Replan complete ({self._replan_count}): {evaluation.reason}")

                            # Set flag to restart step iteration with updated plan
                            should_restart = True
                            break

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
                self._replan_count += 1
                yield ReplanTriggeredEvent(
                    plan_id=plan_id,
                    reason="Goal not yet achieved, adding steps to complete",
                    replan_number=self._replan_count,
                )

                # Perform dynamic replanning
                self._current_plan = await self._handle_replan(
                    current_plan=self._current_plan,
                    failed_step=None,
                    reason="Goal not yet achieved after completing all steps",
                    tools=tools,
                )
                new_pending_count = len(self._current_plan.get_pending_steps())

                yield PlanUpdatedEvent(
                    plan_id=plan_id,
                    reason="Auto-replan: goal not achieved",
                    added_steps=new_pending_count,
                    removed_steps=0,
                    replan_number=self._replan_count,
                )

                last_evaluation = None
                continue  # Restart with new pending steps

            break  # Exit the while loop

        # Mark plan as completed or failed
        if success:
            self._current_plan = self._current_plan.complete()
            self._current_phase = ExecutionPhase.COMPLETED
        else:
            self._current_plan = self._current_plan.fail()
            self._current_phase = ExecutionPhase.FAILED

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

    def get_ledger_summary(self) -> Optional[str]:
        """
        Get concise ledger summary in TOON format for evaluator.

        Returns:
            TOON string summary or None if no ledger exists
        """
        if self._ledger:
            return self._ledger.to_toon_summary()
        return None

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

            # Build evaluation prompt with TOON for minimal token usage
            goal = self._current_plan.goal if self._current_plan else "Unknown"
            prompt = f"""
Goal: {goal}

Ledger State:
{to_toon(ledger_data)}

Analyze this state and call the report_evaluation tool with your assessment.
"""

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

    async def _execute_step(
        self,
        step: PlanStep,
        tools: List[Any],
        managed_agents: Optional[List[Any]] = None,
    ) -> Optional[str]:
        """
        Execute a single plan step using PlanStepExecutor.

        Uses smolagents' native managed agent routing - the LLM reads
        agent descriptions and automatically routes to the right agent.

        The executor receives the Plan object and generates a prompt from it,
        ensuring the sub-agent has proper context (goal, progress, agents).

        Args:
            step: The step to execute
            tools: Available tools
            managed_agents: Available managed agents for delegation (unused - handled by executor)

        Returns:
            Result string from step execution
        """
        logger.info(f"Executing step {step.step_id}: {step.description[:100]}...")

        # Use PlanStepExecutor - pass Plan object, executor generates prompt from it
        # Wrap in asyncio.to_thread since execute() is synchronous (calls blocking LLM APIs)
        if self.plan_step_executor and self._current_plan:
            result = await asyncio.to_thread(
                self.plan_step_executor.execute,
                plan=self._current_plan,
                current_step=step,
            )
            return result

        # Fallback: If there's a tool_call specified, use it directly
        if step.tool_call:
            tool = None
            for t in tools:
                tool_name = getattr(t, 'name', str(t))
                if tool_name.lower() == step.tool_call.lower().split(':')[0]:
                    tool = t
                    break

            if not tool:
                raise ValueError(f"Tool not found: {step.tool_call}")

            logger.info(f"Executing tool {step.tool_call} with params: {step.parameters}")
            try:
                # Wrap blocking tool call in thread
                result = await asyncio.to_thread(tool.forward, **(step.parameters or {}))
                return f"Executed {step.tool_call}: {result}"
            except Exception as e:
                logger.error(f"Tool execution failed: {e}")
                raise

        # No executor and no tool_call - just mark as done
        logger.warning("No plan_step_executor configured, step not actually executed")
        return f"Step completed (no executor): {step.description}"

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
            # Context gathering is done via research_emery (created inside PlanService)
            recovery = self.plan_service.analyze_step_failure(
                failed_step=step,
                error_message=error,
                plan=self._current_plan,
                ledger=self._ledger,
                org_model=self._org_model,
                api_key=self._api_key,
                organization_id=self._organization_id,
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
            result = await self._execute_step(updated_step, tools)
            return result
        except Exception as e:
            logger.error(f"Recovery step failed: {e}")
            raise

    async def _handle_replan(
        self,
        current_plan: Plan,
        failed_step: Optional[PlanStep],
        reason: str,
        tools: List[Any],
    ) -> Plan:
        """
        Handle replanning when evaluator indicates plan needs adjustment.

        Generates recovery steps to address the issue and merges them into the plan.
        Failed/problematic steps are marked as skipped and new steps are inserted.

        Args:
            current_plan: The current plan being executed
            failed_step: The step that triggered replanning (if any)
            reason: Why replanning was triggered
            tools: Available tools for recovery planning

        Returns:
            Updated plan with recovery steps
        """
        logger.info(f"Handling replan for plan {current_plan.id}: {reason}")

        # Get completed and pending steps
        completed_steps = [s for s in current_plan.steps if s.status == PlanStepStatus.COMPLETED.value]
        pending_steps = [s for s in current_plan.steps if s.status == PlanStepStatus.PENDING.value]

        # Build recovery context
        completed_summary = "\n".join([
            f"- {s.description} (result: {s.result or 'completed'})"
            for s in completed_steps
        ]) or "No steps completed yet"

        pending_summary = "\n".join([
            f"- {s.description}"
            for s in pending_steps
        ]) or "No pending steps"

        failed_info = ""
        if failed_step:
            failed_info = f"""
The following step triggered replanning:
- Step: {failed_step.description}
- Error: {failed_step.error or 'N/A'}
- Result: {failed_step.result or 'N/A'}
"""

        # Generate recovery instructions
        recovery_prompt = f"""
The plan needs adjustment. Please generate recovery steps.

Original Goal: {current_plan.goal}

{failed_info}

Reason for replanning: {reason}

Completed Steps:
{completed_summary}

Remaining Pending Steps:
{pending_summary}

Available Tools: {[getattr(t, 'name', str(t)) for t in tools]}

Generate new steps to recover and achieve the original goal.
Consider what has already been done and what still needs to happen.
"""

        # Use plan service to generate recovery steps
        # IMPORTANT: Must pass same model/auth parameters as _generate_plan()
        # to ensure correct model resolution (not falling back to HF default)
        recovery_plan = await self.plan_service.generate_plan(
            basic_instructions=recovery_prompt,
            context_tables=None,  # Use existing context
            available_tools=[getattr(t, 'name', str(t)) for t in tools],
            goal=f"Recovery: {current_plan.goal}",
            org_model=self._org_model,
            tools=tools,
            api_key=self._api_key,
            organization_id=self._organization_id,
            conversation_history=self._conversation_history,  # ACE: Resolve references
            strategy_service=self._strategy_service,  # ACE: Proven patterns
        )

        # Build new step list:
        # 1. Keep completed steps as-is
        # 2. Mark failed step as skipped (if any)
        # 3. Remove old pending steps
        # 4. Add new recovery steps
        new_steps = list(completed_steps)

        if failed_step:
            skipped_step = PlanStep(
                step_id=failed_step.step_id,
                description=failed_step.description,
                tool_call=failed_step.tool_call,
                parameters=failed_step.parameters,
                context_tables=failed_step.context_tables,
                status=PlanStepStatus.SKIPPED.value,
                result=failed_step.result,
                error=f"Skipped during replan: {reason}",
            )
            new_steps.append(skipped_step)

        # Add recovery steps
        new_steps.extend(recovery_plan.steps)

        # Create updated plan with incremented version
        updated_plan = Plan(
            id=current_plan.id,
            goal=current_plan.goal,
            basic_instructions=current_plan.basic_instructions,
            steps=new_steps,
            status=PlanStatus.EXECUTING.value,
            generated_at=current_plan.generated_at,
            approved_at=current_plan.approved_at,
            version=current_plan.version + 1,
        )

        logger.info(
            f"Replan complete: removed {len(pending_steps)} pending steps, "
            f"added {len(recovery_plan.steps)} recovery steps (v{updated_plan.version})"
        )

        return updated_plan

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
    # Cascading Planning - Sub-Agent Planning Before Execution
    # ============================================================

    async def create_cascading_plan(
        self,
        goal: str,
        instructions: str,
        tools: List[Any],
        agent_factories: Dict[str, Callable[..., Any]],
        context_tables: Optional[ResolvedContext] = None,
    ) -> AsyncIterator[Any]:
        """
        Create hierarchical plan: high-level + sub-agent detailed plans.

        Phase 1: Generate high-level plan (goal + steps)
        Phase 2: For each step targeting a managed agent, run sub-agent planning
        Phase 3: Collect questions from all sub-agents
        Phase 4: Yield complete plan or questions for user

        Args:
            goal: High-level goal to achieve
            instructions: Detailed instructions for planning
            tools: Available tools
            agent_factories: Dict mapping agent_name to factory function
            context_tables: Resolved context mappings

        Yields:
            PlanCreatedEvent, SubPlanCreatedEvent, QuestionsCollectedEvent,
            or CascadingPlanCompleteEvent
        """
        # Phase 1: High-level plan (existing flow)
        async for event in self.create_plan(goal, instructions, tools, context_tables):
            yield event

        if not self._current_plan:
            return

        # Phase 2: Sub-agent planning
        self._sub_planner = SubAgentPlanner(
            agent_factories=agent_factories,
            original_task=instructions,
            model=None,  # Model passed via agent factories
            max_depth=3,  # Enable 3 levels of recursive cascade planning
            model_provider=self._model_provider,  # For LLM step classification
            org_model=self._org_model,
        )

        updated_steps: List[PlanStep] = []
        for step in self._current_plan.steps:
            # Use target_agent from plan (set by LLM during planning)
            target = step.target_agent

            if target and target in agent_factories:
                logger.info(f"📋 Running sub-agent planning for step: {step.description[:50]}...")

                result = self._sub_planner.run_planning(step, target)

                if result.success and result.sub_plan:
                    updated_steps.append(step.with_sub_plan(result.sub_plan))
                    yield SubPlanCreatedEvent(
                        plan_id=self._current_plan.id,
                        step_id=step.step_id,
                        agent_name=target,
                        sub_plan_goal=result.sub_plan.goal,
                        sub_plan_step_count=len(result.sub_plan.steps),
                    )
                    logger.info(
                        f"✅ Sub-plan created for {target}: "
                        f"{len(result.sub_plan.steps)} steps"
                    )
                else:
                    updated_steps.append(step.with_target_agent(target))
                    if result.error:
                        logger.warning(f"Sub-agent planning failed: {result.error}")
            else:
                updated_steps.append(step)

        # Phase 3: Check for questions
        all_questions = self._sub_planner.get_all_questions()
        if not all_questions.is_empty:
            logger.info(
                f"📋 Questions collected: {len(all_questions.questions)} "
                f"questions from sub-agents"
            )
            yield QuestionsCollectedEvent(
                plan_id=self._current_plan.id,
                questions=all_questions,
            )
            # Don't update plan yet - wait for answers via resume_cascading_plan
            return

        # Phase 4: Update plan with sub-plans and emit complete event
        self._current_plan = self._current_plan.with_steps(updated_steps)
        total_sub_plans = sum(1 for s in updated_steps if s.sub_plan)

        logger.info(
            f"📋 Cascading planning complete: {total_sub_plans} sub-plans created"
        )
        yield CascadingPlanCompleteEvent(
            plan_id=self._current_plan.id,
            total_sub_plans=total_sub_plans,
        )

    async def resume_cascading_plan(
        self,
        answers: QuestionAnswers,
    ) -> AsyncIterator[Any]:
        """
        Resume cascading planning with user's answers to questions.

        Called after QuestionsCollectedEvent when user provides answers.

        Args:
            answers: User's answers to the batched questions

        Yields:
            SubPlanCreatedEvent for completed sub-plans,
            QuestionsCollectedEvent if more questions,
            or CascadingPlanCompleteEvent when done
        """
        if not self._sub_planner or not self._current_plan:
            logger.error("Cannot resume: no active cascading planning session")
            return

        # Get steps that need their sub-plans completed with answers
        updated_steps: List[PlanStep] = []

        for step in self._current_plan.steps:
            if step.target_agent and not step.sub_plan:
                # This step needs planning resumed with answers
                step_answers = answers.get_answers_for_agent(
                    step.target_agent,
                    self._sub_planner.get_all_questions(),
                )

                if step_answers:
                    result = self._sub_planner.resume_with_answers(
                        step.step_id,
                        step_answers,
                    )

                    if result.success and result.sub_plan:
                        updated_steps.append(step.with_sub_plan(result.sub_plan))
                        yield SubPlanCreatedEvent(
                            plan_id=self._current_plan.id,
                            step_id=step.step_id,
                            agent_name=step.target_agent,
                            sub_plan_goal=result.sub_plan.goal,
                            sub_plan_step_count=len(result.sub_plan.steps),
                        )
                    else:
                        updated_steps.append(step)
                else:
                    updated_steps.append(step)
            else:
                updated_steps.append(step)

        # Clear questions for next round
        self._sub_planner.clear_questions()

        # Check if more questions arose
        all_questions = self._sub_planner.get_all_questions()
        if not all_questions.is_empty:
            yield QuestionsCollectedEvent(
                plan_id=self._current_plan.id,
                questions=all_questions,
            )
            return

        # Update plan and emit complete
        self._current_plan = self._current_plan.with_steps(updated_steps)
        total_sub_plans = sum(1 for s in updated_steps if s.sub_plan)

        yield CascadingPlanCompleteEvent(
            plan_id=self._current_plan.id,
            total_sub_plans=total_sub_plans,
        )

    # ============================================================
    # Unified Message Handling - Single Entry Point
    # ============================================================

    def _reset_state(self) -> None:
        """
        Clean reset of all internal state.

        AIDEV-NOTE: Replaces the scattered `clear_coordinator_state()` calls
        in chat_processing_service.py with a single method.
        """
        self._unified_phase = Phase.IDLE
        self._current_phase = ExecutionPhase.PLANNING
        self._current_plan = None
        self._ledger = None
        self._pending_context = None
        self._sub_planner = None
        self._replan_count = 0
        self._evaluation_count = 0
        self._interrupt_queue = []
        self._execution_paused = False
        logger.info("📋 Coordinator state reset to IDLE")

    def queue_interrupt(self, message: str) -> InterruptQueuedEvent:
        """
        Queue an interrupt message for processing.

        Called when a message arrives during planning or execution phase.

        Args:
            message: The user's interrupt message

        Returns:
            InterruptQueuedEvent for UI feedback
        """
        self._interrupt_queue.append(message)
        phase_str = self._unified_phase.value
        logger.info(f"⏸️ Interrupt queued during {phase_str}: {message[:50]}...")
        return InterruptQueuedEvent(message=message, phase=phase_str)

    def has_pending_interrupts(self) -> bool:
        """Check if there are pending interrupt messages."""
        return len(self._interrupt_queue) > 0

    async def _classify_interrupt(
        self,
        interrupt_message: str,
    ) -> InterruptClassification:
        """
        Use subagent pattern to classify interrupt intent.

        Args:
            interrupt_message: The user's interrupt message

        Returns:
            InterruptClassification with classification and reasoning
        """
        if not self._model_provider or not self._current_plan:
            # Fallback if no model available - default to CONTEXT_ADD
            logger.warning("No model provider available for interrupt classification")
            return InterruptClassification(
                classification="CONTEXT_ADD",
                requires_replan=False,
                is_cancel=False,
                reasoning="No classifier available, defaulting to context injection",
            )

        # Build context for classification
        completed_steps = "\n".join([
            f"- {s.description}"
            for s in self._current_plan.steps
            if s.status == PlanStepStatus.COMPLETED.value
        ]) or "None yet"

        remaining_steps = "\n".join([
            f"- {s.description}"
            for s in self._current_plan.steps
            if s.status == PlanStepStatus.PENDING.value
        ]) or "None remaining"

        prompt = build_classification_prompt(
            interrupt_message=interrupt_message,
            current_plan_summary=f"Goal: {self._current_plan.goal}",
            completed_steps=completed_steps,
            remaining_steps=remaining_steps,
        )

        try:
            # Create classifier and run (synchronous, wrap in thread)
            model = self._org_model or "claude-sonnet-4-20250514"
            classifier_agent, classification_tool = create_interrupt_classifier(model)

            await asyncio.to_thread(classifier_agent.run, prompt)

            result = classification_tool.get_result()
            if result:
                return result

            # Tool wasn't called - default to CONTEXT_ADD
            logger.warning("Interrupt classifier did not call report_classification tool")
            return InterruptClassification(
                classification="CONTEXT_ADD",
                requires_replan=False,
                is_cancel=False,
                reasoning="Classifier did not provide classification, defaulting to context injection",
            )

        except Exception as e:
            logger.error(f"Interrupt classification failed: {e}")
            return InterruptClassification(
                classification="CONTEXT_ADD",
                requires_replan=False,
                is_cancel=False,
                reasoning=f"Classification error: {e}, defaulting to context injection",
            )

    def _inject_interrupt_context(self, interrupt_msg: str) -> None:
        """
        Add user interrupt as context for the agent to consider in next steps.

        This updates the ledger with the user's feedback so subsequent steps
        can see and act on the new information.

        Args:
            interrupt_msg: The user's interrupt message
        """
        if self._ledger:
            self._ledger._record_event(
                event_type=LedgerEventType.USER_FEEDBACK,
                data={"feedback": interrupt_msg}
            )
            logger.info(f"💉 Injected interrupt context into ledger: {interrupt_msg[:50]}...")

    async def handle_message(
        self,
        message: str,
        tools: Optional[List[Any]] = None,
        managed_agents: Optional[List[Any]] = None,
        agent_factories: Optional[Dict[str, Callable[..., Any]]] = None,
    ) -> AsyncIterator[Any]:
        """
        Route message based on current phase - SINGLE ENTRY POINT.

        AIDEV-NOTE: This method replaces the phase handling logic scattered
        throughout chat_processing_service.py. All flow control lives here now.

        Args:
            message: The user's message (task, approval response, or answers)
            tools: Available tools (only needed for fresh start)
            managed_agents: Available managed agents (only needed for fresh start)
            agent_factories: Factory functions for cascade planning

        Yields:
            Appropriate events based on current phase and message content
        """
        logger.info(f"📋 handle_message() in phase {self._unified_phase.value}")

        # Handle interrupts during planning phase - queue for processing after plan completes
        if self._unified_phase == Phase.PLANNING:
            yield self.queue_interrupt(message)
            return

        # Handle interrupts during execution phase - queue and pause
        if self._unified_phase == Phase.EXECUTING:
            self._execution_paused = True
            yield self.queue_interrupt(message)
            return

        if self._unified_phase == Phase.AWAITING_CLARIFICATION:
            async for event in self._handle_clarification_response(message):
                yield event

        elif self._unified_phase == Phase.AWAITING_APPROVAL:
            async for event in self._handle_approval_response(message, tools):
                yield event

        elif self._unified_phase == Phase.AWAITING_CASCADE_QUESTIONS:
            async for event in self._handle_cascade_response(message):
                yield event

        else:
            # IDLE or fresh start - run classification + planning
            # Store context for potential resumption
            effective_tools = tools or (self._pending_context.tools if self._pending_context else [])
            effective_agents = managed_agents or (self._pending_context.managed_agents if self._pending_context else [])
            effective_factories = agent_factories or (self._pending_context.agent_factories if self._pending_context else None)

            # Store pending context for potential clarification/approval
            self._pending_context = PendingContext(
                original_task=message,
                tools=effective_tools,
                managed_agents=effective_agents,
                agent_factories=effective_factories,
            )

            async for event in self.execute(
                task=message,
                tools=effective_tools,
                managed_agents=effective_agents,
                agent_factories=effective_factories,
            ):
                # Track phase transitions based on events
                if isinstance(event, AwaitingClarificationEvent):
                    self._unified_phase = Phase.AWAITING_CLARIFICATION
                elif isinstance(event, PlanCreatedEvent):
                    self._unified_phase = Phase.AWAITING_APPROVAL
                elif isinstance(event, QuestionsCollectedEvent):
                    self._unified_phase = Phase.AWAITING_CASCADE_QUESTIONS
                elif isinstance(event, ExecutionCompletedEvent):
                    self._unified_phase = Phase.COMPLETED if event.success else Phase.FAILED
                elif isinstance(event, DirectExecutionStartedEvent):
                    # Direct mode doesn't need coordinator state
                    self._unified_phase = Phase.IDLE

                yield event

    async def _handle_clarification_response(self, response: str) -> AsyncIterator[Any]:
        """
        Combine original task with clarification and re-classify.

        AIDEV-NOTE: Replaces the `original_task` handling in chat_processing_service.py.
        """
        if not self._pending_context:
            yield ErrorEvent(error="No pending context for clarification")
            return

        combined_task = f"{self._pending_context.original_task}\n\nUser's clarification: {response}"
        self._unified_phase = Phase.IDLE
        logger.info("📋 Processing clarification response, re-executing with combined task")

        async for event in self.execute(
            task=combined_task,
            tools=self._pending_context.tools,
            managed_agents=self._pending_context.managed_agents,
            agent_factories=self._pending_context.agent_factories,
        ):
            # Track phase transitions
            if isinstance(event, PlanCreatedEvent):
                self._unified_phase = Phase.AWAITING_APPROVAL
            elif isinstance(event, QuestionsCollectedEvent):
                self._unified_phase = Phase.AWAITING_CASCADE_QUESTIONS
            elif isinstance(event, ExecutionCompletedEvent):
                self._unified_phase = Phase.COMPLETED if event.success else Phase.FAILED

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

            self._unified_phase = Phase.EXECUTING
            effective_tools = tools or (self._pending_context.tools if self._pending_context else [])

            async for event in self.execute_plan(self._current_plan.id, effective_tools):
                if isinstance(event, ExecutionCompletedEvent):
                    self._unified_phase = Phase.COMPLETED if event.success else Phase.FAILED
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
            feedback_task = f"{self._pending_context.original_task}\n\nUser feedback on plan: {response}"
            self._unified_phase = Phase.PLANNING

            async for event in self.execute(
                task=feedback_task,
                tools=self._pending_context.tools,
                managed_agents=self._pending_context.managed_agents,
                agent_factories=self._pending_context.agent_factories,
            ):
                if isinstance(event, PlanCreatedEvent):
                    self._unified_phase = Phase.AWAITING_APPROVAL
                yield event

    async def _handle_cascade_response(self, response: str) -> AsyncIterator[Any]:
        """
        Handle answers to cascade planning questions.

        AIDEV-NOTE: Replaces the `awaiting_cascade_questions` phase handling
        in chat_processing_service.py.
        """
        if not self._current_plan:
            yield ErrorEvent(error="No current plan for cascade response")
            return

        # Try to parse as JSON, fall back to simple dict
        try:
            answers_dict = json.loads(response)
        except json.JSONDecodeError:
            # Treat as single answer to first question
            answers_dict = {"default": response}

        logger.info(f"📋 Processing cascade answers: {len(answers_dict)} answers")

        async for event in self.resume_cascading_plan(QuestionAnswers(answers=answers_dict)):
            if isinstance(event, QuestionsCollectedEvent):
                # More questions - stay in this phase
                self._unified_phase = Phase.AWAITING_CASCADE_QUESTIONS
            elif isinstance(event, CascadingPlanCompleteEvent):
                # Planning complete - transition to awaiting approval
                self._unified_phase = Phase.AWAITING_APPROVAL

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
