"""
Get Task Query

AIDEV-NOTE: Query objects for task retrieval operations.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class GetTaskQuery:
    """Query for retrieving a single task."""
    
    task_id: str
    
    def __post_init__(self):
        """Validate query parameters."""
        if not self.task_id or not self.task_id.strip():
            raise ValueError("Task ID cannot be empty")
    
    @property
    def normalized_task_id(self) -> str:
        """Get normalized task ID."""
        return self.task_id.strip()


@dataclass(frozen=True)
class GetTasksByAgentQuery:
    """Query for retrieving tasks by agent."""
    
    agent_id: int
    limit: Optional[int] = None
    
    def __post_init__(self):
        """Validate query parameters."""
        if self.agent_id <= 0:
            raise ValueError("Agent ID must be positive")
        
        if self.limit is not None and self.limit <= 0:
            raise ValueError("Limit must be positive")


@dataclass(frozen=True)
class GetTasksByOrganizationQuery:
    """Query for retrieving tasks by organization."""
    
    organization_id: int
    limit: Optional[int] = None
    recent_only: bool = False
    
    def __post_init__(self):
        """Validate query parameters."""
        if self.organization_id <= 0:
            raise ValueError("Organization ID must be positive")
        
        if self.limit is not None and self.limit <= 0:
            raise ValueError("Limit must be positive")


@dataclass(frozen=True)
class GetPendingTasksQuery:
    """Query for retrieving pending tasks."""
    
    limit: Optional[int] = None
    
    def __post_init__(self):
        """Validate query parameters."""
        if self.limit is not None and self.limit <= 0:
            raise ValueError("Limit must be positive")