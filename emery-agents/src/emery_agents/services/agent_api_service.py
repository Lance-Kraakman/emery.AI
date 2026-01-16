"""
Agent API Service

Centralized service for fetching agents and skills from the Next.js API.
Eliminates duplication between chat_processing_service.py and mention_routing.py.

AIDEV-NOTE: This service uses async httpx for API calls with:
- RLS headers (X-Organization-ID) for multi-tenancy
- Observability headers (X-Call-ID) for tracing
- Consistent JSON error handling
- Structured logging with [AGENT-API] prefix
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


@dataclass
class AgentData:
    """Agent configuration data from API."""
    id: str
    name: str
    description: str
    persona: Optional[str]
    database_id: Optional[str]
    raw: Dict[str, Any]  # Full API response for passthrough


@dataclass
class SkillData:
    """Skill definition data from API."""
    id: str
    name: str
    description: str
    raw: Dict[str, Any]  # Full API response for passthrough


class AgentAPIService:
    """
    Service for fetching agents and skills from the Next.js API.

    Usage:
        service = AgentAPIService(api_key="...", organization_id="...")

        # Fetch all agents for organization
        agents = await service.fetch_agents()

        # Fetch single agent by name
        agent = await service.fetch_agent_by_name("my-agent")

        # Fetch skills for an agent
        skills = await service.fetch_skills(agent_id="...")

        # Combined fetch for convenience
        agents_with_skills = await service.fetch_agents_with_skills()
    """

    def __init__(
        self,
        api_key: str,
        organization_id: Optional[str] = None,
        timeout: float = 15.0
    ):
        """
        Initialize the service.

        Args:
            api_key: Bearer token for API authentication
            organization_id: Organization ID for RLS context
            timeout: Request timeout in seconds (default 15s)
        """
        self.api_key = api_key
        self.organization_id = organization_id
        self.timeout = timeout
        self.base_url = os.getenv("NEXT_API_URL", "http://localhost:3000")

    def _build_headers(self, call_id: str) -> Dict[str, str]:
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
        self,
        agent_id: Optional[str] = None,
        agent_name: Optional[str] = None
    ) -> List[AgentData]:
        """
        Fetch agents from API.

        Args:
            agent_id: Optional filter by agent ID
            agent_name: Optional filter by agent name

        Returns:
            List of AgentData objects (may be empty)
        """
        call_id = str(uuid.uuid4())[:8]

        params = {}
        if agent_id:
            params["id"] = agent_id
        if agent_name:
            params["name"] = agent_name

        logger.info(f"[AGENT-API] Fetching agents - call_id: {call_id}, params: {params}")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/agents",
                    params=params if params else None,
                    headers=self._build_headers(call_id),
                )

                if not response.is_success:
                    logger.warning(f"[AGENT-API] Failed to fetch agents - call_id: {call_id}, status: {response.status_code}")
                    return []

                try:
                    data = response.json()
                except json.JSONDecodeError as e:
                    logger.warning(f"[AGENT-API] Invalid JSON response - call_id: {call_id}, error: {e}")
                    return []

                # Handle both single agent (by name) and list responses
                if data.get("success") and data.get("data"):
                    raw_data = data["data"]
                    # API returns single object for name lookup, list for all agents
                    if isinstance(raw_data, dict):
                        raw_data = [raw_data]

                    agents = [
                        AgentData(
                            id=agent.get("id", ""),
                            name=agent.get("name", "Unknown"),
                            description=agent.get("description", ""),
                            persona=agent.get("persona"),
                            database_id=agent.get("databaseId"),
                            raw=agent,
                        )
                        for agent in raw_data
                    ]
                    logger.info(f"[AGENT-API] Fetched {len(agents)} agents - call_id: {call_id}")
                    return agents

                logger.info(f"[AGENT-API] No agents found - call_id: {call_id}")
                return []

        except httpx.RequestError as e:
            logger.warning(f"[AGENT-API] HTTP error fetching agents - call_id: {call_id}, error: {e}")
            return []
        except Exception as e:
            logger.warning(f"[AGENT-API] Unexpected error fetching agents - call_id: {call_id}, error: {e}")
            return []

    async def fetch_agent_by_name(self, name: str) -> Optional[AgentData]:
        """
        Fetch a single agent by name.

        Args:
            name: Agent name to look up

        Returns:
            AgentData if found, None otherwise
        """
        agents = await self.fetch_agents(agent_name=name)
        return agents[0] if agents else None

    async def fetch_skills(self, agent_id: str) -> List[SkillData]:
        """
        Fetch skills for a specific agent.

        Args:
            agent_id: Agent ID to fetch skills for

        Returns:
            List of SkillData objects (may be empty)
        """
        call_id = str(uuid.uuid4())[:8]

        logger.debug(f"[AGENT-API] Fetching skills for agent {agent_id} - call_id: {call_id}")

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/api/skills",
                    params={"agent_id": agent_id},
                    headers=self._build_headers(call_id),
                )

                if not response.is_success:
                    logger.warning(f"[AGENT-API] Failed to fetch skills - call_id: {call_id}, agent_id: {agent_id}, status: {response.status_code}")
                    return []

                try:
                    data = response.json()
                except json.JSONDecodeError as e:
                    logger.warning(f"[AGENT-API] Invalid JSON for skills - call_id: {call_id}, error: {e}")
                    return []

                raw_skills = data.get("data", [])
                skills = [
                    SkillData(
                        id=skill.get("id", ""),
                        name=skill.get("name", "Unknown"),
                        description=skill.get("description", ""),
                        raw=skill,
                    )
                    for skill in raw_skills
                ]

                logger.debug(f"[AGENT-API] Fetched {len(skills)} skills for agent {agent_id} - call_id: {call_id}")
                return skills

        except httpx.RequestError as e:
            logger.warning(f"[AGENT-API] HTTP error fetching skills - call_id: {call_id}, error: {e}")
            return []
        except Exception as e:
            logger.warning(f"[AGENT-API] Unexpected error fetching skills - call_id: {call_id}, error: {e}")
            return []

    async def fetch_agents_with_skills(self) -> List[Tuple[AgentData, List[SkillData]]]:
        """
        Fetch all agents with their skills in one operation.

        Returns:
            List of (AgentData, List[SkillData]) tuples
        """
        agents = await self.fetch_agents()

        results = []
        for agent in agents:
            skills = await self.fetch_skills(agent.id)
            results.append((agent, skills))

        logger.info(f"[AGENT-API] Total: {len(results)} agents with skills loaded")
        return results
