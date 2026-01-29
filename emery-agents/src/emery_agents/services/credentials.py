"""
Shared Credentials Module.

Centralized credential types used across task execution and skill execution.

AIDEV-NOTE: Consolidated from duplicate definitions in:
- services/tasks/task_executor.py
- services/skills/execution_service.py
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

logger = logging.getLogger(__name__)


CredentialSource = Literal["user", "agent", "context"]


@dataclass
class ResolvedCredentials:
    """
    Credentials resolved for task/skill execution.

    Source indicates where credentials came from:
    - "user": Org-level task using invoking user's credentials
    - "agent": Agent task using agent's stored credentials
    - "context": Inherited from current execution context
    """

    api_key: str
    organization_id: int
    source: CredentialSource

    def __post_init__(self) -> None:
        if not self.api_key:
            logger.warning("ResolvedCredentials created with empty api_key")
