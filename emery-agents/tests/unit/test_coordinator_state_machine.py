"""
Unit tests for CoordinatorStateMachine.

Tests state transitions, input handling, and context management.
"""

import pytest
from unittest.mock import MagicMock

from emery_agents.services.coordinator_state_machine import (
    CoordinatorStateMachine,
    Phase,
    ActionType,
    StateAction,
    StateContext,
    InvalidTransitionError,
    VALID_TRANSITIONS,
)


class TestPhaseTransitions:
    """Test state transition validation."""

    def test_initial_state_is_idle(self):
        sm = CoordinatorStateMachine("test-session")
        assert sm.context.phase == Phase.IDLE
        assert sm.phase == Phase.IDLE

    def test_valid_transition_from_idle_to_awaiting_approval(self):
        sm = CoordinatorStateMachine("test-session")
        mock_coordinator = MagicMock()
        mock_plan = MagicMock()

        sm.transition(
            Phase.AWAITING_APPROVAL,
            coordinator=mock_coordinator,
            plan=mock_plan
        )

        assert sm.context.phase == Phase.AWAITING_APPROVAL
        assert sm.context.coordinator == mock_coordinator
        assert sm.context.plan == mock_plan

    def test_valid_transition_from_idle_to_awaiting_clarification(self):
        sm = CoordinatorStateMachine("test-session")

        sm.transition(
            Phase.AWAITING_CLARIFICATION,
            original_task="Create a CRM"
        )

        assert sm.context.phase == Phase.AWAITING_CLARIFICATION
        assert sm.context.original_task == "Create a CRM"

    def test_valid_transition_from_idle_to_awaiting_cascade_questions(self):
        sm = CoordinatorStateMachine("test-session")
        mock_coordinator = MagicMock()
        mock_plan = MagicMock()

        sm.transition(
            Phase.AWAITING_CASCADE_QUESTIONS,
            coordinator=mock_coordinator,
            plan=mock_plan,
            original_task="Build an HR system"
        )

        assert sm.context.phase == Phase.AWAITING_CASCADE_QUESTIONS

    def test_valid_transition_from_awaiting_approval_to_executing(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_APPROVAL

        sm.transition(Phase.EXECUTING)

        assert sm.context.phase == Phase.EXECUTING

    def test_valid_transition_from_awaiting_approval_to_idle_feedback(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_APPROVAL

        sm.transition(Phase.IDLE)

        assert sm.context.phase == Phase.IDLE

    def test_valid_transition_from_executing_to_idle(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.EXECUTING

        sm.transition(Phase.IDLE)

        assert sm.context.phase == Phase.IDLE

    def test_valid_self_transition_cascade_questions(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_CASCADE_QUESTIONS

        # Self-transition is allowed (more questions)
        sm.transition(Phase.AWAITING_CASCADE_QUESTIONS)

        assert sm.context.phase == Phase.AWAITING_CASCADE_QUESTIONS

    def test_invalid_transition_raises_error(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_APPROVAL

        with pytest.raises(InvalidTransitionError) as exc_info:
            sm.transition(Phase.AWAITING_CASCADE_QUESTIONS)

        assert "Cannot transition from AWAITING_APPROVAL to AWAITING_CASCADE_QUESTIONS" in str(exc_info.value)

    def test_invalid_transition_from_clarification_to_executing(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_CLARIFICATION

        with pytest.raises(InvalidTransitionError):
            sm.transition(Phase.EXECUTING)

    def test_invalid_transition_from_questions_to_approval(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_QUESTIONS

        with pytest.raises(InvalidTransitionError):
            sm.transition(Phase.AWAITING_APPROVAL)


class TestHandleInput:
    """Test input handling based on current phase."""

    def test_handle_idle_returns_run_coordinator(self):
        sm = CoordinatorStateMachine("test-session")

        action = sm.handle_input("task", "Create a CRM app")

        assert action.action_type == ActionType.RUN_COORDINATOR
        assert sm.context.original_task == "Create a CRM app"

    def test_handle_clarification_returns_combined_task(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_CLARIFICATION
        sm.context.original_task = "Create an app"

        action = sm.handle_input("clarification", "It should be a CRM")

        assert action.action_type == ActionType.RUN_COORDINATOR
        assert "Create an app" in action.combined_task
        assert "It should be a CRM" in action.combined_task

    def test_handle_approval_with_approve(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_APPROVAL
        sm.context.coordinator = MagicMock()
        sm.context.plan = MagicMock()

        action = sm.handle_input("approval", "approve")

        assert action.action_type == ActionType.EXECUTE_PLAN
        assert action.next_phase == Phase.EXECUTING

    def test_handle_approval_with_feedback(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_APPROVAL
        sm.context.original_task = "Create a CRM"

        action = sm.handle_input("feedback", "Add more features")

        assert action.action_type == ActionType.RUN_COORDINATOR
        assert "Create a CRM" in action.combined_task
        assert "Add more features" in action.combined_task

    def test_handle_cascade_questions_with_json_answers(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_CASCADE_QUESTIONS
        sm.context.coordinator = MagicMock()

        action = sm.handle_input("answers", '{"q1": "answer1", "q2": "answer2"}')

        assert action.action_type == ActionType.RESUME_CASCADE
        assert sm.context.question_answers == {"q1": "answer1", "q2": "answer2"}

    def test_handle_cascade_questions_with_dict_answers(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_CASCADE_QUESTIONS

        action = sm.handle_input("answers", {"q1": "answer1"})

        assert action.action_type == ActionType.RESUME_CASCADE
        assert sm.context.question_answers == {"q1": "answer1"}

    def test_handle_managed_agent_hitl_with_approve(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_QUESTIONS
        sm.context.original_task = "Create app"

        action = sm.handle_input("approval", "approve")

        assert action.action_type == ActionType.FALL_THROUGH
        assert action.combined_task == "approve"
        assert sm.context.phase == Phase.IDLE  # State cleared

    def test_handle_managed_agent_hitl_with_feedback(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_QUESTIONS
        sm.context.original_task = "Create app"

        action = sm.handle_input("feedback", "Add login page")

        assert action.action_type == ActionType.FALL_THROUGH
        assert "Create app" in action.combined_task
        assert "Add login page" in action.combined_task

    def test_handle_executing_returns_error(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.EXECUTING

        action = sm.handle_input("task", "New task")

        assert action.action_type == ActionType.ERROR
        assert "in progress" in action.error_message.lower()


class TestEventHandlers:
    """Test event handlers that trigger state transitions."""

    def test_on_clarification_needed(self):
        sm = CoordinatorStateMachine("test-session")

        sm.on_clarification_needed(task="Create an app")

        assert sm.context.phase == Phase.AWAITING_CLARIFICATION
        assert sm.context.original_task == "Create an app"

    def test_on_plan_created(self):
        sm = CoordinatorStateMachine("test-session")
        mock_coordinator = MagicMock()
        mock_plan = MagicMock()

        sm.on_plan_created(mock_coordinator, mock_plan, "Create a CRM")

        assert sm.context.phase == Phase.AWAITING_APPROVAL
        assert sm.context.coordinator == mock_coordinator
        assert sm.context.plan == mock_plan
        assert sm.context.original_task == "Create a CRM"

    def test_on_cascade_questions(self):
        sm = CoordinatorStateMachine("test-session")
        mock_coordinator = MagicMock()
        mock_plan = MagicMock()

        sm.on_cascade_questions(mock_coordinator, mock_plan, "Build HR system")

        assert sm.context.phase == Phase.AWAITING_CASCADE_QUESTIONS
        assert sm.context.coordinator == mock_coordinator

    def test_on_cascade_complete(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_CASCADE_QUESTIONS
        sm.context.question_answers = {"q1": "a1"}

        sm.on_cascade_complete()

        assert sm.context.phase == Phase.AWAITING_APPROVAL
        assert sm.context.question_answers is None

    def test_on_managed_agent_hitl(self):
        sm = CoordinatorStateMachine("test-session")

        sm.on_managed_agent_hitl(task="Create app")

        assert sm.context.phase == Phase.AWAITING_QUESTIONS
        assert sm.context.original_task == "Create app"

    def test_on_execution_started(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_APPROVAL

        sm.on_execution_started()

        assert sm.context.phase == Phase.EXECUTING

    def test_on_execution_complete(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.EXECUTING
        sm.context.coordinator = MagicMock()
        sm.context.plan = MagicMock()

        sm.on_execution_complete()

        assert sm.context.phase == Phase.IDLE
        assert sm.context.coordinator is None
        assert sm.context.plan is None

    def test_on_error_clears_state(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.EXECUTING
        sm.context.coordinator = MagicMock()

        sm.on_error("Something went wrong")

        assert sm.context.phase == Phase.IDLE
        assert sm.context.coordinator is None


class TestStateContext:
    """Test StateContext dataclass."""

    def test_clear_resets_all_fields(self):
        context = StateContext(
            phase=Phase.EXECUTING,
            original_task="Create app",
            coordinator=MagicMock(),
            plan=MagicMock(),
            question_answers={"q1": "a1"}
        )

        context.clear()

        assert context.phase == Phase.IDLE
        assert context.original_task is None
        assert context.coordinator is None
        assert context.plan is None
        assert context.question_answers is None


class TestHelpers:
    """Test helper methods."""

    def test_is_approval_true(self):
        sm = CoordinatorStateMachine("test-session")

        assert sm._is_approval("approve") is True
        assert sm._is_approval("APPROVE") is True
        assert sm._is_approval("  approve  ") is True

    def test_is_approval_false(self):
        sm = CoordinatorStateMachine("test-session")

        assert sm._is_approval("no") is False
        assert sm._is_approval("reject") is False
        assert sm._is_approval("I approve this") is False

    def test_parse_answers_dict(self):
        sm = CoordinatorStateMachine("test-session")

        result = sm._parse_answers({"q1": "a1"})

        assert result == {"q1": "a1"}

    def test_parse_answers_json_string(self):
        sm = CoordinatorStateMachine("test-session")

        result = sm._parse_answers('{"q1": "a1"}')

        assert result == {"q1": "a1"}

    def test_parse_answers_plain_string(self):
        sm = CoordinatorStateMachine("test-session")

        result = sm._parse_answers("Just some text")

        assert result == {"default": "Just some text"}


class TestSerialization:
    """Test serialization methods."""

    def test_to_dict(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.AWAITING_APPROVAL
        sm.context.coordinator = MagicMock()
        sm.context.plan = MagicMock()
        sm.context.original_task = "Create app"

        result = sm.to_dict()

        assert result["session_id"] == "test-session"
        assert result["phase"] == "AWAITING_APPROVAL"
        assert result["has_coordinator"] is True
        assert result["has_plan"] is True
        assert result["has_original_task"] is True

    def test_repr(self):
        sm = CoordinatorStateMachine("test-session")
        sm.context.phase = Phase.EXECUTING

        result = repr(sm)

        assert "test-session" in result
        assert "EXECUTING" in result


class TestFullFlow:
    """Integration tests for full user flows."""

    def test_full_plan_and_approve_flow(self):
        """Test complete flow: task → plan → approve → execute → complete."""
        sm = CoordinatorStateMachine("test-session")
        mock_coordinator = MagicMock()
        mock_plan = MagicMock()

        # 1. User sends task
        action = sm.handle_input("task", "Create a CRM app")
        assert action.action_type == ActionType.RUN_COORDINATOR
        assert sm.context.phase == Phase.IDLE

        # 2. Coordinator creates plan
        sm.on_plan_created(mock_coordinator, mock_plan, "Create a CRM app")
        assert sm.context.phase == Phase.AWAITING_APPROVAL

        # 3. User approves
        action = sm.handle_input("approval", "approve")
        assert action.action_type == ActionType.EXECUTE_PLAN
        assert action.next_phase == Phase.EXECUTING

        # 4. Execution starts
        sm.on_execution_started()
        assert sm.context.phase == Phase.EXECUTING

        # 5. Execution completes
        sm.on_execution_complete()
        assert sm.context.phase == Phase.IDLE
        assert sm.context.coordinator is None

    def test_full_cascade_planning_flow(self):
        """Test cascade planning: task → questions → answers → more questions → plan → approve."""
        sm = CoordinatorStateMachine("test-session")
        mock_coordinator = MagicMock()
        mock_plan = MagicMock()

        # 1. Task starts cascade planning
        action = sm.handle_input("task", "Build HR system")
        assert action.action_type == ActionType.RUN_COORDINATOR

        # 2. Cascade planning has questions
        sm.on_cascade_questions(mock_coordinator, mock_plan, "Build HR system")
        assert sm.context.phase == Phase.AWAITING_CASCADE_QUESTIONS

        # 3. User answers questions
        action = sm.handle_input("answers", {"q1": "Yes, include payroll"})
        assert action.action_type == ActionType.RESUME_CASCADE

        # 4. More questions (self-transition)
        sm.on_more_cascade_questions()
        assert sm.context.phase == Phase.AWAITING_CASCADE_QUESTIONS

        # 5. User answers more questions
        action = sm.handle_input("answers", {"q2": "Use PostgreSQL"})
        assert action.action_type == ActionType.RESUME_CASCADE

        # 6. Cascade complete
        sm.on_cascade_complete()
        assert sm.context.phase == Phase.AWAITING_APPROVAL

        # 7. User approves
        action = sm.handle_input("approval", "approve")
        assert action.action_type == ActionType.EXECUTE_PLAN

    def test_clarification_flow(self):
        """Test clarification: task → clarify → answer → plan."""
        sm = CoordinatorStateMachine("test-session")

        # 1. Task needs clarification
        action = sm.handle_input("task", "Create an app")
        sm.on_clarification_needed("Create an app")
        assert sm.context.phase == Phase.AWAITING_CLARIFICATION

        # 2. User provides clarification
        action = sm.handle_input("clarification", "A CRM for sales teams")
        assert action.action_type == ActionType.RUN_COORDINATOR
        assert "Create an app" in action.combined_task
        assert "A CRM for sales teams" in action.combined_task
        assert sm.context.phase == Phase.IDLE

    def test_feedback_replan_flow(self):
        """Test feedback: plan → feedback → replan."""
        sm = CoordinatorStateMachine("test-session")
        mock_coordinator = MagicMock()
        mock_plan = MagicMock()

        # 1. Plan created
        sm.on_plan_created(mock_coordinator, mock_plan, "Create CRM")
        assert sm.context.phase == Phase.AWAITING_APPROVAL

        # 2. User provides feedback instead of approval
        action = sm.handle_input("feedback", "Add email integration")
        assert action.action_type == ActionType.RUN_COORDINATOR
        assert "Add email integration" in action.combined_task
        assert sm.context.phase == Phase.IDLE  # Reset for replan
