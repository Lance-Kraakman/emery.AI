#!/usr/bin/env python3
"""
Generate TOOL_EXAMPLES Python code from capabilities.

Maps capability fields directly to dspy.Example:
- task = description (already describes what the tool does)
- tool_id, tool_name, tool_domain, etc. = direct mapping

Usage:
    uv run python scripts/convert_capabilities_to_examples.py > src/emery_agents/reasoning/examples/tools.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from emery_agents.tools.capability_bootstrap import (
    populate_integration_services,
    populate_system_agents,
)
from emery_agents.tools.capability_registry import CapabilityRegistry


def generate_python_code() -> str:
    """Generate Python module with TOOL_EXAMPLES."""

    # Load capabilities
    registry = CapabilityRegistry()
    populate_system_agents(registry)
    populate_integration_services(registry)

    lines = [
        '"""',
        "Tool examples for KNNFewShot tool selection.",
        "",
        "Auto-generated from capabilities. Do not edit manually.",
        "Regenerate with: uv run python scripts/convert_capabilities_to_examples.py",
        '"""',
        "",
        "import dspy",
        "",
        "",
        '_INPUT_FIELDS = ("task",)',
        "",
        "",
        "def _example(",
        "    task: str,",
        "    tool_id: str,",
        "    tool_name: str,",
        "    tool_type: str,",
        "    tool_domain: str,",
        "    tool_actions: list[str],",
        "    tool_entities: list[str],",
        ") -> dspy.Example:",
        '    """Create a tool example for KNNFewShot."""',
        "    return dspy.Example(",
        "        task=task,",
        "        tool_id=tool_id,",
        "        tool_name=tool_name,",
        "        tool_type=tool_type,",
        "        tool_domain=tool_domain,",
        "        tool_actions=tool_actions,",
        "        tool_entities=tool_entities,",
        "    ).with_inputs(*_INPUT_FIELDS)",
        "",
        "",
        "TOOL_EXAMPLES: list[dspy.Example] = [",
    ]

    for cap in registry.all():
        # Use description as task - escape quotes and newlines
        task = cap.description.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
        # Truncate very long descriptions
        if len(task) > 500:
            task = task[:497] + "..."

        lines.append("    _example(")
        lines.append(f'        task="{task}",')
        lines.append(f'        tool_id="{cap.id}",')
        lines.append(f'        tool_name="{cap.name}",')
        lines.append(f'        tool_type="{cap.type.value}",')
        lines.append(f'        tool_domain="{cap.domain}",')
        lines.append(f"        tool_actions={cap.actions!r},")
        lines.append(f"        tool_entities={cap.entities!r},")
        lines.append("    ),")

    lines.append("]")
    lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_python_code(), file=sys.stdout)
