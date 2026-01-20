import logging
import sys
import time
import os
import asyncio
from typing import AsyncIterator, Dict, Any, List
import grpc
from grpc import aio
from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .generated import table_service_pb2, table_service_pb2_grpc
from .mappers import ProtoMapper
from ..services.agent_executor import AgentExecutor
from ..services.tool_loader import UnifiedToolLoader
import concurrent.futures

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Suppress verbose loggers that dump large JSON payloads
logging.getLogger("openai._base_client").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("smolagents").setLevel(logging.WARNING)

class AgentWorkerServiceImplementation(agent_worker_pb2_grpc.AgentWorkerServicer):
    """gRPC service implementation for AgentWorker."""
    
    def __init__(self, max_concurrent_tasks: int = 10):
        # Fail fast if HF_TOKEN is not provided
        hf_token = os.getenv("HF_TOKEN")
        if not hf_token:
            raise EnvironmentError(
                "HF_TOKEN environment variable is required for AgentWorkerService. "
                "Get your token from https://huggingface.co/settings/tokens"
            )
        
        self.max_concurrent_tasks = max_concurrent_tasks
        self.worker_id = f"worker_{int(time.time())}"
        self.start_time = time.time()
        self.active_tasks: Dict[str, Any] = {}

        logger.info(f"AgentWorkerServiceImplementation initialized")

        # Initialize all services (HF_TOKEN is guaranteed to exist)
        self.agent_executor = AgentExecutor()
        self.tool_loader = UnifiedToolLoader()
        self.proto_mapper = ProtoMapper()

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

            logger.info(f"🔧 [TASK-{request.task_id[:8]}] Model context set: agent={agent_model or 'none'}, org={org_model or 'none'}")

            # Stream execution progress (simplified - direct executor)
            async for progress_dict in self.agent_executor.execute_task(execution_context):
                # Convert dict to TaskProgress entity (simplified - no DDD entities)
                from ..types import TaskStatus
                
                # Map status string to protobuf enum
                status_map = {
                    "in_progress": agent_worker_pb2.TASK_IN_PROGRESS,
                    "completed": agent_worker_pb2.TASK_COMPLETED,
                    "failed": agent_worker_pb2.TASK_FAILED
                }
                
                # Create protobuf directly (simplified - no intermediate entity)
                proto_progress = agent_worker_pb2.TaskProgress(
                    task_id=request.task_id,
                    status=status_map.get(progress_dict["status"], agent_worker_pb2.TASK_IN_PROGRESS),
                    output_json=progress_dict.get("output", ""),
                    error_message=progress_dict.get("error_message", ""),
                    timestamp_ms=progress_dict["timestamp_ms"],
                    progress_percent=progress_dict["progress_percent"],
                    token_usage=progress_dict.get("token_usage")
                )
                yield proto_progress
                
        except Exception as e:
            print(f"❌ [TASK-{request.task_id[:8]}] Failed: {str(e)}")
            import traceback
            print(f"📍 [TASK-{request.task_id[:8]}] Traceback: {traceback.format_exc()}")
            sys.stdout.flush()
            
            logger.exception(f"Task {request.task_id[:8]} failed")
            
            # Send final error progress
            error_progress = agent_worker_pb2.TaskProgress(
                task_id=request.task_id,
                status=agent_worker_pb2.TASK_FAILED,
                output_json="",
                error_message=str(e),
                timestamp_ms=int(time.time() * 1000),
                progress_percent=0.0
            )
            yield error_progress
            
        finally:
            if request.task_id in self.active_tasks:
                del self.active_tasks[request.task_id]

    async def GetWorkerInfo(self, request: agent_worker_pb2.Empty, context: grpc.aio.ServicerContext) -> agent_worker_pb2.WorkerInfo:
        """Get worker health and capability information."""
        from ..types import WorkerStatus

        # Check worker health
        hf_token = os.getenv("HF_TOKEN")
        status = agent_worker_pb2.WORKER_HEALTHY if hf_token else agent_worker_pb2.WORKER_UNHEALTHY

        # Get available tools (simplified - direct tool loader)
        available_tools = self.tool_loader.get_available_tools()

        # Create protobuf directly (simplified - no intermediate entity)
        worker_info_proto = agent_worker_pb2.WorkerInfo(
            worker_id=self.worker_id,
            version="2.0.0-protobuf",
            organization_id="",  # Multi-tenant services handle org at request level
            status=status,
            skills=["auto_routing", "capability_execution"],  # Available agent skills
            active_tasks=len(self.active_tasks),
            max_concurrent_tasks=self.max_concurrent_tasks,
            uptime_seconds=int(time.time() - self.start_time),
            supported_tools=available_tools
        )
        
        return worker_info_proto

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

def register_chat_services(server):
    """Register chat-related services for port 50051."""
    # Add AgentWorker service
    agent_service_impl = AgentWorkerServiceImplementation()
    agent_worker_pb2_grpc.add_AgentWorkerServicer_to_server(agent_service_impl, server)
    
    # Add ChatProcessing service  
    from .chat_processing_service import ChatProcessingServiceImplementation
    chat_service_impl = ChatProcessingServiceImplementation()  # Multi-tenant: org from request
    agent_worker_pb2_grpc.add_ChatProcessingServiceServicer_to_server(chat_service_impl, server)

def register_table_services(server):
    """Register table operations services for port 50052."""
    # Add Table service only
    from .table_proccessing_service import TableService
    table_service_impl = TableService()
    table_service_pb2_grpc.add_TableServiceServicer_to_server(table_service_impl, server)

async def serve_chat_server(port: int):
    """Chat processing server (port 50051) - AgentWorker + ChatProcessing only."""
    # Create dedicated thread pool for chat server to prevent resource contention
    # Configurable via GRPC_CHAT_MAX_WORKERS environment variable
    chat_max_workers = int(os.getenv("GRPC_CHAT_MAX_WORKERS", "20"))
    chat_thread_pool = concurrent.futures.ThreadPoolExecutor(
        max_workers=chat_max_workers,
        thread_name_prefix="grpc-chat-server"
    )
    
    # Configure gRPC server with keepalive settings and dedicated thread pool
    server = aio.server(
        migration_thread_pool=chat_thread_pool,
        maximum_concurrent_rpcs=50,  # Limit concurrent RPCs to prevent resource exhaustion
        options=[
            ('grpc.keepalive_time_ms', 30000),  # Send keepalive ping every 30s
            ('grpc.keepalive_timeout_ms', 10000),  # Wait 10s for keepalive response
            ('grpc.keepalive_permit_without_calls', 1),  # Allow keepalive pings when no calls
            ('grpc.http2.max_pings_without_data', 0),  # Allow unlimited pings without data
            ('grpc.http2.min_recv_ping_interval_without_data_ms', 20000),  # Accept client pings as frequent as 20s
        ]
    )

    register_chat_services(server)
    
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Chat gRPC server starting on {listen_addr}")
    logger.info("Chat server services available:")
    logger.info("  - AgentWorker: Agent execution and task management")
    logger.info("  - ChatProcessingService: AI chat processing (RAG + LLM streaming)")
    logger.info("  - TableService: NOT available (use table port)")
    
    await server.start()
    logger.info("✅ Chat gRPC server started successfully")
    await server.wait_for_termination()

async def serve_table_server(port: int):
    """Table operations server (port 50052) - Table service only."""
    # Create dedicated thread pool for table server to prevent resource contention
    # Configurable via GRPC_TABLE_MAX_WORKERS environment variable
    table_max_workers = int(os.getenv("GRPC_TABLE_MAX_WORKERS", "15"))
    table_thread_pool = concurrent.futures.ThreadPoolExecutor(
        max_workers=table_max_workers,
        thread_name_prefix="grpc-table-server"
    )
    
    # Configure gRPC server with keepalive settings and dedicated thread pool
    server = aio.server(
        migration_thread_pool=table_thread_pool,
        maximum_concurrent_rpcs=30,  # Limit concurrent RPCs to prevent resource exhaustion
        options=[
            ('grpc.keepalive_time_ms', 30000),  # Send keepalive ping every 30s
            ('grpc.keepalive_timeout_ms', 10000),  # Wait 10s for keepalive response
            ('grpc.keepalive_permit_without_calls', 1),  # Allow keepalive pings when no calls
            ('grpc.http2.max_pings_without_data', 0),  # Allow unlimited pings without data
            ('grpc.http2.min_recv_ping_interval_without_data_ms', 20000),  # Accept client pings as frequent as 20s
        ]
    )

    register_table_services(server)
    
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Table gRPC server starting on {listen_addr}")
    logger.info("Table server services available:")
    logger.info("  - TableService: Delta Lake table operations (CRUD + bulk insert)")
    logger.info("  - AgentWorker: NOT available (use chat port)")
    logger.info("  - ChatProcessingService: NOT available (use chat port)")
    
    await server.start()
    logger.info("✅ Table gRPC server started successfully")
    await server.wait_for_termination()

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Emery Agents gRPC Worker')
    parser.add_argument('--mode', choices=['chat', 'table'], required=True,
                       help='Service mode: chat=ChatProcessing only, table=TableService only')
    parser.add_argument('--port', type=int, required=True,
                       help='gRPC server port')
    
    
    args = parser.parse_args()
    
    if args.mode == 'chat':
        logger.info(f"🚀 Starting ChatProcessingService on port {args.port}")
        await serve_chat_server(args.port)
    elif args.mode == 'table':
        logger.info(f"🚀 Starting TableService on port {args.port}")
        await serve_table_server(args.port)

if __name__ == '__main__':
    asyncio.run(main())