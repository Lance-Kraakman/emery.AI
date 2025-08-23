"""
Protobuf Mappers

AIDEV-NOTE: Clean protobuf ↔ domain entity conversion.
No complex abstractions - just direct mapping functions.
"""

from typing import List, Dict, Any
from emery_agents.infrastructure.grpc.generated import agent_worker_pb2
from ...core.entities import (
    TaskRequest, TaskProgress, WorkerInfo, CancelTaskRequest, CancelTaskResponse,
    AgentConfig, CapabilityConfig, StepConfig, ToolConfig, ServerConfig,
    InstructionConfig, TriggerData
)
from ...core.types import StepType, TaskStatus, WorkerStatus


class ProtoMapper:
    """Handles conversion between protobuf messages and domain entities."""
    
    def task_request_from_proto(self, proto: agent_worker_pb2.TaskRequest) -> TaskRequest:
        """Convert protobuf TaskRequest to domain entity."""
        # Convert agent config
        agent_config = self._agent_config_from_proto(proto.agent_config)
        
        # Convert trigger data
        trigger_data = TriggerData(
            payload=dict(proto.trigger_data.payload)
        )
        
        # Handle oneof execution_mode
        capability_name = None
        instruction_config = None
        
        if proto.HasField("capability_name"):
            capability_name = proto.capability_name
        elif proto.HasField("instruction_config"):
            instruction_config = self._instruction_config_from_proto(proto.instruction_config)
        
        return TaskRequest(
            task_id=proto.task_id,
            agent_id=proto.agent_id,
            agent_config=agent_config,
            trigger_data=trigger_data,
            organization_id=proto.organization_id,
            owner_id=proto.owner_id,
            timeout_seconds=proto.timeout_seconds,
            name=proto.name,
            capability_name=capability_name,
            instruction_config=instruction_config
        )
    
    def task_progress_to_proto(self, progress: TaskProgress) -> agent_worker_pb2.TaskProgress:
        """Convert domain TaskProgress to protobuf."""
        # Map status string to protobuf enum
        status_map = {
            "TASK_PENDING": agent_worker_pb2.TASK_PENDING,
            "TASK_IN_PROGRESS": agent_worker_pb2.TASK_IN_PROGRESS,
            "TASK_COMPLETED": agent_worker_pb2.TASK_COMPLETED,
            "TASK_FAILED": agent_worker_pb2.TASK_FAILED,
            "TASK_CANCELLED": agent_worker_pb2.TASK_CANCELLED,
            "TASK_TIMEOUT": agent_worker_pb2.TASK_TIMEOUT,
        }
        
        return agent_worker_pb2.TaskProgress(
            task_id=progress.task_id,
            status=status_map.get(progress.status, agent_worker_pb2.TASK_PENDING),
            step_id=progress.step_id,
            step_type=progress.step_type,
            output_json=progress.output_json,
            error_message=progress.error_message,
            timestamp_ms=progress.timestamp_ms,
            progress_percent=progress.progress_percent
        )
    
    def worker_info_to_proto(self, info: WorkerInfo) -> agent_worker_pb2.WorkerInfo:
        """Convert domain WorkerInfo to protobuf."""
        # Map status string to protobuf enum
        status_map = {
            "WORKER_HEALTHY": agent_worker_pb2.WORKER_HEALTHY,
            "WORKER_BUSY": agent_worker_pb2.WORKER_BUSY,
            "WORKER_DEGRADED": agent_worker_pb2.WORKER_DEGRADED,
            "WORKER_UNHEALTHY": agent_worker_pb2.WORKER_UNHEALTHY,
            "WORKER_SHUTTING_DOWN": agent_worker_pb2.WORKER_SHUTTING_DOWN,
        }
        
        return agent_worker_pb2.WorkerInfo(
            worker_id=info.worker_id,
            version=info.version,
            organization_id=info.organization_id,
            status=status_map.get(info.status, agent_worker_pb2.WORKER_HEALTHY),
            capabilities=info.capabilities,
            active_tasks=info.active_tasks,
            max_concurrent_tasks=info.max_concurrent_tasks,
            uptime_seconds=info.uptime_seconds,
            supported_tools=info.supported_tools
        )
    
    def cancel_task_request_from_proto(self, proto: agent_worker_pb2.CancelTaskRequest) -> CancelTaskRequest:
        """Convert protobuf CancelTaskRequest to domain entity."""
        return CancelTaskRequest(
            task_id=proto.task_id,
            reason=proto.reason
        )
    
    def cancel_task_response_to_proto(self, response: CancelTaskResponse) -> agent_worker_pb2.CancelTaskResponse:
        """Convert domain CancelTaskResponse to protobuf."""
        return agent_worker_pb2.CancelTaskResponse(
            success=response.success,
            message=response.message
        )
    
    def _agent_config_from_proto(self, proto: agent_worker_pb2.AgentConfig) -> AgentConfig:
        """Convert protobuf AgentConfig to domain entity."""
        tools = [self._tool_config_from_proto(tool) for tool in proto.tools]
        servers = [self._server_config_from_proto(server) for server in proto.servers]
        capabilities = [self._capability_config_from_proto(cap) for cap in proto.capabilities]
        
        return AgentConfig(
            name=proto.name,
            role=proto.role,
            description=proto.description,
            persona=proto.persona,
            tools=tools,
            servers=servers,
            capabilities=capabilities
        )
    
    def _capability_config_from_proto(self, proto: agent_worker_pb2.CapabilityConfig) -> CapabilityConfig:
        """Convert protobuf CapabilityConfig to domain entity."""
        steps = [self._step_config_from_proto(step) for step in proto.steps]
        
        return CapabilityConfig(
            name=proto.name,
            description=proto.description,
            steps=steps
        )
    
    def _step_config_from_proto(self, proto: agent_worker_pb2.StepConfig) -> StepConfig:
        """Convert protobuf StepConfig to domain entity."""
        # Map protobuf enum to domain enum
        step_type = StepType.CODE_STEP if proto.type == agent_worker_pb2.CODE_STEP else StepType.TOOL_STEP
        
        tools = [self._tool_config_from_proto(tool) for tool in proto.tools]
        servers = [self._server_config_from_proto(server) for server in proto.servers]
        
        return StepConfig(
            id=proto.id,
            type=step_type,
            instructions=proto.instructions,
            model=proto.model,
            tools=tools,
            servers=servers
        )
    
    def _tool_config_from_proto(self, proto: agent_worker_pb2.ToolConfig) -> ToolConfig:
        """Convert protobuf ToolConfig to domain entity."""
        return ToolConfig(
            name=proto.name,
            version=proto.version,
            config=dict(proto.config)
        )
    
    def _server_config_from_proto(self, proto: agent_worker_pb2.ServerConfig) -> ServerConfig:
        """Convert protobuf ServerConfig to domain entity."""
        return ServerConfig(
            name=proto.name,
            endpoint=proto.endpoint,
            config=dict(proto.config)
        )
    
    def _instruction_config_from_proto(self, proto: agent_worker_pb2.InstructionConfig) -> InstructionConfig:
        """Convert protobuf InstructionConfig to domain entity."""
        tools = [self._tool_config_from_proto(tool) for tool in proto.tools]
        servers = [self._server_config_from_proto(server) for server in proto.servers]
        
        return InstructionConfig(
            instructions=proto.instructions,
            tools=tools,
            servers=servers
        )