"""
Execution Coordinator

Coordinates two-phase execution: planning (read-only) → approval → execution (full).
Enforces tool restrictions based on execution phase.
Includes evaluation loop for goal detection and replanning.
"""

import json
import logging
import re
from dataclasses import dataclass
from typing import List, Optional, Any, AsyncIterator, Dict, Callable
from enum import Enum

from ..models.plan import Plan, PlanStep, PlanStatus, PlanStepStatus, create_plan
from ..models.task_ledger import TaskLedger, create_ledger_from_plan
from ..models.context_mapping import ResolvedContext
from ..tools.tool_modes import ToolMode, filter_tools_for_mode
from .plan_service import PlanService

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
        agent_factory: Optional[Any] = None,
        evaluator_factory: Optional[Callable] = None,
        evaluate_after_steps: int = 1,
        max_replans: int = 3,
    ):
        """
        Initialize execution coordinator.

        Args:
            plan_service: Service for plan persistence
            agent_factory: Factory for creating agents with tool restrictions
            evaluator_factory: Factory for creating evaluator agents
            evaluate_after_steps: Run evaluation after this many steps (default: 1)
            max_replans: Maximum number of replans before stopping (default: 3)
        """
        self.plan_service = plan_service or PlanService()
        self.agent_factory = agent_factory
        self.evaluator_factory = evaluator_factory
        self.evaluate_after_steps = evaluate_after_steps
        self.max_replans = max_replans
        self._current_phase = ExecutionPhase.PLANNING
        self._current_plan: Optional[Plan] = None
        self._ledger: Optional[TaskLedger] = None
        self._replan_count: int = 0
        self._evaluation_count: int = 0

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

    async def create_plan(
        self,
        goal: str,
        instructions: str,
        tools: List[Any],
        context_tables: Optional[ResolvedContext] = None,
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

        Yields:
            PlanCreatedEvent when plan is ready for approval
        """
        self._current_phase = ExecutionPhase.PLANNING
        logger.info(f"Starting planning phase for goal: {goal}")

        # Filter tools to read-only for planning
        planning_tools = filter_tools_for_mode(tools, ToolMode.PLANNING)
        logger.info(
            f"Planning phase: {len(planning_tools)} read-only tools available "
            f"(filtered from {len(tools)} total)"
        )

        # Generate plan using planning agent
        plan = await self.plan_service.generate_plan(
            basic_instructions=instructions,
            context_tables=context_tables,
            available_tools=[getattr(t, 'name', str(t)) for t in planning_tools],
            goal=goal,
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
    ) -> AsyncIterator[Any]:
        """
        Phase 2: Execute an approved plan with full tools.

        This phase executes each step in the approved plan.
        All tools are available during this phase.

        Args:
            plan_id: ID of the approved plan to execute
            tools: All available tools (no filtering)

        Yields:
            StepStartedEvent, StepCompletedEvent, StepFailedEvent, ExecutionCompletedEvent
        """
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
                    result = await self._execute_step(step, tools)

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
                                self._ledger.record_event({
                                    "type": "replan",
                                    "reason": evaluation.reason,
                                    "replan_number": self._replan_count,
                                    "new_step_count": new_pending_count,
                                })

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
                continue  # Restart with new pending steps
            else:
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
            evaluator = self.evaluator_factory()
            ledger_data = self.get_ledger_for_evaluator() or {}

            # Build evaluation prompt
            goal = self._current_plan.goal if self._current_plan else "Unknown"
            prompt = f"""
Goal: {goal}

Ledger State:
{json.dumps(ledger_data, indent=2, default=str)}

Evaluate the current execution state and respond with JSON only.
"""

            # Run evaluator
            result = evaluator.run(prompt)
            return self._parse_evaluation(result)

        except Exception as e:
            logger.error(f"Evaluation failed: {e}")
            return EvaluationResult(
                goal_achieved=False,
                blocking_issues=False,
                should_continue=True,
                needs_replan=False,
                reason=f"Evaluation error: {e}",
            )

    def _parse_evaluation(self, result: Any) -> EvaluationResult:
        """
        Parse evaluator response into EvaluationResult.

        Args:
            result: Raw response from evaluator agent

        Returns:
            Parsed EvaluationResult
        """
        try:
            # Convert result to string if needed
            result_str = str(result) if not isinstance(result, str) else result

            # Extract JSON from response (evaluator may include extra text)
            json_match = re.search(r'\{[^{}]*\}', result_str, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                return EvaluationResult(
                    goal_achieved=bool(data.get("goal_achieved", False)),
                    blocking_issues=bool(data.get("blocking_issues", False)),
                    should_continue=bool(data.get("should_continue", True)),
                    needs_replan=bool(data.get("needs_replan", False)),
                    reason=str(data.get("reason", "")),
                )
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse evaluation JSON: {e}")
        except Exception as e:
            logger.warning(f"Failed to parse evaluation: {e}")

        # Default: STOP execution on parse error (safer than blindly continuing)
        return EvaluationResult(
            goal_achieved=False,
            blocking_issues=True,  # Mark as blocked since we can't evaluate
            should_continue=False,  # Stop - don't continue blindly
            needs_replan=False,
            reason="Evaluation parse error - stopping execution for safety",
        )

    async def _execute_step(
        self,
        step: PlanStep,
        tools: List[Any],
    ) -> Optional[str]:
        """
        Execute a single plan step.

        Args:
            step: The step to execute
            tools: Available tools

        Returns:
            Result string from step execution
        """
        logger.info(f"Executing step {step.step_id}: {step.description}")

        if not step.tool_call:
            # No tool call specified, just mark as done
            return f"Step completed: {step.description}"

        # Find the tool
        tool = None
        for t in tools:
            tool_name = getattr(t, 'name', str(t))
            if tool_name.lower() == step.tool_call.lower().split(':')[0]:
                tool = t
                break

        if not tool:
            raise ValueError(f"Tool not found: {step.tool_call}")

        # Execute the tool
        # This is a placeholder - actual implementation would call the tool
        # with the step parameters
        logger.info(f"Would execute tool {step.tool_call} with params: {step.parameters}")
        return f"Executed {step.tool_call}"

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


class ExecutionCoordinatorFactory:
    """Factory for creating ExecutionCoordinator instances."""

    def __init__(
        self,
        plan_service: Optional[PlanService] = None,
        agent_factory: Optional[Any] = None,
        evaluator_factory: Optional[Callable] = None,
        evaluate_after_steps: int = 1,
        max_replans: int = 3,
    ):
        """
        Initialize factory.

        Args:
            plan_service: Plan service for persistence
            agent_factory: Agent factory for creating agents
            evaluator_factory: Factory for creating evaluator agents
            evaluate_after_steps: Run evaluation after this many steps
            max_replans: Maximum number of replans before stopping
        """
        self.plan_service = plan_service
        self.agent_factory = agent_factory
        self.evaluator_factory = evaluator_factory
        self.evaluate_after_steps = evaluate_after_steps
        self.max_replans = max_replans

    def create(self) -> ExecutionCoordinator:
        """Create a new ExecutionCoordinator instance."""
        return ExecutionCoordinator(
            plan_service=self.plan_service,
            agent_factory=self.agent_factory,
            evaluator_factory=self.evaluator_factory,
            evaluate_after_steps=self.evaluate_after_steps,
            max_replans=self.max_replans,
        )
