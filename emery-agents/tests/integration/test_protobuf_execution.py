"""
Integration tests for protobuf-compatible execution.

AIDEV-NOTE: Tests the complete flow: protobuf → domain entities → smolagents → results.
"""

import pytest
import json
from typing import List
from unittest.mock import AsyncMock, MagicMock

from emery_agents.core.entities import (
    TaskRequest, AgentConfig, CapabilityConfig, StepConfig, ToolConfig, 
    ServerConfig, TriggerData, InstructionConfig
)
from emery_agents.core.types import StepType
from emery_agents.execution.capability_router import CapabilityRouter
from emery_agents.execution.tools.tool_registry import ToolRegistry
from emery_agents.infrastructure.execution.smolagents_execution_service import SmolAgentsExecutionService


class TestCapabilityRouter:
    """Test capability routing for dual execution modes."""
    
    def test_route_capability_name_execution(self):
        """Test routing when capability_name is provided."""
        router = CapabilityRouter()
        
        # Create test capability
        step = StepConfig(
            id="test_step",
            type=StepType.CODE_STEP,
            instructions="Write a Python function",
            model="Qwen/Qwen2.5-Coder-32B-Instruct",
            tools=[],
            servers=[]
        )
        
        capability = CapabilityConfig(
            name="code_generation",
            description="Generate Python code",
            steps=[step]
        )
        
        agent_config = AgentConfig(
            name="Test Agent",
            role="Developer",
            description="Test agent",
            persona="Helpful assistant",
            tools=[],
            servers=[],
            capabilities=[capability]
        )
        
        request = TaskRequest(
            task_id="test_task",
            agent_id=1,
            agent_config=agent_config,
            trigger_data=TriggerData(payload={}),
            organization_id="test_org",
            owner_id="test_user",
            timeout_seconds=300,
            name="Test Task",
            capability_name="code_generation"
        )
        
        result = router.route_execution(request)
        
        assert result.name == "code_generation"
        assert len(result.steps) == 1
        assert result.steps[0].instructions == "Write a Python function"
    
    def test_route_instruction_config_execution(self):
        """Test routing when instruction_config is provided."""
        router = CapabilityRouter()
        
        instruction_config = InstructionConfig(
            instructions="Send an email to the team",
            tools=[ToolConfig(name="gmail", version="1.0", config={})],
            servers=[]
        )
        
        agent_config = AgentConfig(
            name="Test Agent",
            role="Assistant",
            description="Test agent",
            persona="Helpful assistant",
            tools=[],
            servers=[],
            capabilities=[]
        )
        
        request = TaskRequest(
            task_id="test_task",
            agent_id=1,
            agent_config=agent_config,
            trigger_data=TriggerData(payload={}),
            organization_id="test_org",
            owner_id="test_user",
            timeout_seconds=300,
            name="Test Task",
            instruction_config=instruction_config
        )
        
        result = router.route_execution(request)
        
        assert result.name == "auto_routed_capability"
        assert len(result.steps) == 1
        assert result.steps[0].type == StepType.TOOL_STEP  # Because tools are provided
        assert result.steps[0].instructions == "Send an email to the team"
    
    def test_route_no_execution_mode_raises_error(self):
        """Test that missing execution mode raises error."""
        router = CapabilityRouter()
        
        agent_config = AgentConfig(
            name="Test Agent",
            role="Assistant",
            description="Test agent",
            persona="Helpful assistant",
            tools=[],
            servers=[],
            capabilities=[]
        )
        
        request = TaskRequest(
            task_id="test_task",
            agent_id=1,
            agent_config=agent_config,
            trigger_data=TriggerData(payload={}),
            organization_id="test_org",
            owner_id="test_user",
            timeout_seconds=300,
            name="Test Task"
            # No capability_name or instruction_config
        )
        
        with pytest.raises(ValueError, match="must specify either capability_name or instruction_config"):
            router.route_execution(request)


@pytest.mark.asyncio
class TestSmolAgentsExecutionService:
    """Test smolagents execution service."""
    
    async def test_execute_task_with_capability_routing(self):
        """Test task execution with capability routing."""
        # This test requires HF_TOKEN and smolagents
        import os
        if not os.getenv("HF_TOKEN"):
            pytest.skip("HF_TOKEN not available")
        
        service = SmolAgentsExecutionService()
        
        # Create test request with capability
        step = StepConfig(
            id="test_step",
            type=StepType.CODE_STEP,
            instructions="Calculate 2 + 2 and return the result",
            model="Qwen/Qwen2.5-Coder-7B-Instruct",  # Smaller model for testing
            tools=[],
            servers=[]
        )
        
        capability = CapabilityConfig(
            name="simple_calculation",
            description="Simple math calculation",
            steps=[step]
        )
        
        agent_config = AgentConfig(
            name="Math Agent",
            role="Calculator",
            description="Math calculation agent",
            persona="Precise mathematician",
            tools=[],
            servers=[],
            capabilities=[capability]
        )
        
        request = TaskRequest(
            task_id="test_calc_task",
            agent_id=1,
            agent_config=agent_config,
            trigger_data=TriggerData(payload={}),
            organization_id="test_org",
            owner_id="test_user",
            timeout_seconds=60,  # Short timeout for testing
            name="Simple Calculation",
            capability_name="simple_calculation"
        )
        
        # Collect all progress updates
        progress_updates = []
        async for progress in service.execute_task(request):
            progress_updates.append(progress)
        
        # Verify we got progress updates
        assert len(progress_updates) > 0
        
        # Check first update is routing
        first_update = progress_updates[0]
        assert first_update.task_id == "test_calc_task"
        assert first_update.step_id == "routing"
        
        # Check final update is completion or failure
        final_update = progress_updates[-1]
        assert final_update.task_id == "test_calc_task"
        assert final_update.status in ["TASK_COMPLETED", "TASK_FAILED"]
        
        if final_update.status == "TASK_COMPLETED":
            # Parse the result
            result_data = json.loads(final_update.output_json)
            assert "message" in result_data
        else:
            # Check error message is present
            assert final_update.error_message != ""
    
    async def test_execute_task_with_instruction_routing(self):
        """Test task execution with instruction-based routing."""
        import os
        if not os.getenv("HF_TOKEN"):
            pytest.skip("HF_TOKEN not available")
        
        service = SmolAgentsExecutionService()
        
        instruction_config = InstructionConfig(
            instructions="What is the capital of France?",
            tools=[],
            servers=[]
        )
        
        agent_config = AgentConfig(
            name="Knowledge Agent",
            role="Assistant",
            description="Knowledge assistant",
            persona="Knowledgeable helper",
            tools=[],
            servers=[],
            capabilities=[]
        )
        
        request = TaskRequest(
            task_id="test_knowledge_task",
            agent_id=1,
            agent_config=agent_config,
            trigger_data=TriggerData(payload={}),
            organization_id="test_org",
            owner_id="test_user",
            timeout_seconds=60,
            name="Knowledge Question",
            instruction_config=instruction_config
        )
        
        # Collect progress updates
        progress_updates = []
        async for progress in service.execute_task(request):
            progress_updates.append(progress)
        
        # Verify we got progress updates
        assert len(progress_updates) > 0
        
        # Check task was processed
        final_update = progress_updates[-1]
        assert final_update.task_id == "test_knowledge_task"
        assert final_update.status in ["TASK_COMPLETED", "TASK_FAILED"]


if __name__ == "__main__":
    # Simple test runner for development
    import asyncio
    
    async def run_simple_test():
        print("Testing CapabilityRouter...")
        test_router = TestCapabilityRouter()
        test_router.test_route_capability_name_execution()
        test_router.test_route_instruction_config_execution()
        print("✓ CapabilityRouter tests passed")
            
    
    asyncio.run(run_simple_test())