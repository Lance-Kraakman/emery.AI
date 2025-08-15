import logging
import sys
import time
from typing import AsyncIterator, Dict, Any
import grpc
from grpc import aio
from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .proto_mappers import parse_task_request, create_task_progress
from ..core.types import TaskStatus, TaskInstructions
from ..integrations.smolagents import SmolAgentsOrchestrator

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AgentWorkerServiceImplementation(agent_worker_pb2_grpc.AgentWorkerServicer):
    def __init__(self, organization_id: str, max_concurrent_tasks: int = 10):
        self.organization_id = organization_id
        self.max_concurrent_tasks = max_concurrent_tasks
        self.worker_id = f"worker_{organization_id}_{int(time.time())}"
        self.start_time = time.time()
        self.active_tasks: Dict[str, Any] = {}
        
        # Check HF_TOKEN at startup
        import os
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
        
        task_data = parse_task_request(request)
        task_id = task_data['task_id']
        agent = task_data['agent']
        capability_name = task_data.get('capability_name')
        instruction_config = task_data.get('instruction_config')

        print(f"🚀 [TASK-{task_id[:8]}] Starting execution for agent: {agent.name if agent else 'Unknown'}")
        print(f"📋 [TASK-{task_id[:8]}] Instructions: {instruction_config}..." if instruction_config else "No instruction config")
        sys.stdout.flush()
        
        logger.info(f"Starting task execution: {task_id[:8]} for agent {agent.name if agent else 'Unknown'}")
        logger.info(f"Instruction config: {instruction_config}")
        
        self.active_tasks[task_id] = {'agent': agent, 'start_time': time.time()}

        try:
            print(f"⚡ [TASK-{task_id[:8]}] Initializing...")
            sys.stdout.flush()
            yield create_task_progress(task_id=task_id, status=TaskStatus.IN_PROGRESS, step_id="initialization", progress_percent=0.0)
            
            print(f"🤖 [TASK-{task_id[:8]}] Creating SmolAgents orchestrator...")
            sys.stdout.flush()
            orchestrator = SmolAgentsOrchestrator()
            
            print(f"🔧 [TASK-{task_id[:8]}] Setting up agent hierarchy...")
            sys.stdout.flush()
            orchestrator.setup_agent_orchestrator(agent)
            
            print(f"✅ [TASK-{task_id[:8]}] Orchestrator ready")
            sys.stdout.flush()
            yield create_task_progress(task_id=task_id, status=TaskStatus.IN_PROGRESS, step_id="orchestrator_init", output_data={"message": "Orchestrator initialized"}, progress_percent=10.0)
            
            if not instruction_config:
                print(f"⚠️  [TASK-{task_id[:8]}] No instruction config, using default for capability: {capability_name}")
                instruction_config = TaskInstructions(instructions=f"Execute capability: {capability_name}")
            else:
                print(f"📝 [TASK-{task_id[:8]}] Using provided instructions")
                sys.stdout.flush()
            
            print(f"🎯 [TASK-{task_id[:8]}] Executing with orchestrator...")
            sys.stdout.flush()
            task_result = await orchestrator.execute_with_orchestrator(instructions=instruction_config)
            
            print(f"🏁 [TASK-{task_id[:8]}] Execution completed: {task_result.get('status', 'unknown')}")
            sys.stdout.flush()
            
            if task_result["status"] == "success":
                final_result = {"status": "completed", "result": task_result.get("result", {})}
                final_status = TaskStatus.COMPLETED
            else:
                final_result = {"status": "failed", "error": task_result.get("error", "Unknown error")}
                final_status = TaskStatus.FAILED
            
            yield create_task_progress(task_id=task_id, status=final_status, step_id="completion", output_data=final_result, progress_percent=100.0)
        except Exception as e:
            print(f"❌ [TASK-{task_id[:8]}] Failed: {str(e)}")
            import traceback
            print(f"📍 [TASK-{task_id[:8]}] Traceback: {traceback.format_exc()}")
            sys.stdout.flush()
            
            logger.exception(f"Task {task_id[:8]} failed")
            yield create_task_progress(task_id=task_id, status=TaskStatus.FAILED, error_message=str(e))
        finally:
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]

    async def GetWorkerInfo(self, request: agent_worker_pb2.Empty, context: grpc.aio.ServicerContext) -> agent_worker_pb2.WorkerInfo:
        return agent_worker_pb2.WorkerInfo(
            worker_id=self.worker_id,
            version="2.0.0-proto",
            organization_id=self.organization_id,
            status=agent_worker_pb2.WORKER_HEALTHY,
            active_tasks=len(self.active_tasks),
            max_concurrent_tasks=self.max_concurrent_tasks,
            uptime_seconds=int(time.time() - self.start_time)
        )

    async def CancelTask(self, request: agent_worker_pb2.CancelTaskRequest, context: grpc.aio.ServicerContext) -> agent_worker_pb2.CancelTaskResponse:
        task_id = request.task_id
        if task_id in self.active_tasks:
            del self.active_tasks[task_id]
            return agent_worker_pb2.CancelTaskResponse(success=True, message=f"Task {task_id} cancelled")
        else:
            return agent_worker_pb2.CancelTaskResponse(success=False, message=f"Task {task_id} not found")

async def serve(port: int, organization_id: str):
    print(f"PYTHON WORKER: Creating server for port {port}, org {organization_id}")
    server = aio.server()
    
    print("PYTHON WORKER: Creating service implementation...")
    service_impl = AgentWorkerServiceImplementation(organization_id)
    
    print("PYTHON WORKER: Adding servicer to server...")
    agent_worker_pb2_grpc.add_AgentWorkerServicer_to_server(service_impl, server)
    
    listen_addr = f'[::]:{port}'
    print(f"PYTHON WORKER: Adding insecure port {listen_addr}")
    server.add_insecure_port(listen_addr)
    
    print(f"PYTHON WORKER: Starting server on {listen_addr}")
    logger.info(f"Server starting on {listen_addr}")
    
    await server.start()
    print("PYTHON WORKER: Server started successfully, waiting for termination...")
    await server.wait_for_termination()
