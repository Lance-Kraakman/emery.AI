"""Backward compat — canonical location: emery_agents.api.skill_api"""

from emery_agents.api.skill_api import (  # noqa: F401
    SkillAPIService,
    SkillData,
    _normalize_name,
)
from emery_agents.entities.workspace import WorkspaceSkill  # noqa: F401
