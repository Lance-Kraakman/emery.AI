"""
Skill Definition Models

Dataclasses for skill input/output definitions.
Used in plan generation templates.
"""

from dataclasses import dataclass
from typing import Any, Dict


@dataclass
class SkillInputDefinition:
    """Definition of a skill input variable."""

    name: str
    type: str = "text"
    required: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for Jinja template."""
        return {
            "name": self.name,
            "type": self.type,
            "required": self.required,
        }


@dataclass
class SkillOutputDefinition:
    """Definition of a skill output variable."""

    name: str
    type: str = "text"

    def to_dict(self) -> Dict[str, str]:
        """Convert to dict for Jinja template."""
        return {
            "name": self.name,
            "type": self.type,
        }
