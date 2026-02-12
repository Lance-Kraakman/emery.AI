"""
Dynamic Agent Tool - Wraps user-defined agents as callable tools.

Created for 'reference' type tools (e.g., agent-46) that appear in
agent tool configurations. Fetches agent metadata via API, delegates
execution to execute_agent_by_id().

Follows the same pattern as DynamicSkillTool.
"""

from __future__ import annotations

import logging
from typing import Any

import dspy

from emery_agents.api import fetch_agent_by_id_sync

logger = logging.getLogger(__name__)


class DynamicAgentTool:
    """Tool for executing agents dynamically. Created for 'reference' type tools."""

    def __init__(self, agent_id: int, api_key: str, organization_id: int):
        self.agent_id = agent_id
        self.api_key = api_key
        self.organization_id = organization_id

        # Fetch agent metadata for DSPy tool registration
        agent_data = fetch_agent_by_id_sync(agent_id, api_key, organization_id)

        # Use ID + name slug for better LLM context
        # Format: agent_{id}_{name_slug} (e.g., agent_5_sales_assistant)
        if agent_data:
            safe_name = agent_data.name.replace(" ", "_").replace("-", "_").lower()
            self.name = f"agent_{agent_id}_{safe_name}" if safe_name else f"agent_{agent_id}"
            self.description = (
                agent_data.description or f"Execute agent: {agent_data.name}"
            )
            doc_desc = agent_data.description or ""
        else:
            self.name = f"agent_{agent_id}"
            self.description = f"Execute agent {agent_id}"
            doc_desc = ""

        self.__name__ = self.name
        self.__doc__ = (
            f"Execute this agent with a task. {doc_desc} "
            f"Pass a task description and the agent will use its skills to complete it."
        )
        self.inputs = {"task": {"type": "string", "description": "Task for the agent"}}
        self.output_type = "string"

        logger.info(f"[DYNAMIC-AGENT] Created tool: {self.name} (agent_id={agent_id})")

    def __call__(self, **kwargs: Any) -> str:
        return self.forward(**kwargs)

    def forward(self, task: str = "") -> str:
        """Execute agent. Credentials resolved by execute_agent_by_id()."""
        from ..execution.dynamic_execution import execute_agent_by_id

        logger.info(f"[DYNAMIC-AGENT] Executing agent {self.agent_id}: {task[:100]}")
        return execute_agent_by_id(
            agent_id=self.agent_id,
            task=task,
            api_key=self.api_key,
            org_id=str(self.organization_id),
        )

    def to_dspy_tool(self) -> dspy.Tool:
        """Convert to dspy.Tool with proper metadata.

        DSPy ReAct auto-wraps callables but loses custom attributes.
        This method creates a proper dspy.Tool with explicit metadata.
        """
        return dspy.Tool(
            func=self.forward,
            name=self.name,
            desc=self.description,
            args={name: {"type": info["type"]} for name, info in self.inputs.items()},
            arg_desc={
                name: info.get("description", name)
                for name, info in self.inputs.items()
            },
        )
