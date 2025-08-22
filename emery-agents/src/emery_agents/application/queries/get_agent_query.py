"""
Get Agent Query

AIDEV-NOTE: Query object for agent retrieval operations.
Follows CQRS pattern separating reads from writes.
"""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class GetAgentQuery:
    """Query for retrieving agent information."""
    
    agent_id: int
    
    def __post_init__(self):
        """Validate query parameters."""
        if self.agent_id <= 0:
            raise ValueError("Agent ID must be positive")


@dataclass(frozen=True)
class GetAgentsByOrganizationQuery:
    """Query for retrieving agents by organization."""
    
    organization_id: int
    active_only: bool = False
    
    def __post_init__(self):
        """Validate query parameters."""
        if self.organization_id <= 0:
            raise ValueError("Organization ID must be positive")


@dataclass(frozen=True)
class GetAgentsByOwnerQuery:
    """Query for retrieving agents by owner."""
    
    owner_id: str
    
    def __post_init__(self):
        """Validate query parameters."""
        if not self.owner_id or not self.owner_id.strip():
            raise ValueError("Owner ID cannot be empty")