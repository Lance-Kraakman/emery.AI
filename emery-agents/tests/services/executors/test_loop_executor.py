"""
Tests for LoopExecutor iteration logic.

Uses simple mock for step_executor callback to test loop behavior.
"""

import pytest

from emery_agents.entities.skill_config import LoopConfig
from emery_agents.services.executors.workflow.loop import LoopExecutor
from emery_agents.services.executors.workflow.types import WorkflowStep


def make_step(
    step_id: str = "step_1",
    name: str = "test_step",
    loop_config: LoopConfig | None = None,
) -> WorkflowStep:
    """Create a WorkflowStep for testing."""
    return WorkflowStep(
        id=step_id,
        name=name,
        loop_config=loop_config,
    )


class TestForEachLoop:
    """Test for_each loop execution."""

    @pytest.mark.asyncio
    async def test_iterates_over_items(self):
        """For_each iterates over each item in the list."""
        execution_log = []

        async def mock_executor(step, step_context, **kwargs):
            # Log what item we're processing
            execution_log.append(step_context.get("item"))
            return f"processed_{step_context.get('item')}", 0

        def condition_evaluator(condition, context):
            return True

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            name="process_items",
            loop_config=LoopConfig(
                type="for_each",
                items_var="items",
                current_item_var="item",
                max_iterations=100,
            ),
        )
        context = {"items": ["a", "b", "c"]}

        results, retries = await executor.execute(step, context, mock_executor)

        assert execution_log == ["a", "b", "c"]
        assert results == ["processed_a", "processed_b", "processed_c"]
        assert retries == 0

    @pytest.mark.asyncio
    async def test_injects_loop_index(self):
        """For_each injects __loop_index__ (0-based) and __loop_iteration__ (1-based)."""
        captured_indices = []

        async def mock_executor(step, step_context, **kwargs):
            captured_indices.append({
                "index": step_context.get("__loop_index__"),
                "iteration": step_context.get("__loop_iteration__"),
            })
            return "ok", 0

        def condition_evaluator(condition, context):
            return True

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="for_each",
                items_var="items",
            ),
        )
        context = {"items": [1, 2, 3]}

        await executor.execute(step, context, mock_executor)

        assert captured_indices == [
            {"index": 0, "iteration": 1},
            {"index": 1, "iteration": 2},
            {"index": 2, "iteration": 3},
        ]

    @pytest.mark.asyncio
    async def test_respects_max_iterations(self):
        """For_each stops at max_iterations."""
        call_count = 0

        async def mock_executor(step, step_context, **kwargs):
            nonlocal call_count
            call_count += 1
            return "ok", 0

        def condition_evaluator(condition, context):
            return True

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="for_each",
                items_var="items",
                max_iterations=2,  # Limit to 2
            ),
        )
        context = {"items": [1, 2, 3, 4, 5]}

        results, _ = await executor.execute(step, context, mock_executor)

        assert call_count == 2
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_stores_results_in_context(self):
        """For_each stores results in {step_name}_results."""
        async def mock_executor(step, step_context, **kwargs):
            return f"result_{step_context.get('item')}", 0

        def condition_evaluator(condition, context):
            return True

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            name="my_step",
            loop_config=LoopConfig(
                type="for_each",
                items_var="items",
            ),
        )
        context = {"items": ["x", "y"]}

        await executor.execute(step, context, mock_executor)

        assert context["my_step_results"] == ["result_x", "result_y"]


class TestWhileLoop:
    """Test while loop execution."""

    @pytest.mark.asyncio
    async def test_stops_when_condition_false(self):
        """While loop stops when condition evaluates to false."""
        call_count = 0

        async def mock_executor(step, step_context, **kwargs):
            nonlocal call_count
            call_count += 1
            step_context["counter"] = call_count
            return f"iteration_{call_count}", 0

        def condition_evaluator(condition, context):
            # Run while counter < 3
            return context.get("counter", 0) < 3

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="while",
                condition="counter < 3",
                max_iterations=100,
            ),
        )
        context = {"counter": 0}

        results, _ = await executor.execute(step, context, mock_executor)

        assert call_count == 3
        assert len(results) == 3

    @pytest.mark.asyncio
    async def test_never_runs_if_condition_initially_false(self):
        """While loop doesn't run if condition is false at start."""
        call_count = 0

        async def mock_executor(step, step_context, **kwargs):
            nonlocal call_count
            call_count += 1
            return "ok", 0

        def condition_evaluator(condition, context):
            return False  # Always false

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="while",
                condition="false",
            ),
        )
        context = {}

        results, _ = await executor.execute(step, context, mock_executor)

        assert call_count == 0
        assert results == []


class TestUntilLoop:
    """Test until loop execution."""

    @pytest.mark.asyncio
    async def test_runs_at_least_once(self):
        """Until loop runs at least once before checking condition."""
        call_count = 0

        async def mock_executor(step, step_context, **kwargs):
            nonlocal call_count
            call_count += 1
            return "ok", 0

        def condition_evaluator(condition, context):
            return True  # Condition immediately true

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="until",
                condition="true",
            ),
        )
        context = {}

        results, _ = await executor.execute(step, context, mock_executor)

        assert call_count == 1  # Ran once before condition check
        assert len(results) == 1

    @pytest.mark.asyncio
    async def test_stops_when_condition_becomes_true(self):
        """Until loop stops when condition becomes true."""
        call_count = 0

        async def mock_executor(step, step_context, **kwargs):
            nonlocal call_count
            call_count += 1
            step_context["done"] = call_count >= 3
            return f"iteration_{call_count}", 0

        def condition_evaluator(condition, context):
            return context.get("done", False)

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="until",
                condition="done == true",
                max_iterations=100,
            ),
        )
        context = {"done": False}

        results, _ = await executor.execute(step, context, mock_executor)

        assert call_count == 3
        assert len(results) == 3


class TestMaxIterationsLimit:
    """Test max_iterations prevents infinite loops."""

    @pytest.mark.asyncio
    async def test_while_respects_max_iterations(self):
        """While loop stops at max_iterations even if condition is true."""
        call_count = 0

        async def mock_executor(step, step_context, **kwargs):
            nonlocal call_count
            call_count += 1
            return "ok", 0

        def condition_evaluator(condition, context):
            return True  # Always true (would run forever)

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="while",
                condition="true",
                max_iterations=5,
            ),
        )
        context = {}

        results, _ = await executor.execute(step, context, mock_executor)

        assert call_count == 5
        assert len(results) == 5

    @pytest.mark.asyncio
    async def test_until_respects_max_iterations(self):
        """Until loop stops at max_iterations even if condition never true."""
        call_count = 0

        async def mock_executor(step, step_context, **kwargs):
            nonlocal call_count
            call_count += 1
            return "ok", 0

        def condition_evaluator(condition, context):
            return False  # Never becomes true

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="until",
                condition="never_true",
                max_iterations=3,
            ),
        )
        context = {}

        results, _ = await executor.execute(step, context, mock_executor)

        assert call_count == 3
        assert len(results) == 3


class TestRetryAccumulation:
    """Test that retries from iterations are accumulated."""

    @pytest.mark.asyncio
    async def test_accumulates_retries(self):
        """Total retries is sum of retries from all iterations."""
        async def mock_executor(step, step_context, **kwargs):
            # Each iteration "required" 2 retries
            return "ok", 2

        def condition_evaluator(condition, context):
            return True

        executor = LoopExecutor(condition_evaluator)
        step = make_step(
            loop_config=LoopConfig(
                type="for_each",
                items_var="items",
            ),
        )
        context = {"items": [1, 2, 3]}

        _, total_retries = await executor.execute(step, context, mock_executor)

        assert total_retries == 6  # 3 iterations * 2 retries each
