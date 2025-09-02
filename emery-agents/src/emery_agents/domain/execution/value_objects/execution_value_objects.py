"""
Execution-Specific Value Objects

AIDEV-NOTE: Domain value objects for execution-related concepts.
Provides validation and type safety for execution parameters.
"""

import re
from typing import ClassVar
from ...shared.value_objects.base import StringValueObject, IntegerValueObject, ValueObject


class CapabilityName(StringValueObject):
    """
    Capability name value object.
    
    Represents a unique name for an agent capability.
    Must follow naming conventions for capabilities.
    """
    
    MIN_LENGTH: ClassVar[int] = 3
    MAX_LENGTH: ClassVar[int] = 100
    
    def _validate(self, value: str) -> None:
        """Validate capability name format."""
        super()._validate(value)
        
        cleaned_value = value.strip()
        
        if len(cleaned_value) < self.MIN_LENGTH:
            raise ValueError(f"CapabilityName must be at least {self.MIN_LENGTH} characters")
        
        if len(cleaned_value) > self.MAX_LENGTH:
            raise ValueError(f"CapabilityName must not exceed {self.MAX_LENGTH} characters")
        
        # Allow alphanumeric, underscores, hyphens, and dots (for namespacing)
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9_.-]*$', cleaned_value):
            raise ValueError(
                "CapabilityName must start with a letter and contain only "
                "alphanumeric characters, underscores, hyphens, and dots"
            )
        
        self._value = cleaned_value
    
    @classmethod
    def from_string(cls, value: str) -> "CapabilityName":
        """Create CapabilityName from string."""
        return cls(value)
    
    @property
    def namespace(self) -> str:
        """Get namespace part if capability is namespaced (e.g., 'email.send' -> 'email')."""
        if '.' in self._value:
            return self._value.split('.')[0]
        return self._value
    
    @property
    def action(self) -> str:
        """Get action part if capability is namespaced (e.g., 'email.send' -> 'send')."""
        if '.' in self._value:
            return self._value.split('.')[-1]
        return self._value


class TimeoutSeconds(IntegerValueObject):
    """
    Timeout duration value object.
    
    Represents a timeout duration in seconds.
    Must be a positive integer within reasonable bounds.
    """
    
    MIN_TIMEOUT: ClassVar[int] = 1
    MAX_TIMEOUT: ClassVar[int] = 3600  # 1 hour max
    DEFAULT_TIMEOUT: ClassVar[int] = 300  # 5 minutes default
    
    def _validate(self, value: int) -> None:
        """Validate timeout value."""
        super()._validate(value)
        
        if value < self.MIN_TIMEOUT:
            raise ValueError(f"TimeoutSeconds must be at least {self.MIN_TIMEOUT} seconds")
        
        if value > self.MAX_TIMEOUT:
            raise ValueError(f"TimeoutSeconds must not exceed {self.MAX_TIMEOUT} seconds")
    
    @classmethod
    def from_int(cls, value: int) -> "TimeoutSeconds":
        """Create TimeoutSeconds from integer."""
        return cls(value)
    
    @classmethod
    def default(cls) -> "TimeoutSeconds":
        """Create default timeout."""
        return cls(cls.DEFAULT_TIMEOUT)
    
    @classmethod
    def from_minutes(cls, minutes: int) -> "TimeoutSeconds":
        """Create timeout from minutes."""
        return cls(minutes * 60)
    
    @property
    def in_minutes(self) -> float:
        """Get timeout in minutes."""
        return self.value / 60
    
    @property
    def in_milliseconds(self) -> int:
        """Get timeout in milliseconds."""
        return self.value * 1000


class MaxSteps(IntegerValueObject):
    """
    Maximum steps value object.
    
    Represents the maximum number of steps allowed in an execution.
    Must be a positive integer within reasonable bounds.
    """
    
    MIN_STEPS: ClassVar[int] = 1
    MAX_STEPS: ClassVar[int] = 100
    DEFAULT_STEPS: ClassVar[int] = 10
    
    def _validate(self, value: int) -> None:
        """Validate max steps value."""
        super()._validate(value)
        
        if value < self.MIN_STEPS:
            raise ValueError(f"MaxSteps must be at least {self.MIN_STEPS}")
        
        if value > self.MAX_STEPS:
            raise ValueError(f"MaxSteps must not exceed {self.MAX_STEPS}")
    
    @classmethod
    def from_int(cls, value: int) -> "MaxSteps":
        """Create MaxSteps from integer."""
        return cls(value)
    
    @classmethod
    def default(cls) -> "MaxSteps":
        """Create default max steps."""
        return cls(cls.DEFAULT_STEPS)
    
    @property
    def is_minimal(self) -> bool:
        """Check if this is the minimum number of steps."""
        return self.value == self.MIN_STEPS
    
    @property
    def is_maximum(self) -> bool:
        """Check if this is the maximum number of steps."""
        return self.value == self.MAX_STEPS


class ProgressPercent(ValueObject[float]):
    """
    Progress percentage value object.
    
    Represents execution progress as a percentage (0.0 to 100.0).
    """
    
    def _validate(self, value: float) -> None:
        """Validate progress percentage."""
        super()._validate(value)
        
        if not isinstance(value, (int, float)):
            raise ValueError(f"ProgressPercent must be a number, got {type(value).__name__}")
        
        if value < 0.0:
            raise ValueError(f"ProgressPercent cannot be negative, got {value}")
        
        if value > 100.0:
            raise ValueError(f"ProgressPercent cannot exceed 100.0, got {value}")
    
    @classmethod
    def from_float(cls, value: float) -> "ProgressPercent":
        """Create ProgressPercent from float."""
        return cls(float(value))
    
    @classmethod
    def from_fraction(cls, completed: int, total: int) -> "ProgressPercent":
        """Create ProgressPercent from fraction."""
        if total <= 0:
            return cls(0.0)
        return cls(min(100.0, (completed / total) * 100))
    
    @classmethod
    def zero(cls) -> "ProgressPercent":
        """Create zero progress."""
        return cls(0.0)
    
    @classmethod
    def complete(cls) -> "ProgressPercent":
        """Create complete progress."""
        return cls(100.0)
    
    @property
    def is_complete(self) -> bool:
        """Check if progress is complete."""
        return self.value >= 100.0
    
    @property
    def is_started(self) -> bool:
        """Check if progress has started."""
        return self.value > 0.0
    
    @property
    def as_decimal(self) -> float:
        """Get progress as decimal (0.0 to 1.0)."""
        return self.value / 100.0