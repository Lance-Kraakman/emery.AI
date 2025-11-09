import logging
import sys
import time
import os
from typing import AsyncIterator, Dict, Any, List
import grpc
from grpc import aio
from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .generated import table_service_pb2, table_service_pb2_grpc
from .mappers import ProtoMapper
from ..services.agent_executor import AgentExecutor
from ..services.tool_loader import UnifiedToolLoader

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

        # Initialize services (simplified - no DI container)
        self.agent_executor = AgentExecutor()
        self.tool_loader = UnifiedToolLoader()
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
            # DEBUG: Log raw request fields FIRST
            logger.info(f"🔍 [TASK-{task_request.task_id[:8]}] RAW REQUEST FIELDS:")
            logger.info(f"🔍 [TASK-{task_request.task_id[:8]}] - agent_model field: {repr(getattr(task_request, 'agent_model', 'FIELD_NOT_FOUND'))}")
            logger.info(f"🔍 [TASK-{task_request.task_id[:8]}] - organization_model field: {repr(getattr(task_request, 'organization_model', 'FIELD_NOT_FOUND'))}")
            logger.info(f"🔍 [TASK-{task_request.task_id[:8]}] - agent_model type: {type(getattr(task_request, 'agent_model', None))}")
            logger.info(f"🔍 [TASK-{task_request.task_id[:8]}] - organization_model type: {type(getattr(task_request, 'organization_model', None))}")
            logger.info(f"🔍 [TASK-{task_request.task_id[:8]}] - agent_model bool: {bool(getattr(task_request, 'agent_model', None))}")
            logger.info(f"🔍 [TASK-{task_request.task_id[:8]}] - organization_model bool: {bool(getattr(task_request, 'organization_model', None))}")

            # Extract model parameters from proto request for model selection hierarchy
            # AIDEV-NOTE: Model hierarchy: agent_model (request) → agent_config.default_model → org_model → system default
            agent_model = getattr(task_request, 'agent_model', None) or None  # Direct agent_model from request (preferred)
            if not agent_model and hasattr(task_request, 'agent_config') and task_request.agent_config:
                agent_model = getattr(task_request.agent_config, 'default_model', None)  # Fallback to agent config

            if agent_model:
                logger.info(f"🔧 [TASK-{task_request.task_id[:8]}] Agent model: {agent_model}")
            else:
                logger.info(f"⚠️  [TASK-{task_request.task_id[:8]}] NO agent_model found")

            org_model = getattr(task_request, 'organization_model', None) or None
            if org_model:
                logger.info(f"🔧 [TASK-{task_request.task_id[:8]}] Organization model: {org_model}")
            else:
                logger.info(f"⚠️  [TASK-{task_request.task_id[:8]}] NO organization_model found")

            # Convert TaskRequest to ExecutionContext (simplified - no DDD)
            execution_context = self.agent_executor.determine_execution_context(task_request)

            # Add model parameters to execution context
            execution_context.agent_model = agent_model
            execution_context.org_model = org_model

            logger.info(f"🔧 [TASK-{task_request.task_id[:8]}] Model context set: agent={agent_model or 'none'}, org={org_model or 'none'}")

            # Stream execution progress (simplified - direct executor)
            async for progress_dict in self.agent_executor.execute_task(execution_context):
                # Convert dict to TaskProgress entity (simplified - no DDD entities)
                from ..types import TaskStatus
                
                # Map status string to enum
                status_map = {
                    "in_progress": TaskStatus.TASK_IN_PROGRESS,
                    "completed": TaskStatus.TASK_COMPLETED,
                    "failed": TaskStatus.TASK_FAILED
                }
                
                # Create protobuf directly (simplified - no intermediate entity)
                proto_progress = agent_worker_pb2.TaskProgress(
                    task_id=task_request.task_id,
                    status=status_map.get(progress_dict["status"], TaskStatus.TASK_IN_PROGRESS).value,
                    output_json=progress_dict.get("output", ""),
                    error_message=progress_dict.get("error_message", ""),
                    timestamp_ms=progress_dict["timestamp_ms"],
                    progress_percent=progress_dict["progress_percent"],
                    token_usage=progress_dict.get("token_usage")
                )
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
        from ..types import WorkerStatus

        # Check worker health
        hf_token = os.getenv("HF_TOKEN")
        status = WorkerStatus.WORKER_HEALTHY.value if hf_token else WorkerStatus.WORKER_UNHEALTHY.value

        # Get available tools (simplified - direct tool loader)
        available_tools = self.tool_loader.list_available_tools()

        # Create protobuf directly (simplified - no intermediate entity)
        worker_info = agent_worker_pb2.WorkerInfo(
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
        if request.task_id in self.active_tasks:
            del self.active_tasks[request.task_id]
            return agent_worker_pb2.CancelTaskResponse(
                success=True,
                message=f"Task {request.task_id} cancelled"
            )
        else:
            return agent_worker_pb2.CancelTaskResponse(
                success=False,
                message=f"Task {request.task_id} not found"
            )

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