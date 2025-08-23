"""
Core Domain Entities

AIDEV-NOTE: These entities match the protobuf schema exactly.
No complex DDD patterns - just simple dataclasses for protobuf mapping.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
from .types import StepType


@dataclass
class ToolConfig:
    """Tool configuration matching protobuf ToolConfig."""
    name: str
    version: str
    config: Dict[str, str]  # map<string, string> in protobuf


@dataclass  
class ServerConfig:
    """Server configuration matching protobuf ServerConfig."""
    name: str
    endpoint: str
    config: Dict[str, str]  # map<string, string> in protobuf


@dataclass
class StepConfig:
    """Step configuration matching protobuf StepConfig."""
    id: str
    type: StepType
    instructions: str
    model: str
    tools: List[ToolConfig]
    servers: List[ServerConfig]


@dataclass
class CapabilityConfig:
    """Capability configuration matching protobuf CapabilityConfig."""
    name: str
    description: str
    steps: List[StepConfig]


@dataclass
class AgentConfig:
    """Agent configuration matching protobuf AgentConfig."""
    name: str
    role: str
    description: str
    persona: str
    tools: List[ToolConfig]
    servers: List[ServerConfig]
    capabilities: List[CapabilityConfig]


@dataclass
class InstructionConfig:
    """Instruction configuration for auto-routing execution."""
    instructions: str
    tools: List[ToolConfig]
    servers: List[ServerConfig]


@dataclass
class TriggerData:
    """Trigger data payload matching protobuf TriggerData."""
    payload: Dict[str, str]  # map<string, string> in protobuf


@dataclass
class TaskRequest:
    """Task request matching protobuf TaskRequest."""
    task_id: str
    agent_id: int
    agent_config: AgentConfig
    trigger_data: TriggerData
    organization_id: str
    owner_id: str
    timeout_seconds: int
    name: str
    # oneof execution_mode:
    capability_name: Optional[str] = None
    instruction_config: Optional[InstructionConfig] = None


@dataclass
class TaskProgress:
    """Task progress matching protobuf TaskProgress."""
    task_id: str
    status: str  # TaskStatus enum as string
    step_id: str
    step_type: str  # StepType enum as string
    output_json: str
    error_message: str
    timestamp_ms: int
    progress_percent: float


@dataclass
class WorkerInfo:
    """Worker information matching protobuf WorkerInfo."""
    worker_id: str
    version: str
    organization_id: str
    status: str  # WorkerStatus enum as string
    capabilities: List[str]
    active_tasks: int
    max_concurrent_tasks: int
    uptime_seconds: int
    supported_tools: List[str]


@dataclass
class CancelTaskRequest:
    """Cancel task request matching protobuf CancelTaskRequest."""
    task_id: str
    reason: str


@dataclass
class CancelTaskResponse:
    """Cancel task response matching protobuf CancelTaskResponse."""
    success: bool
    message: str


@dataclass
class ErrorResponse:
    """Error response matching protobuf ErrorResponse."""
    code: str
    message: str
    details: str