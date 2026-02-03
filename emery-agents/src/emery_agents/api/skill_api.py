"""Skill API — sync and async patterns for skill operations."""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any, Dict, List, Optional

import httpx

from .http_client import make_request, unwrap_entity
from ..entities.workspace import WorkspaceSkill

logger = logging.getLogger(__name__)


def _normalize_name(name: str) -> str:
    """Normalize a skill name for fuzzy matching."""
    return name.lower().replace(":", "").replace("-", "_").replace(" ", "_")


class SkillAPI:
    """Typed sync API for skill operations.

    Uses the shared HTTPClient (make_request) for sync contexts like CRUD tools.

    Usage:
        api = SkillAPI(api_key, org_id)
        skills = api.list()
        skills = api.list(agent_id=123)
        skill = api.get(456)
    """

    def __init__(self, api_key: str, org_id: str):
        self._api_key = api_key
        self._org_id = org_id

    def list(
        self,
        agent_id: Optional[int] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[WorkspaceSkill]:
        """List skills, optionally filtered by agent.

        Args:
            agent_id: Optional agent ID to filter by
            filters: Optional additional filter criteria

        Returns:
            List of WorkspaceSkill objects
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
                WorkspaceSkill(
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

    def get(self, skill_id: int) -> Optional[WorkspaceSkill]:
        """Get skill by ID.

        Args:
            skill_id: Skill ID

        Returns:
            WorkspaceSkill object or None if not found
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

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"Skill get: failed to parse response: {result[:200]}")
            return None

        try:
            return WorkspaceSkill(
                id=entity["id"],
                name=entity.get("name", ""),
                description=entity.get("description", ""),
                agent_id=entity.get("agentId"),
                is_system=entity.get("isSystem", False),
            )
        except KeyError as e:
            logger.warning(f"Skill get: missing field {e}: {result[:200]}")
            return None


class SkillAPIService:
    """
    Async service for fetching skills from the Next.js API.

    Uses httpx.AsyncClient with RLS headers and observability.

    Usage:
        service = SkillAPIService(api_key="...", organization_id=123)
        skills = await service.fetch_skills()
        skills = await service.fetch_skills(agent_id="123")
        skill = await service.fetch_skill_by_id("456")
        skill = await service.fetch_skill_by_name("populate-clients-table")
    """

    def __init__(
        self,
        api_key: str,
        organization_id: Optional[int] = None,
        timeout: float = 15.0,
    ):
        self.api_key = api_key
        self.organization_id = organization_id
        self.timeout = timeout
        self.base_url = os.getenv("NEXTJS_BASE_URL", "http://localhost:3000")

    def _build_headers(self, call_id: str) -> Dict[str, str]:
        """Build request headers with auth, RLS, and observability."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-Call-ID": call_id,
            "X-Source": "skill-api-service",
        }
        if self.organization_id:
            headers["X-Organization-ID"] = str(self.organization_id)
        return headers

    async def fetch_skills(
        self,
        agent_id: Optional[str] = None,
    ) -> List[WorkspaceSkill]:
        """
        Fetch skills from API.

        Args:
            agent_id: Optional filter by agent ID

        Returns:
            List of WorkspaceSkill objects

        Raises:
            httpx.RequestError: On HTTP connection errors
            RuntimeError: On non-success HTTP responses or invalid JSON
        """
        call_id = str(uuid.uuid4())[:8]

        params: Dict[str, str] = {}
        if agent_id:
            params["agent_id"] = agent_id

        logger.info(f"[SKILL-API] Fetching skills - call_id: {call_id}, params: {params}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/skills",
                params=params if params else None,
                headers=self._build_headers(call_id),
            )

            if not response.is_success:
                raise RuntimeError(
                    f"[SKILL-API] Failed to fetch skills - call_id: {call_id}, "
                    f"status: {response.status_code}, body: {response.text[:200]}"
                )

            try:
                data = response.json()
            except json.JSONDecodeError as e:
                raise RuntimeError(
                    f"[SKILL-API] Invalid JSON response - call_id: {call_id}, error: {e}"
                )

            if not data.get("success"):
                raise RuntimeError(
                    f"[SKILL-API] API returned failure - call_id: {call_id}, "
                    f"error: {data.get('error', 'unknown')}"
                )

            raw_skills = data.get("data", [])
            skills = [
                WorkspaceSkill(
                    id=int(skill.get("id", 0)),
                    name=skill.get("name", "Unknown"),
                    description=skill.get("description", ""),
                    raw=skill,
                )
                for skill in raw_skills
            ]

            logger.info(f"[SKILL-API] Fetched {len(skills)} skills - call_id: {call_id}")
            return skills

    async def fetch_skill_by_id(self, skill_id: str) -> Optional[WorkspaceSkill]:
        """
        Fetch a single skill by ID.

        Args:
            skill_id: Skill ID to look up

        Returns:
            WorkspaceSkill if found, None if 404

        Raises:
            httpx.RequestError: On HTTP connection errors
            RuntimeError: On non-success HTTP responses (except 404) or invalid JSON
        """
        call_id = str(uuid.uuid4())[:8]

        logger.info(f"[SKILL-API] Fetching skill {skill_id} - call_id: {call_id}")

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/skills/{skill_id}",
                headers=self._build_headers(call_id),
            )

            if response.status_code == 404:
                logger.info(f"[SKILL-API] Skill {skill_id} not found - call_id: {call_id}")
                return None

            if not response.is_success:
                raise RuntimeError(
                    f"[SKILL-API] Failed to fetch skill {skill_id} - call_id: {call_id}, "
                    f"status: {response.status_code}"
                )

            try:
                data = response.json()
            except json.JSONDecodeError as e:
                raise RuntimeError(
                    f"[SKILL-API] Invalid JSON for skill {skill_id} - call_id: {call_id}, error: {e}"
                )

            if not data.get("success") or not data.get("data"):
                return None

            raw = data["data"]
            return WorkspaceSkill(
                id=int(raw.get("id", 0)),
                name=raw.get("name", "Unknown"),
                description=raw.get("description", ""),
                raw=raw,
            )

    async def fetch_skill_by_name(self, name: str) -> Optional[WorkspaceSkill]:
        """
        Fetch a single skill by name (normalized fuzzy match).

        Fetches all org skills and matches by normalized name
        (lowercase, hyphens/spaces -> underscores).

        Args:
            name: Skill name to look up

        Returns:
            WorkspaceSkill if found, None otherwise
        """
        skills = await self.fetch_skills()
        normalized_target = _normalize_name(name)
        return next(
            (s for s in skills if _normalize_name(s.name) == normalized_target),
            None,
        )
