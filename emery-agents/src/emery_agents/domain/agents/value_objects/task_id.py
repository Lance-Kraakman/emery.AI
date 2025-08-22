"""
Task ID Value Object

AIDEV-NOTE: Strong typing for Task IDs using UUID format.
Tasks use UUID identifiers for distributed system compatibility.
"""

from dataclasses import dataclass
from typing import Any
import uuid
import re


@dataclass(frozen=True)
class TaskId:
    """Value object for Task identifiers (UUIDs)."""
    
    value: str
    
    def __post_init__(self):
        """Validate and normalize task ID value."""
        # Allow UUID object conversion
        if isinstance(self.value, uuid.UUID):
            object.__setattr__(self, 'value', str(self.value))
        elif not isinstance(self.value, str):
            raise ValueError("Task ID must be a valid UUID")
        
        if not self.value or not self.value.strip():
            raise ValueError("Task ID must be a valid UUID")
        
        # Validate UUID format
        try:
            uuid.UUID(self.value.strip())
            object.__setattr__(self, 'value', self.value.strip())
        except ValueError:
            raise ValueError("Task ID must be a valid UUID")
    
    def __str__(self) -> str:
        return self.value
    
    def __repr__(self) -> str:
        return f"TaskId({self.value})"
    
    @classmethod
    def generate(cls) -> "TaskId":
        """Generate a new random task ID."""
        return cls(str(uuid.uuid4()))
    
    @classmethod
    def from_string(cls, value: str) -> "TaskId":
        """Create TaskId from string with validation."""
        return cls(value.strip())
    
    @classmethod
    def from_any(cls, value: Any) -> "TaskId":
        """Create TaskId from any value with type coercion."""
        if isinstance(value, cls):
            return value
        
        if isinstance(value, str):
            return cls.from_string(value)
        
        if hasattr(value, '__str__'):
            return cls.from_string(str(value))
            
        raise TypeError(f"Cannot create TaskId from {type(value)}: {value}")
    
    def short_id(self) -> str:
        """Get first 8 characters for display purposes."""
        return self.value[:8]