"""
Execute Task Command

AIDEV-NOTE: Command object for task execution with validation.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class ExecuteTaskCommand:
    """Command for executing an existing task."""
    
    task_id: str
    timeout_seconds: Optional[int] = None
    
    def __post_init__(self):
        """Validate command data."""
        if not self.task_id or not self.task_id.strip():
            raise ValueError("Task ID cannot be empty")
        
        if self.timeout_seconds is not None:
            if self.timeout_seconds <= 0:
                raise ValueError("Timeout must be positive")
            
            if self.timeout_seconds > 3600:  # 1 hour max
                raise ValueError("Timeout cannot exceed 3600 seconds")
    
    @property
    def normalized_task_id(self) -> str:
        """Get normalized task ID."""
        return self.task_id.strip()