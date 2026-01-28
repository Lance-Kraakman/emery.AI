"""Typed Skill API - shared by tools and services."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ..http_client import make_request

logger = logging.getLogger(__name__)


@dataclass
class Skill:
    """Skill entity."""

    id: int
    name: str
    description: str = ""
    agent_id: Optional[int] = None
    is_system: bool = False


class SkillAPI:
    """Typed API for skill operations.

    Usage:
        api = SkillAPI(api_key, org_id)
        skills = api.list()
        skills = api.list(agent_id=123)
        skill = api.get(456)
    """

    def __init__(self, api_key: str, org_id: str):
        self._api_key = api_key
        self._org_id = org_id

    @staticmethod
    def _unwrap_entity(result: str) -> Optional[Dict[str, Any]]:
        """Unwrap entity from API envelope {"success": true, "data": {...}}."""
        try:
            parsed = json.loads(result)
            if isinstance(parsed, dict) and "data" in parsed:
                return parsed["data"]  # type: ignore[no-any-return]
            return parsed  # type: ignore[no-any-return]
        except (json.JSONDecodeError, TypeError):
            return None

    def list(
        self,
        agent_id: Optional[int] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Skill]:
        """List skills, optionally filtered by agent.

        Args:
            agent_id: Optional agent ID to filter by
            filters: Optional additional filter criteria

        Returns:
            List of Skill objects
        """
        endpoint = "skills"
        params = []

        if agent_id is not None:
            params.append(f"agent_id={agent_id}")
        if filters:
            params.extend(f"{key}={value}" for key, value in filters.items())
        if params:
            endpoint += "?" + "&".join(params)

        result = make_request(
            endpoint=endpoint,
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            logger.debug(f"Skill list failed: {result}")
            return []

        try:
            data = json.loads(result)
            return [
                Skill(
                    id=skill["id"],
                    name=skill.get("name", ""),
                    description=skill.get("description", ""),
                    agent_id=skill.get("agentId"),
                    is_system=skill.get("isSystem", False),
                )
                for skill in data.get("data", [])
            ]
        except (json.JSONDecodeError, KeyError) as e:
            logger.debug(f"Skill parse failed: {e}")
            return []

    def get(self, skill_id: int) -> Optional[Skill]:
        """Get skill by ID.

        Args:
            skill_id: Skill ID

        Returns:
            Skill object or None if not found
        """
        result = make_request(
            endpoint=f"skills/{skill_id}",
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            return None

        entity = self._unwrap_entity(result)
        if entity is None:
            logger.warning(f"Skill get: failed to parse response: {result[:200]}")
            return None

        try:
            return Skill(
                id=entity["id"],
                name=entity.get("name", ""),
                description=entity.get("description", ""),
                agent_id=entity.get("agentId"),
                is_system=entity.get("isSystem", False),
            )
        except KeyError as e:
            logger.warning(f"Skill get: missing field {e}: {result[:200]}")
            return None
