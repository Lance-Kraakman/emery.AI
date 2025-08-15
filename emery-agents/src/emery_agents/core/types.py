"""
Type definitions for Emery Agents system.

Matches TypeScript types from app/actions/types.ts for consistency.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, TypedDict, Union
from datetime import datetime

class OrchestratorResult(TypedDict, total=False):
    """Result from orchestrator execution."""
    status: str  # "success" or "failed" 
    selected_capability: str
    result: Optional[Any]
    error: Optional[str]
    orchestrator: str

class ContextData(TypedDict, total=False):
    """Execution context data structure."""
    variables: Dict[str, Any]
    step_outputs: Dict[str, Any]
    completed_steps: List[str]
    execution_id: str
    model: Optional[str]
    
class TriggerData(TypedDict, total=False):
    """Trigger event data."""
    trigger_type: str
    user_request: Optional[str]
    webhook_data: Optional[Dict[str, Any]]
    cron_data: Optional[Dict[str, Any]]
    database_event: Optional[Dict[str, Any]]


class StepType(Enum):
    """Step execution types."""
    CODE_STEP = "CODE_STEP"
    TOOL_STEP = "TOOL_STEP"


class TriggerType(Enum):
    """Agent trigger types."""
    MANUAL = "MANUAL"
    CRON = "CRON"
    WEBHOOK = "WEBHOOK"
    DATABASE_EVENT = "DATABASE_EVENT"
    CALENDAR = "CALENDAR"


class TaskStatus(Enum):
    """Task execution status."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


@dataclass
class TriggerConfig:
    """Agent trigger configuration."""
    type: TriggerType
    cron: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    table_id: Optional[int] = None


@dataclass
class ToolConfig:
    """Tool configuration matching frontend ToolConfig interface."""
    name: str
    version: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


@dataclass
class ServerConfig:
    """Server configuration."""
    name: str
    endpoint: Optional[str] = None
    config: Optional[Dict[str, Any]] = None


@dataclass
class StepConfig:
    """Step execution configuration."""
    id: str
    type: StepType
    instructions: str
    model: Optional[str] = None
    tools: Optional[List[ToolConfig]] = None
    servers: Optional[List[ServerConfig]] = None


@dataclass
class CapabilityConfig:
    """Agent capability configuration."""
    name: str
    description: str
    steps: List[StepConfig]


@dataclass
class TaskInstructions:
    """Task instruction configuration."""
    instructions: str
    tools: Optional[List[ToolConfig]] = None
    servers: Optional[List[ServerConfig]] = None

@dataclass
class Task:
    """Task execution definition."""
    id: str
    agentId: int
    name: str
    instructions: TaskInstructions
    capabilityName: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    createdBy: Optional[str] = None
    createdAt: Optional[datetime] = None


@dataclass
class CreateTaskData:
    """Task creation data."""
    agentId: int
    name: str
    instructions: TaskInstructions
    capabilityName: Optional[str] = None
    createdBy: Optional[str] = None


@dataclass
class Agent:
    """Agent configuration."""
    id: Optional[int] = None
    name: str = ""
    role: Optional[str] = None
    description: Optional[str] = None
    persona: Optional[str] = None
    ownerId: Optional[str] = None
    tools: Optional[List[ToolConfig]] = None
    servers: Optional[List[ServerConfig]] = None
    trigger: Optional[TriggerConfig] = None
    capabilities: Optional[List[CapabilityConfig]] = None
    databaseId: Optional[str] = None
    status: Optional[str] = "active"
    organizationId: Optional[int] = None
    roleId: Optional[int] = None
    apiKey: Optional[str] = None
    lastUsedAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None


@dataclass
class CreateAgentData:
    """Agent creation data."""
    name: str
    role: Optional[str] = None
    description: Optional[str] = None
    persona: Optional[str] = None
    tools: Optional[List[ToolConfig]] = None
    servers: Optional[List[ServerConfig]] = None
    trigger: Optional[TriggerConfig] = None
    capabilities: Optional[List[CapabilityConfig]] = None
    status: Optional[str] = None
    roleId: Optional[int] = None


@dataclass
class StepExecution:
    """Step execution tracking."""
    id: str
    taskId: str
    stepId: str
    stepType: str
    instructions: Optional[str] = None
    inputData: Optional[Dict[str, Any]] = None
    outputData: Optional[Dict[str, Any]] = None
    status: TaskStatus = TaskStatus.PENDING
    errorMessage: Optional[str] = None
    startedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None


@dataclass
class ExecutionContext:
    """Agent execution context."""
    agent: Agent
    task: Task
    capability: CapabilityConfig
    variables: Dict[str, Any] = field(default_factory=dict)
    outputs: Dict[str, Any] = field(default_factory=dict)
    step_executions: List[StepExecution] = field(default_factory=list)


