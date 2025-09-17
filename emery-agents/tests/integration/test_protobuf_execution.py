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
from emery_agents.domain.execution.services.capability_routing_service import CapabilityRoutingService
from emery_agents.domain.execution.repositories.execution_repository import IExecutionRepository
from emery_agents.application.di.container import container


class TestCapabilityRouter:
    """Test capability routing for dual execution modes."""
    
    def test_route_capability_name_execution(self):
        """Test routing when capability_name is provided."""
        routing_service = CapabilityRoutingService()
        
        # Create test capability
        step = StepConfig(
            id="test_step",
            type=StepType.CODE_STEP,
            instructions="Write a Python function",
            model="Qwen/Qwen2.5-Coder-7B-Instruct",
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
        
        execution_context = routing_service.determine_execution_context(request)
        # Get the capability from the context  
        result = routing_service.find_capability_by_name(
            request.agent_config.capabilities, 
            request.capability_name
        )
        
        assert result.name == "code_generation"
        assert len(result.steps) == 1
        assert result.steps[0].instructions == "Write a Python function"
    
    def test_route_instruction_config_execution(self):
        """Test routing when instruction_config is provided."""
        routing_service = CapabilityRoutingService()
        
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
        
        execution_context = routing_service.determine_execution_context(request)
        # Create dynamic capability from instruction config
        result = routing_service.create_dynamic_capability(
            instruction_config.instructions,
            instruction_config.tools,
            instruction_config.servers
        )
        
        assert result.name == "dynamic_capability"
        assert len(result.steps) == 1
        assert result.steps[0].type == StepType.TOOL_STEP  # Because tools are provided
        assert result.steps[0].instructions == "Send an email to the team"
    
    def test_route_no_execution_mode_raises_error(self):
        """Test that missing execution mode raises error."""
        routing_service = CapabilityRoutingService()
        
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
            routing_service.determine_execution_context(request)


@pytest.mark.asyncio
class TestSmolAgentsExecutionRepository:
    """Test smolagents execution repository with DDD architecture."""
    
    async def test_execute_task_with_capability_routing(self):
        """Test task execution with capability routing."""
        # This test requires HF_TOKEN and smolagents
        import os
        if not os.getenv("HF_TOKEN"):
            pytest.skip("HF_TOKEN not available")
        
        # Initialize DDD container and get execution repository
        container.initialize_defaults()
        
        execution_repo = container.get_repository(IExecutionRepository)
        routing_service = CapabilityRoutingService()
        
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
        
        # Convert TaskRequest to ExecutionContext
        execution_context = routing_service.determine_execution_context(request)
        
        # Collect all progress updates using DDD architecture
        progress_updates = []
        async for progress_dict in execution_repo.execute_task(execution_context):
            # Convert dict to TaskProgress-like object for compatibility
            class MockTaskProgress:
                def __init__(self, data):
                    self.task_id = request.task_id
                    self.step_id = data["step_id"]
                    self.status = data["status"].upper()
                    if not self.status.startswith("TASK_"):
                        self.status = f"TASK_{self.status.upper()}"
                    self.output_json = json.dumps(data["output"]) if isinstance(data["output"], dict) else str(data["output"])
                    self.error_message = data.get("error_message", "")
                    
            progress_updates.append(MockTaskProgress(progress_dict))
        
        # Verify we got progress updates
        assert len(progress_updates) > 0
        
        # Check first update is setup
        first_update = progress_updates[0]
        assert first_update.task_id == "test_calc_task"
        assert first_update.step_id == "setup"
        
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
        
        # Initialize DDD container and get execution repository
        container.initialize_defaults()
        
        execution_repo = container.get_repository(IExecutionRepository)
        routing_service = CapabilityRoutingService()
        
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
        
        # Convert TaskRequest to ExecutionContext
        execution_context = routing_service.determine_execution_context(request)
        
        # Collect progress updates using DDD architecture
        progress_updates = []
        async for progress_dict in execution_repo.execute_task(execution_context):
            # Convert dict to TaskProgress-like object for compatibility
            class MockTaskProgress:
                def __init__(self, data):
                    self.task_id = request.task_id
                    self.step_id = data["step_id"]
                    self.status = data["status"].upper()
                    if not self.status.startswith("TASK_"):
                        self.status = f"TASK_{self.status.upper()}"
                    self.output_json = json.dumps(data["output"]) if isinstance(data["output"], dict) else str(data["output"])
                    self.error_message = data.get("error_message", "")
                    
            progress_updates.append(MockTaskProgress(progress_dict))
        
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