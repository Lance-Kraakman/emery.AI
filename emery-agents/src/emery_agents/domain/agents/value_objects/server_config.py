"""
Server Configuration Value Object

AIDEV-NOTE: Value object for MCP server configuration.
Represents server setup and connection parameters.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, Optional
import re
from urllib.parse import urlparse


@dataclass(frozen=True)
class ServerConfig:
    """Value object for server configuration."""
    
    name: str
    endpoint: Optional[str] = None
    config: Optional[Dict[str, Any]] = field(default_factory=dict)
    
    def __post_init__(self):
        """Validate server configuration."""
        if not self.name or not self.name.strip():
            raise ValueError("Server name cannot be empty")
        
        # Validate name format (alphanumeric, underscore, hyphen)
        name = self.name.strip()
        if not re.match(r'^[a-zA-Z0-9_\-]+$', name):
            raise ValueError(f"Server name contains invalid characters: '{name}'")
        
        if len(name) > 100:
            raise ValueError(f"Server name too long (max 100 chars): '{name}'")
        
        # Validate endpoint URL if provided
        if self.endpoint is not None:
            endpoint = self.endpoint.strip()
            if not endpoint:
                raise ValueError("Server endpoint cannot be empty string")
            
            # Basic URL validation
            try:
                parsed = urlparse(endpoint)
                if not parsed.scheme or not parsed.netloc:
                    raise ValueError(f"Invalid server endpoint URL: '{endpoint}'")
            except Exception as e:
                raise ValueError(f"Invalid server endpoint URL: '{endpoint}' - {e}")
        
        # Validate config is dict if provided
        if self.config is not None and not isinstance(self.config, dict):
            raise TypeError(f"Server config must be a dict, got {type(self.config)}")
    
    @property
    def normalized_name(self) -> str:
        """Get normalized server name."""
        return self.name.strip().lower()
    
    @property
    def display_name(self) -> str:
        """Get display name with endpoint if available."""
        if self.endpoint:
            return f"{self.name} ({self.endpoint})"
        return self.name
    
    @property
    def is_remote(self) -> bool:
        """Check if server has a remote endpoint."""
        return self.endpoint is not None and self.endpoint.strip() != ""
    
    def has_config(self, key: str) -> bool:
        """Check if configuration contains a specific key."""
        return self.config is not None and key in self.config
    
    def get_config_value(self, key: str, default: Any = None) -> Any:
        """Get configuration value with default."""
        if self.config is None:
            return default
        return self.config.get(key, default)
    
    def matches_name(self, name: str) -> bool:
        """Check if server matches given name (case-insensitive)."""
        return self.normalized_name == name.strip().lower()
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ServerConfig":
        """Create ServerConfig from dictionary."""
        return cls(
            name=data["name"],
            endpoint=data.get("endpoint"),
            config=data.get("config", {})
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        result = {"name": self.name}
        
        if self.endpoint is not None:
            result["endpoint"] = self.endpoint
        
        if self.config:
            result["config"] = self.config
        
        return result