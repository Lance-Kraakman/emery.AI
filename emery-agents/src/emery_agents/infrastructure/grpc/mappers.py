"""
Protobuf Mappers

AIDEV-NOTE: Clean protobuf ↔ domain entity conversion.
Simplified for single-instruction model - removed StepConfig/StepType mapping.
No complex abstractions - just direct mapping functions.
"""

from typing import List, Dict, Any, Optional
from ...grpc.generated import agent_worker_pb2
from ...core.entities import (
    TaskRequest, TaskProgress, WorkerInfo, CancelTaskRequest, CancelTaskResponse,
    AgentConfig, SkillConfig, SkillInput, SkillOutput, ToolConfig, ServerConfig,
    InstructionConfig, TriggerData
)
from ...core.types import TaskStatus, WorkerStatus


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
        """
        Convert domain TaskProgress to protobuf.

        AIDEV-NOTE: Simplified for single-instruction model - removed step_id and step_type.
        """
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
        skills = [self._skill_config_from_proto(skill) for skill in proto.skills]

        return AgentConfig(
            name=proto.name,
            role=proto.role,
            description=proto.description,
            persona=proto.persona,
            tools=tools,
            servers=servers,
            skills=skills
        )
    
    def _skill_config_from_proto(self, proto: agent_worker_pb2.SkillConfig) -> SkillConfig:
        """
        Convert protobuf SkillConfig to domain entity.

        AIDEV-NOTE: Simplified for single-instruction model - removed step iteration.
        """
        inputs = [SkillInput(name=inp.name, required=inp.required) for inp in proto.inputs]
        outputs = [SkillOutput(name=out.name) for out in proto.outputs]
        tools = [self._tool_config_from_proto(tool) for tool in proto.tools]

        return SkillConfig(
            name=proto.name,
            description=proto.description,
            inputs=inputs,
            outputs=outputs,
            instructions=proto.instructions,
            tools=tools
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
    
    # AIDEV-NOTE: Value object conversion methods for DDD compliance
    
    def convert_to_domain_agent_id(self, primitive_id: int) -> 'AgentId':
        """Convert primitive integer to AgentId value object."""
        from ...domain.shared.value_objects.ids import AgentId
        return AgentId(primitive_id)
    
    def convert_to_domain_organization_id(self, primitive_id: str) -> 'OrganizationId':
        """Convert primitive string to OrganizationId value object."""
        from ...domain.shared.value_objects.ids import OrganizationId
        try:
            # Try to convert string to int for OrganizationId
            org_id_int = int(primitive_id)
            return OrganizationId(org_id_int)
        except ValueError:
            raise ValueError(f"OrganizationId must be numeric, got: {primitive_id}")
    
    def convert_to_domain_task_id(self, primitive_id: str) -> 'TaskId':
        """Convert primitive string to TaskId value object."""
        from ...domain.shared.value_objects.ids import TaskId
        return TaskId(primitive_id)
    
    def convert_to_domain_owner_id(self, primitive_id: str) -> 'OwnerId':
        """Convert primitive string to OwnerId value object."""
        from ...domain.shared.value_objects.ids import OwnerId
        return OwnerId(primitive_id)
    
    def convert_to_domain_capability_name(self, primitive_name: Optional[str]) -> Optional['CapabilityName']:
        """Convert primitive string to CapabilityName value object."""
        if not primitive_name:
            return None
        from ...domain.execution.value_objects.execution_value_objects import CapabilityName
        return CapabilityName(primitive_name)
    
    def convert_to_domain_timeout_seconds(self, primitive_seconds: int) -> 'TimeoutSeconds':
        """Convert primitive integer to TimeoutSeconds value object."""
        from ...domain.execution.value_objects.execution_value_objects import TimeoutSeconds
        return TimeoutSeconds(primitive_seconds)
    
    def convert_from_domain_agent_id(self, agent_id: 'AgentId') -> int:
        """Convert AgentId value object to primitive integer."""
        return agent_id.value
    
    def convert_from_domain_organization_id(self, org_id: 'OrganizationId') -> str:
        """Convert OrganizationId value object to primitive string."""
        return str(org_id.value)
    
    def convert_from_domain_task_id(self, task_id: 'TaskId') -> str:
        """Convert TaskId value object to primitive string."""
        return task_id.value
    
    def convert_from_domain_owner_id(self, owner_id: 'OwnerId') -> str:
        """Convert OwnerId value object to primitive string."""
        return owner_id.value
    
    def convert_from_domain_capability_name(self, capability_name: Optional['CapabilityName']) -> Optional[str]:
        """Convert CapabilityName value object to primitive string."""
        return capability_name.value if capability_name else None
    
    def convert_from_domain_timeout_seconds(self, timeout: 'TimeoutSeconds') -> int:
        """Convert TimeoutSeconds value object to primitive integer."""
        return timeout.value