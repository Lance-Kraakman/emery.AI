"""Test gRPC server functionality."""

import pytest

from emery_agents.grpc.server import AgentWorkerServiceImplementation
from emery_agents.grpc.proto_mappers import create_task_progress
from emery_agents.domain.entities.models import TaskStatus
from emery_agents.grpc.generated import agent_worker_pb2

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
    
    
    @pytest.mark.asyncio
    async def test_get_worker_info(self):
        """Test GetWorkerInfo gRPC method."""
        service = AgentWorkerServiceImplementation("test_org")        
        request = agent_worker_pb2.Empty()
        
        info = await service.GetWorkerInfo(request, None)
        
        assert info.organization_id == "test_org"
        assert info.worker_id.startswith("worker_test_org")
        assert info.version == "2.0.0-proto"
        assert info.active_tasks == 0
        assert info.max_concurrent_tasks == 10
    
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
