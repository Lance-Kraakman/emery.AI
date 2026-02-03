import logging
import sys
import time
import os
import asyncio
from pathlib import Path
from typing import AsyncIterator, Dict, Any, List, Optional
import grpc
from grpc import aio
from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .generated import table_service_pb2, table_service_pb2_grpc
from .mappers import ProtoMapper
from ..services.agents.executor import AgentExecutor
from emery_agents.tools.loader import UnifiedToolLoader
from ..services.tasks import TaskExecutor
from ..services.tasks.task_executor import TaskData
from ..infrastructure.workspace_sync import WorkspaceSync
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

        # Shared task executor for both ExecuteTask and ProcessMessage paths
        self.task_executor = TaskExecutor(
            agent_executor=self.agent_executor,
            api_service=None,  # No API service needed for background tasks
        )

        # Initialize workspace sync for filesystem-based agent workspaces
        # Workspaces are stored in S3 as tar.gz archives
        s3_bucket = os.getenv("S3_BUCKET_NAME")
        if s3_bucket:
            self.workspace_sync: Optional[WorkspaceSync] = WorkspaceSync(
                bucket=s3_bucket,
            )
            logger.info(f"WorkspaceSync initialized with bucket: {s3_bucket}")
        else:
            self.workspace_sync = None
            logger.warning("S3_BUCKET_NAME not set - workspace persistence disabled")

    async def ExecuteTask(
        self,
        request: agent_worker_pb2.TaskRequest,
        context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_worker_pb2.TaskProgress]:
        """Execute agent task with streaming progress updates.

        AIDEV-NOTE: Refactored to use shared TaskExecutor for consistency with
        ProcessMessage task-based execution. Workspace sync remains here as it's
        specific to background task execution.
        """
        # Convert protobuf to entity at boundary, then build TaskData
        task_request = self.proto_mapper.task_request_from_proto(request)
        task_data = TaskExecutor.from_task_request(task_request)

        print(f"🚀 [TASK-{task_data.task_id[:8]}] Starting execution for agent: {task_data.agent_id}")
        print(f"📋 [TASK-{task_data.task_id[:8]}] Name: {request.name}")
        sys.stdout.flush()

        logger.info(f"Task: {request.name}")

        # Download workspace from S3 if workspace sync is enabled
        workspace_path: Optional[Path] = None
        workspace_id = str(task_data.agent_id) if task_data.agent_id else "org"
        if self.workspace_sync and task_data.agent_id:
            try:
                workspace_path = self.workspace_sync.download(
                    task_data.organization_id, "agents", workspace_id
                )
                logger.info(f"📁 [TASK-{task_data.task_id[:8]}] Workspace downloaded to {workspace_path}")

                # Prepare task history directory
                self.workspace_sync.prepare_task_history(
                    workspace_id=workspace_id,
                    task_id=task_data.task_id,
                )

                # Log workspace manifest after download
                try:
                    shell = self.workspace_sync._get_shell(workspace_id)
                    tree_result = shell.run(
                        "tree -L 2 --noreport 2>/dev/null || find . -maxdepth 2 -type f | head -50",
                        timeout=10,
                    )
                    manifest_text = tree_result.stdout if tree_result.success else "Could not generate manifest"
                    file_count = len([l for l in manifest_text.strip().split('\n') if l.strip()]) if manifest_text else 0

                    print(f"📂 [TASK-{task_data.task_id[:8]}] Workspace contents ({file_count} entries):\n{manifest_text}")
                    sys.stdout.flush()

                    self.workspace_sync.append_to_session_log(
                        workspace_id=workspace_id,
                        task_id=task_data.task_id,
                        entry={
                            "type": "workspace_manifest",
                            "workspace_id": workspace_id,
                            "manifest": manifest_text,
                            "file_count": file_count,
                        },
                    )
                except Exception as manifest_err:
                    logger.warning(f"Failed to log workspace manifest: {manifest_err}")

            except Exception as e:
                logger.error(f"Failed to download workspace: {e}")
                # Continue without workspace - task can still execute

        # Set workspace path in task data
        task_data.workspace_path = workspace_path

        self.active_tasks[task_data.task_id] = {
            'agent_id': task_data.agent_id,
            'start_time': time.time(),
            'workspace_path': workspace_path,
        }

        try:
            logger.info(f"🔧 [TASK-{task_data.task_id[:8]}] Model context: agent={task_data.agent_model or 'none'}, org={task_data.org_model or 'none'}")

            # Stream execution progress via shared TaskExecutor
            async for progress_dict in self.task_executor.execute(task_data):
                # Map status string to protobuf enum
                status_map = {
                    "in_progress": agent_worker_pb2.TASK_IN_PROGRESS,
                    "completed": agent_worker_pb2.TASK_COMPLETED,
                    "failed": agent_worker_pb2.TASK_FAILED
                }

                # Create protobuf directly
                proto_progress = agent_worker_pb2.TaskProgress(
                    task_id=task_data.task_id,
                    status=status_map.get(progress_dict.get("status", "in_progress"), agent_worker_pb2.TASK_IN_PROGRESS),
                    output_json=progress_dict.get("output", ""),
                    error_message=progress_dict.get("error_message", ""),
                    timestamp_ms=progress_dict.get("timestamp_ms", int(time.time() * 1000)),
                    progress_percent=progress_dict.get("progress_percent", 0.0),
                    token_usage=progress_dict.get("token_usage")
                )
                yield proto_progress

        except Exception as e:
            print(f"❌ [TASK-{task_data.task_id[:8]}] Failed: {str(e)}")
            import traceback
            print(f"📍 [TASK-{task_data.task_id[:8]}] Traceback: {traceback.format_exc()}")
            sys.stdout.flush()

            logger.exception(f"Task {task_data.task_id[:8]} failed")

            # Send final error progress
            error_progress = agent_worker_pb2.TaskProgress(
                task_id=task_data.task_id,
                status=agent_worker_pb2.TASK_FAILED,
                output_json="",
                error_message=str(e),
                timestamp_ms=int(time.time() * 1000),
                progress_percent=0.0
            )
            yield error_progress

        finally:
            # Upload workspace back to S3 and cleanup
            if self.workspace_sync and workspace_path and task_data.agent_id:
                try:
                    self.workspace_sync.upload(
                        task_data.organization_id, "agents", workspace_id
                    )
                    logger.info(f"📤 [TASK-{task_data.task_id[:8]}] Workspace uploaded to S3")
                    self.workspace_sync.cleanup(workspace_id)
                except Exception as e:
                    logger.error(f"Failed to upload workspace: {e}")

            if task_data.task_id in self.active_tasks:
                del self.active_tasks[task_data.task_id]

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
    # Start background flush worker for Redis write buffer
    table_service_impl.start_flush_worker()

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