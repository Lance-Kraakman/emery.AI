"""
Skills Module

Skill permission validation.

NOTE: Skill execution now handled by services.executors.router.ExecutionRouter.
"""

from .validator import (
    SkillPermissions,
    SkillPermissionValidator,
    create_validator_from_skills,
)

__all__ = [
    # Validator (lightweight, safe to eagerly import)
    "SkillPermissions",
    "SkillPermissionValidator",
    "create_validator_from_skills",
]
