"""
Skill API Service

Centralized service for fetching skills from the Next.js API.
Mirrors AgentAPIService for consistent patterns.

Uses async httpx with:
- RLS headers (X-Organization-ID) for multi-tenancy
- Observability headers (X-Call-ID) for tracing
- Structured logging with [SKILL-API] prefix
- Raises exceptions on errors (caller handles error display)
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class SkillData:
    """Skill data from API."""
    id: str
    name: str
    description: str
    raw: Dict[str, Any]  # Full API response for passthrough


def _normalize_name(name: str) -> str:
    """Normalize a skill name for fuzzy matching."""
    return name.lower().replace("-", "_").replace(" ", "_")


class SkillAPIService:
    """
    Service for fetching skills from the Next.js API.

    Usage:
        service = SkillAPIService(api_key="...", organization_id="...")

        # Fetch all skills for organization
        skills = await service.fetch_skills()

        # Fetch skills for a specific agent
        skills = await service.fetch_skills(agent_id="123")

        # Fetch single skill by ID
        skill = await service.fetch_skill_by_id("456")

        # Fetch single skill by name (normalized fuzzy match)
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
    ) -> List[SkillData]:
        """
        Fetch skills from API.

        Args:
            agent_id: Optional filter by agent ID

        Returns:
            List of SkillData objects

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
                SkillData(
                    id=str(skill.get("id", "")),
                    name=skill.get("name", "Unknown"),
                    description=skill.get("description", ""),
                    raw=skill,
                )
                for skill in raw_skills
            ]

            logger.info(f"[SKILL-API] Fetched {len(skills)} skills - call_id: {call_id}")
            return skills

    async def fetch_skill_by_id(self, skill_id: str) -> Optional[SkillData]:
        """
        Fetch a single skill by ID.

        Args:
            skill_id: Skill ID to look up

        Returns:
            SkillData if found, None if 404

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
            return SkillData(
                id=str(raw.get("id", "")),
                name=raw.get("name", "Unknown"),
                description=raw.get("description", ""),
                raw=raw,
            )

    async def fetch_skill_by_name(self, name: str) -> Optional[SkillData]:
        """
        Fetch a single skill by name (normalized fuzzy match).

        Fetches all org skills and matches by normalized name
        (lowercase, hyphens/spaces → underscores).

        Args:
            name: Skill name to look up

        Returns:
            SkillData if found, None otherwise
        """
        skills = await self.fetch_skills()
        normalized_target = _normalize_name(name)
        return next(
            (s for s in skills if _normalize_name(s.name) == normalized_target),
            None,
        )
