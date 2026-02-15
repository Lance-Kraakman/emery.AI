# Configure DSPy cache and mem0 dir FIRST, before any module imports them
import logging
import os
from pathlib import Path
import subprocess
import traceback

import dspy


def _configure_dspy_cache() -> None:
    """Configure DSPy cache before any other imports trigger dspy initialization."""
    efs_path = Path(os.getenv("WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces"))
    if efs_path.exists() and efs_path.is_dir():
        cache_dir = efs_path / ".cache" / "dspy"
    else:
        cache_dir = Path.home() / ".cache" / "dspy"

    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        dspy.configure_cache(
            enable_disk_cache=True,
            enable_memory_cache=True,
            disk_cache_dir=str(cache_dir),
        )
        logging.getLogger(__name__).info(f"DSPy disk cache configured: {cache_dir}")
    except (PermissionError, OSError) as e:
        logging.getLogger(__name__).warning(
            f"Cannot create cache dir {cache_dir}: {e}, using memory-only"
        )
        dspy.configure_cache(enable_disk_cache=False, enable_memory_cache=True)


def _configure_mem0_dir() -> None:
    """Set MEM0_DIR before mem0 is imported to avoid permission errors in containers.

    mem0 creates ~/.mem0 at import time for its cloud service config (which we don't use).
    In Docker running as root without HOME, ~ expands to / which is read-only.
    """
    if os.environ.get("MEM0_DIR"):
        return

    workspace_path = Path(os.getenv("WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces"))
    if workspace_path.exists() and workspace_path.is_dir():
        mem0_dir = workspace_path / ".cache" / "mem0"
    else:
        mem0_dir = Path("/tmp/mem0")

    os.environ["MEM0_DIR"] = str(mem0_dir)


_configure_dspy_cache()
_configure_mem0_dir()

# Now safe to import other modules that may use dspy or mem0
import asyncio
import concurrent.futures
import sys
import time
from collections.abc import AsyncIterator
from typing import Any

import grpc
from grpc import aio

from emery_agents.planning.registry import PlanningRegistry
from emery_agents.tools.capability_bootstrap import (
    populate_integration_services,
    populate_system_agents,
)
from emery_agents.tools.capability_registry import CapabilityRegistry
from emery_agents.tools.loader import UnifiedToolLoader
from .chat_processing_service import ChatProcessingServiceImplementation

from ..services.sandbox.proxy_manager import ProxyManager
from ..infrastructure.storage import (
    create_workspace_storage,
    WorkspaceStorage,
    WorkspaceType,
)
from ..services.tasks import TaskExecutor
from .generated import (
    agent_worker_pb2,
    agent_worker_pb2_grpc,
    table_service_pb2_grpc,
)
from .mappers import ProtoMapper
from .tls import get_server_credentials

import argparse

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
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
            raise OSError(
                "HF_TOKEN environment variable is required for AgentWorkerService. "
                "Get your token from https://huggingface.co/settings/tokens"
            )

        self.max_concurrent_tasks = max_concurrent_tasks
        self.worker_id = f"worker_{int(time.time())}"
        self.start_time = time.time()
        self.active_tasks: dict[str, Any] = {}

        logger.info("AgentWorkerServiceImplementation initialized")

        # Initialize all services (HF_TOKEN is guaranteed to exist)
        self.tool_loader = UnifiedToolLoader()
        self.proto_mapper = ProtoMapper()

        # Initialize capability registry (matches ChatProcessingService pattern)
        # Singleton lifetime - reused across all requests
        self.capability_registry = CapabilityRegistry()
        populate_system_agents(self.capability_registry)
        populate_integration_services(self.capability_registry)
        logger.info("Capability registry initialized at startup")

        # Initialize planning registry
        self.planning_registry = PlanningRegistry()

        # Shared task executor with injected registries
        self.task_executor = TaskExecutor(
            capability_registry=self.capability_registry,
            planning_registry=self.planning_registry,
        )

        # Initialize workspace storage (EFS/NFS/local filesystem)
        # Workspaces are stored directly on shared filesystem - no S3 needed
        self.workspace_storage: WorkspaceStorage = create_workspace_storage()

        # Workspace-level locks to prevent concurrent access to same workspace
        self._workspace_locks: dict[str, asyncio.Lock] = {}

    async def ExecuteTask(
        self, request: agent_worker_pb2.TaskRequest, context: grpc.aio.ServicerContext
    ) -> AsyncIterator[agent_worker_pb2.TaskProgress]:
        """Execute agent task with streaming progress updates.

        AIDEV-NOTE: Refactored to use shared TaskExecutor for consistency with
        ProcessMessage task-based execution. Uses shared filesystem storage
        with workspace-level locking to prevent concurrent access.
        """

        # Convert protobuf to entity at boundary, then build TaskData
        task_request = self.proto_mapper.task_request_from_proto(request)
        task_data = TaskExecutor.from_task_request(task_request)

        print(
            f"🚀 [TASK-{task_data.task_id[:8]}] Starting execution for agent: {task_data.agent_id}"
        )
        print(f"📋 [TASK-{task_data.task_id[:8]}] Name: {request.name}")
        sys.stdout.flush()

        logger.info(f"Task: {request.name}")

        # Get workspace path from shared filesystem (instant - no download needed)
        workspace_path: Path | None = None
        workspace_id = str(task_data.agent_id) if task_data.agent_id else "org"
        workspace_lock_key = f"{task_data.organization_id}:{workspace_id}"
        workspace_lock: asyncio.Lock | None = None

        # Get or create lock for this workspace
        if task_data.agent_id:
            if workspace_lock_key not in self._workspace_locks:
                self._workspace_locks[workspace_lock_key] = asyncio.Lock()
            workspace_lock = self._workspace_locks[workspace_lock_key]

            # Acquire workspace lock - held for entire task duration
            await workspace_lock.acquire()
            logger.info(f"🔒 [TASK-{task_data.task_id[:8]}] Acquired workspace lock")

        try:
            # Set up workspace if we have an agent
            if task_data.agent_id:
                try:
                    workspace_path = self.workspace_storage.get_workspace_path(
                        task_data.organization_id, WorkspaceType.AGENTS, workspace_id
                    )
                    logger.info(
                        f"📁 [TASK-{task_data.task_id[:8]}] Workspace ready at {workspace_path}"
                    )

                    # Create agent identifier file (visible in synced folder)
                    agent_name = (
                        request.agent_config.name
                        if request.agent_config and request.agent_config.name
                        else None
                    )
                    if agent_name:
                        self.workspace_storage.create_agent_identifier(
                            org_id=task_data.organization_id,
                            workspace_id=workspace_id,
                            agent_name=agent_name,
                            agent_id=task_data.agent_id,
                        )

                    # Prepare task history directory
                    self.workspace_storage.prepare_task_history(
                        org_id=task_data.organization_id,
                        workspace_type=WorkspaceType.AGENTS,
                        workspace_id=workspace_id,
                        task_id=task_data.task_id,
                    )

                    # Log workspace manifest
                    try:
                        result = subprocess.run(
                            ["find", str(workspace_path), "-maxdepth", "2", "-type", "f"],
                            capture_output=True,
                            text=True,
                            timeout=10,
                        )
                        manifest_text = result.stdout if result.returncode == 0 else "Could not generate manifest"
                        file_count = (
                            len([l for l in manifest_text.strip().split("\n") if l.strip()])
                            if manifest_text
                            else 0
                        )

                        print(
                            f"📂 [TASK-{task_data.task_id[:8]}] Workspace contents ({file_count} entries):\n{manifest_text[:500]}"
                        )
                        sys.stdout.flush()

                        self.workspace_storage.append_to_session_log(
                            org_id=task_data.organization_id,
                            workspace_type=WorkspaceType.AGENTS,
                            workspace_id=workspace_id,
                            task_id=task_data.task_id,
                            entry={
                                "type": "workspace_manifest",
                                "workspace_id": workspace_id,
                                "manifest": manifest_text[:1000],
                                "file_count": file_count,
                            },
                        )
                    except Exception as manifest_err:
                        logger.warning(f"Failed to log workspace manifest: {manifest_err}")

                except Exception as e:
                    logger.error(f"Failed to access workspace: {e}")
                    # Continue without workspace - task can still execute

            # Set workspace path in task data
            task_data.workspace_path = workspace_path

            # Enable capabilities for this org (per-request)
            # This matches the pattern in coordinator_streaming.py
            org_id_str = str(task_data.organization_id)
            self.capability_registry.enable_all_system_agents(org_id_str)

            # AIDEV-NOTE: Task timeout - prevents runaway tasks from consuming resources
            task_timeout = int(os.getenv("TASK_TIMEOUT_SECONDS", "3600"))  # Default 1 hour
            task_start_time = time.time()

            self.active_tasks[task_data.task_id] = {
                "agent_id": task_data.agent_id,
                "start_time": task_start_time,
                "workspace_path": workspace_path,
                "timeout": task_timeout,
            }

            logger.info(
                f"🔧 [TASK-{task_data.task_id[:8]}] Model context: agent={task_data.agent_model or 'none'}, org={task_data.org_model or 'none'}"
            )

            # Stream execution progress via shared TaskExecutor
            async for progress_dict in self.task_executor.execute(task_data):
                # Check task timeout
                elapsed = time.time() - task_start_time
                if elapsed > task_timeout:
                    raise TimeoutError(
                        f"Task exceeded {task_timeout}s timeout (elapsed: {elapsed:.1f}s)"
                    )

                # Map status string to protobuf enum
                status_map = {
                    "in_progress": agent_worker_pb2.TASK_IN_PROGRESS,
                    "completed": agent_worker_pb2.TASK_COMPLETED,
                    "failed": agent_worker_pb2.TASK_FAILED,
                    "awaiting_human": agent_worker_pb2.TASK_AWAITING_HUMAN,
                }

                # Create protobuf directly
                proto_progress = agent_worker_pb2.TaskProgress(
                    task_id=task_data.task_id,
                    status=status_map.get(
                        progress_dict.get("status", "in_progress"),
                        agent_worker_pb2.TASK_IN_PROGRESS,
                    ),
                    output_json=progress_dict.get("output", ""),
                    error_message=progress_dict.get("error_message", ""),
                    timestamp_ms=progress_dict.get(
                        "timestamp_ms", int(time.time() * 1000)
                    ),
                    progress_percent=progress_dict.get("progress_percent", 0.0),
                    token_usage=progress_dict.get("token_usage"),
                )
                yield proto_progress

        except Exception as e:
            print(f"❌ [TASK-{task_data.task_id[:8]}] Failed: {str(e)}")

            print(
                f"📍 [TASK-{task_data.task_id[:8]}] Traceback: {traceback.format_exc()}"
            )
            sys.stdout.flush()

            logger.exception(f"Task {task_data.task_id[:8]} failed")

            # Send final error progress
            error_progress = agent_worker_pb2.TaskProgress(
                task_id=task_data.task_id,
                status=agent_worker_pb2.TASK_FAILED,
                output_json="",
                error_message=str(e),
                timestamp_ms=int(time.time() * 1000),
                progress_percent=0.0,
            )
            yield error_progress

        finally:
            # Workspace changes persist instantly on shared filesystem
            # No upload needed - just rotate old history periodically
            if workspace_path and task_data.agent_id:
                try:
                    # Rotate old history (non-blocking, best effort)
                    self.workspace_storage.rotate_history(
                        task_data.organization_id,
                        WorkspaceType.AGENTS,
                        workspace_id,
                        max_days=30,
                    )
                    logger.info(
                        f"✅ [TASK-{task_data.task_id[:8]}] Workspace changes persisted"
                    )
                except Exception as e:
                    logger.warning(f"Failed to rotate history: {e}")

            if task_data.task_id in self.active_tasks:
                del self.active_tasks[task_data.task_id]

            # Release workspace lock
            if workspace_lock is not None and workspace_lock.locked():
                workspace_lock.release()
                logger.info(f"🔓 [TASK-{task_data.task_id[:8]}] Released workspace lock")

    async def GetWorkerInfo(
        self, request: agent_worker_pb2.Empty, context: grpc.aio.ServicerContext
    ) -> agent_worker_pb2.WorkerInfo:
        """Get worker health and capability information."""

        # Check worker health
        hf_token = os.getenv("HF_TOKEN")
        status = (
            agent_worker_pb2.WORKER_HEALTHY
            if hf_token
            else agent_worker_pb2.WORKER_UNHEALTHY
        )

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
            supported_tools=available_tools,
        )

        return worker_info_proto

    async def CancelTask(
        self,
        request: agent_worker_pb2.CancelTaskRequest,
        context: grpc.aio.ServicerContext,
    ) -> agent_worker_pb2.CancelTaskResponse:
        """Cancel a running task."""
        if request.task_id in self.active_tasks:
            del self.active_tasks[request.task_id]
            return agent_worker_pb2.CancelTaskResponse(
                success=True, message=f"Task {request.task_id} cancelled"
            )
        else:
            return agent_worker_pb2.CancelTaskResponse(
                success=False, message=f"Task {request.task_id} not found"
            )


def register_chat_services(server):
    """Register chat-related services for port 50051."""
    # Add AgentWorker service
    agent_service_impl = AgentWorkerServiceImplementation()
    agent_worker_pb2_grpc.add_AgentWorkerServicer_to_server(agent_service_impl, server)

    chat_service_impl = (
        ChatProcessingServiceImplementation()
    )  # Multi-tenant: org from request
    agent_worker_pb2_grpc.add_ChatProcessingServiceServicer_to_server(
        chat_service_impl, server
    )


def register_table_services(server):
    """Register table operations services for port 50052."""
    # Add Table service only
    from .table_proccessing_service import TableService

    table_service_impl = TableService()
    table_service_pb2_grpc.add_TableServiceServicer_to_server(
        table_service_impl, server
    )
    # Start background flush worker for Redis write buffer
    table_service_impl.start_flush_worker()


async def serve_chat_server(port: int):
    """Chat processing server (port 50051) - AgentWorker + ChatProcessing only."""
    # Pre-warm the network proxy at startup (avoids 5-10s delay on first networked task)
    # This runs in background - if it fails, tasks will retry lazily
    try:
        proxy_mgr = ProxyManager.get_instance()
        proxy_mgr.ensure_running()
        logger.info("Network proxy pre-warmed at server startup")
    except Exception as e:
        logger.warning(f"Failed to pre-warm network proxy (will retry on first use): {e}")

    # Create dedicated thread pool for chat server to prevent resource contention
    # Configurable via GRPC_CHAT_MAX_WORKERS environment variable
    chat_max_workers = int(os.getenv("GRPC_CHAT_MAX_WORKERS", "20"))
    chat_thread_pool = concurrent.futures.ThreadPoolExecutor(
        max_workers=chat_max_workers, thread_name_prefix="grpc-chat-server"
    )

    # Configure gRPC server with keepalive settings and dedicated thread pool
    server = aio.server(
        migration_thread_pool=chat_thread_pool,
        maximum_concurrent_rpcs=50,  # Limit concurrent RPCs to prevent resource exhaustion
        options=[
            ("grpc.keepalive_time_ms", 30000),  # Send keepalive ping every 30s
            ("grpc.keepalive_timeout_ms", 10000),  # Wait 10s for keepalive response
            (
                "grpc.keepalive_permit_without_calls",
                1,
            ),  # Allow keepalive pings when no calls
            (
                "grpc.http2.max_pings_without_data",
                0,
            ),  # Allow unlimited pings without data
            (
                "grpc.http2.min_recv_ping_interval_without_data_ms",
                20000,
            ),  # Accept client pings as frequent as 20s
            # AIDEV-NOTE: Message size limits for large payloads (e.g., file uploads)
            ("grpc.max_send_message_length", 100 * 1024 * 1024),  # 100MB
            ("grpc.max_receive_message_length", 100 * 1024 * 1024),  # 100MB
        ],
    )

    register_chat_services(server)

    listen_addr = f"[::]:{port}"
    credentials = get_server_credentials()
    if credentials:
        server.add_secure_port(listen_addr, credentials)
        logger.info(f"Chat gRPC server starting on {listen_addr} (mTLS)")
    else:
        server.add_insecure_port(listen_addr)
        logger.warning(
            f"Chat gRPC server starting on {listen_addr} (INSECURE - dev only)"
        )
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
        max_workers=table_max_workers, thread_name_prefix="grpc-table-server"
    )

    # Configure gRPC server with keepalive settings and dedicated thread pool
    server = aio.server(
        migration_thread_pool=table_thread_pool,
        maximum_concurrent_rpcs=30,  # Limit concurrent RPCs to prevent resource exhaustion
        options=[
            ("grpc.keepalive_time_ms", 30000),  # Send keepalive ping every 30s
            ("grpc.keepalive_timeout_ms", 10000),  # Wait 10s for keepalive response
            (
                "grpc.keepalive_permit_without_calls",
                1,
            ),  # Allow keepalive pings when no calls
            (
                "grpc.http2.max_pings_without_data",
                0,
            ),  # Allow unlimited pings without data
            (
                "grpc.http2.min_recv_ping_interval_without_data_ms",
                20000,
            ),  # Accept client pings as frequent as 20s
            # AIDEV-NOTE: Message size limits for large payloads (e.g., bulk data inserts)
            ("grpc.max_send_message_length", 100 * 1024 * 1024),  # 100MB
            ("grpc.max_receive_message_length", 100 * 1024 * 1024),  # 100MB
        ],
    )

    register_table_services(server)

    listen_addr = f"[::]:{port}"
    credentials = get_server_credentials()
    if credentials:
        server.add_secure_port(listen_addr, credentials)
        logger.info(f"Table gRPC server starting on {listen_addr} (mTLS)")
    else:
        server.add_insecure_port(listen_addr)
        logger.warning(
            f"Table gRPC server starting on {listen_addr} (INSECURE - dev only)"
        )
    logger.info("Table server services available:")
    logger.info("  - TableService: Delta Lake table operations (CRUD + bulk insert)")
    logger.info("  - AgentWorker: NOT available (use chat port)")
    logger.info("  - ChatProcessingService: NOT available (use chat port)")

    await server.start()
    logger.info("✅ Table gRPC server started successfully")
    await server.wait_for_termination()


async def main():
    parser = argparse.ArgumentParser(description="Emery Agents gRPC Worker")
    parser.add_argument(
        "--mode",
        choices=["chat", "table"],
        required=True,
        help="Service mode: chat=ChatProcessing only, table=TableService only",
    )
    parser.add_argument("--port", type=int, required=True, help="gRPC server port")

    args = parser.parse_args()

    if args.mode == "chat":
        logger.info(f"🚀 Starting ChatProcessingService on port {args.port}")
        await serve_chat_server(args.port)
    elif args.mode == "table":
        logger.info(f"🚀 Starting TableService on port {args.port}")
        await serve_table_server(args.port)


if __name__ == "__main__":
    asyncio.run(main())
