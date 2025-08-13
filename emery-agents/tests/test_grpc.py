"""Test gRPC server functionality."""

import pytest

from emery_agents.grpc.server import AgentWorkerServiceImplementation
from emery_agents.grpc.proto_mappers import create_task_progress
from emery_agents.core.types import TaskStatus, TaskInstructions

class TestAgentWorkerService:
    """Test gRPC service implementation."""
    
    def test_initialization(self):
        """AgentWorkerService initializes correctly."""
        service = AgentWorkerServiceImplementation("test_org", max_concurrent_tasks=5)
        
        assert service.organization_id == "test_org"
        assert service.max_concurrent_tasks == 5
        assert service.worker_id.startswith("worker_test_org")
        assert isinstance(service.active_tasks, dict)
        assert len(service.active_tasks) == 0
    
    def test_capability_selection_single(self, sample_agent):
        """Test capability selection with single capability."""
        service = AgentWorkerServiceImplementation("test_org")
        instructions = TaskInstructions(instructions="Test task")
        
        selected = service.select_capability_for_instructions(sample_agent, instructions)
        assert selected == "test_capability"
    
    def test_capability_selection_no_capabilities(self):
        """Test capability selection with no capabilities."""
        from emery_agents.core.types import Agent
        agent = Agent(id=123, name="Empty Agent", capabilities=[])
        
        service = AgentWorkerServiceImplementation("test_org")
        instructions = TaskInstructions(instructions="Test task")
        
        selected = service.select_capability_for_instructions(agent, instructions)
        assert selected == "general_task"
    
    def test_capability_selection_keyword_match(self, sample_agent):
        """Test capability selection by keyword matching."""
        service = AgentWorkerServiceImplementation("test_org")
        instructions = TaskInstructions(instructions="Execute test_capability now")
        
        selected = service.select_capability_for_instructions(sample_agent, instructions)
        assert selected == "test_capability"
    
    def test_capability_selection_tool_match(self, sample_agent):
        """Test capability selection by tool matching."""
        service = AgentWorkerServiceImplementation("test_org")
        instructions = TaskInstructions(
            instructions="Use tools",
            tools=[sample_agent.capabilities[0].steps[0].tools[0]]
        )
        
        selected = service.select_capability_for_instructions(sample_agent, instructions)
        assert selected == "test_capability"
    
    @pytest.mark.asyncio
    async def test_get_worker_info(self):
        """Test GetWorkerInfo gRPC method."""
        service = AgentWorkerServiceImplementation("test_org")
        
        from emery_agents.grpc.generated import agent_worker_pb2
        request = agent_worker_pb2.Empty()
        
        info = await service.GetWorkerInfo(request, None)
        
        assert info.organization_id == "test_org"
        assert info.worker_id.startswith("worker_test_org")
        assert info.version == "2.0.0-proto"
        assert info.active_tasks == 0
        assert info.max_concurrent_tasks == 10
        assert "dynamic_agent_execution" in info.capabilities
    
    @pytest.mark.asyncio
    async def test_cancel_task_found(self):
        """Test canceling an active task."""
        service = AgentWorkerServiceImplementation("test_org")
        
        # Add active task
        service.active_tasks["task_123"] = {"test": "data"}
        
        from emery_agents.grpc.generated import agent_worker_pb2
        request = agent_worker_pb2.CancelTaskRequest(
            task_id="task_123",
            reason="Test cancellation"
        )
        
        response = await service.CancelTask(request, None)
        
        assert response.success is True
        assert "cancelled successfully" in response.message
        assert "task_123" not in service.active_tasks
    
    @pytest.mark.asyncio
    async def test_cancel_task_not_found(self):
        """Test canceling non-existent task."""
        service = AgentWorkerServiceImplementation("test_org")
        
        from emery_agents.grpc.generated import agent_worker_pb2
        request = agent_worker_pb2.CancelTaskRequest(
            task_id="nonexistent",
            reason="Test"
        )
        
        response = await service.CancelTask(request, None)
        
        assert response.success is False
        assert "not found" in response.message


class TestProtoMappers:
    """Test protobuf mapping functions."""
    
    def test_create_task_progress(self):
        """Test creating TaskProgress protobuf."""
        progress = create_task_progress(
            task_id="test_task",
            status=TaskStatus.IN_PROGRESS,
            step_id="step_1",
            step_type="CODE_STEP",
            progress_percent=50.0
        )
        
        assert progress.task_id == "test_task"
        assert progress.step_id == "step_1"
        assert progress.step_type == "CODE_STEP"
        assert progress.progress_percent == 50.0


class TestGRPCIntegration:
    """Test gRPC server integration."""
    
    @pytest.mark.asyncio
    async def test_execute_task_error_handling(self):
        """Test ExecuteTask error handling."""
        service = AgentWorkerServiceImplementation("test_org")
        
        # Create invalid request that will fail parsing
        from emery_agents.grpc.generated import agent_worker_pb2
        request = agent_worker_pb2.TaskRequest()
        # Leave request empty to trigger parsing error
        
        responses = []
        async for response in service.ExecuteTask(request, None):
            responses.append(response)
            break  # Just get first response
        
        assert len(responses) == 1
        assert "Failed to parse" in responses[0].error_message
    
    def test_active_task_tracking(self):
        """Test active task tracking."""
        service = AgentWorkerServiceImplementation("test_org", max_concurrent_tasks=2)
        
        # Initially no tasks
        assert len(service.active_tasks) == 0
        
        # Add tasks
        service.active_tasks["task_1"] = {"data": "test1"}
        service.active_tasks["task_2"] = {"data": "test2"}
        
        assert len(service.active_tasks) == 2
        
        # Remove task
        del service.active_tasks["task_1"]
        assert len(service.active_tasks) == 1
        assert "task_2" in service.active_tasks
    
    def test_worker_id_generation(self):
        """Test worker ID generation is unique."""
        service1 = AgentWorkerServiceImplementation("org1")
        service2 = AgentWorkerServiceImplementation("org2")
        
        assert service1.worker_id != service2.worker_id
        assert "org1" in service1.worker_id
        assert "org2" in service2.worker_id