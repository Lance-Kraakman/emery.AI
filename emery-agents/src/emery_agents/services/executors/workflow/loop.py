"""
Loop executor for workflow step iteration.

Handles for_each, while, and until loop types.

AIDEV-NOTE: Part of Phase 2.5 refactoring (Feb 2026).
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from emery_agents.entities.skill_config import LoopConfig

    from .types import WorkflowStep

logger = logging.getLogger(__name__)


@dataclass
class LoopContext:
    """Context for loop execution."""

    index: int = 0
    iteration: int = 1
    current_item: Any = None
    results: list[Any] = field(default_factory=list)
    total_retries: int = 0


class LoopExecutor:
    """Executes steps with loop iteration.

    Supports:
    - for_each: Iterate over array in items_var
    - while: Repeat while condition is true
    - until: Repeat until condition is true

    Loop variables injected into context:
    - __loop_index__: 0-based index
    - __loop_iteration__: 1-based iteration count
    - {current_item_var}: Current item (for_each only)
    """

    def __init__(
        self,
        condition_evaluator: Callable[[str, dict[str, Any]], bool],
    ):
        """Initialize loop executor.

        Args:
            condition_evaluator: Function to evaluate condition expressions
        """
        self.condition_evaluator = condition_evaluator

    async def execute(
        self,
        step: WorkflowStep,
        step_context: dict[str, Any],
        step_executor: Callable[..., Any],
        **executor_kwargs: Any,
    ) -> tuple[list[Any], int]:
        """Execute a step with loop iteration.

        Args:
            step: WorkflowStep with loop_config
            step_context: Context dict to inject loop variables into
            step_executor: Async function to execute the step
            **executor_kwargs: Additional kwargs passed to step_executor

        Returns:
            Tuple of (accumulated results, total retries)
        """
        loop_config = step.loop_config
        if not loop_config:
            raise ValueError("Loop config required for loop execution")

        loop_type = loop_config.type
        max_iterations = loop_config.max_iterations

        logger.info(
            f"🔁 Starting {loop_type} loop for step {step.name} (max: {max_iterations})"
        )

        # Create step copy without loop_config to avoid infinite recursion
        step_without_loop = self._create_step_without_loop(step)

        if loop_type == "for_each":
            return await self._execute_for_each(
                step_without_loop,
                loop_config,
                step_context,
                step_executor,
                **executor_kwargs,
            )
        elif loop_type == "while":
            return await self._execute_while(
                step_without_loop,
                loop_config,
                step_context,
                step_executor,
                **executor_kwargs,
            )
        elif loop_type == "until":
            return await self._execute_until(
                step_without_loop,
                loop_config,
                step_context,
                step_executor,
                **executor_kwargs,
            )
        else:
            raise ValueError(f"Unknown loop type: {loop_type}")

    async def _execute_for_each(
        self,
        step: WorkflowStep,
        loop_config: LoopConfig,
        step_context: dict[str, Any],
        step_executor: Callable[..., Any],
        **executor_kwargs: Any,
    ) -> tuple[list[Any], int]:
        """Execute for_each loop over items."""
        items_var = loop_config.items_var
        if not items_var:
            raise ValueError("for_each loop requires items_var")

        current_item_var = loop_config.current_item_var or "item"
        max_iterations = loop_config.max_iterations

        items = step_context.get(items_var, [])
        if not isinstance(items, (list, tuple)):
            logger.warning(
                f"items_var '{items_var}' is not a list, wrapping as single item"
            )
            items = [items] if items else []

        iteration_count = min(len(items), max_iterations)
        logger.info(
            f"🔁 for_each: iterating over {iteration_count} items from '{items_var}'"
        )

        results: list[Any] = []
        total_retries = 0

        for i, item in enumerate(items[:max_iterations]):
            # Set loop variables in context
            step_context[current_item_var] = item
            step_context["__loop_index__"] = i
            step_context["__loop_iteration__"] = i + 1

            logger.info(
                f"🔁 Iteration {i + 1}/{iteration_count}: {current_item_var}={str(item)[:50]}"
            )

            result, retries = await step_executor(
                step=step,
                step_context=step_context,
                **executor_kwargs,
            )
            results.append(result)
            total_retries += retries

        # Clean up loop variables
        self._cleanup_loop_vars(step_context, current_item_var)

        logger.info(
            f"🔁 for_each completed: {len(results)} iterations, {total_retries} retries"
        )
        step_context[f"{step.name}_results"] = results
        return results, total_retries

    async def _execute_while(
        self,
        step: WorkflowStep,
        loop_config: LoopConfig,
        step_context: dict[str, Any],
        step_executor: Callable[..., Any],
        **executor_kwargs: Any,
    ) -> tuple[list[Any], int]:
        """Execute while loop (repeat while condition is true)."""
        condition = loop_config.condition
        if not condition:
            raise ValueError("while loop requires condition")

        max_iterations = loop_config.max_iterations
        results: list[Any] = []
        total_retries = 0
        iteration = 0

        while iteration < max_iterations:
            if not self.condition_evaluator(condition, step_context):
                logger.info(
                    f"🔁 while loop: condition '{condition}' is false, stopping"
                )
                break

            step_context["__loop_index__"] = iteration
            step_context["__loop_iteration__"] = iteration + 1

            logger.info(f"🔁 while iteration {iteration + 1}: condition=true")

            result, retries = await step_executor(
                step=step,
                step_context=step_context,
                **executor_kwargs,
            )
            results.append(result)
            total_retries += retries
            iteration += 1

        if iteration >= max_iterations:
            logger.warning(
                f"🔁 while loop: reached max iterations ({max_iterations})"
            )

        self._cleanup_loop_vars(step_context)

        logger.info(
            f"🔁 while completed: {len(results)} iterations, {total_retries} retries"
        )
        step_context[f"{step.name}_results"] = results
        return results, total_retries

    async def _execute_until(
        self,
        step: WorkflowStep,
        loop_config: LoopConfig,
        step_context: dict[str, Any],
        step_executor: Callable[..., Any],
        **executor_kwargs: Any,
    ) -> tuple[list[Any], int]:
        """Execute until loop (repeat until condition becomes true)."""
        condition = loop_config.condition
        if not condition:
            raise ValueError("until loop requires condition")

        max_iterations = loop_config.max_iterations
        results: list[Any] = []
        total_retries = 0
        iteration = 0

        while iteration < max_iterations:
            step_context["__loop_index__"] = iteration
            step_context["__loop_iteration__"] = iteration + 1

            logger.info(f"🔁 until iteration {iteration + 1}")

            result, retries = await step_executor(
                step=step,
                step_context=step_context,
                **executor_kwargs,
            )
            results.append(result)
            total_retries += retries
            iteration += 1

            # Check condition after execution
            if self.condition_evaluator(condition, step_context):
                logger.info(
                    f"🔁 until loop: condition '{condition}' is now true, stopping"
                )
                break

        if iteration >= max_iterations:
            logger.warning(
                f"🔁 until loop: reached max iterations ({max_iterations})"
            )

        self._cleanup_loop_vars(step_context)

        logger.info(
            f"🔁 until completed: {len(results)} iterations, {total_retries} retries"
        )
        step_context[f"{step.name}_results"] = results
        return results, total_retries

    def _create_step_without_loop(self, step: WorkflowStep) -> WorkflowStep:
        """Create a copy of step without loop_config to avoid recursion."""
        from .types import WorkflowStep as WS

        return WS(
            id=step.id,
            name=step.name,
            instruction=step.instruction,
            skill_id=step.skill_id,
            tools=step.tools,
            inputs=step.inputs,
            outputs=step.outputs,
            condition=step.condition,
            input_defs=step.input_defs,
            output_defs=step.output_defs,
            error_config=step.error_config,
            retry_config=step.retry_config,
            step_outputs=step.step_outputs,
            parallel_group=step.parallel_group,
            loop_config=None,  # Remove loop config to prevent recursion
            read_config=step.read_config,
            write_config=step.write_config,
            tool_execution_config=step.tool_execution_config,
            agentic_config=step.agentic_config,
            is_disabled=step.is_disabled,
        )

    def _cleanup_loop_vars(
        self,
        step_context: dict[str, Any],
        current_item_var: str | None = None,
    ) -> None:
        """Remove loop variables from context."""
        step_context.pop("__loop_index__", None)
        step_context.pop("__loop_iteration__", None)
        if current_item_var:
            step_context.pop(current_item_var, None)


# Singleton instance
_default_loop_executor: LoopExecutor | None = None


def get_loop_executor(
    condition_evaluator: Callable[[str, dict[str, Any]], bool] | None = None,
) -> LoopExecutor:
    """Get shared LoopExecutor instance."""
    global _default_loop_executor
    if _default_loop_executor is None:
        if condition_evaluator is None:
            raise ValueError("condition_evaluator required for first initialization")
        _default_loop_executor = LoopExecutor(condition_evaluator)
    return _default_loop_executor
