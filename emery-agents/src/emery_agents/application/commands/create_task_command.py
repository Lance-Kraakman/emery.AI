"""
Create Task Command

AIDEV-NOTE: Command object for task creation with validation.
Separates command handling from business logic following CQRS pattern.
"""

from dataclasses import dataclass
from typing import Optional

from ...domain.agents.entities.task import TaskInstructions


@dataclass(frozen=True)
class CreateTaskCommand:
    """Command for creating a new task."""
    
    agent_id: int
    name: str
    instructions: TaskInstructions
    capability_name: Optional[str] = None
    created_by: Optional[str] = None
    organization_id: Optional[int] = None  # Optional override
    
    def __post_init__(self):
        """Validate command data."""
        if self.agent_id <= 0:
            raise ValueError("Agent ID must be positive")
        
        if not self.name or not self.name.strip():
            raise ValueError("Task name cannot be empty")
        
        if len(self.name) > 500:
            raise ValueError("Task name cannot exceed 500 characters")
        
        if self.organization_id is not None and self.organization_id <= 0:
            raise ValueError("Organization ID must be positive")
        
        # Instructions validation is handled by TaskInstructions value object