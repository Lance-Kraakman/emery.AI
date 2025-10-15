"""
Tool-Specific Value Objects

AIDEV-NOTE: Domain value objects for tool-related concepts.
Provides validation and type safety for tool names, versions, and configurations.
"""

import re
from typing import ClassVar
from ...shared.value_objects.base import StringValueObject


class ToolName(StringValueObject):
    """
    Tool name value object.
    
    Represents a unique identifier/name for a tool.
    Must follow naming conventions (lowercase, underscores allowed).
    """
    
    MIN_LENGTH: ClassVar[int] = 2
    MAX_LENGTH: ClassVar[int] = 50
    
    def _validate(self, value: str) -> None:
        """Validate tool name format."""
        super()._validate(value)
        
        cleaned_value = value.strip().lower()
        
        if len(cleaned_value) < self.MIN_LENGTH:
            raise ValueError(f"ToolName must be at least {self.MIN_LENGTH} characters")
        
        if len(cleaned_value) > self.MAX_LENGTH:
            raise ValueError(f"ToolName must not exceed {self.MAX_LENGTH} characters")
        
        # Tool names should be lowercase alphanumeric with underscores
        if not re.match(r'^[a-z0-9_]+$', cleaned_value):
            raise ValueError("ToolName must be lowercase alphanumeric with underscores")
        
        # Cannot start with underscore or number
        if cleaned_value[0] in '_0123456789':
            raise ValueError("ToolName cannot start with underscore or number")
        
        self._value = cleaned_value
    
    @classmethod
    def from_string(cls, value: str) -> "ToolName":
        """Create ToolName from string.""" 
        return cls(value)


class ToolVersion(StringValueObject):
    """
    Tool version value object.
    
    Represents a semantic version for a tool.
    Supports semantic versioning (x.y.z) and simple versions (x.y, x).
    """
    
    MAX_LENGTH: ClassVar[int] = 20
    
    def _validate(self, value: str) -> None:
        """Validate tool version format."""
        super()._validate(value)
        
        cleaned_value = value.strip()
        
        if len(cleaned_value) > self.MAX_LENGTH:
            raise ValueError(f"ToolVersion must not exceed {self.MAX_LENGTH} characters")
        
        # Support semantic versioning patterns
        semver_patterns = [
            r'^\d+\.\d+\.\d+$',  # x.y.z
            r'^\d+\.\d+$',       # x.y  
            r'^\d+$',            # x
            r'^\d+\.\d+\.\d+-[a-z0-9]+$',  # x.y.z-alpha
            r'^v\d+\.\d+\.\d+$', # vx.y.z
        ]
        
        is_valid = any(re.match(pattern, cleaned_value) for pattern in semver_patterns)
        
        if not is_valid:
            raise ValueError(
                f"ToolVersion must follow semantic versioning (e.g., '1.0.0', '2.1', '1'), got: {cleaned_value}"
            )
        
        self._value = cleaned_value
    
    @classmethod
    def from_string(cls, value: str) -> "ToolVersion":
        """Create ToolVersion from string."""
        return cls(value)
    
    @classmethod
    def default(cls) -> "ToolVersion":
        """Create default version (1.0)."""
        return cls("1.0")
    
    @property
    def major(self) -> int:
        """Get major version number."""
        # Remove 'v' prefix if present
        version_str = self._value[1:] if self._value.startswith('v') else self._value
        # Get first number before dot or dash
        major_str = version_str.split('.')[0].split('-')[0]
        return int(major_str)
    
    @property
    def is_prerelease(self) -> bool:
        """Check if this is a prerelease version."""
        return '-' in self._value