"""
Protobuf Mappers

AIDEV-NOTE: Clean protobuf ↔ domain entity conversion.
Simplified for single-instruction model - removed StepConfig/StepType mapping.
No complex abstractions - just direct mapping functions.
"""

import json
from typing import Any, TypedDict

from ...entities.message import (
    FileAttachment,
    FilePart,
    HistoryMessage,
    ImageAttachment,
    ImagePart,
    MessagePart,
    TextPart,
)
from ...entities.models.context_mapping import ResolvedContext
from ...entities.task import SkillInputValue, TaskRequest, TriggerData
from ...entities.tool_config import ToolConfig
from ...types import InstructionConfig
from ..generated import agent_worker_pb2


# Type definitions for structured return values
class TaskProgressDict(TypedDict):
    """Type-safe structure for task progress data."""

    task_id: str
    status: str
    output_json: str
    error_message: str
    timestamp_ms: int
    progress_percent: float


class WorkerInfoDict(TypedDict):
    """Type-safe structure for worker info data."""

    worker_id: str
    version: str
    organization_id: str
    status: str
    capabilities: list[str]
    active_tasks: int
    max_concurrent_tasks: int
    uptime_seconds: int
    supported_tools: list[str]


class CancelTaskRequestDict(TypedDict):
    """Type-safe structure for cancel task request."""

    task_id: str
    reason: str


class CancelTaskResponseDict(TypedDict):
    """Type-safe structure for cancel task response."""

    success: bool
    message: str


class ProtoMapper:
    """Handles conversion between protobuf messages and domain entities."""

    def task_request_from_proto(
        self, proto: agent_worker_pb2.TaskRequest
    ) -> TaskRequest:
        """Convert protobuf TaskRequest to domain entity."""
        # Convert agent config

        # Convert trigger data with typed skill inputs
        skill_input_values: list[SkillInputValue] = []
        if proto.trigger_data and proto.trigger_data.skill_inputs:
            for input_val in proto.trigger_data.skill_inputs:
                # Extract value from oneof field
                value: Any = None
                if input_val.HasField("string_value"):
                    value = input_val.string_value
                elif input_val.HasField("number_value"):
                    value = input_val.number_value
                elif input_val.HasField("bool_value"):
                    value = input_val.bool_value
                elif input_val.HasField("json_value"):
                    try:
                        value = json.loads(input_val.json_value)
                    except json.JSONDecodeError:
                        value = input_val.json_value  # Fallback to raw string

                skill_input_values.append(
                    SkillInputValue(
                        name=input_val.name, type=input_val.type, value=value
                    )
                )

        trigger_data = TriggerData(skill_inputs=skill_input_values)

        # Handle oneof execution_mode
        skill_name = None

        if proto.HasField("skill_name"):
            skill_name = proto.skill_name

        # Convert instruction config to dataclass if present
        instruction_config = None
        if proto.HasField("instruction_config"):
            instruction_config = InstructionConfig(
                task=proto.instruction_config.task,
                tools=list(proto.instruction_config.tools),
                servers=list(proto.instruction_config.servers),
                images=list(proto.instruction_config.images),
                attachments=list(proto.instruction_config.attachments),
                model=proto.instruction_config.model or None,
            )

        # Parse resolved context if present
        resolved_context = None
        if proto.HasField("resolved_context"):
            resolved_context = ResolvedContext.from_proto(proto.resolved_context)

        # Handle optional agent_config message
        agent_config = proto.agent_config if proto.HasField("agent_config") else None

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
            skill_id=proto.skill_id or None,
            instruction_config=instruction_config,
            organization_model=proto.organization_model or None,
            agent_model=proto.agent_model or None,
            resolved_context=resolved_context,
            # Trigger context for audit trail
            trigger_type=proto.trigger_type or None,
            triggered_by_user_id=proto.triggered_by_user_id or None,
            triggered_by_user_name=proto.triggered_by_user_name or None,
            user_api_key=proto.user_api_key or None,
        )

    def task_progress_to_proto(
        self, progress: TaskProgressDict
    ) -> agent_worker_pb2.TaskProgress:
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
            progress_percent=progress.progress_percent,
        )

    def worker_info_to_proto(self, info: WorkerInfoDict) -> agent_worker_pb2.WorkerInfo:
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
            supported_tools=info.supported_tools,
        )

    def cancel_task_request_from_proto(
        self, proto: agent_worker_pb2.CancelTaskRequest
    ) -> CancelTaskRequestDict:
        """Convert protobuf CancelTaskRequest - simplified to return dict."""
        return {"task_id": proto.task_id, "reason": proto.reason}

    def cancel_task_response_to_proto(
        self, response: CancelTaskResponseDict
    ) -> agent_worker_pb2.CancelTaskResponse:
        """Convert domain CancelTaskResponse to protobuf."""
        return agent_worker_pb2.CancelTaskResponse(
            success=response.success, message=response.message
        )


# =========================================================================
# Standalone converter functions (used at gRPC boundary)
# =========================================================================


def tool_config_from_proto(proto: agent_worker_pb2.ToolConfig) -> ToolConfig:
    """Convert protobuf ToolConfig to entity ToolConfig."""
    return ToolConfig(
        name=proto.name,
        version=proto.version,
        config=dict(proto.config),
    )


def tool_configs_from_proto(
    protos: list[agent_worker_pb2.ToolConfig],
) -> list[ToolConfig]:
    """Convert list of protobuf ToolConfigs to entity ToolConfigs."""
    return [tool_config_from_proto(p) for p in protos]


def message_part_from_proto(proto: agent_worker_pb2.MessagePart) -> MessagePart | None:
    """Convert protobuf MessagePart to entity MessagePart."""
    if proto.HasField("text"):
        return TextPart(text=proto.text.text)
    elif proto.HasField("image_url"):
        return ImagePart(url=proto.image_url.url)
    elif proto.HasField("file"):
        return FilePart(
            url=proto.file.url,
            mime_type=proto.file.mime_type,
            filename=proto.file.filename,
            size=proto.file.size,
        )
    return None


def message_parts_from_proto(
    protos: list[agent_worker_pb2.MessagePart],
) -> list[MessagePart]:
    """Convert list of protobuf MessageParts to entity MessageParts."""
    result = []
    for p in protos:
        entity = message_part_from_proto(p)
        if entity is not None:
            result.append(entity)
    return result


def file_attachments_from_proto(
    message_parts: list[agent_worker_pb2.MessagePart],
) -> list[FileAttachment]:
    """Extract FileAttachment entities from protobuf MessageParts."""
    attachments = []
    for part in message_parts:
        if part.HasField("file"):
            attachments.append(
                FileAttachment(
                    url=part.file.url,
                    mime_type=part.file.mime_type,
                    filename=part.file.filename,
                )
            )
    return attachments


def image_attachments_from_proto(
    message_parts: list[agent_worker_pb2.MessagePart],
) -> list[ImageAttachment]:
    """Extract ImageAttachment entities from protobuf MessageParts."""
    attachments = []
    for part in message_parts:
        if part.HasField("image_url") and part.image_url.url:
            attachments.append(ImageAttachment(url=part.image_url.url))
    return attachments


def token_usage_to_proto(tu: Any | None) -> agent_worker_pb2.TokenUsage | None:
    """Convert entity TokenUsage (or compatible) to protobuf TokenUsage."""
    if not tu:
        return None
    return agent_worker_pb2.TokenUsage(
        model_name=getattr(tu, "model_name", ""),
        input_tokens=getattr(tu, "input_tokens", 0),
        output_tokens=getattr(tu, "output_tokens", 0),
        total_tokens=getattr(tu, "total_tokens", 0),
        cost_usd=getattr(tu, "cost_usd", 0.0),
    )


def history_messages_from_proto(
    protos: list[agent_worker_pb2.HistoryMessage],
) -> list[HistoryMessage]:
    """Convert proto HistoryMessage list to entity HistoryMessage list."""
    return [
        HistoryMessage(
            role=msg.role,
            content_parts=message_parts_from_proto(list(msg.content_parts)),
            timestamp=msg.timestamp,
        )
        for msg in protos
    ]
