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
    """Typed source for a field value - skill output, skill input, or table reference."""
    type: Literal['skill_output', 'skill_input', 'table_ref']
    name: Optional[str] = None      # For skill_output and skill_input types
    order: Optional[int] = None     # For table_ref type
    field: Optional[str] = None     # For table_ref type

    @classmethod
    def from_proto(cls, proto_source) -> Optional['FieldSource']:
        """Create from protobuf FieldSource.

        Returns None if no valid source is set (e.g., legacy data or empty mapping).
        """
        # Check which oneof field is set
        which_source = proto_source.WhichOneof('source')

        if which_source == 'skill_output':
            return cls(type='skill_output', name=proto_source.skill_output)
        elif which_source == 'skill_input':
            return cls(type='skill_input', name=proto_source.skill_input)
        elif which_source == 'table_ref':
            return cls(
                type='table_ref',
                order=proto_source.table_ref.order,
                field=proto_source.table_ref.field
            )
        else:
            # No valid source set - return None (caller should skip this mapping)
            logger.warning(f"FieldSource has no valid source type set: {which_source}")
            return None


@dataclass
class RowIdSource:
    """Source for row ID in update mode - determines which row to update."""
    type: Literal['static', 'skill_input', 'skill_output', 'table_ref', 'source_row']
    static_id: Optional[str] = None
    skill_input: Optional[str] = None
    skill_output: Optional[str] = None
    table_ref_order: Optional[int] = None
    table_ref_field: Optional[str] = None

    @classmethod
    def from_proto(cls, proto_source) -> 'RowIdSource':
        """Create from protobuf RowIdSource."""
        which_source = proto_source.WhichOneof('source')

        if which_source == 'static_id':
            return cls(type='static', static_id=proto_source.static_id)
        elif which_source == 'skill_input':
            return cls(type='skill_input', skill_input=proto_source.skill_input)
        elif which_source == 'skill_output':
            return cls(type='skill_output', skill_output=proto_source.skill_output)
        elif which_source == 'table_ref':
            return cls(
                type='table_ref',
                table_ref_order=proto_source.table_ref.order,
                table_ref_field=proto_source.table_ref.field
            )
        elif which_source == 'use_source_row':
            return cls(type='source_row')
        else:
            raise ValueError(f"RowIdSource must have a valid source, got: {which_source}")


@dataclass
class FieldMapping:
    """Maps a typed source to a target table field."""
    source: FieldSource
    target_field_id: int    # Destination field/column
    append_mode: bool = False  # When true, append to existing relation values instead of replacing
    target_field_type: Optional[str] = None  # Field type (e.g., 'relation', 'text', 'number')

    @classmethod
    def from_proto(cls, proto_mapping) -> Optional['FieldMapping']:
        """Create from protobuf FieldMapping.

        Returns None if the source is invalid (caller should skip this mapping).
        """
        source = FieldSource.from_proto(proto_mapping.source)
        if source is None:
            logger.warning(f"Skipping FieldMapping with invalid source for field {proto_mapping.target_field_id}")
            return None

        # Extract target field type from metadata if available
        target_field_type = None
        if proto_mapping.HasField('target_field_metadata'):
            target_field_type = proto_mapping.target_field_metadata.field_type or None

        return cls(
            source=source,
            target_field_id=proto_mapping.target_field_id,
            append_mode=proto_mapping.append_mode,
            target_field_type=target_field_type
        )


@dataclass
class TableMapping:
    """Ordered operation for a single table."""
    order: int                          # Execution order (1, 2, 3...)
    target_table_id: int                # Which table to write to
    row_action: RowAction               # Create or update
    row_id_source: Optional[RowIdSource] = None  # For update mode - typed source for row ID
    mappings: List[FieldMapping] = field(default_factory=list)  # Field mappings for this table
    display_field_id: Optional[int] = None  # Field to use for relation display value
    mode: Optional[str] = None          # Per-table mode: 'single_row' or 'multi_row'

    @classmethod
    def from_proto(cls, proto_mapping) -> 'TableMapping':
        """Create from protobuf TableMapping."""
        row_id_source = None
        if proto_mapping.HasField('row_id_source'):
            row_id_source = RowIdSource.from_proto(proto_mapping.row_id_source)

        # Filter out mappings with invalid sources
        valid_mappings = [
            m for m in (FieldMapping.from_proto(pm) for pm in proto_mapping.mappings)
            if m is not None
        ]

        return cls(
            order=proto_mapping.order,
            target_table_id=proto_mapping.target_table_id,
            row_action=RowAction(proto_mapping.row_action or 'create'),
            row_id_source=row_id_source,
            mappings=valid_mappings,
            display_field_id=proto_mapping.display_field_id if proto_mapping.display_field_id else None,
            mode=proto_mapping.mode if proto_mapping.mode else None
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


def build_row_data_from_item(
    item: Any,
    mappings: List[FieldMapping],
    context: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Build row data from a result item using typed field mappings.

    This is for code paths that have raw data items (e.g., task results)
    instead of typed SkillInputValue/SkillOutputValue lists.

    Args:
        item: The result item (dict) to extract values from
        mappings: List of field mappings with typed sources
        context: Additional context (e.g., {'inputs': {...}} for skill inputs)

    Returns:
        Dict mapping field_id (as string) to extracted value
    """
    row_data: Dict[str, Any] = {}

    for mapping in mappings:
        if not mapping.source:
            continue

        source = mapping.source
        value = None

        if source.type == 'skill_output':
            # Extract from item using source.name as field path
            value = extract_field_value(item, source.name, context)

        elif source.type == 'skill_input':
            # Get from context inputs if available
            if context and 'inputs' in context:
                inputs = context.get('inputs', {})
                value = inputs.get(source.name)

        # table_ref type not supported in legacy code paths - needs previous results

        if value is not None:
            row_data[str(mapping.target_field_id)] = value

    return row_data
