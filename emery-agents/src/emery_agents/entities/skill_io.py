"""
Skill Input/Output Runtime Entities

Typed dataclasses for runtime skill input/output values.
"""

from dataclasses import dataclass
from typing import Any, List, Optional


@dataclass
class SkillInputValue:
    """A single skill input value at runtime."""
    name: str
    value: Any
    value_type: Optional[str] = None  # 'text', 'number', 'file', etc.


@dataclass
class SkillOutputValue:
    """A single skill output value at runtime."""
    name: str
    value: Any
    value_type: Optional[str] = None


@dataclass
class RowMappingContext:
    """Context for row mapping operations."""
    source_row_id: Optional[str] = None
    item_index: Optional[int] = None
    current_item: Any = None
