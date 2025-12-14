"""
Output Mapping Entities

AIDEV-NOTE: Redesigned for path-based field mapping (2025-01)
Supports single-row (classification) and multi-row (object detection) mapping modes.
Maps structured model outputs (label, score, box.xmin, etc.) to table fields.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class OutputMappingMode(str, Enum):
    """Mode for output mapping."""
    SINGLE_ROW = "single_row"  # Map to one row (e.g., top classification result)
    MULTI_ROW = "multi_row"    # Create row per array item (e.g., object detections)


class RowAction(str, Enum):
    """Action for single-row mode."""
    CREATE = "create"
    UPDATE = "update"


@dataclass
class FieldMapping:
    """Maps a source output field to a target table field."""
    source_field: str       # e.g., "label", "score", "box.xmin", "source.rowId"
    target_table_id: int    # Destination table
    target_field_id: int    # Destination field/column

    @classmethod
    def from_proto(cls, proto_mapping) -> 'FieldMapping':
        """Create from protobuf FieldMapping."""
        return cls(
            source_field=proto_mapping.source_field,
            target_table_id=proto_mapping.target_table_id,
            target_field_id=proto_mapping.target_field_id
        )


@dataclass
class OutputMappingConfig:
    """Configuration for path-based output mapping."""
    mode: OutputMappingMode
    row_action: RowAction = RowAction.CREATE  # For single_row mode
    row_id: Optional[str] = None              # For update mode
    mappings: List[FieldMapping] = field(default_factory=list)

    @classmethod
    def from_proto(cls, proto_config) -> 'OutputMappingConfig':
        """Create from protobuf OutputMappingConfig."""
        mode = OutputMappingMode(proto_config.mode or 'single_row')
        row_action = RowAction(proto_config.row_action or 'create')

        mappings = [
            FieldMapping.from_proto(m)
            for m in proto_config.mappings
        ]

        return cls(
            mode=mode,
            row_action=row_action,
            row_id=proto_config.row_id if proto_config.row_id else None,
            mappings=mappings
        )

    @property
    def is_single_row(self) -> bool:
        return self.mode == OutputMappingMode.SINGLE_ROW

    @property
    def is_multi_row(self) -> bool:
        return self.mode == OutputMappingMode.MULTI_ROW

    @property
    def is_create(self) -> bool:
        return self.row_action == RowAction.CREATE

    @property
    def is_update(self) -> bool:
        return self.row_action == RowAction.UPDATE

    def get_target_table_id(self) -> Optional[int]:
        """Get the target table ID from the first mapping."""
        if self.mappings:
            return self.mappings[0].target_table_id
        return None


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
