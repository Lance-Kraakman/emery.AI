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
        """
        Create from gRPC ContextMappingProto message.

        Proto fields:
        - table_id: int32
        - table_name: string
        - access_mode: string ("read", "write", "readwrite")
        - sync_mode: string ("on_access", "on_save", "realtime")
        - target_type: string ("agent", "skill", "skill_step")
        - target_id: string
        """
        # Parse access_mode with fallback
        access_str = getattr(proto, 'access_mode', 'read') or 'read'
        try:
            access_mode = ContextMappingAccessMode(access_str)
        except ValueError:
            access_mode = ContextMappingAccessMode.READ

        # Parse sync_mode with fallback
        sync_str = getattr(proto, 'sync_mode', 'on_access') or 'on_access'
        try:
            sync_mode = ContextMappingSyncMode(sync_str)
        except ValueError:
            sync_mode = ContextMappingSyncMode.ON_ACCESS

        # Parse target_type with fallback
        target_str = getattr(proto, 'target_type', 'agent') or 'agent'
        try:
            target_type = ContextMappingTargetType(target_str)
        except ValueError:
            target_type = ContextMappingTargetType.AGENT

        return cls(
            id=0,  # ID not sent over proto (DB-only field)
            organization_id=0,  # Not sent over proto (RLS handles this)
            target_type=target_type,
            target_id=getattr(proto, 'target_id', '') or '',
            table_id=proto.table_id,
            table_name=proto.table_name or '',
            access_mode=access_mode,
            sync_mode=sync_mode,
            is_system=False,  # Not sent over proto
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

    @classmethod
    def from_proto(cls, proto) -> "ResolvedContext":
        """
        Create from gRPC ResolvedContextProto message.

        Proto fields:
        - mappings: repeated ContextMappingProto (merged mappings)
        - agent_mappings: repeated ContextMappingProto
        - skill_mappings: repeated ContextMappingProto
        - step_mappings: repeated ContextMappingProto
        """
        if proto is None:
            return cls(
                mappings=[],
                agent_mappings=[],
                skill_mappings=[],
                step_mappings=[],
            )

        return cls(
            mappings=[ContextMapping.from_proto(m) for m in proto.mappings],
            agent_mappings=[ContextMapping.from_proto(m) for m in proto.agent_mappings],
            skill_mappings=[ContextMapping.from_proto(m) for m in proto.skill_mappings],
            step_mappings=[ContextMapping.from_proto(m) for m in proto.step_mappings],
        )

    @classmethod
    def empty(cls) -> "ResolvedContext":
        """Create an empty resolved context."""
        return cls(
            mappings=[],
            agent_mappings=[],
            skill_mappings=[],
            step_mappings=[],
        )

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
