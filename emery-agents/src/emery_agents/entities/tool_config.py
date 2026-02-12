"""
ToolConfig entity — replaces proto ToolConfig for internal use.

Converted from proto at the gRPC boundary (agent_streaming / proto_mapper).
Not to be confused with StepToolConfig (skill step tool references in skill_config.py).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ToolConfig:
    """General tool configuration from gRPC agent config.

    Fields:
        name: Tool identifier (e.g., "enhancd-create-agent", "gmail_send_email")
        version: Tool version string
        config: Key-value configuration (api_key, base_url, skill_id, etc.)
    """

    name: str
    version: str = ""
    config: dict[str, Any] = field(default_factory=dict)

    @property
    def app_name(self) -> str:
        """Extract app name from tool name.

        Examples:
            - "gmail_find_email" -> "gmail"
            - "slack_send_message" -> "slack"
            - "create_table" -> "create_table" (no underscore, return as-is)
        """
        return extract_app_name(self.name)


def extract_app_name(tool_name: str) -> str:
    """Extract app name from tool name.

    Convention: External tool names follow the pattern "{app}_{action}"
    e.g., "gmail_find_email" -> "gmail", "slack_send_message" -> "slack"

    Args:
        tool_name: Full tool name

    Returns:
        App name (prefix before first underscore, or full name if no underscore)
    """
    return tool_name.split("_")[0] if "_" in tool_name else tool_name
