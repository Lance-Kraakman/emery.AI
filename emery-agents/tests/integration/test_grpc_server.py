"""
gRPC Server Integration Tests

AIDEV-NOTE: Integration tests for gRPC server functionality following DDD test patterns.
Tests actual gRPC communication with minimal mocking for core server functionality.
"""

import asyncio
import socket
import pytest
import grpc
from unittest.mock import patch
from typing import AsyncIterator

from emery_agents.infrastructure.grpc.server import AgentWorkerServiceImplementation
from emery_agents.infrastructure.grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc


class TestGrpcServerIntegration:
    """Integration tests for gRPC server core functionality."""

    @pytest.fixture
    def grpc_server_port(self) -> int:
        """Find available port for test gRPC server."""
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.bind(('', 0))
            s.listen(1)
            port = s.getsockname()[1]
        return port

    @pytest.fixture
    async def grpc_test_server(self, grpc_server_port):
        """Start gRPC test server and return server instance."""
        server = grpc.aio.server()
        
        # Mock environment for test server
        with patch.dict('os.environ', {'HF_TOKEN': 'test-token'}):
            service_impl = AgentWorkerServiceImplementation(organization_id="test-org")
            agent_worker_pb2_grpc.add_AgentWorkerServicer_to_server(service_impl, server)
            
            listen_addr = f'localhost:{grpc_server_port}'
            server.add_insecure_port(listen_addr)
            
            await server.start()
            yield server, service_impl
            await server.stop(grace=0.1)

    @pytest.fixture
    async def grpc_client(self, grpc_test_server, grpc_server_port):
        """Create gRPC client connected to test server."""
        server, service_impl = grpc_test_server
        
        channel = grpc.aio.insecure_channel(f'localhost:{grpc_server_port}')
        client = agent_worker_pb2_grpc.AgentWorkerStub(channel)
        
        yield client, service_impl
        await channel.close()

    @pytest.fixture
    def sample_task_request(self) -> agent_worker_pb2.TaskRequest:
        """Create sample task request for testing."""
        # Create instruction config
        instruction_config = agent_worker_pb2.InstructionConfig()
        instruction_config.instructions = "Test task execution"
        
        request = agent_worker_pb2.TaskRequest()
        request.task_id = "test-task-123"
        request.agent_id = 123
        request.capability_name = "test_capability"
        request.instruction_config.CopyFrom(instruction_config)
        request.organization_id = "test-org"
        request.owner_id = "test-user"
        
        return request

    @pytest.mark.asyncio
    async def test_server_worker_info(self, grpc_client):
        """Test GetWorkerInfo endpoint returns proper worker information."""
        client, service_impl = grpc_client
        
        # Create empty request
        empty_request = agent_worker_pb2.Empty()
        
        # Call GetWorkerInfo
        response = await client.GetWorkerInfo(empty_request)
        
        # Verify response
        assert response.organization_id == "test-org"
        assert response.version == "2.0.0-proto"
        assert response.status == agent_worker_pb2.WORKER_HEALTHY
        assert response.active_tasks == 0
        assert response.max_concurrent_tasks == 10
        assert response.uptime_seconds >= 0
        assert "worker_test-org_" in response.worker_id

    @pytest.mark.asyncio
    async def test_task_execution_successful(self, grpc_client, sample_task_request):
        """Test successful task execution with progress streaming."""
        client, service_impl = grpc_client
        
        # Mock agent service for successful execution
        async def mock_execute_task(agent, instructions, capability_name):
            return {"status": "success", "result": {"output": "Task completed successfully"}}
        
        service_impl.agent_service.execute_task = mock_execute_task
        
        # Execute task and collect progress updates
        progress_updates = []
        async for progress in client.ExecuteTask(sample_task_request):
            progress_updates.append(progress)
        
        # Verify progress updates
        assert len(progress_updates) >= 2  # At least initialization and completion
        
        # Check initialization progress
        init_progress = progress_updates[0]
        assert init_progress.task_id == "test-task-123"
        assert init_progress.status == agent_worker_pb2.TASK_IN_PROGRESS
        assert init_progress.step_id == "initialization"
        assert init_progress.progress_percent == 0.0
        
        # Check final completion progress
        final_progress = progress_updates[-1]
        assert final_progress.task_id == "test-task-123"
        assert final_progress.status == agent_worker_pb2.TASK_COMPLETED
        assert final_progress.step_id == "completion"
        assert final_progress.progress_percent == 100.0
        assert "Task completed successfully" in str(final_progress.output_json)

    @pytest.mark.asyncio
    async def test_task_execution_failure(self, grpc_client, sample_task_request):
        """Test task execution failure handling."""
        client, service_impl = grpc_client
        
        # Mock agent service for failed execution
        async def mock_execute_task(agent, instructions, capability_name):
            raise Exception("Test execution failure")
        
        service_impl.agent_service.execute_task = mock_execute_task
        
        # Execute task and collect progress updates
        progress_updates = []
        async for progress in client.ExecuteTask(sample_task_request):
            progress_updates.append(progress)
        
        # Verify failure is handled properly
        assert len(progress_updates) >= 2
        
        # Check final progress indicates failure
        final_progress = progress_updates[-1]
        assert final_progress.task_id == "test-task-123"
        assert final_progress.status == agent_worker_pb2.TASK_FAILED
        assert "Test execution failure" in final_progress.error_message

    @pytest.mark.asyncio
    async def test_task_cancellation(self, grpc_client, sample_task_request):
        """Test task cancellation functionality."""
        client, service_impl = grpc_client
        
        # Mock long-running task
        async def mock_execute_task(agent, instructions, capability_name):
            await asyncio.sleep(1)  # Simulate work
            return {"status": "success", "result": {}}
        
        service_impl.agent_service.execute_task = mock_execute_task
        
        # Start task execution in background
        task_execution = asyncio.create_task(
            self._collect_progress_updates(client.ExecuteTask(sample_task_request))
        )
        
        # Wait briefly to ensure task is started
        await asyncio.sleep(0.1)
        
        # Cancel the task
        cancel_request = agent_worker_pb2.CancelTaskRequest(task_id="test-task-123")
        cancel_response = await client.CancelTask(cancel_request)
        
        # Verify cancellation response
        assert cancel_response.success is True
        assert "test-task-123" in cancel_response.message
        
        # Wait for task execution to complete
        progress_updates = await task_execution
        
        # Verify task was removed from active tasks
        assert "test-task-123" not in service_impl.active_tasks

    @pytest.mark.asyncio 
    async def test_cancel_nonexistent_task(self, grpc_client):
        """Test cancelling a task that doesn't exist."""
        client, service_impl = grpc_client
        
        # Try to cancel non-existent task
        cancel_request = agent_worker_pb2.CancelTaskRequest(task_id="nonexistent-task")
        cancel_response = await client.CancelTask(cancel_request)
        
        # Verify appropriate response
        assert cancel_response.success is False
        assert "not found" in cancel_response.message.lower()

    @pytest.mark.asyncio
    async def test_concurrent_task_tracking(self, grpc_client):
        """Test that server tracks concurrent tasks properly."""
        client, service_impl = grpc_client
        
        # Mock quick-executing task
        async def mock_execute_task(agent, instructions, capability_name):
            return {"status": "success", "result": {}}
        
        service_impl.agent_service.execute_task = mock_execute_task
        
        # Create multiple task requests
        task_requests = []
        for i in range(3):
            instruction_config = agent_worker_pb2.InstructionConfig()
            instruction_config.instructions = f"Test task {i}"
            
            request = agent_worker_pb2.TaskRequest()
            request.task_id = f"task-{i}"
            request.agent_id = 123
            request.instruction_config.CopyFrom(instruction_config)
            request.organization_id = "test-org"
            
            task_requests.append(request)
        
        # Execute tasks concurrently
        tasks = [
            asyncio.create_task(self._collect_progress_updates(client.ExecuteTask(req)))
            for req in task_requests
        ]
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        
        # Verify all tasks completed successfully
        for result in results:
            assert len(result) >= 2  # At least init and completion
            final_progress = result[-1]
            assert final_progress.status == agent_worker_pb2.TASK_COMPLETED
        
        # Verify no tasks remain active
        assert len(service_impl.active_tasks) == 0

    async def _collect_progress_updates(self, progress_stream: AsyncIterator) -> list:
        """Helper to collect all progress updates from a stream."""
        updates = []
        async for update in progress_stream:
            updates.append(update)
        return updates

    @pytest.mark.asyncio
    async def test_server_environment_setup(self, grpc_client):
        """Test server properly initializes with environment variables."""
        client, service_impl = grpc_client
        
        # Verify service was initialized with test organization
        assert service_impl.organization_id == "test-org"
        assert service_impl.max_concurrent_tasks == 10
        assert len(service_impl.active_tasks) == 0
        
        # Verify worker ID format
        assert service_impl.worker_id.startswith("worker_test-org_")
        
        # Verify agent service is initialized
        assert service_impl.agent_service is not None