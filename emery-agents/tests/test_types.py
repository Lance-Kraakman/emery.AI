"""Test type definitions and validation."""

import pytest
from datetime import datetime

from emery_agents.core.types import (
    StepType, TriggerType, TaskStatus,
    ToolConfig, ServerConfig, StepConfig, CapabilityConfig,
    TaskInstructions, Task, Agent
)

class TestEnums:
    """Test enum definitions."""
    
    def test_step_type_values(self):
        """Step types have correct values."""
        assert StepType.CODE_STEP.value == "CODE_STEP"
        assert StepType.TOOL_STEP.value == "TOOL_STEP"
    
    def test_trigger_type_values(self):
        """Trigger types have correct values."""
        assert TriggerType.MANUAL.value == "MANUAL"
        assert TriggerType.CRON.value == "CRON"
        assert TriggerType.WEBHOOK.value == "WEBHOOK"
    
    def test_task_status_values(self):
        """Task status values are correct."""
        assert TaskStatus.PENDING.value == "pending"
        assert TaskStatus.IN_PROGRESS.value == "in_progress"
        assert TaskStatus.COMPLETED.value == "completed"
        assert TaskStatus.FAILED.value == "failed"


class TestConfigurations:
    """Test configuration dataclasses."""
    
    def test_tool_config_creation(self):
        """ToolConfig creates correctly."""
        tool = ToolConfig(name="test_tool", version="1.0", config={"key": "value"})
        assert tool.name == "test_tool"
        assert tool.version == "1.0"
        assert tool.config["key"] == "value"
    
    def test_server_config_creation(self):
        """ServerConfig creates correctly."""
        server = ServerConfig(name="test_server", endpoint="http://localhost")
        assert server.name == "test_server"
        assert server.endpoint == "http://localhost"
    
    def test_step_config_creation(self):
        """StepConfig creates with proper types."""
        step = StepConfig(
            id="step_1",
            type=StepType.CODE_STEP,
            instructions="Do something",
            model="gpt-4"
        )
        assert step.id == "step_1"
        assert step.type == StepType.CODE_STEP
        assert step.instructions == "Do something"
        assert step.model == "gpt-4"
    
    def test_capability_config_creation(self, sample_step_config):
        """CapabilityConfig creates with steps."""
        capability = CapabilityConfig(
            name="test_capability",
            description="Test capability",
            steps=[sample_step_config]
        )
        assert capability.name == "test_capability"
        assert len(capability.steps) == 1
        assert capability.steps[0].id == "test_step_1"


class TestTaskTypes:
    """Test task-related types."""
    
    def test_task_instructions_creation(self):
        """TaskInstructions creates correctly."""
        instructions = TaskInstructions(
            instructions="Do this task",
            tools=[ToolConfig(name="tool1")],
            servers=[ServerConfig(name="server1")]
        )
        assert instructions.instructions == "Do this task"
        assert len(instructions.tools) == 1
        assert len(instructions.servers) == 1
    
    def test_task_creation(self, sample_task_instructions):
        """Task creates with proper defaults."""
        task = Task(
            id="task_123",
            agentId=456,
            name="Test Task",
            instructions=sample_task_instructions
        )
        assert task.id == "task_123"
        assert task.agentId == 456
        assert task.status == TaskStatus.PENDING
        assert task.result is None
        assert task.error is None
    
    def test_agent_creation(self, sample_capability):
        """Agent creates with capabilities."""
        agent = Agent(
            id=123,
            name="Test Agent",
            capabilities=[sample_capability]
        )
        assert agent.id == 123
        assert agent.name == "Test Agent"
        assert len(agent.capabilities) == 1
        assert agent.status == "active"


