"""
Tests for WorkflowOrchestrator DAG traversal logic.

Uses mock step_handler to test orchestration behavior without
executing actual steps.
"""

import pytest

from emery_agents.entities.configs import AuthConfig, WorkflowRequest
from emery_agents.entities.skill_config import ErrorConfig, SkillStep
from emery_agents.services.executors.workflow.orchestrator import WorkflowOrchestrator


def make_step(
    step_id: str,
    name: str,
    condition: str = "",
    is_disabled: bool = False,
    error_config: ErrorConfig | None = None,
) -> SkillStep:
    """Create a SkillStep for testing."""
    return SkillStep(
        id=step_id,
        name=name,
        condition=condition,
        is_disabled=is_disabled,
        error_config=error_config,
    )


def make_request(
    steps: list[SkillStep],
    initial_inputs: dict | None = None,
) -> WorkflowRequest:
    """Create a WorkflowRequest for testing."""
    return WorkflowRequest(
        steps=steps,
        initial_inputs=initial_inputs or {},
        auth=AuthConfig(api_key="test-key", org_id=1),
    )


class TestSequentialExecution:
    """Test that steps execute in sequence."""

    @pytest.mark.asyncio
    async def test_steps_run_in_order(self):
        """Steps execute in declaration order."""
        execution_order = []

        async def mock_handler(step, context, kwargs):
            execution_order.append(step.name)
            return f"result_{step.name}"

        steps = [
            make_step("1", "first"),
            make_step("2", "second"),
            make_step("3", "third"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        progress_list = []
        async for progress in orchestrator.execute(request):
            progress_list.append(progress)

        assert execution_order == ["first", "second", "third"]

    @pytest.mark.asyncio
    async def test_yields_progress_for_each_step(self):
        """Orchestrator yields StepProgress for each step."""
        async def mock_handler(step, context, kwargs):
            return "ok"

        steps = [
            make_step("1", "first"),
            make_step("2", "second"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        progress_list = []
        async for progress in orchestrator.execute(request):
            progress_list.append(progress)

        # Each step yields running + completed progress
        completed = [p for p in progress_list if p.status == "completed"]
        assert len(completed) == 2
        assert completed[0].name == "first"
        assert completed[1].name == "second"


class TestResultsInContext:
    """Test that step results are stored in context."""

    @pytest.mark.asyncio
    async def test_results_accessible_by_step_id(self):
        """Step results are stored by step ID."""
        captured_context = []

        async def mock_handler(step, context, kwargs):
            captured_context.append(dict(context))
            return f"result_from_{step.name}"

        steps = [
            make_step("step_a", "first"),
            make_step("step_b", "second"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        async for _ in orchestrator.execute(request):
            pass

        # Second step should see first step's result
        second_step_context = captured_context[1]
        assert second_step_context.get("step_a") == "result_from_first"

    @pytest.mark.asyncio
    async def test_results_accessible_by_step_name(self):
        """Step results are also stored by step name."""
        captured_context = []

        async def mock_handler(step, context, kwargs):
            captured_context.append(dict(context))
            return f"result_from_{step.name}"

        steps = [
            make_step("step_a", "first_step"),
            make_step("step_b", "second_step"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        async for _ in orchestrator.execute(request):
            pass

        # Second step should see first step's result by name
        second_step_context = captured_context[1]
        assert second_step_context.get("first_step") == "result_from_first_step"


class TestConditionEvaluation:
    """Test condition-based step skipping."""

    @pytest.mark.asyncio
    async def test_false_condition_skips_step(self):
        """Step with false condition is skipped."""
        execution_log = []

        async def mock_handler(step, context, kwargs):
            execution_log.append(step.name)
            return "ok"

        steps = [
            make_step("1", "first"),
            make_step("2", "conditional", condition="false"),  # Will be skipped
            make_step("3", "third"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        progress_list = []
        async for progress in orchestrator.execute(request):
            progress_list.append(progress)

        # Only first and third should execute
        assert execution_log == ["first", "third"]

        # Conditional step should have skipped status
        skipped = [p for p in progress_list if p.status == "skipped"]
        assert len(skipped) == 1
        assert skipped[0].name == "conditional"

    @pytest.mark.asyncio
    async def test_true_condition_executes_step(self):
        """Step with true condition executes normally."""
        execution_log = []

        async def mock_handler(step, context, kwargs):
            execution_log.append(step.name)
            return "ok"

        steps = [
            make_step("1", "first"),
            make_step("2", "conditional", condition="true"),
            make_step("3", "third"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        async for _ in orchestrator.execute(request):
            pass

        assert execution_log == ["first", "conditional", "third"]

    @pytest.mark.asyncio
    async def test_condition_uses_context_variables(self):
        """Condition can reference variables from context."""
        execution_log = []

        async def mock_handler(step, context, kwargs):
            execution_log.append(step.name)
            if step.name == "setup":
                context["should_run"] = True
            return "ok"

        steps = [
            make_step("1", "setup"),
            make_step("2", "conditional", condition="{{should_run}}"),
        ]
        request = make_request(steps, initial_inputs={"should_run": False})

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        async for _ in orchestrator.execute(request):
            pass

        # Both should execute since setup sets should_run=True
        assert execution_log == ["setup", "conditional"]


class TestDisabledSteps:
    """Test disabled step handling."""

    @pytest.mark.asyncio
    async def test_disabled_step_skipped(self):
        """Step with is_disabled=True is skipped."""
        execution_log = []

        async def mock_handler(step, context, kwargs):
            execution_log.append(step.name)
            return "ok"

        steps = [
            make_step("1", "first"),
            make_step("2", "disabled_step", is_disabled=True),
            make_step("3", "third"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        progress_list = []
        async for progress in orchestrator.execute(request):
            progress_list.append(progress)

        # Disabled step should not execute
        assert execution_log == ["first", "third"]

        # Should have skipped status
        skipped = [p for p in progress_list if p.status == "skipped"]
        assert len(skipped) == 1
        assert skipped[0].name == "disabled_step"


class TestErrorHandling:
    """Test error handling during execution."""

    @pytest.mark.asyncio
    async def test_error_stops_workflow(self):
        """Error without continue_on_error stops workflow."""
        execution_log = []

        async def mock_handler(step, context, kwargs):
            execution_log.append(step.name)
            if step.name == "failing":
                raise ValueError("Step failed!")
            return "ok"

        steps = [
            make_step("1", "first"),
            make_step("2", "failing"),
            make_step("3", "never_reached"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        progress_list = []
        async for progress in orchestrator.execute(request):
            progress_list.append(progress)

        # Third step should NOT execute
        assert execution_log == ["first", "failing"]

        # Failing step should have failed status
        failed = [p for p in progress_list if p.status == "failed"]
        assert len(failed) == 1
        assert failed[0].name == "failing"
        assert "Step failed!" in failed[0].error

    @pytest.mark.asyncio
    async def test_continue_on_error_proceeds(self):
        """Error with continue_on_error=True allows workflow to continue."""
        execution_log = []

        async def mock_handler(step, context, kwargs):
            execution_log.append(step.name)
            if step.name == "failing":
                raise ValueError("Step failed!")
            return "ok"

        steps = [
            make_step("1", "first"),
            make_step(
                "2",
                "failing",
                error_config=ErrorConfig(continue_on_error=True),
            ),
            make_step("3", "continues"),
        ]
        request = make_request(steps)

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        progress_list = []
        async for progress in orchestrator.execute(request):
            progress_list.append(progress)

        # All steps should execute
        assert execution_log == ["first", "failing", "continues"]

        # Failing step should have completed with continued_after_error
        failing_progress = [p for p in progress_list if p.name == "failing" and p.status == "completed"]
        assert len(failing_progress) == 1
        assert failing_progress[0].continued_after_error is True
        assert "Step failed!" in failing_progress[0].error


class TestEmptyWorkflow:
    """Test edge cases."""

    @pytest.mark.asyncio
    async def test_empty_steps_completes_immediately(self):
        """Workflow with no steps completes without yielding progress."""
        async def mock_handler(step, context, kwargs):
            return "ok"

        request = make_request(steps=[])

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        progress_list = []
        async for progress in orchestrator.execute(request):
            progress_list.append(progress)

        assert progress_list == []

    @pytest.mark.asyncio
    async def test_initial_inputs_in_context(self):
        """Initial inputs are available in first step's context."""
        captured_context = []

        async def mock_handler(step, context, kwargs):
            captured_context.append(dict(context))
            return "ok"

        steps = [make_step("1", "first")]
        request = make_request(steps, initial_inputs={"user_id": 123, "name": "test"})

        orchestrator = WorkflowOrchestrator(step_handler=mock_handler)
        async for _ in orchestrator.execute(request):
            pass

        assert captured_context[0]["user_id"] == 123
        assert captured_context[0]["name"] == "test"
