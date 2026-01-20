"""
Schema Loader

Loads and renders JSON Schema files for agent prompts.
Provides capability summaries for agents and I/O documentation for tools.

AIDEV-NOTE: Schemas are loaded when agents are created, NOT during planning.
The planner uses agent routing (not direct tool selection), so it only sees
agent descriptions. Tools with I/O schemas are used by agents during execution.

Schemas are cached using lru_cache to avoid repeated file I/O.
"""

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Schema directories relative to this file
SCHEMA_ROOT = Path(__file__).parent / "schemas"
AGENT_SCHEMA_DIR = SCHEMA_ROOT / "agents"
TOOL_SCHEMA_DIR = SCHEMA_ROOT / "tools"


@lru_cache(maxsize=50)
def load_agent_schema(agent_name: str) -> Optional[Dict[str, Any]]:
    """
    Load a JSON Schema for an agent's capabilities.

    Cached using lru_cache to avoid repeated file I/O.

    Args:
        agent_name: Name of the agent (e.g., "schema_builder")

    Returns:
        Parsed schema dict, or None if not found
    """
    schema_path = AGENT_SCHEMA_DIR / f"{agent_name}.schema.json"
    if not schema_path.exists():
        logger.debug(f"No schema found for agent: {agent_name}")
        return None

    try:
        with open(schema_path) as f:
            data: Dict[str, Any] = json.load(f)
            return data
    except Exception as e:
        logger.warning(f"Failed to load schema for {agent_name}: {e}")
        return None


@lru_cache(maxsize=100)
def load_tool_schema(tool_name: str, category: str = "emery") -> Optional[Dict[str, Any]]:
    """
    Load a JSON Schema for a tool's I/O.

    Cached using lru_cache to avoid repeated file I/O.

    Args:
        tool_name: Name of the tool (e.g., "field_crud")
        category: Tool category ("emery" or "integrations")

    Returns:
        Parsed schema dict, or None if not found
    """
    schema_path = TOOL_SCHEMA_DIR / category / f"{tool_name}.schema.json"
    if not schema_path.exists():
        logger.debug(f"No schema found for tool: {tool_name} in {category}")
        return None

    try:
        with open(schema_path) as f:
            data: Dict[str, Any] = json.load(f)
            return data
    except Exception as e:
        logger.warning(f"Failed to load schema for {tool_name}: {e}")
        return None


def render_agent_capabilities(agent_name: str) -> str:
    """
    Render an agent's capabilities as a human-readable summary.

    This is used in agent prompts to describe what the agent can do.

    Args:
        agent_name: Name of the agent

    Returns:
        Markdown-formatted capability summary
    """
    schema = load_agent_schema(agent_name)
    if not schema:
        return ""

    lines = [f"## {schema.get('name', agent_name)} Capabilities", ""]
    lines.append(schema.get("description", ""))
    lines.append("")

    capabilities = schema.get("capabilities", {})
    for cap_name, cap_def in capabilities.items():
        lines.append(f"### {cap_name}")
        lines.append(cap_def.get("description", ""))

        # Inputs
        inputs = cap_def.get("inputs", {})
        if inputs:
            lines.append("")
            lines.append("**Inputs:**")
            for input_name, input_def in inputs.items():
                req = " (required)" if input_def.get("required") else ""
                input_type = input_def.get("type", "any")
                desc = input_def.get("description", "")
                lines.append(f"- `{input_name}`: {input_type}{req} - {desc}")

        # Outputs
        outputs = cap_def.get("outputs", {})
        if outputs:
            lines.append("")
            lines.append("**Outputs:**")
            for output_name, output_def in outputs.items():
                output_type = output_def.get("type", "any")
                lines.append(f"- `{output_name}`: {output_type}")

        lines.append("")

    return "\n".join(lines)


def render_tool_io(tool_name: str, category: str = "emery") -> str:
    """
    Render a tool's I/O schema as a human-readable summary.

    This is used in agent prompts to describe how to use tools.

    Args:
        tool_name: Name of the tool
        category: Tool category

    Returns:
        Markdown-formatted I/O documentation
    """
    schema = load_tool_schema(tool_name, category)
    if not schema:
        return ""

    lines = [f"## {schema.get('name', tool_name)}", ""]
    lines.append(schema.get("description", ""))
    lines.append("")

    operations = schema.get("operations", {})
    for op_name, op_def in operations.items():
        lines.append(f"### {op_name}")
        lines.append(op_def.get("description", ""))

        # Inputs
        inputs = op_def.get("inputs", {})
        if inputs:
            lines.append("")
            lines.append("**Inputs:**")
            for input_name, input_def in inputs.items():
                req = " (required)" if input_def.get("required") else ""
                input_type = input_def.get("type", "any")
                desc = input_def.get("description", "")
                lines.append(f"- `{input_name}`: {input_type}{req}")
                if desc:
                    lines.append(f"  {desc}")

        # Outputs
        outputs = op_def.get("outputs", {})
        if outputs:
            lines.append("")
            lines.append("**Outputs:**")
            for output_name, output_def in outputs.items():
                output_type = output_def.get("type", "any")
                lines.append(f"- `{output_name}`: {output_type}")

        # Errors
        errors = op_def.get("errors", [])
        if errors:
            lines.append("")
            lines.append("**Possible errors:** " + ", ".join(f"`{e}`" for e in errors))

        lines.append("")

    return "\n".join(lines)


def get_available_agent_schemas() -> List[str]:
    """
    Get list of available agent schema names.

    Returns:
        List of agent names with schemas
    """
    if not AGENT_SCHEMA_DIR.exists():
        return []

    return [
        p.stem.replace(".schema", "")
        for p in AGENT_SCHEMA_DIR.glob("*.schema.json")
    ]


def get_available_tool_schemas(category: str = "emery") -> List[str]:
    """
    Get list of available tool schema names.

    Args:
        category: Tool category

    Returns:
        List of tool names with schemas
    """
    tool_dir = TOOL_SCHEMA_DIR / category
    if not tool_dir.exists():
        return []

    return [
        p.stem.replace(".schema", "")
        for p in tool_dir.glob("*.schema.json")
    ]
