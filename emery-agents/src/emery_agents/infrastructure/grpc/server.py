import logging
import sys
import time
import os
from typing import AsyncIterator, Dict, Any, List
import grpc
from grpc import aio
from ...grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc
from ...grpc.generated import table_service_pb2, table_service_pb2_grpc
from .mappers import ProtoMapper

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AgentWorkerServiceImplementation(agent_worker_pb2_grpc.AgentWorkerServicer):
    """gRPC service implementation for AgentWorker."""
    
    def __init__(self, organization_id: str, max_concurrent_tasks: int = 10):
        self.organization_id = organization_id
        self.max_concurrent_tasks = max_concurrent_tasks
        self.worker_id = f"worker_{organization_id}_{int(time.time())}"
        self.start_time = time.time()
        self.active_tasks: Dict[str, Any] = {}
        
        # Initialize services using DDD architecture
        from ...application.di.container import container
        container.initialize_defaults()
        self.container = container  # Store container for use in other methods
        self.agent_task_service = container.get_agent_task_service()
        self.proto_mapper = ProtoMapper()
        
        # Check HF_TOKEN at startup
        hf_token = os.getenv("HF_TOKEN")
        logger.info(f"AgentWorkerServiceImplementation initialized")
        logger.info(f"HF_TOKEN present: {'YES' if hf_token else 'NO'}")
        if hf_token:
            logger.info(f"HF_TOKEN value: {hf_token[:10]}...")
        else:
            logger.error("HF_TOKEN missing at worker initialization!")

    async def ExecuteTask(
        self, 
        request: agent_worker_pb2.TaskRequest, 
        context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_worker_pb2.TaskProgress]:
        """Execute agent task with streaming progress updates."""
        
        # Convert protobuf to domain entity
        task_request = self.proto_mapper.task_request_from_proto(request)
        
        print(f"🚀 [TASK-{task_request.task_id[:8]}] Starting execution for agent: {task_request.agent_id}")
        print(f"📋 [TASK-{task_request.task_id[:8]}] Name: {task_request.name}")
        sys.stdout.flush()
        
        logger.info(f"Task: {task_request.name}")
        
        self.active_tasks[task_request.task_id] = {
            'agent_id': task_request.agent_id, 
            'start_time': time.time()
        }

        try:
            # Convert TaskRequest to ExecutionContext for DDD execution
            from ...domain.execution.services.capability_routing_service import CapabilityRoutingService
            from ...domain.execution.repositories.execution_repository import IExecutionRepository
            
            routing_service = CapabilityRoutingService()
            execution_context = routing_service.determine_execution_context(task_request)
            
            # Get execution repository from DI container
            from ...application.di.container import container
            execution_repo = container.get_repository(IExecutionRepository)
            
            # Stream execution progress using DDD architecture
            async for progress_dict in execution_repo.execute_task(execution_context):
                # Convert dict to TaskProgress entity
                from ...core.entities import TaskProgress
                from ...core.types import TaskStatus
                
                # Map status string to enum
                status_map = {
                    "in_progress": TaskStatus.TASK_IN_PROGRESS,
                    "completed": TaskStatus.TASK_COMPLETED,
                    "failed": TaskStatus.TASK_FAILED
                }
                
                import json
                task_progress = TaskProgress(
                    task_id=task_request.task_id,
                    status=status_map.get(progress_dict["status"], TaskStatus.TASK_IN_PROGRESS).name,
                    output_json=progress_dict.get("output", ""),
                    error_message=progress_dict.get("error_message", ""),
                    timestamp_ms=progress_dict["timestamp_ms"],
                    progress_percent=progress_dict["progress_percent"]
                )
                
                # Convert domain entity to protobuf
                proto_progress = self.proto_mapper.task_progress_to_proto(task_progress)
                yield proto_progress
                
        except Exception as e:
            print(f"❌ [TASK-{task_request.task_id[:8]}] Failed: {str(e)}")
            import traceback
            print(f"📍 [TASK-{task_request.task_id[:8]}] Traceback: {traceback.format_exc()}")
            sys.stdout.flush()
            
            logger.exception(f"Task {task_request.task_id[:8]} failed")
            
            # Send final error progress
            error_progress = agent_worker_pb2.TaskProgress(
                task_id=task_request.task_id,
                status=agent_worker_pb2.TASK_FAILED,
                output_json="",
                error_message=str(e),
                timestamp_ms=int(time.time() * 1000),
                progress_percent=0.0
            )
            yield error_progress
            
        finally:
            if task_request.task_id in self.active_tasks:
                del self.active_tasks[task_request.task_id]

    async def GetWorkerInfo(self, request: agent_worker_pb2.Empty, context: grpc.aio.ServicerContext) -> agent_worker_pb2.WorkerInfo:
        """Get worker health and capability information."""
        from ...core.entities import WorkerInfo
        from ...core.types import WorkerStatus
        
        # Check worker health
        hf_token = os.getenv("HF_TOKEN")
        status = WorkerStatus.WORKER_HEALTHY.name if hf_token else WorkerStatus.WORKER_UNHEALTHY.name
        
        # Get available capabilities from DDD architecture
        from ...domain.tools.repositories.tool_registry_repository import IToolRegistryRepository
        tool_registry = self.container.get_repository(IToolRegistryRepository)
        available_tools = tool_registry.list_available_tools()
        
        worker_info = WorkerInfo(
            worker_id=self.worker_id,
            version="2.0.0-protobuf",
            organization_id=self.organization_id,
            status=status,
            capabilities=["auto_routing", "capability_execution"],  # Supported execution modes
            active_tasks=len(self.active_tasks),
            max_concurrent_tasks=self.max_concurrent_tasks,
            uptime_seconds=int(time.time() - self.start_time),
            supported_tools=available_tools
        )
        
        return self.proto_mapper.worker_info_to_proto(worker_info)

    async def CancelTask(self, request: agent_worker_pb2.CancelTaskRequest, context: grpc.aio.ServicerContext) -> agent_worker_pb2.CancelTaskResponse:
        """Cancel a running task."""
        from ...core.entities import CancelTaskResponse
        
        cancel_request = self.proto_mapper.cancel_task_request_from_proto(request)
        
        if cancel_request.task_id in self.active_tasks:
            del self.active_tasks[cancel_request.task_id]
            response = CancelTaskResponse(
                success=True, 
                message=f"Task {cancel_request.task_id} cancelled"
            )
        else:
            response = CancelTaskResponse(
                success=False, 
                message=f"Task {cancel_request.task_id} not found"
            )
        
        return self.proto_mapper.cancel_task_response_to_proto(response)

async def serve(port: int, organization_id: str):
    server = aio.server()
    
    # Add AgentWorker service
    agent_service_impl = AgentWorkerServiceImplementation(organization_id)
    agent_worker_pb2_grpc.add_AgentWorkerServicer_to_server(agent_service_impl, server)
    
    # Add ChatProcessing service  
    from .chat_processing_service import ChatProcessingServiceImplementation
    chat_service_impl = ChatProcessingServiceImplementation(organization_id)
    agent_worker_pb2_grpc.add_ChatProcessingServiceServicer_to_server(chat_service_impl, server)
    
    # Add Table service
    from .table_proccessing_service import TableService
    table_service_impl = TableService()
    table_service_pb2_grpc.add_TableServiceServicer_to_server(table_service_impl, server)
    
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"gRPC Server starting on {listen_addr}")
    logger.info("Services available:")
    logger.info("  - AgentWorker: Agent execution and task management")
    logger.info("  - ChatProcessingService: AI chat processing (RAG + LLM streaming)")
    logger.info("  - TableService: Delta Lake table operations (CRUD + bulk insert)")
    
    await server.start()
    logger.info("✅ gRPC server started successfully, waiting for termination")
    await server.wait_for_termination()