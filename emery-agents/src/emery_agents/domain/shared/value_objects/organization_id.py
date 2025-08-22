"""
Organization ID Value Object

AIDEV-NOTE: Shared value object for Organization identifiers.
Used across multiple bounded contexts in the system.
"""

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class OrganizationId:
    """Value object for Organization identifiers."""
    
    value: int
    
    def __post_init__(self):
        """Validate and normalize organization ID value."""
        # Allow string numeric conversion
        if isinstance(self.value, str):
            try:
                object.__setattr__(self, 'value', int(self.value))
            except ValueError:
                raise ValueError("Organization ID must be a positive integer")
        elif not isinstance(self.value, int):
            raise ValueError("Organization ID must be a positive integer")
        
        if self.value < 0:
            raise ValueError("Organization ID must be a positive integer")
    
    def __str__(self) -> str:
        return str(self.value)
    
    def __repr__(self) -> str:
        return f"OrganizationId({self.value})"
    
    def __int__(self) -> int:
        return self.value
    
    @classmethod
    def from_string(cls, value: str) -> "OrganizationId":
        """Create OrganizationId from string representation."""
        try:
            return cls(int(value))
        except (ValueError, TypeError) as e:
            raise ValueError(f"Cannot create OrganizationId from string '{value}': {e}")
    
    @classmethod
    def from_any(cls, value: Any) -> "OrganizationId":
        """Create OrganizationId from any value with type coercion."""
        if isinstance(value, cls):
            return value
        
        if isinstance(value, int):
            return cls(value)
            
        if isinstance(value, str):
            return cls.from_string(value)
            
        raise TypeError(f"Cannot create OrganizationId from {type(value)}: {value}")