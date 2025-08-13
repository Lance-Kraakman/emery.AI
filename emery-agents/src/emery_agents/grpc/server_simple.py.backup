"""
Simplified gRPC server implementation for agent worker instances
"""

import asyncio
import json
import logging
import time
from typing import AsyncIterator

import grpc
from grpc import aio

# Import generated protobuf definitions
from .generated import agent_worker_pb2
from .generated import agent_worker_pb2_grpc

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AgentWorkerServiceImplementation(agent_worker_pb2_grpc.AgentWorkerServicer):
    """
    Simplified gRPC service implementation for agent task execution
    """
    
    def __init__(self, organization_id: str, max_concurrent_tasks: int = 10):
        self.organization_id = organization_id
        self.max_concurrent_tasks = max_concurrent_tasks
        self.worker_id = f"worker_{organization_id}_{int(time.time())}"
        self.start_time = time.time()
        
        logger.info(f"Initialized worker {self.worker_id} for organization {organization_id}")
    
    async def ExecuteTask(
        self, 
        request: agent_worker_pb2.TaskRequest, 
        context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_worker_pb2.TaskProgress]:
        """
        Execute an agent task and stream progress updates
        """
        task_id = request.task_id
        logger.info(f"[TASK-START] {task_id}: Agent {request.agent_id} capability '{request.capability_name}'")
        
        try:
            # Initial progress update
            yield agent_worker_pb2.TaskProgress(
                task_id=task_id,
                status=agent_worker_pb2.TASK_IN_PROGRESS,
                timestamp_ms=int(time.time() * 1000),
                progress_percent=0.0,
                step_id="initialization",
                step_type="INIT"
            )
            
            # Simulate some work with progress updates
            for i in range(3):
                await asyncio.sleep(0.5)  # Simulate work
                
                progress_percent = ((i + 1) / 3) * 100
                
                yield agent_worker_pb2.TaskProgress(
                    task_id=task_id,
                    status=agent_worker_pb2.TASK_IN_PROGRESS,
                    timestamp_ms=int(time.time() * 1000),
                    progress_percent=progress_percent,
                    step_id=f"step_{i+1}",
                    step_type="WORK",
                    output_json=json.dumps({"step": i+1, "result": f"completed step {i+1}"})
                )
            
            # Final completion update
            yield agent_worker_pb2.TaskProgress(
                task_id=task_id,
                status=agent_worker_pb2.TASK_COMPLETED,
                timestamp_ms=int(time.time() * 1000),
                progress_percent=100.0,
                step_id="completion",
                step_type="COMPLETE",
                output_json=json.dumps({"final_result": f"Task {task_id} completed successfully"})
            )
            
        except Exception as e:
            logger.error(f"[TASK-ERROR] {task_id}: {str(e)}")
            yield agent_worker_pb2.TaskProgress(
                task_id=task_id,
                status=agent_worker_pb2.TASK_FAILED,
                error_message=str(e),
                timestamp_ms=int(time.time() * 1000),
                progress_percent=0.0
            )
        finally:
            logger.info(f"[TASK-CLEANUP] {task_id}: Execution completed")
    
    async def GetWorkerInfo(
        self, 
        request: agent_worker_pb2.Empty, 
        context: grpc.aio.ServicerContext
    ) -> agent_worker_pb2.WorkerInfo:
        """
        Return worker health and capability information
        """
        uptime = int(time.time() - self.start_time)
        
        return agent_worker_pb2.WorkerInfo(
            worker_id=self.worker_id,
            version="1.0.0",
            organization_id=self.organization_id,
            status=agent_worker_pb2.WORKER_HEALTHY,
            capabilities=["general_assistance", "data_analysis", "email_automation"],
            active_tasks=0,
            max_concurrent_tasks=self.max_concurrent_tasks,
            uptime_seconds=uptime,
            supported_tools=["gmail", "slack", "github"]
        )
    
    async def CancelTask(
        self, 
        request: agent_worker_pb2.CancelTaskRequest, 
        context: grpc.aio.ServicerContext
    ) -> agent_worker_pb2.CancelTaskResponse:
        """
        Cancel a running task (simplified implementation)
        """
        task_id = request.task_id
        logger.info(f"[TASK-CANCEL] {task_id}: {request.reason or 'No reason provided'}")
        
        return agent_worker_pb2.CancelTaskResponse(
            success=True,
            message=f"Task {task_id} cancellation requested (simplified implementation)"
        )


async def serve(port: int, organization_id: str):
    """
    Start the gRPC server for this worker instance
    """
    server = aio.server()
    servicer = AgentWorkerServiceImplementation(organization_id)
    
    agent_worker_pb2_grpc.add_AgentWorkerServicer_to_server(servicer, server)
    
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Starting simplified agent worker server on {listen_addr} for organization {organization_id}")
    
    await server.start()
    
    try:
        await server.wait_for_termination()
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
        await server.stop(5)
    finally:
        logger.info("Server stopped")


def main():
    """
    Entry point for the simplified gRPC worker server
    """
    import sys
    import os
    
    # Get configuration from environment or command line
    port = int(os.environ.get('WORKER_PORT', '50051'))
    organization_id = os.environ.get('ORGANIZATION_ID', 'default')
    
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    if len(sys.argv) > 2:
        organization_id = sys.argv[2]
    
    logger.info(f"Starting simplified agent worker for organization '{organization_id}' on port {port}")
    
    try:
        asyncio.run(serve(port, organization_id))
    except KeyboardInterrupt:
        logger.info("Worker shutdown by user")
    except Exception as e:
        logger.error(f"Worker failed to start: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()


# AIDEV-NOTE: This is a simplified server using only generated protobuf definitions
# AIDEV-TODO: Integrate with actual agent runner and context manager once protobuf issues resolved