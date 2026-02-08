"""Agent API — sync and async patterns for agent operations."""

from __future__ import annotations

import builtins
import json
import logging
import os
import uuid
from typing import Any

import httpx
import requests

from ..entities.workspace import WorkspaceAgent, WorkspaceSkill
from .http_client import make_request, unwrap_entity

logger = logging.getLogger(__name__)


class AgentAPI:
    """Typed sync API for agent operations.

    Uses the shared HTTPClient (make_request) for sync contexts like CRUD tools.

    Usage:
        api = AgentAPI(api_key, org_id)
        agents = api.list()
        agent = api.get(123)
    """

    def __init__(self, api_key: str, org_id: str):
        self._api_key = api_key
        self._org_id = org_id

    def list(
        self, filters: dict[str, Any] | None = None
    ) -> builtins.list[WorkspaceAgent]:
        """List all agents.

        Args:
            filters: Optional filter criteria

        Returns:
            List of WorkspaceAgent objects
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
                WorkspaceAgent(
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

    def get(self, agent_id: int) -> WorkspaceAgent | None:
        """Get agent by ID.

        Args:
            agent_id: Agent ID

        Returns:
            WorkspaceAgent object or None if not found
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

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"Agent get: failed to parse response: {result[:200]}")
            return None

        try:
            return WorkspaceAgent(
                id=entity["id"],
                name=entity.get("name", ""),
                description=entity.get("description", ""),
                persona=entity.get("persona", ""),
                database_id=entity.get("databaseId"),
            )
        except KeyError as e:
            logger.warning(f"Agent get: missing field {e}: {result[:200]}")
            return None


class AgentAPIService:
    """
    Async service for fetching agents and skills from the Next.js API.

    Uses httpx.AsyncClient with RLS headers and observability.

    Usage:
        service = AgentAPIService(api_key="...", organization_id=123)
        agents = await service.fetch_agents()
        agent = await service.fetch_agent_by_name("my-agent")
        skills = await service.fetch_skills(agent_id="...")
        agents_with_skills = await service.fetch_agents_with_skills()
    """

    def __init__(
        self, api_key: str, organization_id: int | None = None, timeout: float = 15.0
    ):
        self.api_key = api_key
        self.organization_id = organization_id
        self.timeout = timeout
        self.base_url = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")

    def _build_headers(self, call_id: str) -> dict[str, str]:
        """Build request headers with auth, RLS, and observability."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Call-ID": call_id,
            "X-Source": "agent-api-service",
        }
        if self.organization_id:
            headers["X-Organization-ID"] = str(self.organization_id)
        return headers

    async def fetch_agents(
        self, agent_id: str | None = None, agent_name: str | None = None
    ) -> list[WorkspaceAgent]:
        """
        Fetch agents from API.

        Args:
            agent_id: Optional filter by agent ID
            agent_name: Optional filter by agent name

        Returns:
            List of WorkspaceAgent objects (may be empty)
        """
        call_id = str(uuid.uuid4())[:8]

        params = {}
        if agent_id:
            params["id"] = agent_id
        if agent_name:
            params["name"] = agent_name

        logger.info(
            f"[AGENT-API] Fetching agents - call_id: {call_id}, params: {params}"
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/agents",
                    params=params if params else None,
                    headers=self._build_headers(call_id),
                )

                if not response.is_success:
                    logger.warning(
                        f"[AGENT-API] Failed to fetch agents - call_id: {call_id}, status: {response.status_code}"
                    )
                    return []

                try:
                    data = response.json()
                except json.JSONDecodeError as e:
                    logger.warning(
                        f"[AGENT-API] Invalid JSON response - call_id: {call_id}, error: {e}"
                    )
                    return []

                # Handle both single agent (by name) and list responses
                if data.get("success") and data.get("data"):
                    raw_data = data["data"]
                    # API returns single object for name lookup, list for all agents
                    if isinstance(raw_data, dict):
                        raw_data = [raw_data]

                    agents = [
                        WorkspaceAgent(
                            id=int(agent.get("id", 0)),
                            name=agent.get("name", "Unknown"),
                            description=agent.get("description", ""),
                            persona=agent.get("persona"),
                            database_id=int(agent["databaseId"])
                            if agent.get("databaseId")
                            else None,
                        )
                        for agent in raw_data
                    ]
                    logger.info(
                        f"[AGENT-API] Fetched {len(agents)} agents - call_id: {call_id}"
                    )
                    return agents

                logger.info(f"[AGENT-API] No agents found - call_id: {call_id}")
                return []

        except httpx.RequestError as e:
            logger.warning(
                f"[AGENT-API] HTTP error fetching agents - call_id: {call_id}, error: {e}"
            )
            return []
        except Exception as e:
            logger.warning(
                f"[AGENT-API] Unexpected error fetching agents - call_id: {call_id}, error: {e}"
            )
            return []

    async def fetch_agent_by_name(self, name: str) -> WorkspaceAgent | None:
        """Fetch a single agent by name."""
        agents = await self.fetch_agents(agent_name=name)
        return agents[0] if agents else None

    async def fetch_skills(self, agent_id: str) -> list[WorkspaceSkill]:
        """
        Fetch skills for a specific agent.

        Args:
            agent_id: Agent ID to fetch skills for

        Returns:
            List of WorkspaceSkill objects (may be empty)
        """
        call_id = str(uuid.uuid4())[:8]

        logger.debug(
            f"[AGENT-API] Fetching skills for agent {agent_id} - call_id: {call_id}"
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills",
                    params={"agent_id": agent_id},
                    headers=self._build_headers(call_id),
                )

                if not response.is_success:
                    logger.warning(
                        f"[AGENT-API] Failed to fetch skills - call_id: {call_id}, agent_id: {agent_id}, status: {response.status_code}"
                    )
                    return []

                try:
                    data = response.json()
                except json.JSONDecodeError as e:
                    logger.warning(
                        f"[AGENT-API] Invalid JSON for skills - call_id: {call_id}, error: {e}"
                    )
                    return []

                raw_skills = data.get("data", [])
                skills = [
                    WorkspaceSkill(
                        id=int(skill.get("id", 0)),
                        name=skill.get("name", "Unknown"),
                        description=skill.get("description", ""),
                        inputs=skill.get("inputs", []),
                    )
                    for skill in raw_skills
                ]

                logger.debug(
                    f"[AGENT-API] Fetched {len(skills)} skills for agent {agent_id} - call_id: {call_id}"
                )
                return skills

        except httpx.RequestError as e:
            logger.warning(
                f"[AGENT-API] HTTP error fetching skills - call_id: {call_id}, error: {e}"
            )
            return []
        except Exception as e:
            logger.warning(
                f"[AGENT-API] Unexpected error fetching skills - call_id: {call_id}, error: {e}"
            )
            return []

    async def fetch_agents_with_skills(
        self,
    ) -> list[tuple[WorkspaceAgent, list[WorkspaceSkill]]]:
        """Fetch all agents with their skills in one operation."""
        agents = await self.fetch_agents()

        results = []
        for agent in agents:
            skills = await self.fetch_skills(agent.id)
            results.append((agent, skills))

        logger.info(f"[AGENT-API] Total: {len(results)} agents with skills loaded")
        return results

    async def fetch_agent_by_id(self, agent_id: int) -> WorkspaceAgent | None:
        """Fetch a single agent by ID."""
        agents = await self.fetch_agents(agent_id=str(agent_id))
        return agents[0] if agents else None


def fetch_agent_by_id_sync(
    agent_id: int, api_key: str, organization_id: int
) -> WorkspaceAgent | None:
    """
    Sync fetch of agent by ID. For use in sync contexts (tool loading).

    Standalone function (not on the async AgentAPIService class) using
    requests, matching the sync patterns in dynamic_execution.py.

    Args:
        agent_id: Agent ID to fetch
        api_key: Bearer token for authentication
        organization_id: Organization ID for RLS context

    Returns:
        WorkspaceAgent if found, None otherwise
    """
    base_url = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "X-Organization-Id": str(organization_id),
        "Content-Type": "application/json",
    }
    try:
        response = requests.get(
            f"{base_url}/api/agents/{agent_id}",
            headers=headers,
            timeout=10,
        )
        if response.status_code >= 400:
            logger.warning(
                f"[AGENT-API] Sync fetch agent {agent_id} failed: {response.status_code}"
            )
            return None
        data = response.json()
        agent = data.get("data", data) if isinstance(data, dict) else {}
        return WorkspaceAgent(
            id=int(agent.get("id", 0)),
            name=agent.get("name", "Unknown"),
            description=agent.get("description", ""),
            persona=agent.get("persona"),
            database_id=int(agent["databaseId"]) if agent.get("databaseId") else None,
        )
    except Exception as e:
        logger.error(f"[AGENT-API] Sync fetch failed for agent {agent_id}: {e}")
        return None
