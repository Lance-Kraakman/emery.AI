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


@dataclass
class RowIdSource:
    """Source for row ID in update mode - determines which row to update."""
    type: Literal['static', 'skill_input', 'skill_output', 'table_ref', 'source_row']
    static_id: Optional[str] = None
    skill_input: Optional[str] = None
    skill_output: Optional[str] = None
    table_ref_order: Optional[int] = None
    table_ref_field: Optional[str] = None


@dataclass
class FieldMapping:
    """Maps a typed source to a target table field."""
    source: FieldSource
    target_field_id: int    # Destination field/column
    append_mode: bool = False  # When true, append to existing relation values instead of replacing
    target_field_type: Optional[str] = None  # Field type (e.g., 'relation', 'text', 'number')


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
