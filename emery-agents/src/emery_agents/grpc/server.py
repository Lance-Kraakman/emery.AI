"""
Production gRPC server implementation for agent worker instances.
Uses proto-first architecture with simplified smolagents hierarchy for all execution.
All capability routing and step management handled internally by smolagents.
"""
import asyncio
import json
import logging
import time
from typing import AsyncIterator, Dict, Any

# Constants
MAX_LOG_PREVIEW_LENGTH = 100
SHORT_LOG_PREVIEW_LENGTH = 50
DEFAULT_MAX_CONCURRENT_TASKS = 10
PROGRESS_INITIAL = 10.0

import grpc
from grpc import aio

# Import generated protobuf definitions
from .generated import agent_worker_pb2
from .generated import agent_worker_pb2_grpc

# Import proto mapping functions
from .proto_mappers import parse_task_request, create_task_progress

# Import core execution system
from ..core.types import TaskStatus, Agent, TaskInstructions, OrchestratorResult
from ..integrations.smolagents import SmolAgentsOrchestrator

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AgentWorkerServiceImplementation(agent_worker_pb2_grpc.AgentWorkerServicer):
    """
    Production gRPC service implementation using proto-first architecture.
    
    Receives complete agent configuration via protobuf messages instead of 
    environment variables, eliminating configuration anti-patterns.
    """
    
    def __init__(self, organization_id: str, max_concurrent_tasks: int = DEFAULT_MAX_CONCURRENT_TASKS):
        self.organization_id = organization_id
        self.max_concurrent_tasks = max_concurrent_tasks
        self.worker_id = f"worker_{organization_id}_{int(time.time())}"
        self.start_time = time.time()
        self.active_tasks: Dict[str, Any] = {}
        
        # AIDEV-NOTE: Simplified architecture - smolagents handles all execution routing
        
    
    async def ExecuteTask(
        self, 
        request: agent_worker_pb2.TaskRequest, 
        context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_worker_pb2.TaskProgress]:
        """
        Execute an agent task using complete configuration from proto message.
        No environment variables needed - all config comes via structured proto.
        """
        
        # Parse proto request into Python objects
        try:
            task_data = parse_task_request(request)
        except Exception as e:
            logger.error(f"Failed to parse task request: {e}")
            yield create_task_progress(
                task_id=request.task_id,
                status=TaskStatus.FAILED,
                error_message=f"Failed to parse task request: {str(e)}"
            )
            return
        
        task_id = task_data['task_id']
        agent = task_data['agent']
        capability_name = task_data['capability_name']  # May be None for instruction-based execution
        instruction_config = task_data['instruction_config']  # May be None for direct execution
        trigger_data = task_data['trigger_data']
        
        # Log execution details - smolagents handles all routing internally
        logger.info(f"[TASK-START] {task_id}: Agent {agent.name} executing task")
        if instruction_config:
            logger.info(f"[TASK-INSTRUCTIONS] {task_id}: '{instruction_config.instructions[:MAX_LOG_PREVIEW_LENGTH]}...'")
        elif capability_name:
            logger.info(f"[TASK-CAPABILITY] {task_id}: Targeting capability '{capability_name}'")
        else:
            raise ValueError("Either capability_name or instruction_config must be provided")
        
        logger.info(f"[TASK-CONFIG] {task_id}: Agent has {len(agent.capabilities)} capabilities, {len(agent.tools or [])} tools")
        
        # Track active task
        self.active_tasks[task_id] = {
            'agent': agent,
            'instruction_config': instruction_config,
            'start_time': time.time()
        }
        
        try:
            # Initial progress update
            yield create_task_progress(
                task_id=task_id,
                status=TaskStatus.IN_PROGRESS,
                step_id="initialization",
                step_type="INIT",
                progress_percent=0.0
            )
            
            # Use simplified smolagents orchestrator for all execution
            logger.info(f"[TASK-EXECUTE] {task_id}: Starting smolagents orchestrator execution")
            
            # Initialize smolagents orchestrator
            orchestrator = SmolAgentsOrchestrator()
            orchestrator.setup_agent_orchestrator(agent)
            
            # Progress update for orchestrator initialization  
            yield create_task_progress(
                task_id=task_id,
                status=TaskStatus.IN_PROGRESS,
                step_id="orchestrator_init",
                step_type="INIT",
                output_data={"message": "Smolagents orchestrator initialized"},
                progress_percent=PROGRESS_INITIAL
            )
            
            # Execute using orchestrator - smolagents handles all capability routing
            if not instruction_config:
                # Convert capability_name to instruction_config for smolagents
                instruction_config = TaskInstructions(
                    instructions=f"Execute capability: {capability_name}"
                )
            
            task_result = await orchestrator.execute_with_orchestrator(
                instructions=instruction_config
            )
            
            # Convert orchestrator result to expected format
            if task_result["status"] == "success":
                final_result = {
                    "capability_name": task_result.get("selected_capability", "orchestrator"),
                    "result": task_result.get("result", {}),
                    "orchestrator_used": True,
                    "status": "completed"
                }
                final_status = TaskStatus.COMPLETED
            else:
                final_result = {
                    "error": task_result.get("error", "Unknown orchestrator error"),
                    "orchestrator_used": True,
                    "status": "failed"
                }
                final_status = TaskStatus.FAILED
            
            # Final completion update using new final_result and final_status variables
            yield create_task_progress(
                task_id=task_id,
                status=final_status,
                step_id="completion",
                step_type="COMPLETE",
                output_data=final_result,
                error_message=final_result.get("error", "") if isinstance(final_result, dict) else "",
                progress_percent=100.0
            )
            
            logger.info(f"[TASK-COMPLETE] {task_id}: Execution completed with status {final_status}")
            
        except Exception as e:
            logger.exception(f"[TASK-ERROR] {task_id}: Execution failed")
            yield create_task_progress(
                task_id=task_id,
                status=TaskStatus.FAILED,
                error_message=f"Task execution failed: {str(e)}",
                progress_percent=0.0
            )
        finally:
            # Clean up active task tracking
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
            logger.info(f"[TASK-CLEANUP] {task_id}: Cleanup completed")
    
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
            version="2.0.0-proto",  # Updated version to indicate proto-first implementation
            organization_id=self.organization_id,
            status=agent_worker_pb2.WORKER_HEALTHY,
            capabilities=["dynamic_agent_execution", "multi_step_workflows", "proto_config"],
            active_tasks=len(self.active_tasks),
            max_concurrent_tasks=self.max_concurrent_tasks,
            uptime_seconds=uptime,
            supported_tools=["smolagents", "mcp_servers", "emery_client"]
        )
    
    async def CancelTask(
        self, 
        request: agent_worker_pb2.CancelTaskRequest, 
        context: grpc.aio.ServicerContext
    ) -> agent_worker_pb2.CancelTaskResponse:
        """
        Cancel a running task
        """
        task_id = request.task_id
        logger.info(f"[TASK-CANCEL] {task_id}: {request.reason or 'No reason provided'}")
        
        if task_id in self.active_tasks:
            # AIDEV-TODO: Implement actual task cancellation mechanism
            del self.active_tasks[task_id]
            return agent_worker_pb2.CancelTaskResponse(
                success=True,
                message=f"Task {task_id} cancelled successfully"
            )
        else:
            return agent_worker_pb2.CancelTaskResponse(
                success=False,
                message=f"Task {task_id} not found or already completed"
            )


async def serve(port: int, organization_id: str):
    """
    Start the production gRPC server for this worker instance
    """
    server = aio.server()
    servicer = AgentWorkerServiceImplementation(organization_id)
    
    agent_worker_pb2_grpc.add_AgentWorkerServicer_to_server(servicer, server)
    
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Starting proto-first agent worker server on {listen_addr} for organization {organization_id}")
    logger.info("Server receives complete agent configuration via protobuf messages")
    
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
    Entry point for the production gRPC worker server.
    No environment variable configuration needed - all config comes via proto.
    """
    import sys
    import os
    
    # Only basic server config from environment/args - no agent configuration
    port = int(os.environ.get('WORKER_PORT', '50051'))
    organization_id = os.environ.get('ORGANIZATION_ID', 'default')
    
    if len(sys.argv) > 1:
        port = int(sys.argv[1])
    if len(sys.argv) > 2:
        organization_id = sys.argv[2]
    
    logger.info(f"Starting proto-first agent worker for organization '{organization_id}' on port {port}")
    logger.info("Agent configuration will be received via protobuf messages at runtime")
    
    try:
        asyncio.run(serve(port, organization_id))
    except KeyboardInterrupt:
        logger.info("Worker shutdown by user")
    except Exception as e:
        logger.error(f"Worker failed to start: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()


# AIDEV-NOTE: This server implements the proto-first architecture eliminating 
# environment variable dependencies for agent configuration
# AIDEV-TODO: Add task cancellation support with proper cleanup
# AIDEV-TODO: Add worker health monitoring and resource management
