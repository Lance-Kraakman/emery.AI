"""
Agent ID Value Object

AIDEV-NOTE: Strong typing for Agent IDs to prevent primitive obsession.
Follows DDD value object patterns with validation and immutability.
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AgentId:
    """Value object for Agent identifiers."""
    
    value: int
    
    def __post_init__(self):
        """Validate and normalize agent ID value."""
        # Allow string numeric conversion
        if isinstance(self.value, str):
            try:
                object.__setattr__(self, 'value', int(self.value))
            except ValueError:
                raise ValueError("Agent ID must be a positive integer")
        elif not isinstance(self.value, int):
            raise ValueError("Agent ID must be a positive integer")
        
        if self.value < 0:
            raise ValueError("Agent ID must be a positive integer")
    
    def __str__(self) -> str:
        return str(self.value)
    
    def __repr__(self) -> str:
        return f"AgentId({self.value})"
    
    def __int__(self) -> int:
        return self.value
    
    @classmethod
    def from_string(cls, value: str) -> "AgentId":
        """Create AgentId from string representation."""
        try:
            return cls(int(value))
        except (ValueError, TypeError) as e:
            raise ValueError(f"Cannot create AgentId from string '{value}': {e}")
    
    @classmethod
    def from_any(cls, value: Any) -> "AgentId":
        """Create AgentId from any value with type coercion."""
        if isinstance(value, cls):
            return value
        
        if isinstance(value, int):
            return cls(value)
            
        if isinstance(value, str):
            return cls.from_string(value)
            
        raise TypeError(f"Cannot create AgentId from {type(value)}: {value}")