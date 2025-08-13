"""
Type definitions for Emery Agents system.
EXACTLY matches the TypeScript types from app/actions/types.ts
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
import uuid


class StepType(Enum):
    """Step types - matches frontend StepConfig.type"""
    CODE_STEP = "CODE_STEP"  # UPDATED: matches frontend exactly
    TOOL_STEP = "TOOL_STEP"  # UPDATED: matches frontend exactly


class TriggerType(Enum):
    """Trigger types - matches frontend TriggerConfig.type"""
    MANUAL = "MANUAL"
    CRON = "CRON" 
    WEBHOOK = "WEBHOOK"
    DATABASE_EVENT = "DATABASE_EVENT"
    CALENDAR = "CALENDAR"  # NEW: added CALENDAR support


class TaskStatus(Enum):
    """Task status - matches frontend Task.status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


@dataclass
class TriggerConfig:
    """Matches frontend TriggerConfig exactly"""
    type: TriggerType
    cron: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    table_id: Optional[int] = None  # UPDATED: int not str


@dataclass
class ToolConfig:
    """Matches frontend ToolConfig exactly"""
    name: str
    version: Optional[str] = None
    config: Optional[Dict[str, Any]] = None  # UPDATED: Optional, not default_factory


@dataclass
class ServerConfig:
    """Matches frontend ServerConfig exactly"""
    name: str
    endpoint: Optional[str] = None
    config: Optional[Dict[str, Any]] = None  # UPDATED: Optional, not default_factory


@dataclass
class StepConfig:
    """Matches frontend StepConfig exactly"""
    id: str
    type: StepType
    instructions: str
    model: Optional[str] = None  # Per-step model specification
    tools: Optional[List[ToolConfig]] = None  # UPDATED: Optional to match frontend
    servers: Optional[List[ServerConfig]] = None  # UPDATED: Optional to match frontend


@dataclass
class CapabilityConfig:
    """Matches frontend CapabilityConfig exactly"""
    name: str
    description: str
    steps: List[StepConfig]  # UPDATED: required, matches frontend


@dataclass
class TaskInstructions:
    """Task instruction configuration - step-like structure"""
    instructions: str  # Natural language instructions
    tools: Optional[List[ToolConfig]] = None  # Optional tools
    servers: Optional[List[ServerConfig]] = None  # Optional servers

@dataclass
class Task:
    """Matches frontend Task exactly"""
    id: str
    agentId: int  # UPDATED: camelCase to match frontend
    name: str
    instructions: TaskInstructions  # Step-like configuration
    capabilityName: Optional[str] = None  # Optional - system can auto-route
    status: TaskStatus = TaskStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    startedAt: Optional[datetime] = None  # UPDATED: camelCase
    completedAt: Optional[datetime] = None  # UPDATED: camelCase
    createdBy: Optional[str] = None  # UPDATED: camelCase
    createdAt: Optional[datetime] = None  # UPDATED: camelCase


@dataclass
class CreateTaskData:
    """Matches frontend CreateTaskData exactly"""
    agentId: int
    name: str
    instructions: TaskInstructions  # Step-like configuration
    capabilityName: Optional[str] = None  # Optional - system can auto-route
    createdBy: Optional[str] = None


@dataclass
class Agent:
    """Agent configuration - matches database structure"""
    id: Optional[int] = None  # Database ID (optional for creation)
    name: str = ""
    role: Optional[str] = None
    description: Optional[str] = None
    persona: Optional[str] = None
    ownerId: Optional[str] = None  # UPDATED: camelCase
    tools: Optional[List[ToolConfig]] = None  # UPDATED: Optional
    servers: Optional[List[ServerConfig]] = None  # UPDATED: Optional
    trigger: Optional[TriggerConfig] = None
    capabilities: Optional[List[CapabilityConfig]] = None  # UPDATED: Optional
    databaseId: Optional[str] = None  # UPDATED: camelCase
    status: Optional[str] = "active"
    organizationId: Optional[int] = None  # UPDATED: camelCase
    roleId: Optional[int] = None  # UPDATED: camelCase
    apiKey: Optional[str] = None  # UPDATED: camelCase
    lastUsedAt: Optional[datetime] = None  # UPDATED: camelCase
    createdAt: Optional[datetime] = None  # UPDATED: camelCase


@dataclass
class CreateAgentData:
    """Matches frontend CreateAgentData exactly"""
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
    """Matches frontend StepExecution exactly"""
    id: str
    taskId: str  # UPDATED: camelCase to match frontend
    stepId: str  # UPDATED: camelCase to match frontend
    stepType: str  # UPDATED: lowercase string to match frontend ('code_step', 'tool_step')
    instructions: Optional[str] = None
    inputData: Optional[Dict[str, Any]] = None  # UPDATED: camelCase
    outputData: Optional[Dict[str, Any]] = None  # UPDATED: camelCase
    status: TaskStatus = TaskStatus.PENDING
    errorMessage: Optional[str] = None  # UPDATED: camelCase
    startedAt: Optional[datetime] = None  # UPDATED: camelCase
    completedAt: Optional[datetime] = None  # UPDATED: camelCase


@dataclass
class ExecutionContext:
    """Context passed between agent steps during execution"""
    agent: Agent
    task: Task
    capability: CapabilityConfig  # UPDATED: CapabilityConfig not quoted string
    variables: Dict[str, Any] = field(default_factory=dict)
    outputs: Dict[str, Any] = field(default_factory=dict)  # Outputs from previous steps
    step_executions: List[StepExecution] = field(default_factory=list)  # Track step executions


# AIDEV-NOTE: These types NOW EXACTLY mirror the TypeScript definitions for consistency
# All camelCase fields match frontend, all types match JSONB storage format