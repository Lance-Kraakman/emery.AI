"""
Protobuf Mappers

AIDEV-NOTE: Clean protobuf ↔ domain entity conversion.
Simplified for single-instruction model - removed StepConfig/StepType mapping.
No complex abstractions - just direct mapping functions.
"""

from typing import List, Dict, Any, Optional
from .generated import agent_worker_pb2
from ..entities.task import TaskRequest, TriggerData
from ..entities.agent import AgentConfig
from ..types import TaskStatus, WorkerStatus


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
        skill_name = None
        instruction_config = None

        if proto.HasField("skill_name"):
            skill_name = proto.skill_name
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
            skill_name=skill_name,
            instruction_config=instruction_config
        )
    
    def task_progress_to_proto(self, progress: Any) -> agent_worker_pb2.TaskProgress:
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
    
    def worker_info_to_proto(self, info: Any) -> agent_worker_pb2.WorkerInfo:
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
    
    def cancel_task_request_from_proto(self, proto: agent_worker_pb2.CancelTaskRequest) -> Any:
        """Convert protobuf CancelTaskRequest - simplified to return dict."""
        return {
            'task_id': proto.task_id,
            'reason': proto.reason
        }
    
    def cancel_task_response_to_proto(self, response: Any) -> agent_worker_pb2.CancelTaskResponse:
        """Convert domain CancelTaskResponse to protobuf."""
        return agent_worker_pb2.CancelTaskResponse(
            success=response.success,
            message=response.message
        )
    
    def _agent_config_from_proto(self, proto: agent_worker_pb2.AgentConfig):
        """Convert protobuf AgentConfig to simplified dict/object."""
        # In simplified architecture, just return the protobuf object directly
        # or convert to minimal dict if needed
        return proto
    
    def _skill_config_from_proto(self, proto: agent_worker_pb2.SkillConfig):
        """Convert protobuf SkillConfig - simplified to just return proto."""
        return proto
    
    def _tool_config_from_proto(self, proto: agent_worker_pb2.ToolConfig):
        """Convert protobuf ToolConfig - simplified to just return proto."""
        return proto

    def _server_config_from_proto(self, proto: agent_worker_pb2.ServerConfig):
        """Convert protobuf ServerConfig - simplified to just return proto."""
        return proto
    
    def _instruction_config_from_proto(self, proto: agent_worker_pb2.InstructionConfig):
        """Convert protobuf InstructionConfig - simplified to just return proto."""
        return proto