"""
ToolConfig entity — replaces proto ToolConfig for internal use.

Converted from proto at the gRPC boundary (agent_streaming / proto_mapper).
Not to be confused with StepToolConfig (skill step tool references in skill_config.py).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict


@dataclass
class ToolConfig:
    """General tool configuration from gRPC agent config.

    Fields:
        name: Tool identifier (e.g., "emery-create-agent", "gmail_send_email")
        version: Tool version string
        config: Key-value configuration (api_key, base_url, skill_id, etc.)
    """
    name: str
    version: str = ""
    config: Dict[str, Any] = field(default_factory=dict)
