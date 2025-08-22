"""
Tool Configuration Value Object

AIDEV-NOTE: Value object for tool configuration with validation.
Represents tool setup and parameters in a type-safe manner.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional
import re


@dataclass(frozen=True)
class ToolConfig:
    """Value object for tool configuration."""
    
    name: str
    version: Optional[str] = None
    config: Optional[Dict[str, Any]] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate tool configuration."""
        if not self.name or not self.name.strip():
            raise ValueError("Tool name cannot be empty")
        
        # Validate name format (alphanumeric, underscore, hyphen)
        name = self.name.strip()
        if not re.match(r'^[a-zA-Z0-9_\-]+$', name):
            raise ValueError(f"Tool name contains invalid characters: '{name}'")
        
        if len(name) > 100:
            raise ValueError(f"Tool name too long (max 100 chars): '{name}'")
        
        # Validate version format if provided
        if self.version is not None:
            version = self.version.strip()
            if not version:
                raise ValueError("Tool version cannot be empty string")
            
            if len(version) > 50:
                raise ValueError(f"Tool version too long (max 50 chars): '{version}'")
        
        # Validate config is dict if provided
        if self.config is not None and not isinstance(self.config, dict):
            raise TypeError(f"Tool config must be a dict, got {type(self.config)}")
    
    @property
    def normalized_name(self) -> str:
        """Get normalized tool name."""
        return self.name.strip().lower()
    
    @property
    def display_name(self) -> str:
        """Get display name with version if available."""
        if self.version:
            return f"{self.name}@{self.version}"
        return self.name
    
    def has_config(self, key: str) -> bool:
        """Check if configuration contains a specific key."""
        return self.config is not None and key in self.config
    
    def get_config_value(self, key: str, default: Any = None) -> Any:
        """Get configuration value with default."""
        if self.config is None:
            return default
        return self.config.get(key, default)
    
    def matches_name(self, name: str) -> bool:
        """Check if tool matches given name (case-insensitive)."""
        return self.normalized_name == name.strip().lower()
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ToolConfig":
        """Create ToolConfig from dictionary."""
        return cls(
            name=data["name"],
            version=data.get("version"),
            config=data.get("config", {})
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {"name": self.name}
        
        if self.version is not None:
            result["version"] = self.version
        
        if self.config:
            result["config"] = self.config
        
        return result