"""
Type definitions for Emery Agents system.
Mirrors the TypeScript types from the UI.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
import uuid


class StepType(Enum):
    CODE_STEP = "code_step"
    TOOL_STEP = "tool_step"


class TriggerType(Enum):
    MANUAL = "MANUAL"
    CRON = "CRON" 
    WEBHOOK = "WEBHOOK"
    DATABASE_EVENT = "DATABASE_EVENT"


class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"  # Match database schema


@dataclass
class Trigger:
    type: TriggerType
    cron: Optional[str] = None
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = None
    table_id: Optional[str] = None


@dataclass
class AgentStep:
    id: str
    type: StepType
    instructions: str
    tools: List[str] = field(default_factory=list)
    servers: List[str] = field(default_factory=list)


@dataclass
class Capability:
    name: str
    description: str
    steps: List[AgentStep] = field(default_factory=list)


@dataclass
class Task:
    id: str
    name: str
    status: TaskStatus
    payload: Dict[str, Any] = field(default_factory=dict)
    result: Optional[Any] = None
    error: Optional[str] = None


@dataclass
class Agent:
    id: str
    name: str
    role: Optional[str] = None
    description: Optional[str] = None
    persona: Optional[str] = None
    model: Optional[str] = None
    tools: List[str] = field(default_factory=list)
    servers: List[str] = field(default_factory=list)
    goals: List[str] = field(default_factory=list)
    trigger: Optional[Trigger] = None
    capabilities: List[Capability] = field(default_factory=list)
    database_id: Optional[str] = None
    status: str = "active"
    organization_id: Optional[int] = None
    role_id: Optional[int] = None  # Add role_id field from database
    owner_id: Optional[str] = None
    api_key: Optional[str] = None
    last_used_at: Optional[datetime] = None  # Add last_used_at field
    created_at: Optional[datetime] = None  # Add created_at field


@dataclass
class StepExecution:
    id: str
    task_execution_id: str  # Match database schema field name
    step_id: str
    step_type: StepType
    instructions: Optional[str] = None
    tools: List[str] = field(default_factory=list)
    servers: List[str] = field(default_factory=list)
    input_data: Dict[str, Any] = field(default_factory=dict)
    output_data: Dict[str, Any] = field(default_factory=dict)
    status: TaskStatus = TaskStatus.PENDING
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


@dataclass
class TaskExecution:
    """Main task execution containing multiple step executions"""
    id: str
    agent_id: str
    capability_name: str  # Which capability is being executed
    trigger_type: str
    status: TaskStatus = TaskStatus.PENDING
    input_data: Dict[str, Any] = field(default_factory=dict)
    output_data: Dict[str, Any] = field(default_factory=dict)
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    
    # Step executions for this task
    step_executions: List[StepExecution] = field(default_factory=list)


@dataclass
class ExecutionContext:
    """Context passed between agent steps during execution"""
    agent: Agent
    task_execution: TaskExecution
    capability: Capability
    variables: Dict[str, Any] = field(default_factory=dict)
    outputs: Dict[str, Any] = field(default_factory=dict)  # Outputs from previous steps


# AIDEV-NOTE: These types mirror the TypeScript definitions exactly for consistency
# AIDEV-TODO: Add validation methods to ensure data integrity
# AIDEV-QUESTION: Should we add pydantic models for automatic validation?