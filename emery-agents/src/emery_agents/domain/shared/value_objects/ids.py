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


class UserId(StringValueObject):
    """
    User identifier value object.
    
    Represents a unique identifier for a user.
    Can be a UUID, email, or other unique string identifier.
    """
    
    def _validate(self, value: str) -> None:
        """Validate user ID format."""
        super()._validate(value)
        
        # User IDs must be at least 3 characters
        if len(value) < 3:
            raise ValueError(f"UserId must be at least 3 characters, got: {value}")
        
        # Max length for database compatibility
        if len(value) > 255:
            raise ValueError(f"UserId must not exceed 255 characters, got length: {len(value)}")
    
    @classmethod
    def from_string(cls, value: str) -> "UserId":
        """Create UserId from string."""
        return cls(value)
    
    @classmethod
    def from_email(cls, email: str) -> "UserId":
        """Create UserId from email address."""
        # Basic email validation
        if '@' not in email:
            raise ValueError(f"Invalid email format for UserId: {email}")
        return cls(email)


class OwnerId(UserId):
    """
    Owner identifier value object.
    
    Represents the owner of a resource (agent, task, etc.).
    Inherits from UserId as owners are users.
    """
    
    @classmethod
    def from_user_id(cls, user_id: UserId) -> "OwnerId":
        """Create OwnerId from UserId."""
        return cls(user_id.value)


class DatabaseId(StringValueObject):
    """
    Database identifier value object.
    
    Represents a unique identifier for a database or table.
    Must follow database naming conventions.
    """
    
    def _validate(self, value: str) -> None:
        """Validate database ID format."""
        super()._validate(value)
        
        # Database IDs should follow naming conventions
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]{2,63}$', value):
            raise ValueError(
                f"DatabaseId must start with a letter and contain only "
                f"alphanumeric characters and underscores (3-64 chars), got: {value}"
            )
    
    @classmethod
    def from_string(cls, value: str) -> "DatabaseId":
        """Create DatabaseId from string."""
        return cls(value)
    
    @classmethod
    def generate_for_table(cls, table_name: str) -> "DatabaseId":
        """Generate a database ID for a table."""
        # Sanitize table name for database ID
        sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', table_name.lower())
        if not sanitized[0].isalpha():
            sanitized = 't_' + sanitized
        return cls(sanitized[:64])  # Limit to 64 chars