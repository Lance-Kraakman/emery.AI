"""Typed Agent API - shared by tools and services."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from ..http_client import make_request

logger = logging.getLogger(__name__)


@dataclass
class Agent:
    """Agent entity."""

    id: int
    name: str
    description: str = ""
    persona: str = ""
    database_id: Optional[int] = None


class AgentAPI:
    """Typed API for agent operations.

    Usage:
        api = AgentAPI(api_key, org_id)
        agents = api.list()
        agent = api.get(123)
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

    def list(self, filters: Optional[Dict[str, Any]] = None) -> List[Agent]:
        """List all agents.

        Args:
            filters: Optional filter criteria

        Returns:
            List of Agent objects
        """
        endpoint = "agents"
        if filters:
            params = "&".join(f"{key}={value}" for key, value in filters.items())
            endpoint += f"?{params}"

        result = make_request(
            endpoint=endpoint,
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            logger.debug(f"Agent list failed: {result}")
            return []

        try:
            data = json.loads(result)
            return [
                Agent(
                    id=agent["id"],
                    name=agent.get("name", ""),
                    description=agent.get("description", ""),
                    persona=agent.get("persona", ""),
                    database_id=agent.get("databaseId"),
                )
                for agent in data.get("data", [])
            ]
        except (json.JSONDecodeError, KeyError) as e:
            logger.debug(f"Agent parse failed: {e}")
            return []

    def get(self, agent_id: int) -> Optional[Agent]:
        """Get agent by ID.

        Args:
            agent_id: Agent ID

        Returns:
            Agent object or None if not found
        """
        result = make_request(
            endpoint=f"agents/{agent_id}",
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            return None

        entity = self._unwrap_entity(result)
        if entity is None:
            logger.warning(f"Agent get: failed to parse response: {result[:200]}")
            return None

        try:
            return Agent(
                id=entity["id"],
                name=entity.get("name", ""),
                description=entity.get("description", ""),
                persona=entity.get("persona", ""),
                database_id=entity.get("databaseId"),
            )
        except KeyError as e:
            logger.warning(f"Agent get: missing field {e}: {result[:200]}")
            return None
