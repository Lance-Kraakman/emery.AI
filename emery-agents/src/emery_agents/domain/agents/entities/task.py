"""
Task Domain Entity

AIDEV-NOTE: Proper DDD entity using value objects for type safety.
Mutable entity with business logic for task lifecycle management.
"""

import uuid
from datetime import datetime
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from ...shared.value_objects.ids import AgentId, OrganizationId, TaskId


TaskStatus = Union[str, Any]  # 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'timeout'


@dataclass
class TaskInstructions:
    """Task execution instructions."""
    instructions: str
    tools: Optional[List[Dict[str, Any]]] = None
    servers: Optional[List[Dict[str, Any]]] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TaskConfig:
    """Configuration for creating a new task with value objects."""
    agent_id: AgentId
    organization_id: OrganizationId
    name: str
    instructions: TaskInstructions
    id: Optional[TaskId] = None
    capability_name: Optional[str] = None
    status: Optional[str] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None


class Task:
    """Task domain entity with business logic."""
    
    def __init__(
        self,
        id: TaskId,
        agent_id: AgentId,
        organization_id: OrganizationId,
        name: str,
        capability_name: Optional[str],
        instructions: TaskInstructions,
        status: str,
        result: Optional[Any],
        error: Optional[str],
        started_at: Optional[datetime],
        completed_at: Optional[datetime],
        created_by: Optional[str],
        created_at: datetime
    ):
        self.id = id
        self.agent_id = agent_id
        self.organization_id = organization_id
        self.name = name
        self.capability_name = capability_name
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
        
        return cls(
            id=config.id or TaskId.generate(),
            agent_id=config.agent_id,
            organization_id=config.organization_id,
            name=config.name,
            capability_name=config.capability_name,
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
        """Create task from persistence data."""
        instructions_data = data["instructions"]
        if isinstance(instructions_data, dict):
            instructions = TaskInstructions(**instructions_data)
        else:
            instructions = TaskInstructions(instructions=str(instructions_data))
        
        return cls(
            id=TaskId(data["id"]),
            agent_id=AgentId(data["agent_id"]),
            organization_id=OrganizationId(data["organization_id"]),
            name=data["name"],
            capability_name=data.get("capability_name"),
            instructions=instructions,
            status=data["status"],
            result=data.get("result"),
            error=data.get("error"),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            created_by=data.get("created_by"),
            created_at=data["created_at"]
        )
    
    # Properties
    @property
    def status(self) -> str:
        return self._status
    
    @property
    def result(self) -> Optional[Any]:
        return self._result
    
    @property
    def error(self) -> Optional[str]:
        return self._error
    
    @property
    def started_at(self) -> Optional[datetime]:
        return self._started_at
    
    @property
    def completed_at(self) -> Optional[datetime]:
        return self._completed_at
    
    # Business logic methods
    def start(self) -> None:
        """Start task execution."""
        if self._status != "pending":
            raise ValueError(f"Cannot start task {self.id}: current status is {self._status}")
        
        self._status = "in_progress"
        self._started_at = datetime.utcnow()
        self._error = None  # Clear any previous error
    
    def complete(self, result: Optional[Any] = None) -> None:
        """Mark task as completed with result."""
        if self._status != "in_progress":
            raise ValueError(f"Cannot complete task {self.id}: current status is {self._status}")
        
        self._status = "completed"
        self._result = result
        self._completed_at = datetime.utcnow()
        self._error = None  # Clear any error on success
    
    def fail(self, error: str) -> None:
        """Mark task as failed with error."""
        if self._status == "completed":
            raise ValueError(f"Cannot fail task {self.id}: task is already completed")
        
        self._status = "failed"
        self._error = error
        self._completed_at = datetime.utcnow()
    
    def cancel(self, reason: Optional[str] = None) -> None:
        """Cancel task execution."""
        if self._status in ["completed", "failed"]:
            raise ValueError(f"Cannot cancel task {self.id}: task is already {self._status}")
        
        self._status = "cancelled"
        self._error = f"Cancelled: {reason}" if reason else "Cancelled by user"
        self._completed_at = datetime.utcnow()
    
    def timeout(self) -> None:
        """Mark task as timed out."""
        if self._status in ["completed", "failed"]:
            raise ValueError(f"Cannot timeout task {self.id}: task is already {self._status}")
        
        self._status = "timeout"
        self._error = "Task execution timed out"
        self._completed_at = datetime.utcnow()
    
    def update_result(self, result: Any) -> None:
        """Update task result during execution (for progress tracking)."""
        if self._status != "in_progress":
            raise ValueError(f"Cannot update result for task {self.id}: task is not in progress")
        
        self._result = result
    
    # Status predicates
    @property
    def is_terminal(self) -> bool:
        """Check if task is in a terminal state."""
        return self._status in ["completed", "failed", "cancelled", "timeout"]
    
    @property
    def is_running(self) -> bool:
        """Check if task is running."""
        return self._status == "in_progress"
    
    @property
    def is_pending(self) -> bool:
        """Check if task is pending."""
        return self._status == "pending"
    
    @property
    def is_successful(self) -> bool:
        """Check if task completed successfully."""
        return self._status == "completed"
    
    @property
    def is_failed(self) -> bool:
        """Check if task failed."""
        return self._status in ["failed", "cancelled", "timeout"]
    
    # Utility methods
    @property
    def duration(self) -> Optional[int]:
        """Get task duration in milliseconds (if completed)."""
        if not self._started_at or not self._completed_at:
            return None
        
        delta = self._completed_at - self._started_at
        return int(delta.total_seconds() * 1000)
    
    @property
    def display_name(self) -> str:
        """Get task display name."""
        return self.name[:47] + "..." if len(self.name) > 50 else self.name
    
    @property
    def short_id(self) -> str:
        """Get first 8 characters for display purposes."""
        return self.id.short_id