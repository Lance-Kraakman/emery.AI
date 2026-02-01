"""
Skill Permission Validator - Validates skill execution against whitelist.

AIDEV-NOTE: This validator ensures that user-defined agents can only execute
skills that are explicitly assigned to them. This prevents:

1. Agent escaping its allowed skill set
2. Skill executor callback being used to run arbitrary skills
3. Privilege escalation via skill invocation

The validator is created with a whitelist of allowed skill IDs extracted
from the agent's configuration, and blocks any skill not in that list.
"""

import logging
from typing import Set, Optional
from dataclasses import dataclass, field

from ..agents.api import SkillData

logger = logging.getLogger(__name__)


@dataclass
class SkillPermissions:
    """
    Permission configuration for skill execution.

    Attributes:
        allowed_skill_ids: Set of skill IDs this agent is allowed to execute
        agent_id: The agent ID for logging/audit purposes
    """
    allowed_skill_ids: Set[int] = field(default_factory=set)
    agent_id: Optional[int] = None


class SkillPermissionValidator:
    """
    Validates skill execution against a whitelist.

    Usage:
        permissions = SkillPermissions(
            allowed_skill_ids={1, 2, 3},
            agent_id=42
        )
        validator = SkillPermissionValidator(permissions)

        # Validate before execution
        validator.validate_execution(skill_id=1, skill_name="send_email")  # OK
        validator.validate_execution(skill_id=99, skill_name="hack")  # Raises PermissionError
    """

    def __init__(self, permissions: SkillPermissions):
        """
        Initialize validator with permission configuration.

        Args:
            permissions: SkillPermissions defining allowed skills
        """
        self._permissions = permissions
        logger.debug(
            f"[SKILL-VALIDATOR] Initialized with {len(permissions.allowed_skill_ids)} "
            f"allowed skills for agent {permissions.agent_id}"
        )

    @property
    def allowed_skill_ids(self) -> Set[int]:
        """Get the set of allowed skill IDs."""
        return self._permissions.allowed_skill_ids

    @property
    def agent_id(self) -> Optional[int]:
        """Get the agent ID."""
        return self._permissions.agent_id

    def is_allowed(self, skill_id: int) -> bool:
        """
        Check if a skill ID is in the allowed set.

        Args:
            skill_id: The skill ID to check

        Returns:
            True if skill is allowed, False otherwise
        """
        return skill_id in self._permissions.allowed_skill_ids

    def validate_execution(self, skill_id: int, skill_name: str) -> None:
        """
        Validate that a skill can be executed by this agent.

        Args:
            skill_id: The numeric skill ID
            skill_name: The skill name (for error messages)

        Raises:
            PermissionError: If skill is not in the allowed set
        """
        if skill_id not in self._permissions.allowed_skill_ids:
            logger.warning(
                f"[SECURITY] Blocked unauthorized skill execution: "
                f"skill_id={skill_id}, skill_name='{skill_name}', "
                f"agent_id={self._permissions.agent_id}, "
                f"allowed_skills={self._permissions.allowed_skill_ids}"
            )
            raise PermissionError(
                f"Skill '{skill_name}' (id={skill_id}) is not authorized for this agent. "
                f"Only skills assigned to this agent can be executed."
            )

        logger.debug(
            f"[SKILL-VALIDATOR] Allowed skill execution: "
            f"skill_id={skill_id}, skill_name='{skill_name}'"
        )


def create_validator_from_skills(
    skills: list[SkillData],
    agent_id: Optional[int] = None
) -> SkillPermissionValidator:
    """
    Create a validator from a list of SkillData.

    Args:
        skills: List of SkillData objects
        agent_id: Optional agent ID for logging

    Returns:
        SkillPermissionValidator configured with skill IDs
    """
    skill_ids: Set[int] = set()
    for skill in skills:
        try:
            skill_ids.add(int(skill.id))
        except (ValueError, TypeError):
            logger.warning(f"[SKILL-VALIDATOR] Invalid skill ID: {skill.id}")

    permissions = SkillPermissions(
        allowed_skill_ids=skill_ids,
        agent_id=agent_id,
    )

    return SkillPermissionValidator(permissions)
