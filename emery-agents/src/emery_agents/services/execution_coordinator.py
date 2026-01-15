"""
Execution Coordinator

Coordinates two-phase execution: planning (read-only) → approval → execution (full).
Enforces tool restrictions based on execution phase.
Includes evaluation loop for goal detection and replanning.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from typing import List, Optional, Any, AsyncIterator, Dict, Callable, Tuple, TYPE_CHECKING
from enum import Enum

from ..agents.evaluator_agent import EvaluationTool
from ..models.plan import Plan, PlanStep, PlanStatus, PlanStepStatus, SubPlan, create_plan
from ..models.task_ledger import TaskLedger, create_ledger_from_plan, LedgerEventType
from ..models.context_mapping import ResolvedContext
from ..models.execution import StepExecutionResult, EvaluatorInput, ReplanContext
from ..models.planning_questions import BatchedQuestions, QuestionAnswers
from ..tools.tool_modes import ToolMode, filter_tools_for_mode
from .plan_service import PlanService
from .plan_step_executor import PlanStepExecutor
from .sub_agent_planner import SubAgentPlanner, SubAgentPlanningResult
from .protocols import EvaluatorAgent, Tool

logger = logging.getLogger(__name__)


class ExecutionPhase(Enum):
    """Current phase of execution."""
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


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


class CoordinatorMode(Enum):
    """How coordinator handles the task."""
    PLAN_AND_APPROVE = "plan_and_approve"  # Full planning flow
    DIRECT = "direct"  # Execute immediately without plan
    PASSTHROUGH = "passthrough"  # Let managed agent handle (has own HITL)


@dataclass
class PassthroughEvent:
    """Event emitted when coordinator passes through to a managed agent."""
    agent_name: str


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
        evaluator_factory: Optional[Callable[[], Tuple[EvaluatorAgent, EvaluationTool]]] = None,
        plan_step_executor: Optional[PlanStepExecutor] = None,
        evaluate_after_steps: int = 1,
        max_replans: int = 3,
        org_model: Optional[str] = None,
        context_tools: Optional[List[Any]] = None,
    ):
        """
        Initialize execution coordinator.

        Args:
            plan_service: Service for plan persistence
            evaluator_factory: Factory for creating (agent, tool) tuples for evaluation
            plan_step_executor: Executor for plan steps using smolagents routing
            evaluate_after_steps: Run evaluation after this many steps (default: 1)
            max_replans: Maximum number of replans before stopping (default: 3)
            org_model: Organization model ID for model resolution hierarchy
            context_tools: Tools for context gathering during planning (database_crud, table_crud)
        """
        self.plan_service = plan_service or PlanService()
        self.evaluator_factory = evaluator_factory
        self.plan_step_executor = plan_step_executor
        self.evaluate_after_steps = evaluate_after_steps
        self.max_replans = max_replans
        self._org_model = org_model
        self._context_tools = context_tools or []
        self._current_phase = ExecutionPhase.PLANNING
        self._current_plan: Optional[Plan] = None
        self._ledger: Optional[TaskLedger] = None
        self._replan_count: int = 0
        self._evaluation_count: int = 0
        self._managed_agents: Optional[List[Any]] = None  # Stored from execute() for later use
        self._sub_planner: Optional[SubAgentPlanner] = None  # For cascading planning resume

    @classmethod
    def from_config(cls, config: ExecutionCoordinatorConfig) -> "ExecutionCoordinator":
        """Create coordinator from config dataclass."""
        return cls(
            plan_service=config.plan_service,
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

    # ============================================================
    # Smart Execution - Adaptive Mode Selection
    # ============================================================

    async def execute(
        self,
        task: str,
        tools: List[Any],
        managed_agents: Optional[List[Any]] = None,
    ) -> AsyncIterator[Any]:
        """
        Smart execution entry point - decides mode based on task analysis.

        Modes:
        - PLAN_AND_APPROVE: Complex multi-step task requiring user approval
        - DIRECT: Simple task that can execute immediately
        - PASSTHROUGH: Single managed agent task (agent has own HITL)

        Args:
            task: The user's task/request
            tools: Available tools
            managed_agents: Available managed agents

        Yields:
            Appropriate events based on mode
        """
        # Store managed_agents for later use in execute_plan
        self._managed_agents = managed_agents

        mode = self._determine_mode(task, tools, managed_agents or [])
        logger.info(f"📋 Coordinator: Mode determined as {mode.value} for task: {task[:50]}...")

        if mode == CoordinatorMode.PASSTHROUGH:
            # Let managed agent handle - it has its own HITL
            target_agent = self._get_target_agent(task, managed_agents or [])
            if target_agent:
                logger.info(f"📋 Coordinator: Passing through to {target_agent}")
                yield PassthroughEvent(agent_name=target_agent)
                return
            # Fall through to PLAN_AND_APPROVE if no clear target
            logger.warning("📋 Coordinator: PASSTHROUGH mode but no clear target, falling back to PLAN_AND_APPROVE")
            mode = CoordinatorMode.PLAN_AND_APPROVE

        elif mode == CoordinatorMode.DIRECT:
            # Simple task - execute without showing a plan
            logger.info("📋 Coordinator: Direct execution (no plan needed)")
            yield DirectExecutionStartedEvent(task=task)
            # Note: Actual execution happens in chat_processing_service
            # This just signals the mode - the normal agent flow handles execution
            return

        else:  # PLAN_AND_APPROVE
            # Complex task - full planning flow
            logger.info("📋 Coordinator: Plan and approve mode (complex task)")
            async for event in self.create_plan(
                goal=task,
                instructions=task,
                tools=tools,
            ):
                yield event
            # Session manager handles approval state

    def _determine_mode(
        self,
        task: str,
        tools: List[Any],
        managed_agents: List[Any],
    ) -> CoordinatorMode:
        """
        Determine execution mode based on task analysis.

        Priority:
        1. PASSTHROUGH if task clearly targets a single managed agent with own HITL
        2. PLAN_AND_APPROVE if task requires multiple agents/tools
        3. DIRECT for simple operations

        Args:
            task: User's task text
            tools: Available tools
            managed_agents: Available managed agents

        Returns:
            Appropriate CoordinatorMode
        """
        task_lower = task.lower()

        # Check for single managed agent targeting
        target_agent = self._get_target_agent(task, managed_agents)
        if target_agent:
            # Single agent with HITL capability
            return CoordinatorMode.PASSTHROUGH

        # Check for multi-agent or complex multi-tool scenarios
        if self._is_multi_step_task(task_lower):
            return CoordinatorMode.PLAN_AND_APPROVE

        # Default: simple direct execution
        return CoordinatorMode.DIRECT

    def _get_target_agent(
        self,
        task: str,
        managed_agents: List[Any],
    ) -> Optional[str]:
        """
        Identify if task clearly targets a single managed agent.

        Returns agent name if clear target, None otherwise.
        """
        task_lower = task.lower()

        # Agent patterns - tasks that should route to specific agents
        # These agents have their own HITL mechanisms
        agent_patterns = {
            "schema_builder": [
                "create table", "design schema", "add tables",
                "create a table", "design a schema", "new table",
                "create database", "design database"
            ],
            "skill_builder": [
                "update skill", "modify skill", "edit skill",
                "change skill", "update the skill", "modify the skill"
            ],
        }

        for agent_name, patterns in agent_patterns.items():
            if any(pattern in task_lower for pattern in patterns):
                # Verify this agent is available
                for agent in managed_agents:
                    if getattr(agent, 'name', None) == agent_name:
                        return agent_name
        return None

    def _is_multi_step_task(self, task_lower: str) -> bool:
        """
        Detect if task requires multiple steps/agents.

        Returns True if task should use full planning flow.
        """
        # Multiple action words joined by "and"
        action_words = ["create", "add", "edit", "update", "delete", "modify", "remove", "change"]
        if " and " in task_lower:
            action_count = sum(1 for word in action_words if word in task_lower)
            if action_count >= 2:
                return True

        # Explicit multi-resource keywords
        multi_keywords = ["multiple", "several", "all", "each"]
        if any(kw in task_lower for kw in multi_keywords):
            if any(word in task_lower for word in action_words):
                return True

        # Explicit planning/design request
        planning_phrases = ["plan out", "design", "architect", "help me plan"]
        if any(phrase in task_lower for phrase in planning_phrases):
            return True

        return False

    async def create_plan(
        self,
        goal: str,
        instructions: str,
        tools: List[Any],
        context_tables: Optional[ResolvedContext] = None,
        managed_agents: Optional[List[Any]] = None,
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

        Yields:
            PlanCreatedEvent when plan is ready for approval
        """
        self._current_phase = ExecutionPhase.PLANNING
        logger.info(f"Starting planning phase for goal: {goal}")

        # Use passed managed_agents or fall back to stored ones
        agents = managed_agents or self._managed_agents or []

        # Filter tools to read-only for planning
        planning_tools = filter_tools_for_mode(tools, ToolMode.PLANNING)
        logger.info(
            f"Planning phase: {len(planning_tools)} read-only tools available "
            f"(filtered from {len(tools)} total)"
        )

        # Generate plan using LLM
        # Pass managed_agents so planner knows available agents for routing
        # Pass context_tools so planner can list databases/tables before planning
        plan = await self.plan_service.generate_plan(
            basic_instructions=instructions,
            context_tables=context_tables,
            available_tools=[getattr(t, 'name', str(t)) for t in planning_tools],
            goal=goal,
            org_model=self._org_model,
            tools=planning_tools,
            managed_agents=agents,
            context_tools=self._context_tools,
        )

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
        self._current_plan = self._current_plan.start_execution()
        logger.info(f"Starting execution of plan {plan_id}")

        # Reset counters for this execution
        self._replan_count = 0
        self._evaluation_count = 0
        steps_since_eval = 0

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

            for step in pending_steps:
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

                    success = False
                    break  # Stop execution on failure

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
        Get concise ledger summary JSON for evaluator.

        Returns:
            JSON string summary or None if no ledger exists
        """
        if self._ledger:
            return self._ledger.to_json_summary()
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

            # Build evaluation prompt
            goal = self._current_plan.goal if self._current_plan else "Unknown"
            prompt = f"""
Goal: {goal}

Ledger State:
{json.dumps(ledger_data, indent=2, default=str)}

Analyze this state and call the report_evaluation tool with your assessment.
"""

            # Run evaluator - it will call report_evaluation tool
            evaluator.run(prompt)

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
        if self.plan_step_executor and self._current_plan:
            result = self.plan_step_executor.execute(
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
                result = tool.forward(**(step.parameters or {}))
                return f"Executed {step.tool_call}: {result}"
            except Exception as e:
                logger.error(f"Tool execution failed: {e}")
                raise

        # No executor and no tool_call - just mark as done
        logger.warning("No plan_step_executor configured, step not actually executed")
        return f"Step completed (no executor): {step.description}"

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
        recovery_plan = await self.plan_service.generate_plan(
            basic_instructions=recovery_prompt,
            context_tables=None,  # Use existing context
            available_tools=[getattr(t, 'name', str(t)) for t in tools],
            goal=f"Recovery: {current_plan.goal}",
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
