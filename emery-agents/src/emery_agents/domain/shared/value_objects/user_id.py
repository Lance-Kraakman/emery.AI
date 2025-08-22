"""
User ID Value Object

AIDEV-NOTE: Shared value object for User identifiers.
Handles both string UUIDs and integer IDs as used in the system.
"""

from dataclasses import dataclass
from typing import Any, Union
import re


@dataclass(frozen=True)
class UserId:
    """Value object for User identifiers."""
    
    value: str
    
    def __post_init__(self):
        """Validate user ID value."""
        if not isinstance(self.value, str):
            raise TypeError(f"User ID must be a string, got {type(self.value)}")
        
        if not self.value or not self.value.strip():
            raise ValueError("User ID cannot be empty")
        
        # Validate format (UUID or alphanumeric string)
        value = self.value.strip()
        if not re.match(r'^[a-zA-Z0-9\-_]+$', value):
            raise ValueError(f"User ID contains invalid characters: '{value}'")
    
    def __str__(self) -> str:
        return self.value
    
    @classmethod
    def from_any(cls, value: Any) -> "UserId":
        """Create UserId from any value with type coercion."""
        if isinstance(value, cls):
            return value
        
        if isinstance(value, str):
            return cls(value)
            
        if isinstance(value, (int, float)):
            return cls(str(value))
            
        raise TypeError(f"Cannot create UserId from {type(value)}: {value}")
    
    def is_uuid(self) -> bool:
        """Check if the user ID is in UUID format."""
        uuid_pattern = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        return bool(re.match(uuid_pattern, self.value))