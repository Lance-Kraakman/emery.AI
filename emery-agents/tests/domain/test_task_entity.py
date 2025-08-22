"""
Tests for Task Domain Entity

AIDEV-NOTE: Tests focus on task lifecycle and state transitions.
Business rules validation without external dependencies.
"""

import pytest
from datetime import datetime

from src.emery_agents.domain.agents.entities.task import Task, TaskConfig, TaskInstructions, TaskStatus
from src.emery_agents.domain.agents.value_objects.agent_id import AgentId
from src.emery_agents.domain.agents.value_objects.task_id import TaskId
from src.emery_agents.domain.shared.value_objects.organization_id import OrganizationId


class TestTaskEntity:
    """Test Task domain entity business logic."""
    
    def test_create_task_with_valid_config(self):
        """Test creating task with valid configuration."""
        instructions = TaskInstructions(
            instructions="Send email to team",
            tools=[{"name": "gmail"}],
            servers=[{"name": "gmail"}]
        )
        
        config = TaskConfig(
            agent_id=123,
            organization_id=1,
            name="Send Email Task",
            capability_name="email",
            instructions=instructions,
            created_by="user_123"
        )
        
        task = Task.create(config)
        
        assert task.agent_id.value == 123
        assert task.organization_id.value == 1
        assert task.name == "Send Email Task"
        assert task.capability_name == "email"
        assert task.instructions.instructions == "Send email to team"
        assert task.status == TaskStatus.PENDING
        assert task.created_by == "user_123"
        assert task.result is None
        assert task.error is None
    
    def test_create_task_generates_uuid_id(self):
        """Test task creation generates UUID for ID."""
        task = self._create_test_task()
        
        # Should be valid UUID format
        assert isinstance(task.id, TaskId)
        assert len(task.id.value) == 36  # UUID length
        assert "-" in task.id.value
    
    def test_create_task_validates_name(self):
        """Test task name validation."""
        instructions = TaskInstructions(instructions="Test")
        config = TaskConfig(
            agent_id=123,
            organization_id=1,
            name="",  # Empty name
            instructions=instructions
        )
        
        with pytest.raises(ValueError, match="Task name cannot be empty"):
            Task.create(config)
    
    def test_create_task_validates_name_length(self):
        """Test task name length validation."""
        long_name = "x" * 501  # Too long
        instructions = TaskInstructions(instructions="Test")
        config = TaskConfig(
            agent_id=123,
            organization_id=1,
            name=long_name,
            instructions=instructions
        )
        
        with pytest.raises(ValueError, match="Task name cannot exceed 500 characters"):
            Task.create(config)
    
    def test_task_start_from_pending_status(self):
        """Test starting task from pending status."""
        task = self._create_test_task()
        assert task.status == TaskStatus.PENDING
        
        running_task = task.start()
        
        assert running_task.status == TaskStatus.IN_PROGRESS
        assert running_task.started_at is not None
        assert running_task.error is None
        # Original task unchanged (immutable)
        assert task.status == TaskStatus.PENDING
    
    def test_task_start_fails_from_non_pending_status(self):
        """Test starting task fails from non-pending status."""
        task = self._create_test_task()
        running_task = task.start()
        
        with pytest.raises(ValueError, match="Cannot start task .* current status is in_progress"):
            running_task.start()
    
    def test_task_complete_from_running_status(self):
        """Test completing task from running status."""
        task = self._create_test_task()
        running_task = task.start()
        
        result_data = {"output": "Email sent successfully"}
        completed_task = running_task.complete(result_data)
        
        assert completed_task.status == TaskStatus.COMPLETED
        assert completed_task.result == result_data
        assert completed_task.completed_at is not None
        assert completed_task.error is None
    
    def test_task_complete_fails_from_non_running_status(self):
        """Test completing task fails from non-running status."""
        task = self._create_test_task()
        
        with pytest.raises(ValueError, match="Cannot complete task .* current status is pending"):
            task.complete({"result": "data"})
    
    def test_task_fail_from_any_non_completed_status(self):
        """Test failing task from various statuses."""
        # From pending
        task = self._create_test_task()
        failed_task = task.fail("Something went wrong")
        
        assert failed_task.status == TaskStatus.FAILED
        assert failed_task.error == "Something went wrong"
        assert failed_task.completed_at is not None
        
        # From running
        running_task = task.start()
        failed_task2 = running_task.fail("Execution failed")
        
        assert failed_task2.status == TaskStatus.FAILED
        assert failed_task2.error == "Execution failed"
    
    def test_task_fail_from_completed_status_raises_error(self):
        """Test failing completed task raises error."""
        task = self._create_test_task()
        running_task = task.start()
        completed_task = running_task.complete({"result": "success"})
        
        with pytest.raises(ValueError, match="Cannot fail task .* task is already completed"):
            completed_task.fail("Should not work")
    
    def test_task_cancel_from_non_terminal_status(self):
        """Test cancelling task from non-terminal status."""
        task = self._create_test_task()
        cancelled_task = task.cancel("User cancelled")
        
        assert cancelled_task.status == TaskStatus.CANCELLED
        assert cancelled_task.error == "Cancelled: User cancelled"
        assert cancelled_task.completed_at is not None
    
    def test_task_cancel_without_reason(self):
        """Test cancelling task without reason."""
        task = self._create_test_task()
        cancelled_task = task.cancel()
        
        assert cancelled_task.status == TaskStatus.CANCELLED
        assert cancelled_task.error == "Cancelled by user"
    
    def test_task_cancel_from_terminal_status_raises_error(self):
        """Test cancelling terminal task raises error."""
        task = self._create_test_task()
        running_task = task.start()
        completed_task = running_task.complete({"result": "done"})
        
        with pytest.raises(ValueError, match="Cannot cancel task .* task is already completed"):
            completed_task.cancel("Should not work")
    
    def test_task_timeout_from_non_terminal_status(self):
        """Test timing out task from non-terminal status."""
        task = self._create_test_task()
        running_task = task.start()
        timeout_task = running_task.timeout()
        
        assert timeout_task.status == TaskStatus.TIMEOUT
        assert timeout_task.error == "Task execution timed out"
        assert timeout_task.completed_at is not None
    
    def test_task_update_result_from_running_status(self):
        """Test updating result from running status."""
        task = self._create_test_task()
        running_task = task.start()
        
        progress_data = {"progress": "50%"}
        updated_task = running_task.update_result(progress_data)
        
        assert updated_task.status == TaskStatus.IN_PROGRESS
        assert updated_task.result == progress_data
    
    def test_task_update_result_fails_from_non_running_status(self):
        """Test updating result fails from non-running status."""
        task = self._create_test_task()
        
        with pytest.raises(ValueError, match="Cannot update result for task .* task is not in progress"):
            task.update_result({"progress": "10%"})
    
    def test_task_status_predicates(self):
        """Test task status predicate methods."""
        task = self._create_test_task()
        
        # Pending
        assert task.is_pending() is True
        assert task.is_running() is False
        assert task.is_terminal() is False
        
        # Running
        running_task = task.start()
        assert running_task.is_pending() is False
        assert running_task.is_running() is True
        assert running_task.is_terminal() is False
        
        # Completed
        completed_task = running_task.complete({"result": "done"})
        assert completed_task.is_pending() is False
        assert completed_task.is_running() is False
        assert completed_task.is_terminal() is True
        assert completed_task.is_successful() is True
        assert completed_task.is_failed() is False
        
        # Failed
        failed_task = task.fail("error")
        assert failed_task.is_terminal() is True
        assert failed_task.is_successful() is False
        assert failed_task.is_failed() is True
    
    def test_task_duration_calculation(self):
        """Test task duration calculation."""
        task = self._create_test_task()
        
        # No duration for pending task
        assert task.duration() is None
        
        # Start and complete task
        running_task = task.start()
        # Simulate some time passing
        completed_task = running_task.complete({"result": "done"})
        
        duration = completed_task.duration()
        assert duration is not None
        assert duration >= 0  # Should be non-negative milliseconds
    
    def test_task_display_name_truncation(self):
        """Test task display name truncation."""
        short_name = "Short Task"
        long_name = "This is a very long task name that exceeds fifty characters"
        
        short_task = self._create_test_task(name=short_name)
        long_task = self._create_test_task(name=long_name)
        
        assert short_task.display_name() == short_name
        assert long_task.display_name() == long_name[:47] + "..."
        assert len(long_task.display_name()) == 50
    
    def test_task_short_id(self):
        """Test task short ID generation."""
        task = self._create_test_task()
        short_id = task.short_id()
        
        assert len(short_id) == 8
        assert short_id == task.id.value[:8]
    
    def test_task_equality_by_id(self):
        """Test task equality is based on ID."""
        task1 = self._create_test_task()
        task2 = self._create_test_task_with_id(task1.id)
        task3 = self._create_test_task()
        
        assert task1 == task2
        assert task1 != task3
    
    def test_task_hash_by_id(self):
        """Test task hash is based on ID."""
        task1 = self._create_test_task()
        task2 = self._create_test_task_with_id(task1.id)
        
        assert hash(task1) == hash(task2)
    
    def test_from_persistence_creates_task(self):
        """Test creating task from persistence data."""
        data = {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "agent_id": 123,
            "organization_id": 1,
            "name": "Persisted Task",
            "capability_name": "email",
            "instructions": {
                "instructions": "Send email",
                "tools": [{"name": "gmail"}],
                "servers": [{"name": "gmail"}],
                "metadata": {"key": "value"}
            },
            "status": "completed",
            "result": {"output": "Email sent"},
            "error": None,
            "started_at": datetime(2024, 1, 1, 12, 0, 0),
            "completed_at": datetime(2024, 1, 1, 12, 1, 0),
            "created_by": "user_123",
            "created_at": datetime(2024, 1, 1, 11, 59, 0)
        }
        
        task = Task.from_persistence(data)
        
        assert task.id.value == "550e8400-e29b-41d4-a716-446655440000"
        assert task.agent_id.value == 123
        assert task.organization_id.value == 1
        assert task.name == "Persisted Task"
        assert task.capability_name == "email"
        assert task.instructions.instructions == "Send email"
        assert task.instructions.tools == [{"name": "gmail"}]
        assert task.instructions.servers == [{"name": "gmail"}]
        assert task.instructions.metadata == {"key": "value"}
        assert task.status == TaskStatus.COMPLETED
        assert task.result == {"output": "Email sent"}
        assert task.error is None
        assert task.started_at == datetime(2024, 1, 1, 12, 0, 0)
        assert task.completed_at == datetime(2024, 1, 1, 12, 1, 0)
        assert task.created_by == "user_123"
        assert task.created_at == datetime(2024, 1, 1, 11, 59, 0)
    
    def _create_test_task(self, **kwargs) -> Task:
        """Helper to create test task with defaults."""
        defaults = {
            "agent_id": 123,
            "organization_id": 1,
            "name": "Test Task",
            "capability_name": None,
            "instructions": TaskInstructions(instructions="Test instruction"),
            "created_by": "user_123"
        }
        defaults.update(kwargs)
        
        config = TaskConfig(**defaults)
        return Task.create(config)
    
    def _create_test_task_with_id(self, task_id: TaskId) -> Task:
        """Helper to create test task with specific ID."""
        config = TaskConfig(
            agent_id=123,
            organization_id=1,
            name="Test Task",
            instructions=TaskInstructions(instructions="Test instruction"),
            task_id=task_id.value
        )
        
        return Task.create(config)