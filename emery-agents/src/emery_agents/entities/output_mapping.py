"""
Output Mapping Entities

AIDEV-NOTE: Redesigned for multi-table output mapping with typed references (2025-01)
Supports ordered table operations with cross-table references for relations.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class OutputMappingMode(str, Enum):
    """Mode for output mapping."""
    SINGLE_ROW = "single_row"  # Map to one row (e.g., top classification result)
    MULTI_ROW = "multi_row"    # Create row per array item (e.g., object detections)


class RowAction(str, Enum):
    """Action for row operations."""
    CREATE = "create"
    UPDATE = "update"


# =============================================================================
# Multi-Table Output Mapping Types (typed references, no string parsing)
# =============================================================================

@dataclass
class FieldSource:
    """Typed source for a field value - either skill output or table reference."""
    type: Literal['skill_output', 'table_ref']
    name: Optional[str] = None      # For skill_output type
    order: Optional[int] = None     # For table_ref type
    field: Optional[str] = None     # For table_ref type

    @classmethod
    def from_proto(cls, proto_source) -> 'FieldSource':
        """Create from protobuf FieldSource."""
        # Check which oneof field is set
        which_source = proto_source.WhichOneof('source')

        if which_source == 'skill_output':
            return cls(type='skill_output', name=proto_source.skill_output)
        elif which_source == 'table_ref':
            return cls(
                type='table_ref',
                order=proto_source.table_ref.order,
                field=proto_source.table_ref.field
            )
        else:
            raise ValueError(f"FieldSource must have skill_output or table_ref, got: {which_source}")


@dataclass
class FieldMapping:
    """Maps a typed source to a target table field."""
    source: FieldSource
    target_field_id: int    # Destination field/column
    append_mode: bool = False  # When true, append to existing relation values instead of replacing

    @classmethod
    def from_proto(cls, proto_mapping) -> 'FieldMapping':
        """Create from protobuf FieldMapping."""
        return cls(
            source=FieldSource.from_proto(proto_mapping.source),
            target_field_id=proto_mapping.target_field_id,
            append_mode=proto_mapping.append_mode
        )


@dataclass
class TableMapping:
    """Ordered operation for a single table."""
    order: int                          # Execution order (1, 2, 3...)
    target_table_id: int                # Which table to write to
    row_action: RowAction               # Create or update
    row_id: Optional[str]               # For update mode - specific row ID
    mappings: List[FieldMapping]        # Field mappings for this table
    display_field_id: Optional[int] = None  # Field to use for relation display value

    @classmethod
    def from_proto(cls, proto_mapping) -> 'TableMapping':
        """Create from protobuf TableMapping."""
        return cls(
            order=proto_mapping.order,
            target_table_id=proto_mapping.target_table_id,
            row_action=RowAction(proto_mapping.row_action or 'create'),
            row_id=proto_mapping.row_id if proto_mapping.row_id else None,
            mappings=[FieldMapping.from_proto(m) for m in proto_mapping.mappings],
            display_field_id=proto_mapping.display_field_id if proto_mapping.display_field_id else None
        )


@dataclass
class TableMappingResult:
    """Result of a table mapping operation."""
    order: int
    table_id: int
    row_id: str
    row_data: Dict[str, Any]  # Created/updated field values (field_id → value)


@dataclass
class OutputMappingConfig:
    """Configuration for multi-table output mapping."""
    mode: OutputMappingMode
    table_mappings: List[TableMapping] = field(default_factory=list)

    @classmethod
    def from_proto(cls, proto_config) -> 'OutputMappingConfig':
        """Create from protobuf OutputMappingConfig."""
        mode = OutputMappingMode(proto_config.mode or 'single_row')

        table_mappings = [
            TableMapping.from_proto(tm)
            for tm in proto_config.table_mappings
        ]

        return cls(
            mode=mode,
            table_mappings=table_mappings
        )

    @property
    def is_single_row(self) -> bool:
        return self.mode == OutputMappingMode.SINGLE_ROW

    @property
    def is_multi_row(self) -> bool:
        return self.mode == OutputMappingMode.MULTI_ROW

    def get_target_table_ids(self) -> List[int]:
        """Get all target table IDs from table mappings."""
        return [tm.target_table_id for tm in self.table_mappings]


def extract_field_value(data: Any, field_path: str, context: Optional[Dict[str, Any]] = None) -> Any:
    """
    Extract value from result data using field path.

    Args:
        data: The result item (current array item in multi_row, or first item in single_row)
        field_path: Field path like "label", "score", "box.xmin", "source.rowId"
        context: Additional context like {"source": {"rowId": "..."}}

    Returns:
        Extracted value or None if path not found
    """
    # Handle special source fields (for linking back to source row)
    if field_path.startswith('source.'):
        source_field = field_path[7:]  # Remove "source."
        if context and 'source' in context:
            return context['source'].get(source_field)
        return None

    # Handle nested field paths like "box.xmin"
    parts = field_path.split('.')
    value = data

    for part in parts:
        if value is None:
            return None
        if isinstance(value, dict):
            value = value.get(part)
        else:
            # Try attribute access for objects
            try:
                value = getattr(value, part, None)
            except (AttributeError, TypeError):
                return None

    return value


def build_row_data(
    item: Any,
    mappings: List[FieldMapping],
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Build row data dict from mappings.

    Args:
        item: The data item to extract values from
        mappings: List of field mappings
        context: Additional context (source row info, etc.)

    Returns:
        Dict mapping field_id (as string) to extracted value
    """
    row_data: Dict[str, Any] = {}

    for mapping in mappings:
        value = extract_field_value(item, mapping.source_field, context)
        if value is not None:
            row_data[str(mapping.target_field_id)] = value
            logger.debug(f"Mapped {mapping.source_field} -> field {mapping.target_field_id}: {value}")
        else:
            logger.debug(f"No value found for {mapping.source_field}")

    return row_data


# MIME type to file extension mapping (unchanged)
MIME_EXTENSIONS: Dict[str, str] = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/flac': 'flac',
    'video/mp4': 'mp4', 'video/webm': 'webm',
    'application/pdf': 'pdf', 'application/json': 'json', 'text/plain': 'txt',
}


def get_extension_for_mime(mime_type: str) -> str:
    """Get file extension for a MIME type."""
    return MIME_EXTENSIONS.get(mime_type, 'bin')
