"""
Tests for ExecutionRouter routing logic.

Uses mock executors to verify routing decisions.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from emery_agents.entities.configs import AuthConfig, SkillRequest
from emery_agents.entities.skill_config import SkillConfig, SkillStep
from emery_agents.services.executors.router import ExecutionRouter
from emery_agents.types import SkillExecutionResult


def make_skill(
    skill_id: int = 1,
    name: str = "test_skill",
    execution_type: str = "agentic",
    steps: list[SkillStep] | None = None,
) -> SkillConfig:
    """Create a SkillConfig for testing."""
    return SkillConfig(
        id=skill_id,
        name=name,
        execution_type=execution_type,
        steps=steps or [],
    )


def make_skill_request(
    skill: SkillConfig,
    inputs: dict | None = None,
    capture_outputs: bool = False,
) -> SkillRequest:
    """Create a SkillRequest for testing."""
    return SkillRequest(
        skill=skill,
        inputs=inputs or {},
        auth=AuthConfig(api_key="test-key", org_id=1),
        capture_outputs=capture_outputs,
    )


class TestRouteHumanSkill:
    """Test routing of human skills to HumanSkillHandler."""

    def test_routes_human_skill_to_handler(self):
        """Human skill routes to HumanSkillHandler.emit_sync()."""
        # Create mock handler
        mock_handler = MagicMock()
        mock_handler.emit_sync.return_value = SkillExecutionResult(
            result="Awaiting human",
            status="awaiting_human",
        )

        # Create skill that is_human_skill()
        skill = make_skill(execution_type="human")
        # Mock is_human_skill to return True
        skill.is_human_skill = MagicMock(return_value=True)

        router = ExecutionRouter(human_skill_handler=mock_handler)
        request = make_skill_request(skill, capture_outputs=True)

        result = router.execute_skill(request)

        mock_handler.emit_sync.assert_called_once()
        assert result.status == "awaiting_human"


class TestRouteWorkflowSkill:
    """Test routing of workflow skills to WorkflowOrchestrator."""

    def test_routes_workflow_to_orchestrator(self):
        """Workflow skill routes to _execute_workflow_sync()."""
        # Create skill with steps (is_workflow)
        steps = [SkillStep(id="1", name="step1")]
        skill = make_skill(steps=steps)
        # Mock is_workflow to return True
        skill.is_workflow = MagicMock(return_value=True)
        skill.is_human_skill = MagicMock(return_value=False)

        # Create mock workflow orchestrator
        mock_workflow = MagicMock()

        # Create router with mocked _execute_workflow_sync
        router = ExecutionRouter(workflow_orchestrator=mock_workflow)
        router._execute_workflow_sync = MagicMock(
            return_value=SkillExecutionResult(result="Workflow completed")
        )

        request = make_skill_request(skill, capture_outputs=True)
        result = router.execute_skill(request)

        router._execute_workflow_sync.assert_called_once()
        assert result.result == "Workflow completed"


class TestRouteAgenticSkill:
    """Test routing of agentic skills to AgenticExecutor."""

    def test_routes_agentic_to_executor(self):
        """Default skill (not human, not workflow) routes to AgenticExecutor."""
        # Create mock agentic executor
        mock_agentic = MagicMock()
        mock_agentic.execute.return_value = SkillExecutionResult(
            result="Skill completed",
            captured_outputs={"output1": "value1"},
        )

        # Create regular agentic skill
        skill = make_skill()
        skill.is_human_skill = MagicMock(return_value=False)
        skill.is_workflow = MagicMock(return_value=False)

        router = ExecutionRouter(agentic_executor=mock_agentic)
        request = make_skill_request(skill, capture_outputs=True)

        result = router.execute_skill(request)

        mock_agentic.execute.assert_called_once_with(request, None)
        assert result.result == "Skill completed"
        assert result.captured_outputs == {"output1": "value1"}

    def test_passes_progress_callback(self):
        """Progress callback is passed to AgenticExecutor."""
        mock_agentic = MagicMock()
        mock_agentic.execute.return_value = "Done"

        skill = make_skill()
        skill.is_human_skill = MagicMock(return_value=False)
        skill.is_workflow = MagicMock(return_value=False)

        router = ExecutionRouter(agentic_executor=mock_agentic)
        request = make_skill_request(skill)
        progress_cb = MagicMock()

        router.execute_skill(request, progress_callback=progress_cb)

        mock_agentic.execute.assert_called_once_with(request, progress_cb)


class TestRoutingPriority:
    """Test routing priority (human > workflow > agentic)."""

    def test_human_skill_takes_priority_over_workflow(self):
        """Human skill routes to handler even if it has steps."""
        mock_handler = MagicMock()
        mock_handler.emit_sync.return_value = "Awaiting human"
        mock_agentic = MagicMock()
        mock_workflow = MagicMock()

        # Create skill that is both human AND has steps
        steps = [SkillStep(id="1", name="step1")]
        skill = make_skill(steps=steps)
        skill.is_human_skill = MagicMock(return_value=True)
        skill.is_workflow = MagicMock(return_value=True)

        router = ExecutionRouter(
            human_skill_handler=mock_handler,
            agentic_executor=mock_agentic,
            workflow_orchestrator=mock_workflow,
        )
        request = make_skill_request(skill)

        router.execute_skill(request)

        # Should route to human handler, not workflow
        mock_handler.emit_sync.assert_called_once()
        mock_workflow.execute.assert_not_called()
        mock_agentic.execute.assert_not_called()


class TestRouterDefaults:
    """Test that router gets default executors when not provided."""

    def test_creates_default_executors(self):
        """Router creates default executors if none provided."""
        # This should not raise
        router = ExecutionRouter()

        # Should have non-None executors
        assert router.interactive is not None
        assert router.agentic is not None
        assert router.workflow is not None
        assert router.coordinator is not None
        assert router.human_handler is not None
        assert router.step_handler is not None
