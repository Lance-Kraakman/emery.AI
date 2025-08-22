import logging
import sys
import time
from typing import AsyncIterator, Dict, Any, List
import grpc
from grpc import aio
from emery_agents.infrastructure.grpc.generated import agent_worker_pb2, agent_worker_pb2_grpc
from .proto_mappers import parse_task_request, create_task_progress

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class RealAgentExecutionService:
    """Real agent execution service using smolagents."""
    
    def __init__(self):
        from ..execution.smolagents_execution_service import SmolAgentsExecutionService
        self.smolagents_service = SmolAgentsExecutionService()
        logger.info("RealAgentExecutionService initialized with smolagents")
    
    async def execute_task(self, agent, instructions, capability_name=None):
        """Execute task using real smolagents."""
        try:
            # Create minimal execution request for now
            # TODO: Convert from protobuf agent to proper DDD request
            from ...domain.agents.value_objects.agent_id import AgentId
            from ...domain.agents.repositories.agent_execution_repository import AgentExecutionRequest
            
            request = AgentExecutionRequest(
                agent_id=AgentId(getattr(agent, 'id', 1)),
                instructions=instructions,
                execution_id=f"task_{int(time.time())}"
            )
            
            result = await self.smolagents_service.execute_task(request)
            
            if result.success:
                return {
                    "status": "success", 
                    "result": {"output": result.output_data.get("output", "Execution completed")}
                }
            else:
                return {
                    "status": "failed",
                    "error": result.error,
                    "result": {}
                }
                
        except Exception as e:
            logger.exception(f"Real agent execution failed: {e}")
            return {
                "status": "failed",
                "error": str(e),
                "result": {}
            }


class AgentExecutionService:
    """
    Agent execution service for DI container integration.
    
    AIDEV-NOTE: Provides the interface expected by DI container and 
    wraps the real smolagents execution service.
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        from ..execution.smolagents_execution_service import SmolAgentsExecutionService
        self.execution_service = SmolAgentsExecutionService()
        logger.info("AgentExecutionService initialized for DI container")
    
    async def execute_agent(self, request):
        """Execute agent task via smolagents service."""
        return await self.execution_service.execute_task(request)
    
    async def cancel_execution(self, execution_id: str, reason: str = None):
        """Cancel execution (not implemented yet)."""
        logger.warning(f"Cancel execution not implemented: {execution_id}")
    
    async def get_execution_status(self, execution_id: str) -> str:
        """Get execution status (not implemented yet)."""
        logger.warning(f"Get execution status not implemented: {execution_id}")
        return "unknown"
    
    async def is_available(self, organization_id: str) -> bool:
        """Check if execution service is available."""
        # Check if HF_TOKEN is available
        import os
        return bool(os.getenv("HF_TOKEN"))
    
    async def get_worker_health(self, organization_id: str) -> Dict[str, Any]:
        """Get worker health status."""
        import os
        hf_token = os.getenv("HF_TOKEN")
        return {
            "status": "healthy" if hf_token else "unhealthy",
            "hf_token_available": bool(hf_token),
            "execution_service": "smolagents"
        }
    
    async def list_active_executions(self, organization_id: str) -> List[str]:
        """List active executions (not implemented yet)."""
        return []
    
    async def get_execution_logs(self, execution_id: str) -> List[str]:
        """Get execution logs (not implemented yet)."""
        return []


class AgentWorkerServiceImplementation(agent_worker_pb2_grpc.AgentWorkerServicer):
    def __init__(self, organization_id: str, max_concurrent_tasks: int = 10):
        self.organization_id = organization_id
        self.max_concurrent_tasks = max_concurrent_tasks
        self.worker_id = f"worker_{organization_id}_{int(time.time())}"
        self.start_time = time.time()
        self.active_tasks: Dict[str, Any] = {}
        # Real agent service using smolagents
        self.agent_service = RealAgentExecutionService()
        
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
        
        task = parse_task_request(request)
    

        print(f"🚀 [TASK-{task.id[:8]}] Starting execution for agent: {task.agent}")
        print(f"📋 [TASK-{task.id[:8]}] Instructions: {task.instructions}..." if task.instructions else "No instruction config")
        sys.stdout.flush()
        
        logger.info(f"Instructions: {task.instructions}")
        
        self.active_tasks[task.id] = {'agent': task.agent, 'start_time': time.time()}

        try:
            yield create_task_progress(task_id=task.id, status=agent_worker_pb2.TASK_IN_PROGRESS, step_id="initialization", progress_percent=0.0)
            
            task_result = await self.agent_service.execute_task(
                agent=task.agent,
                instructions=task.instructions,
                capability_name=task.capabilityName
            )
            
            if task_result["status"] == "success":
                final_result = {"status": "completed", "result": task_result.get("result", {})}
                final_status = agent_worker_pb2.TASK_COMPLETED
            else:
                final_result = {"status": "failed", "error": task_result.get("error", "Unknown error")}
                final_status = agent_worker_pb2.TASK_FAILED
            
            yield create_task_progress(task_id=task.id, status=final_status, step_id="completion", output_data=final_result, progress_percent=100.0)
        except Exception as e:
            print(f"❌ [TASK-{task.id[:8]}] Failed: {str(e)}")
            import traceback
            print(f"📍 [TASK-{task.id[:8]}] Traceback: {traceback.format_exc()}")
            sys.stdout.flush()
            
            logger.exception(f"Task {task.id[:8]} failed")
            yield create_task_progress(task_id=task.id, status=agent_worker_pb2.TASK_FAILED, error_message=str(e))
        finally:
            if task.id in self.active_tasks:
                del self.active_tasks[task.id]

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
    server = aio.server()
    
    service_impl = AgentWorkerServiceImplementation(organization_id)
    
    agent_worker_pb2_grpc.add_AgentWorkerServicer_to_server(service_impl, server)
    
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)
    
    logger.info(f"Server starting on {listen_addr}")
    
    await server.start()
    logger.info("server started succesfully, waiting for termination")
    await server.wait_for_termination()