"""
Dynamic Skill Tool - Fetches skill config via API at execution time.

AIDEV-NOTE: Part of dynamic execution architecture (Jan 2026).
Created when frontend sends skill_reference tool config.
Fetches skill config via API, resolves credentials from skill.agentId.
Executes skill in-process via execute_skill_by_id().
"""

from __future__ import annotations

import logging
from typing import Any

import requests

from emery_agents.api.http_client import get_base_url

logger = logging.getLogger(__name__)


class DynamicSkillTool:
    """
    Tool for executing skills dynamically.

    Created when frontend sends skill_reference tool config.
    Fetches skill config via API at execution time, resolves credentials.

    Attributes:
        name: Tool name for LLM (skill_{name})
        description: Skill description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type ("string")
    """

    def __init__(
        self,
        skill_id: int,
        api_key: str,
        organization_id: int,
    ):
        """
        Initialize DynamicSkillTool.

        Args:
            skill_id: ID of the skill to execute
            api_key: API key for authentication (user's or inherited)
            organization_id: Organization ID for RLS context
        """
        self.skill_id = skill_id
        self.api_key = api_key
        self.organization_id = organization_id

        # Fetch skill metadata for LLM tool registration
        self._skill_metadata = self._fetch_skill_metadata()

        # DSPy tool properties
        skill_name = self._skill_metadata.get("name", f"skill_{skill_id}")
        self.name = f"skill_{skill_name.replace(':', '').replace(' ', '_').replace('-', '_').lower()}"
        self.description = self._skill_metadata.get(
            "description", f"Execute skill {skill_id}"
        )
        self.inputs = self._build_inputs_schema()
        self.output_type = "string"

        logger.info(f"[DYNAMIC-SKILL] Created tool for skill {skill_id}: {self.name}")

    def __call__(self, **kwargs: Any) -> str:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def forward(self, **kwargs: Any) -> str:
        """
        Execute skill with dynamic credential resolution.

        Human skill handling is done in execute_skill_by_id() - it signals
        via context variable and returns a marker string.

        Args:
            **kwargs: Skill input parameters

        Returns:
            Skill execution result as string
        """
        from ..execution.dynamic_execution import execute_skill_by_id

        logger.info(
            f"[DYNAMIC-SKILL] Executing skill {self.skill_id} with inputs: {list(kwargs.keys())}"
        )

        return execute_skill_by_id(
            skill_id=self.skill_id,
            inputs=kwargs,
            api_key=self.api_key,
            org_id=str(self.organization_id),
        )

    def _fetch_skill_metadata(self) -> dict[str, Any]:
        """
        Fetch basic skill info for tool registration.

        Calls GET /api/skills/:id to get skill metadata (name, description, inputs).
        This is a lightweight call just for tool registration, not full execution.

        Returns:
            Dict with skill metadata (name, description, inputs, outputs)
        """
        base_url = get_base_url()
        url = f"{base_url}/api/skills/{self.skill_id}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "X-Organization-Id": str(self.organization_id),
            "Content-Type": "application/json",
        }

        logger.debug(f"[DYNAMIC-SKILL] Fetching skill metadata from {url}")

        try:
            response = requests.get(url, headers=headers, timeout=10)

            if response.status_code == 404:
                logger.error(f"[DYNAMIC-SKILL] Skill {self.skill_id} not found")
                return {
                    "name": f"unknown_skill_{self.skill_id}",
                    "description": "Skill not found",
                }
            elif response.status_code == 403:
                logger.error(
                    f"[DYNAMIC-SKILL] Permission denied for skill {self.skill_id}"
                )
                return {
                    "name": f"skill_{self.skill_id}",
                    "description": "Permission denied",
                }
            elif response.status_code >= 400:
                logger.error(f"[DYNAMIC-SKILL] API error {response.status_code}")
                return {
                    "name": f"skill_{self.skill_id}",
                    "description": f"API error: {response.status_code}",
                }

            data = response.json()

            # Handle both direct response and wrapped response
            skill_data = data.get("data", data) if isinstance(data, dict) else data

            return {
                "id": skill_data.get("id", self.skill_id),
                "name": skill_data.get("name", f"skill_{self.skill_id}"),
                "description": skill_data.get("description", ""),
                "inputs": skill_data.get("inputs", []),
                "outputs": skill_data.get("outputs", []),
                "instructions": skill_data.get("instructions", ""),
            }

        except requests.exceptions.Timeout:
            logger.error(f"[DYNAMIC-SKILL] Timeout fetching skill {self.skill_id}")
            return {"name": f"skill_{self.skill_id}", "description": "Fetch timeout"}
        except Exception as e:
            logger.error(f"[DYNAMIC-SKILL] Error fetching skill metadata: {e}")
            return {"name": f"skill_{self.skill_id}", "description": str(e)}

    def _build_inputs_schema(self) -> dict[str, Any]:
        """
        Build inputs schema from skill.inputs for DSPy.

        Returns:
            Dict mapping input name to {type, description, nullable}
        """
        inputs_schema = {}
        skill_inputs = self._skill_metadata.get("inputs", [])

        for skill_input in skill_inputs:
            if isinstance(skill_input, dict):
                name = skill_input.get("name", "")
                if not name:
                    continue

                input_type = skill_input.get("type", "string")
                description = skill_input.get("description", f"Input: {name}")
                required = skill_input.get("required", False)

                inputs_schema[name] = {
                    "type": self._map_type(input_type),
                    "description": description,
                }

                if not required:
                    inputs_schema[name]["nullable"] = True

        # If no inputs defined, add a generic 'input' parameter
        if not inputs_schema:
            inputs_schema["input"] = {
                "type": "string",
                "description": "Input for the skill",
                "nullable": True,
            }

        return inputs_schema

    def _map_type(self, skill_type: str) -> str:
        """Map skill input types to DSPy-compatible types."""
        type_mappings = {
            "text": "string",
            "string": "string",
            "number": "number",
            "integer": "integer",
            "boolean": "boolean",
            "array": "array",
            "object": "object",
            "file": "string",  # File paths as strings
            "date": "string",  # Dates as ISO strings
        }
        return type_mappings.get(skill_type.lower(), "string")
