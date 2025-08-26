"""
Core ID Value Objects

AIDEV-NOTE: Typed identifiers for domain entities.
Provides type safety and validation for all ID types used in the system.
"""

import re
import uuid
from typing import Union
from .base import PositiveIntegerValueObject, StringValueObject


class AgentId(PositiveIntegerValueObject):
    """
    Agent identifier value object.
    
    Represents a unique identifier for an agent.
    Must be a positive integer.
    """
    
    @classmethod
    def from_int(cls, value: int) -> "AgentId":
        """Create AgentId from integer."""
        return cls(value)


class OrganizationId(PositiveIntegerValueObject):
    """
    Organization identifier value object.
    
    Represents a unique identifier for an organization.
    Must be a positive integer.
    """
    
    @classmethod
    def from_int(cls, value: int) -> "OrganizationId":
        """Create OrganizationId from integer.""" 
        return cls(value)


class TaskId(StringValueObject):
    """
    Task identifier value object.
    
    Represents a unique identifier for a task.
    Can be a UUID string or a short identifier.
    """
    
    def _validate(self, value: str) -> None:
        """Validate task ID format."""
        super()._validate(value)
        
        # Allow UUID format or short alphanumeric IDs
        if not (self._is_uuid(value) or self._is_short_id(value)):
            raise ValueError(
                f"TaskId must be a valid UUID or short alphanumeric identifier, got: {value}"
            )
    
    def _is_uuid(self, value: str) -> bool:
        """Check if value is a valid UUID."""
        try:
            uuid.UUID(value)
            return True
        except ValueError:
            return False
    
    def _is_short_id(self, value: str) -> bool:
        """Check if value is a valid short ID (alphanumeric, 3-50 chars)."""
        return bool(re.match(r'^[a-zA-Z0-9_-]{3,50}$', value))
    
    @classmethod
    def generate(cls) -> "TaskId":
        """Generate a new random task ID."""
        return cls(str(uuid.uuid4()))
    
    @classmethod
    def from_string(cls, value: str) -> "TaskId":
        """Create TaskId from string."""
        return cls(value)
    
    @property
    def short_id(self) -> str:
        """Get short version of ID (first 8 characters)."""
        return self.value[:8]


class RoleId(PositiveIntegerValueObject):
    """
    Role identifier value object.
    
    Represents a unique identifier for a user role.
    Must be a positive integer.
    """
    
    @classmethod
    def from_int(cls, value: int) -> "RoleId":
        """Create RoleId from integer."""
        return cls(value)