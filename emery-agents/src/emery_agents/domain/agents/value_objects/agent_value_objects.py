"""
Agent-Specific Value Objects

AIDEV-NOTE: Domain value objects specific to agent entity and operations.
Provides validation and type safety for agent-related concepts.
"""

import re
from enum import Enum
from typing import ClassVar
from ...shared.value_objects.base import StringValueObject


class AgentName(StringValueObject):
    """
    Agent name value object.
    
    Represents a human-readable name for an agent.
    Must be 2-100 characters, alphanumeric with spaces/hyphens allowed.
    """
    
    MIN_LENGTH: ClassVar[int] = 2
    MAX_LENGTH: ClassVar[int] = 100
    
    def _validate(self, value: str) -> None:
        """Validate agent name format and length."""
        super()._validate(value)
        
        cleaned_value = value.strip()
        
        if len(cleaned_value) < self.MIN_LENGTH:
            raise ValueError(f"AgentName must be at least {self.MIN_LENGTH} characters")
        
        if len(cleaned_value) > self.MAX_LENGTH:
            raise ValueError(f"AgentName must not exceed {self.MAX_LENGTH} characters")
        
        # Allow alphanumeric, spaces, hyphens, underscores, and common punctuation
        if not re.match(r'^[a-zA-Z0-9\s\-_.,!?()]+$', cleaned_value):
            raise ValueError("AgentName contains invalid characters")
        
        # Ensure it doesn't start or end with whitespace (trimmed above)
        self._value = cleaned_value
    
    @classmethod
    def from_string(cls, value: str) -> "AgentName":
        """Create AgentName from string."""
        return cls(value)


class AgentStatusValue(Enum):
    """Valid agent statuses."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    DISABLED = "disabled"
    PENDING = "pending"
    ARCHIVED = "archived"


class AgentStatus(StringValueObject):
    """
    Agent status value object.
    
    Represents the current operational status of an agent.
    Must be one of the predefined valid statuses.
    """
    
    def _validate(self, value: str) -> None:
        """Validate agent status is a known valid status."""
        super()._validate(value)
        
        # Convert to lowercase for case-insensitive comparison
        normalized_value = value.lower().strip()
        
        valid_statuses = [status.value for status in AgentStatusValue]
        if normalized_value not in valid_statuses:
            raise ValueError(
                f"AgentStatus must be one of {valid_statuses}, got: {normalized_value}"
            )
        
        # Store the normalized value
        self._value = normalized_value
    
    @property
    def is_active(self) -> bool:
        """Check if agent is in active status."""
        return self._value == AgentStatusValue.ACTIVE.value
    
    @property
    def is_operational(self) -> bool:
        """Check if agent can perform tasks."""
        return self._value in [AgentStatusValue.ACTIVE.value, AgentStatusValue.PENDING.value]
    
    @classmethod
    def active(cls) -> "AgentStatus":
        """Create an active status."""
        return cls(AgentStatusValue.ACTIVE.value)
    
    @classmethod
    def inactive(cls) -> "AgentStatus":
        """Create an inactive status."""
        return cls(AgentStatusValue.INACTIVE.value)
    
    @classmethod
    def from_string(cls, value: str) -> "AgentStatus":
        """Create AgentStatus from string."""
        return cls(value)


class ApiKey(StringValueObject):
    """
    API key value object.
    
    Represents a secure API key for agent authentication.
    Must be non-empty and meet minimum security requirements.
    """
    
    MIN_LENGTH: ClassVar[int] = 8
    MAX_LENGTH: ClassVar[int] = 512
    
    def _validate(self, value: str) -> None:
        """Validate API key format and security requirements."""
        super()._validate(value)
        
        if len(value) < self.MIN_LENGTH:
            raise ValueError(f"ApiKey must be at least {self.MIN_LENGTH} characters")
        
        if len(value) > self.MAX_LENGTH:
            raise ValueError(f"ApiKey must not exceed {self.MAX_LENGTH} characters")
        
        # Basic security check - no obviously weak keys
        weak_patterns = ['password', '12345', 'test', 'admin', 'key']
        lower_value = value.lower()
        for pattern in weak_patterns:
            if pattern in lower_value:
                raise ValueError(f"ApiKey appears to contain weak pattern: {pattern}")
    
    @classmethod
    def from_string(cls, value: str) -> "ApiKey":
        """Create ApiKey from string."""
        return cls(value)
    
    @property
    def masked(self) -> str:
        """Get masked version for logging (first 4 chars + ***)."""
        if len(self._value) <= 4:
            return "****"
        return f"{self._value[:4]}***"


class AgentRole(StringValueObject):
    """
    Agent role value object.
    
    Represents the functional role or purpose of an agent.
    Used for categorization and capability determination.
    """
    
    MAX_LENGTH: ClassVar[int] = 50
    
    def _validate(self, value: str) -> None:
        """Validate agent role format."""
        super()._validate(value)
        
        cleaned_value = value.strip().lower()
        
        if len(cleaned_value) > self.MAX_LENGTH:
            raise ValueError(f"AgentRole must not exceed {self.MAX_LENGTH} characters")
        
        # Allow alphanumeric with underscores and hyphens
        if not re.match(r'^[a-z0-9_-]+$', cleaned_value):
            raise ValueError("AgentRole must be lowercase alphanumeric with underscores/hyphens")
        
        self._value = cleaned_value
    
    @classmethod
    def from_string(cls, value: str) -> "AgentRole":
        """Create AgentRole from string."""
        return cls(value)