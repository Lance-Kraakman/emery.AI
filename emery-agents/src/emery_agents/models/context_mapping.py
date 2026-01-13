"""
Context Mapping Models

Represents a table attached to an agent/skill/step for Context Sync.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional


class ContextMappingTargetType(str, Enum):
    """Target type for context mapping."""
    AGENT = "agent"
    SKILL = "skill"
    SKILL_STEP = "skill_step"


class ContextMappingAccessMode(str, Enum):
    """Access mode for context tables."""
    READ = "read"
    WRITE = "write"
    READWRITE = "readwrite"


class ContextMappingSyncMode(str, Enum):
    """Sync mode for context tables."""
    ON_ACCESS = "on_access"
    ON_SAVE = "on_save"
    REALTIME = "realtime"


@dataclass
class ContextMapping:
    """
    Represents a table attached to an agent, skill, or skill step.

    Context mappings define which dynamic tables are available
    to an agent during execution, along with access permissions.
    """
    id: int
    organization_id: int
    target_type: ContextMappingTargetType
    target_id: str  # ID as string (supports UUID for steps)
    table_id: int
    table_name: str
    access_mode: ContextMappingAccessMode
    sync_mode: ContextMappingSyncMode
    is_system: bool

    @classmethod
    def from_proto(cls, proto) -> "ContextMapping":
        """Create from gRPC proto message."""
        return cls(
            id=proto.id,
            organization_id=getattr(proto, 'organization_id', 0),
            target_type=ContextMappingTargetType(getattr(proto, 'target_type', 'agent')),
            target_id=getattr(proto, 'target_id', ''),
            table_id=proto.table_id,
            table_name=proto.table_name,
            access_mode=ContextMappingAccessMode(proto.access_mode),
            sync_mode=ContextMappingSyncMode(proto.sync_mode),
            is_system=proto.is_system,
        )

    def can_read(self) -> bool:
        """Check if this mapping allows read access."""
        return self.access_mode in (
            ContextMappingAccessMode.READ,
            ContextMappingAccessMode.READWRITE
        )

    def can_write(self) -> bool:
        """Check if this mapping allows write access."""
        return self.access_mode in (
            ContextMappingAccessMode.WRITE,
            ContextMappingAccessMode.READWRITE
        )

    def should_sync_on_access(self) -> bool:
        """Check if table should be synced when execution starts."""
        return self.sync_mode == ContextMappingSyncMode.ON_ACCESS

    def should_sync_on_save(self) -> bool:
        """Check if table should be synced when execution completes."""
        return self.sync_mode == ContextMappingSyncMode.ON_SAVE


@dataclass
class ResolvedContext:
    """
    Result of resolving context for execution.

    Contains merged mappings respecting hierarchy: agent -> skill -> step
    """
    mappings: list  # List[ContextMapping]
    agent_mappings: list  # Original agent-level mappings
    skill_mappings: list  # Original skill-level mappings
    step_mappings: list  # Original step-level mappings

    def get_read_tables(self) -> list:
        """Get all tables with read access."""
        return [m for m in self.mappings if m.can_read()]

    def get_write_tables(self) -> list:
        """Get all tables with write access."""
        return [m for m in self.mappings if m.can_write()]

    def get_mapping_by_table_id(self, table_id: int) -> Optional[ContextMapping]:
        """Get mapping for a specific table ID."""
        for m in self.mappings:
            if m.table_id == table_id:
                return m
        return None

    def get_mapping_by_table_name(self, table_name: str) -> Optional[ContextMapping]:
        """Get mapping for a specific table name."""
        for m in self.mappings:
            if m.table_name.lower() == table_name.lower():
                return m
        return None
