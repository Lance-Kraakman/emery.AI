"""
Output Mapping Entities

AIDEV-NOTE: Redesigned for multi-table output mapping with typed references (2025-01)
Supports ordered table operations with cross-table references for relations.
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Literal

logger = logging.getLogger(__name__)


class OutputMappingMode(str, Enum):
    """Mode for output mapping."""

    SINGLE_ROW = "single_row"  # Map to one row (e.g., top classification result)
    MULTI_ROW = "multi_row"  # Create row per array item (e.g., object detections)


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

    type: Literal["skill_output", "skill_input", "table_ref"]
    name: str | None = None  # For skill_output and skill_input types
    order: int | None = None  # For table_ref type
    field: str | None = None  # For table_ref type


@dataclass
class RowIdSource:
    """Source for row ID in update mode - determines which row to update."""

    type: Literal["static", "skill_input", "skill_output", "table_ref", "source_row"]
    static_id: str | None = None
    skill_input: str | None = None
    skill_output: str | None = None
    table_ref_order: int | None = None
    table_ref_field: str | None = None


@dataclass
class FieldMapping:
    """Maps a typed source to a target table field."""

    source: FieldSource
    target_field_id: int  # Destination field/column
    append_mode: bool = (
        False  # When true, append to existing relation values instead of replacing
    )
    target_field_type: str | None = (
        None  # Field type (e.g., 'relation', 'text', 'number')
    )


@dataclass
class TableMapping:
    """Ordered operation for a single table."""

    order: int  # Execution order (1, 2, 3...)
    target_table_id: int  # Which table to write to
    row_action: RowAction  # Create or update
    row_id_source: RowIdSource | None = (
        None  # For update mode - typed source for row ID
    )
    mappings: list[FieldMapping] = field(
        default_factory=list
    )  # Field mappings for this table
    display_field_id: int | None = None  # Field to use for relation display value
    mode: str | None = None  # Per-table mode: 'single_row' or 'multi_row'


@dataclass
class TableMappingResult:
    """Result of a table mapping operation."""

    order: int
    table_id: int
    row_id: str
    row_data: dict[str, Any]  # Created/updated field values (field_id → value)


@dataclass
class OutputMappingConfig:
    """Configuration for multi-table output mapping."""

    mode: OutputMappingMode
    table_mappings: list[TableMapping] = field(default_factory=list)

    @property
    def is_single_row(self) -> bool:
        return self.mode == OutputMappingMode.SINGLE_ROW

    @property
    def is_multi_row(self) -> bool:
        return self.mode == OutputMappingMode.MULTI_ROW

    def get_target_table_ids(self) -> list[int]:
        """Get all target table IDs from table mappings."""
        return [tm.target_table_id for tm in self.table_mappings]


def extract_field_value(
    data: Any, field_path: str, context: dict[str, Any] | None = None
) -> Any:
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
    if field_path.startswith("source."):
        source_field = field_path[7:]  # Remove "source."
        if context and "source" in context:
            return context["source"].get(source_field)
        return None

    # Handle nested field paths like "box.xmin"
    parts = field_path.split(".")
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
MIME_EXTENSIONS: dict[str, str] = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "application/pdf": "pdf",
    "application/json": "json",
    "text/plain": "txt",
}


def get_extension_for_mime(mime_type: str) -> str:
    """Get file extension for a MIME type."""
    return MIME_EXTENSIONS.get(mime_type, "bin")
