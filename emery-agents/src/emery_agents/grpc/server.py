import asyncio
import json
import logging
import time
from typing import AsyncIterator, Dict, Any
import grpc
from grpc import aio
from .generated import agent_worker_pb2, agent_worker_pb2_grpc
from .proto_mappers import parse_task_request, create_task_progress
from ..core.types import TaskStatus, Agent, TaskInstructions
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
        print("=== PYTHON WORKER: STARTING TASK EXECUTION ===")
        logger.info("=== STARTING TASK EXECUTION ===")
        
        task_data = parse_task_request(request)
        task_id = task_data['task_id']
        agent = task_data['agent']
        capability_name = task_data.get('capability_name')
        instruction_config = task_data.get('instruction_config')

        print(f"PYTHON WORKER: Task ID: {task_id}")
        print(f"PYTHON WORKER: Agent: {agent.name if agent else 'None'}")
        print(f"PYTHON WORKER: Capability: {capability_name}")
        print(f"PYTHON WORKER: Instruction config: {instruction_config}")
        
        logger.info(f"Task ID: {task_id}")
        logger.info(f"Agent: {agent.name if agent else 'None'}")
        logger.info(f"Capability: {capability_name}")
        logger.info(f"Instruction config: {instruction_config}")
        
        self.active_tasks[task_id] = {'agent': agent, 'start_time': time.time()}

        try:
            print("PYTHON WORKER: About to yield initialization progress...")
            logger.info("Yielding initialization progress...")
            yield create_task_progress(task_id=task_id, status=TaskStatus.IN_PROGRESS, step_id="initialization", progress_percent=0.0)
            
            print("PYTHON WORKER: Creating SmolAgentsOrchestrator...")
            logger.info("Creating SmolAgentsOrchestrator...")
            orchestrator = SmolAgentsOrchestrator()
            
            print("PYTHON WORKER: Setting up agent orchestrator...")
            logger.info("Setting up agent orchestrator...")
            orchestrator.setup_agent_orchestrator(agent)
            print("PYTHON WORKER: Agent orchestrator setup completed!")
            
            logger.info("Yielding orchestrator init progress...")
            yield create_task_progress(task_id=task_id, status=TaskStatus.IN_PROGRESS, step_id="orchestrator_init", output_data={"message": "Orchestrator initialized"}, progress_percent=10.0)
            
            if not instruction_config:
                logger.info(f"No instruction config provided, creating default for capability: {capability_name}")
                instruction_config = TaskInstructions(instructions=f"Execute capability: {capability_name}")
            else:
                logger.info(f"Using provided instruction config: {instruction_config}")
            
            logger.info("Starting orchestrator execution...")
            task_result = await orchestrator.execute_with_orchestrator(instructions=instruction_config)
            logger.info(f"Orchestrator execution completed: {task_result}")
            
            if task_result["status"] == "success":
                final_result = {"status": "completed", "result": task_result.get("result", {})}
                final_status = TaskStatus.COMPLETED
            else:
                final_result = {"status": "failed", "error": task_result.get("error", "Unknown error")}
                final_status = TaskStatus.FAILED
            
            yield create_task_progress(task_id=task_id, status=final_status, step_id="completion", output_data=final_result, progress_percent=100.0)
        except Exception as e:
            print(f"PYTHON WORKER: EXCEPTION in task {task_id}: {str(e)}")
            print(f"PYTHON WORKER: Exception type: {type(e).__name__}")
            import traceback
            print(f"PYTHON WORKER: Traceback: {traceback.format_exc()}")
            
            logger.exception(f"Task {task_id} failed")
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
