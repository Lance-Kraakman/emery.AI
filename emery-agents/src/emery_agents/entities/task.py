"""
Task Entity (Simplified)

Represents an agent task without DDD value object overhead.
Uses direct types (int, str) with validation in constructors.
"""

import uuid
from datetime import datetime
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from ..types import AgentId, OrganizationId, TaskId, OwnerId


@dataclass
class TriggerData:
    """Trigger data for task execution."""
    payload: Dict[str, Any]


@dataclass
class TaskRequest:
    """Request to execute a task - simplified DTO from protobuf."""
    task_id: TaskId
    agent_id: AgentId
    agent_config: Any  # AgentConfig from protobuf or dict
    trigger_data: TriggerData
    organization_id: OrganizationId
    owner_id: OwnerId
    timeout_seconds: int
    name: str
    skill_name: Optional[str] = None
    instruction_config: Optional[Dict[str, Any]] = None  # Simplified from protobuf
    organization_model: Optional[str] = None  # For model selection


@dataclass
class TaskInstructions:
    """Task execution instructions."""
    instructions: str
    tools: Optional[List[Dict[str, Any]]] = None
    servers: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TaskConfig:
    """Configuration for creating a new task - simplified."""
    agent_id: AgentId
    organization_id: OrganizationId
    name: str
    instructions: TaskInstructions
    id: Optional[TaskId] = None
    skill_name: Optional[str] = None
    status: Optional[str] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[OwnerId] = None
    created_at: Optional[datetime] = None


class Task:
    """Task entity with lifecycle management - simplified without value objects."""

    def __init__(
        self,
        id: TaskId,
        agent_id: AgentId,
        organization_id: OrganizationId,
        name: str,
        skill_name: Optional[str],
        instructions: TaskInstructions,
        status: str,
        result: Optional[Any],
        error: Optional[str],
        started_at: Optional[datetime],
        completed_at: Optional[datetime],
        created_by: Optional[OwnerId],
        created_at: datetime
    ):
        # Validation
        if not name or not name.strip():
            raise ValueError("Task name cannot be empty")
        if agent_id is None:
            raise ValueError("Agent ID is required")
        if organization_id is None:
            raise ValueError("Organization ID is required")

        self.id = id
        self.agent_id = agent_id
        self.organization_id = organization_id
        self.name = name
        self.skill_name = skill_name
        self.instructions = instructions
        self._status = status
        self._result = result
        self._error = error
        self._started_at = started_at
        self._completed_at = completed_at
        self.created_by = created_by
        self.created_at = created_at

    @classmethod
    def create(cls, config: TaskConfig) -> "Task":
        """Create a new task instance."""
        now = datetime.utcnow()

        # Generate ID if not provided
        task_id = config.id or str(uuid.uuid4())

        return cls(
            id=task_id,
            agent_id=config.agent_id,
            organization_id=config.organization_id,
            name=config.name,
            skill_name=config.skill_name,
            instructions=config.instructions,
            status=config.status or "pending",
            result=config.result,
            error=config.error,
            started_at=config.started_at,
            completed_at=config.completed_at,
            created_by=config.created_by,
            created_at=config.created_at or now
        )

    @classmethod
    def from_persistence(cls, data: Dict[str, Any]) -> "Task":
        """Create task from persistence data (dict from gRPC/DB)."""
        # Reconstruct TaskInstructions from dict
        instructions_data = data.get("instructions", {})
        if isinstance(instructions_data, dict):
            instructions = TaskInstructions(
                instructions=instructions_data.get("instructions", ""),
                tools=instructions_data.get("tools"),
                servers=instructions_data.get("servers"),
                metadata=instructions_data.get("metadata")
            )
        else:
            # Handle string instructions (legacy)
            instructions = TaskInstructions(instructions=str(instructions_data))

        return cls(
            id=data["id"],
            agent_id=data["agent_id"],
            organization_id=data["organization_id"],
            name=data["name"],
            skill_name=data.get("skill_name"),
            instructions=instructions,
            status=data.get("status", "pending"),
            result=data.get("result"),
            error=data.get("error"),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            created_by=data.get("created_by"),
            created_at=data.get("created_at", datetime.utcnow())
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary for persistence/serialization."""
        return {
            "id": self.id,
            "agent_id": self.agent_id,
            "organization_id": self.organization_id,
            "name": self.name,
            "skill_name": self.skill_name,
            "instructions": {
                "instructions": self.instructions.instructions,
                "tools": self.instructions.tools,
                "servers": self.instructions.servers,
                "metadata": self.instructions.metadata
            },
            "status": self._status,
            "result": self._result,
            "error": self._error,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "completed_at": self._completed_at.isoformat() if self._completed_at else None,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

    # Properties
    @property
    def status(self) -> str:
        """Get task status."""
        return self._status

    @property
    def result(self) -> Optional[Any]:
        """Get task result."""
        return self._result

    @property
    def error(self) -> Optional[str]:
        """Get task error."""
        return self._error

    @property
    def started_at(self) -> Optional[datetime]:
        """Get task start time."""
        return self._started_at

    @property
    def completed_at(self) -> Optional[datetime]:
        """Get task completion time."""
        return self._completed_at

    @property
    def short_id(self) -> str:
        """Get shortened task ID for display."""
        return self.id[:8] if self.id else ""

    @property
    def is_pending(self) -> bool:
        """Check if task is pending."""
        return self._status == "pending"

    @property
    def is_in_progress(self) -> bool:
        """Check if task is in progress."""
        return self._status == "in_progress"

    @property
    def is_completed(self) -> bool:
        """Check if task is completed."""
        return self._status == "completed"

    @property
    def is_failed(self) -> bool:
        """Check if task failed."""
        return self._status == "failed"

    @property
    def is_cancelled(self) -> bool:
        """Check if task was cancelled."""
        return self._status == "cancelled"

    # Lifecycle methods
    def start(self) -> None:
        """Mark task as started."""
        if not self.is_pending:
            raise ValueError(f"Cannot start task in status: {self._status}")
        self._status = "in_progress"
        self._started_at = datetime.utcnow()

    def complete(self, result: Any) -> None:
        """Mark task as completed with result."""
        if not self.is_in_progress:
            raise ValueError(f"Cannot complete task in status: {self._status}")
        self._status = "completed"
        self._result = result
        self._completed_at = datetime.utcnow()

    def fail(self, error: str) -> None:
        """Mark task as failed with error message."""
        self._status = "failed"
        self._error = error
        self._completed_at = datetime.utcnow()

    def cancel(self, reason: str = "") -> None:
        """Mark task as cancelled."""
        self._status = "cancelled"
        self._error = f"Cancelled: {reason}" if reason else "Cancelled"
        self._completed_at = datetime.utcnow()
