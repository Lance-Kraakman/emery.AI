"""
Workflow Orchestrator for DAG-based step execution.

Handles DAG traversal, condition evaluation, and step routing.
Delegates actual step execution to step handlers.

AIDEV-NOTE: Part of Phase 2.3 refactoring (Feb 2026).
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from collections.abc import AsyncIterator, Callable
from typing import TYPE_CHECKING, Any, Literal

from simpleeval import simple_eval
from tenacity import (
    AsyncRetrying,
    RetryError,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
    wait_fixed,
)

from emery_agents.utils.error_classifier import classify_error

from .loop import LoopExecutor
from .types import StepError, StepProgress, WorkflowStep

if TYPE_CHECKING:
    from emery_agents.entities.configs import AuthConfig, WorkflowRequest
    from emery_agents.entities.skill_config import RetryConfig, SkillConfig, SkillStep

logger = logging.getLogger(__name__)

# Regex for template variables and negation
_TEMPLATE_VAR = re.compile(r"\{\{(\w+)\}\}")
_NEGATE = re.compile(r"!(?!=)")
_BUILTIN_NAMES: dict[str, Any] = {
    "true": True,
    "false": False,
    "null": None,
    "none": None,
    "True": True,
    "False": False,
    "None": None,
}


def _is_retryable_error(exception: Exception) -> bool:
    """Check if error should be retried using error classifier."""
    classified = classify_error(exception)
    return classified.auto_retry


def _get_wait_strategy(config: RetryConfig):
    """Get tenacity wait strategy from config."""
    if config.backoff_type == "exponential":
        return wait_exponential(
            multiplier=config.backoff_ms / 1000,
            min=config.backoff_ms / 1000,
            max=60,
        )
    elif config.backoff_type == "linear":
        return wait_exponential(
            multiplier=config.backoff_ms / 1000,
            min=config.backoff_ms / 1000,
            max=60,
            exp_base=1.5,
        )
    else:
        return wait_fixed(config.backoff_ms / 1000)


class WorkflowOrchestrator:
    """Orchestrates DAG-based workflow execution.

    Responsibilities:
    - DAG traversal with parallel execution support
    - Condition evaluation using simpleeval
    - Step routing to appropriate handlers
    - Error handling with retry logic
    - Loop iteration support

    Replaces StepExecutorService.execute_steps() method.
    """

    def __init__(
        self,
        step_handler: Callable[[WorkflowStep, dict[str, Any], dict[str, Any]], Any] | None = None,
        loop_executor: LoopExecutor | None = None,
    ):
        """Initialize orchestrator.

        Args:
            step_handler: Callback to execute individual steps.
                Signature: (step, context, kwargs) -> result
            loop_executor: LoopExecutor for handling loop iterations.
        """
        self.step_handler = step_handler
        self._loop_executor = loop_executor
        self._execution_stack_lock = asyncio.Lock()

    @property
    def loop_executor(self) -> LoopExecutor:
        """Lazy-initialize LoopExecutor."""
        if self._loop_executor is None:
            self._loop_executor = LoopExecutor(self._evaluate_condition)
        return self._loop_executor

    async def execute(
        self,
        request: WorkflowRequest,
        step_handler: Callable[[WorkflowStep, dict[str, Any], dict[str, Any]], Any] | None = None,
    ) -> AsyncIterator[StepProgress]:
        """Execute a workflow request.

        Args:
            request: WorkflowRequest with steps, inputs, and auth
            step_handler: Optional step handler override

        Yields:
            StepProgress updates as each step executes
        """
        handler = step_handler or self.step_handler
        if not handler:
            raise ValueError("No step handler configured")

        # Convert DTOs to internal types
        internal_steps = [WorkflowStep.from_dto(s) for s in request.steps]
        step_by_id: dict[str, WorkflowStep] = {s.id: s for s in internal_steps}

        # Initialize execution state
        step_context: dict[str, Any] = dict(request.initial_inputs)
        executed_steps: set[str] = set()
        total_steps = len(internal_steps)

        logger.info(f"🚀 Starting workflow with {total_steps} steps")

        # Start with first step
        pending_steps: list[str] = [internal_steps[0].id] if internal_steps else []
        step_counter = 0

        while pending_steps:
            # Get batch of steps (parallel or single)
            batch = self._get_parallel_batch(pending_steps, step_by_id, executed_steps)
            if not batch:
                continue

            if len(batch) > 1:
                # Parallel execution
                logger.info(f"⚡ Executing {len(batch)} steps in parallel")
                async for progress in self._execute_parallel_batch(
                    batch=batch,
                    step_counter=step_counter,
                    total_steps=total_steps,
                    step_context=step_context,
                    handler=handler,
                    request=request,
                    internal_steps=internal_steps,
                    pending_steps=pending_steps,
                    executed_steps=executed_steps,
                ):
                    yield progress
                step_counter += len(batch)
            else:
                # Single step execution
                step = batch[0]
                step_counter += 1
                executed_steps.add(step.id)

                async for progress in self._execute_single_step(
                    step=step,
                    step_counter=step_counter,
                    total_steps=total_steps,
                    step_context=step_context,
                    handler=handler,
                    request=request,
                    internal_steps=internal_steps,
                    pending_steps=pending_steps,
                    executed_steps=executed_steps,
                ):
                    yield progress

    async def _execute_single_step(
        self,
        step: WorkflowStep,
        step_counter: int,
        total_steps: int,
        step_context: dict[str, Any],
        handler: Callable,
        request: WorkflowRequest,
        internal_steps: list[WorkflowStep],
        pending_steps: list[str],
        executed_steps: set[str],
    ) -> AsyncIterator[StepProgress]:
        """Execute a single step with condition checking and error handling."""
        step_name = step.name

        # Skip disabled steps
        if step.is_disabled:
            logger.info(f"⏭️ Step {step_name}: disabled, skipping")
            yield StepProgress(
                step=step_counter,
                total=total_steps,
                id=step.id,
                name=step_name,
                status="skipped",
                result="Step is disabled",
            )
            self._queue_next_steps(step, internal_steps, pending_steps, executed_steps, "success", step_context)
            return

        # Yield running status
        yield StepProgress(
            step=step_counter,
            total=total_steps,
            id=step.id,
            name=step_name,
            status="running",
        )

        # Check entry condition
        if step.condition:
            if not self._evaluate_condition(step.condition, step_context):
                logger.info(f"⏭️ Step {step_name}: condition not met, skipping")
                yield StepProgress(
                    step=step_counter,
                    total=total_steps,
                    id=step.id,
                    name=step_name,
                    status="skipped",
                    result="Condition not met",
                )
                self._queue_next_steps(step, internal_steps, pending_steps, executed_steps, "success", step_context)
                return

        # Handle loop execution
        if step.loop_config:
            async for progress in self._execute_loop_step(
                step=step,
                step_counter=step_counter,
                total_steps=total_steps,
                step_context=step_context,
                handler=handler,
                request=request,
                internal_steps=internal_steps,
                pending_steps=pending_steps,
                executed_steps=executed_steps,
            ):
                yield progress
            return

        # Execute with retry
        retries_attempted = 0
        execution_status: Literal["success", "error"] = "success"

        try:
            result, retries_attempted = await self._execute_with_retry(
                step=step,
                step_context=step_context,
                handler=handler,
                request=request,
            )

            # Store result in context
            step_context[step.id] = result
            if step.name:
                step_context[step.name] = result

            yield StepProgress(
                step=step_counter,
                total=total_steps,
                id=step.id,
                name=step_name,
                status="completed",
                result=str(result) if result else None,
                retries_attempted=retries_attempted,
            )

        except Exception as e:
            execution_status = "error"
            error_msg = str(e)
            logger.error(f"❌ Step {step_name} failed: {error_msg}")

            # Store error in context
            step_context[f"{step.id}_error"] = StepError(
                message=error_msg,
                error_type=type(e).__name__,
                step_name=step_name,
                timestamp=time.time(),
                retries_attempted=retries_attempted,
            )

            # Check error config
            if step.error_config and step.error_config.continue_on_error:
                yield StepProgress(
                    step=step_counter,
                    total=total_steps,
                    id=step.id,
                    name=step_name,
                    status="completed",
                    error=error_msg,
                    continued_after_error=True,
                    retries_attempted=retries_attempted,
                )
            else:
                yield StepProgress(
                    step=step_counter,
                    total=total_steps,
                    id=step.id,
                    name=step_name,
                    status="failed",
                    error=error_msg,
                    retries_attempted=retries_attempted,
                )
                return  # Stop workflow on error

        # Queue next steps
        self._queue_next_steps(step, internal_steps, pending_steps, executed_steps, execution_status, step_context)

    async def _execute_loop_step(
        self,
        step: WorkflowStep,
        step_counter: int,
        total_steps: int,
        step_context: dict[str, Any],
        handler: Callable,
        request: WorkflowRequest,
        internal_steps: list[WorkflowStep],
        pending_steps: list[str],
        executed_steps: set[str],
    ) -> AsyncIterator[StepProgress]:
        """Execute a step with loop iteration."""
        step_name = step.name

        async def step_executor_wrapper(
            step: WorkflowStep,
            step_context: dict[str, Any],
            **kwargs: Any,
        ) -> tuple[Any, int]:
            """Wrapper to match LoopExecutor expected signature."""
            return await self._execute_with_retry(
                step=step,
                step_context=step_context,
                handler=handler,
                request=request,
            )

        try:
            results, total_retries = await self.loop_executor.execute(
                step=step,
                step_context=step_context,
                step_executor=step_executor_wrapper,
            )

            # Store results in context
            step_context[step.id] = results
            if step.name:
                step_context[step.name] = results

            yield StepProgress(
                step=step_counter,
                total=total_steps,
                id=step.id,
                name=step_name,
                status="completed",
                result=f"Loop completed: {len(results)} iterations",
                retries_attempted=total_retries,
            )

            # Queue next steps
            self._queue_next_steps(step, internal_steps, pending_steps, executed_steps, "success", step_context)

        except Exception as e:
            error_msg = str(e)
            logger.error(f"❌ Loop step {step_name} failed: {error_msg}")

            step_context[f"{step.id}_error"] = StepError(
                message=error_msg,
                error_type=type(e).__name__,
                step_name=step_name,
                timestamp=time.time(),
            )

            if step.error_config and step.error_config.continue_on_error:
                yield StepProgress(
                    step=step_counter,
                    total=total_steps,
                    id=step.id,
                    name=step_name,
                    status="completed",
                    error=error_msg,
                    continued_after_error=True,
                )
                self._queue_next_steps(step, internal_steps, pending_steps, executed_steps, "error", step_context)
            else:
                yield StepProgress(
                    step=step_counter,
                    total=total_steps,
                    id=step.id,
                    name=step_name,
                    status="failed",
                    error=error_msg,
                )

    async def _execute_with_retry(
        self,
        step: WorkflowStep,
        step_context: dict[str, Any],
        handler: Callable,
        request: WorkflowRequest,
    ) -> tuple[Any, int]:
        """Execute step with retry logic.

        Returns:
            Tuple of (result, retries_attempted)
        """
        retries_attempted = 0

        if step.retry_config and step.retry_config.max_attempts > 0:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(step.retry_config.max_attempts + 1),
                wait=_get_wait_strategy(step.retry_config),
                retry=retry_if_exception(_is_retryable_error),
                reraise=True,
            ):
                with attempt:
                    retries_attempted = attempt.retry_state.attempt_number - 1
                    result = await self._call_handler(step, step_context, handler, request)
                    return result, retries_attempted
        else:
            result = await self._call_handler(step, step_context, handler, request)
            return result, 0

        return None, retries_attempted

    async def _call_handler(
        self,
        step: WorkflowStep,
        step_context: dict[str, Any],
        handler: Callable,
        request: WorkflowRequest,
    ) -> Any:
        """Call the step handler."""
        kwargs = {
            "auth": request.auth,
            "available_skills": request.available_skills,
            "skill_model": request.skill_model,
        }
        return await handler(step, step_context, kwargs)

    async def _execute_parallel_batch(
        self,
        batch: list[WorkflowStep],
        step_counter: int,
        total_steps: int,
        step_context: dict[str, Any],
        handler: Callable,
        request: WorkflowRequest,
        internal_steps: list[WorkflowStep],
        pending_steps: list[str],
        executed_steps: set[str],
    ) -> AsyncIterator[StepProgress]:
        """Execute a batch of steps in parallel."""
        # Mark all as executed
        for step in batch:
            executed_steps.add(step.id)

        # Create tasks
        tasks = [
            self._execute_parallel_step(step, step_context, handler, request)
            for step in batch
        ]

        # Execute and yield results
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, (step, result) in enumerate(zip(batch, results)):
            step_idx = step_counter + i + 1

            if isinstance(result, Exception):
                yield StepProgress(
                    step=step_idx,
                    total=total_steps,
                    id=step.id,
                    name=step.name,
                    status="failed",
                    error=str(result),
                )
            else:
                # Store in context
                step_context[step.id] = result
                if step.name:
                    step_context[step.name] = result

                yield StepProgress(
                    step=step_idx,
                    total=total_steps,
                    id=step.id,
                    name=step.name,
                    status="completed",
                    result=str(result) if result else None,
                )

                # Queue next steps
                self._queue_next_steps(step, internal_steps, pending_steps, executed_steps, "success", step_context)

    async def _execute_parallel_step(
        self,
        step: WorkflowStep,
        step_context: dict[str, Any],
        handler: Callable,
        request: WorkflowRequest,
    ) -> Any:
        """Execute a single step in parallel batch."""
        kwargs = {
            "auth": request.auth,
            "available_skills": request.available_skills,
            "skill_model": request.skill_model,
        }
        return await handler(step, step_context.copy(), kwargs)

    def _get_parallel_batch(
        self,
        pending_steps: list[str],
        step_by_id: dict[str, WorkflowStep],
        executed_steps: set[str],
    ) -> list[WorkflowStep]:
        """Get batch of steps to execute (parallel group or single)."""
        if not pending_steps:
            return []

        first_id = pending_steps.pop(0)
        first_step = step_by_id.get(first_id)
        if not first_step:
            return []

        # If no parallel group, return single step
        if not first_step.parallel_group:
            return [first_step]

        # Collect all steps with same parallel group
        batch = [first_step]
        remaining = []

        for step_id in pending_steps:
            step = step_by_id.get(step_id)
            if step and step.parallel_group == first_step.parallel_group:
                batch.append(step)
            else:
                remaining.append(step_id)

        pending_steps.clear()
        pending_steps.extend(remaining)

        return batch

    def _queue_next_steps(
        self,
        current_step: WorkflowStep,
        all_steps: list[WorkflowStep],
        pending_steps: list[str],
        executed_steps: set[str],
        status: Literal["success", "error"],
        step_context: dict[str, Any],
    ) -> None:
        """Queue next steps based on step outputs or sequential order."""
        # Check for output-based routing
        if current_step.step_outputs:
            for output in current_step.step_outputs:
                # Match output type to execution status
                if output.type == status or output.type == "default":
                    for next_step_id in output.next_steps:
                        if next_step_id not in executed_steps:
                            pending_steps.append(next_step_id)
            return

        # Sequential: queue next step by index
        try:
            current_idx = next(i for i, s in enumerate(all_steps) if s.id == current_step.id)
            if current_idx + 1 < len(all_steps):
                next_step = all_steps[current_idx + 1]
                if next_step.id not in executed_steps:
                    pending_steps.append(next_step.id)
        except StopIteration:
            pass

    def _evaluate_condition(self, condition: str, context: dict[str, Any]) -> bool:
        """Evaluate condition expression using simpleeval."""
        if not condition or not condition.strip():
            return True

        try:
            # Convert {{var}} to var
            expr = _TEMPLATE_VAR.sub(r"\1", condition)
            # Convert ! to not (but not !=)
            expr = _NEGATE.sub("not ", expr)

            # Build names dict with builtins and context
            names = {**_BUILTIN_NAMES, **context}

            result = simple_eval(expr, names=names)
            return bool(result)
        except Exception as e:
            logger.warning(f"Condition evaluation failed: {condition} - {e}")
            return False


# Singleton instance
_default_orchestrator: WorkflowOrchestrator | None = None


def get_workflow_orchestrator() -> WorkflowOrchestrator:
    """Get shared WorkflowOrchestrator instance."""
    global _default_orchestrator
    if _default_orchestrator is None:
        _default_orchestrator = WorkflowOrchestrator()
    return _default_orchestrator
