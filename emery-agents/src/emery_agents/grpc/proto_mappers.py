"""
Proto mapping functions for converting between protobuf messages and Python dataclasses.

This module provides clean mapping between:
- Protobuf messages (transport layer) 
- Python dataclasses (internal processing)

Following the proto-first architecture where all agent configuration
comes via structured proto messages instead of environment variables.
"""

import json
from typing import Dict, Any, List
from datetime import datetime

from .generated import agent_worker_pb2
from ..core.types import (
    Agent, ToolConfig, ServerConfig, StepConfig, CapabilityConfig,
    StepType, Task, TaskStatus, TaskInstructions
)


def map_proto_tool_to_dataclass(proto_tool: agent_worker_pb2.ToolConfig) -> ToolConfig:
    """Convert protobuf ToolConfig to Python ToolConfig"""
    return ToolConfig(
        name=proto_tool.name,
        version=proto_tool.version if proto_tool.version else None,
        config=dict(proto_tool.config) if proto_tool.config else {}
    )


def map_proto_server_to_dataclass(proto_server: agent_worker_pb2.ServerConfig) -> ServerConfig:
    """Convert protobuf ServerConfig to Python ServerConfig"""
    return ServerConfig(
        name=proto_server.name,
        endpoint=proto_server.endpoint if proto_server.endpoint else None,
        config=dict(proto_server.config) if proto_server.config else {}
    )


def map_proto_step_to_dataclass(proto_step: agent_worker_pb2.StepConfig) -> StepConfig:
    """Convert protobuf StepConfig to Python StepConfig"""
    # Map proto enum to Python enum
    step_type = StepType.TOOL_STEP if proto_step.type == agent_worker_pb2.TOOL_STEP else StepType.CODE_STEP
    
    return StepConfig(
        id=proto_step.id,
        type=step_type,
        instructions=proto_step.instructions,
        model=proto_step.model if proto_step.model else None,
        tools=[map_proto_tool_to_dataclass(tool) for tool in proto_step.tools] if proto_step.tools else None,
        servers=[map_proto_server_to_dataclass(server) for server in proto_step.servers] if proto_step.servers else None
    )


def map_proto_capability_to_dataclass(proto_capability: agent_worker_pb2.CapabilityConfig) -> CapabilityConfig:
    """Convert protobuf CapabilityConfig to Python CapabilityConfig"""
    return CapabilityConfig(
        name=proto_capability.name,
        description=proto_capability.description,
        steps=[map_proto_step_to_dataclass(step) for step in proto_capability.steps]
    )


def map_proto_agent_to_dataclass(proto_agent: agent_worker_pb2.AgentConfig, agent_id: str) -> Agent:
    """Convert protobuf AgentConfig to Python Agent"""
    return Agent(
        id=agent_id,
        name=proto_agent.name,
        role=proto_agent.role if proto_agent.role else '',
        description=proto_agent.description if proto_agent.description else '',
        persona=proto_agent.persona if proto_agent.persona else '',
        tools=[map_proto_tool_to_dataclass(tool) for tool in proto_agent.tools] if proto_agent.tools else None,
        servers=[map_proto_server_to_dataclass(server) for server in proto_agent.servers] if proto_agent.servers else None,
        capabilities=[map_proto_capability_to_dataclass(cap) for cap in proto_agent.capabilities] if proto_agent.capabilities else [],
        # Note: These fields are not in proto but needed for Python Agent dataclass (using camelCase)
        trigger=None,  # Not needed for execution
        databaseId=None,  # camelCase to match dataclass
        status='active',
        organizationId=None,  # camelCase to match dataclass
        ownerId=None,  # camelCase to match dataclass
        apiKey=None  # camelCase to match dataclass
    )


def map_proto_trigger_data(proto_trigger: agent_worker_pb2.TriggerData) -> Dict[str, Any]:
    """Convert protobuf TriggerData to Python dict"""
    result = {}
    for key, value in proto_trigger.payload.items():
        try:
            # Try to parse as JSON first
            result[key] = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            # If parsing fails, use as string
            result[key] = value
    return result


def map_proto_instruction_config(proto_instruction: agent_worker_pb2.InstructionConfig) -> TaskInstructions:
    """Convert protobuf InstructionConfig to Python TaskInstructions"""
    return TaskInstructions(
        instructions=proto_instruction.instructions,
        tools=[map_proto_tool_to_dataclass(tool) for tool in proto_instruction.tools] if proto_instruction.tools else None,
        servers=[map_proto_server_to_dataclass(server) for server in proto_instruction.servers] if proto_instruction.servers else None
    )


def map_task_status_to_proto(status: TaskStatus) -> int:
    """Convert Python TaskStatus to protobuf enum value"""
    status_map = {
        TaskStatus.PENDING: agent_worker_pb2.TASK_PENDING,
        TaskStatus.IN_PROGRESS: agent_worker_pb2.TASK_IN_PROGRESS,
        TaskStatus.COMPLETED: agent_worker_pb2.TASK_COMPLETED,
        TaskStatus.FAILED: agent_worker_pb2.TASK_FAILED,
        TaskStatus.CANCELLED: agent_worker_pb2.TASK_CANCELLED,
        TaskStatus.TIMEOUT: agent_worker_pb2.TASK_TIMEOUT,
    }
    return status_map.get(status, agent_worker_pb2.TASK_FAILED)


def create_task_progress(
    task_id: str,
    status: TaskStatus,
    step_id: str = '',
    step_type: str = '',
    output_data: Any = None,
    error_message: str = '',
    progress_percent: float = 0.0
) -> agent_worker_pb2.TaskProgress:
    """Create a protobuf TaskProgress message from Python data"""
    
    # Convert output data to JSON string
    output_json = ''
    if output_data is not None:
        try:
            output_json = json.dumps(output_data)
        except (TypeError, ValueError) as e:
            output_json = json.dumps({"error": f"Failed to serialize output: {str(e)}", "raw_output": str(output_data)})
    
    return agent_worker_pb2.TaskProgress(
        task_id=task_id,
        status=map_task_status_to_proto(status),
        step_id=step_id,
        step_type=step_type,
        output_json=output_json,
        error_message=error_message,
        timestamp_ms=int(datetime.now().timestamp() * 1000),
        progress_percent=progress_percent
    )


def parse_task_request(request: agent_worker_pb2.TaskRequest) -> Dict[str, Any]:
    """Parse a complete TaskRequest into Python objects for execution"""
    
    # Convert agent config
    agent = map_proto_agent_to_dataclass(request.agent_config, str(request.agent_id))
    
    # Convert trigger data
    trigger_data = map_proto_trigger_data(request.trigger_data)
    
    # Handle execution mode (oneof field)
    capability_name = None
    instruction_config = None
    
    # Check which execution mode is set (protobuf oneof field)
    execution_mode = request.WhichOneof('execution_mode')
    
    if execution_mode == 'capability_name':
        capability_name = request.capability_name
    elif execution_mode == 'instruction_config':
        instruction_config = map_proto_instruction_config(request.instruction_config)
    else:
        raise ValueError("Either capability_name or instruction_config must be provided")
    
    return {
        'task_id': request.task_id,
        'agent_id': request.agent_id,
        'capability_name': capability_name,           # Optional - for direct execution
        'instruction_config': instruction_config,     # Optional - for auto-routing
        'agent': agent,
        'trigger_data': trigger_data,
        'organization_id': request.organization_id,
        'owner_id': request.owner_id,
        'timeout_seconds': request.timeout_seconds
    }


# AIDEV-NOTE: These mappers provide clean conversion between proto transport layer 
# and Python dataclasses used by the agent execution system
# AIDEV-TODO: Add validation to ensure required fields are present in proto messages
# AIDEV-TODO: Add error handling for invalid proto message formats