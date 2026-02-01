"""Backward compat — canonical location: emery_agents.api.agent_api"""

from emery_agents.api.agent_api import (  # noqa: F401
    AgentAPIService,
    AgentData,
    SkillData,
    fetch_agent_by_id_sync,
)
from emery_agents.entities.workspace import WorkspaceAgent, WorkspaceSkill  # noqa: F401
