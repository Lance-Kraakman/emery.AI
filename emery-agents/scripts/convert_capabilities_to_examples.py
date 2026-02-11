#!/usr/bin/env python3
"""
Generate TOOL_EXAMPLES Python code from capabilities.

Creates dspy.Example with:
- INPUT: task (natural language request)
- OUTPUT: tool_id (which tool to use)

The examples teach KNNFewShot which tools to select for different tasks.

Usage:
    uv run python scripts/convert_capabilities_to_examples.py > src/emery_agents/reasoning/examples/tools.py
"""

from __future__ import annotations

import sys
from pathlib import Path

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from emery_agents.entities.models.capability import Capability, CapabilityType
from emery_agents.tools.capability_bootstrap import (
    populate_integration_services,
    populate_system_agents,
)
from emery_agents.tools.capability_registry import CapabilityRegistry


# Hand-crafted examples for common integrations
# These show natural user requests → tool mappings
CURATED_EXAMPLES = [
    # Gmail
    ("Send an email to my team about the meeting", "integration:gmail"),
    ("Email the weekly report to stakeholders", "integration:gmail"),
    ("Reply to the customer's inquiry", "integration:gmail"),
    ("Forward this message to the sales team", "integration:gmail"),

    # Slack
    ("Post an update to the #general channel", "integration:slack"),
    ("Send a message to the engineering team on Slack", "integration:slack"),
    ("Notify the team about the deployment", "integration:slack"),

    # Google Sheets
    ("Add a row to the sales spreadsheet", "integration:google_sheets"),
    ("Update the inventory numbers in the sheet", "integration:google_sheets"),
    ("Read data from the budget spreadsheet", "integration:google_sheets"),

    # Google Calendar
    ("Schedule a meeting for next Tuesday", "integration:google_calendar"),
    ("Create a calendar event for the team sync", "integration:google_calendar"),
    ("Check my availability for tomorrow", "integration:google_calendar"),

    # GitHub
    ("Create a new issue for the bug", "integration:github"),
    ("Open a pull request with my changes", "integration:github"),
    ("Comment on the PR review", "integration:github"),

    # Notion
    ("Create a new page in the project wiki", "integration:notion"),
    ("Update the meeting notes in Notion", "integration:notion"),
    ("Add a task to the project database", "integration:notion"),

    # Stripe
    ("Create an invoice for the customer", "integration:stripe"),
    ("Process a refund for the order", "integration:stripe"),
    ("Check the payment status", "integration:stripe"),

    # Shopify
    ("Add a new product to the store", "integration:shopify"),
    ("Update the inventory count", "integration:shopify"),
    ("Check recent orders", "integration:shopify"),

    # Airtable
    ("Add a record to the contacts base", "integration:airtable"),
    ("Update the project status in Airtable", "integration:airtable"),
    ("Query the leads database", "integration:airtable"),

    # Twilio
    ("Send an SMS to the customer", "integration:twilio"),
    ("Text the delivery confirmation", "integration:twilio"),

    # HubSpot
    ("Create a new contact in CRM", "integration:hubspot"),
    ("Update the deal stage", "integration:hubspot"),
    ("Log the sales call", "integration:hubspot"),

    # Jira
    ("Create a bug ticket", "integration:jira"),
    ("Update the sprint task", "integration:jira"),
    ("Move the issue to Done", "integration:jira"),

    # System agents
    ("Create a new database table for contacts", "agent:schema_builder"),
    ("Add a phone field to the users table", "agent:table_builder"),
    ("Build an app to view the orders", "agent:app_builder"),
    ("Create a dashboard for sales metrics", "agent:app_builder"),
    ("Design a database schema for the CRM", "agent:schema_builder"),
    ("Generate a report from the sales data", "agent:document_builder"),
    ("Create a skill to automate email responses", "agent:skill_builder"),
    ("Run the weekly report skill", "agent:skill_executor"),
    ("Search the web for competitor pricing", "agent:research_agent"),
]


def generate_task_variants(cap: Capability) -> list[str]:
    """Generate natural task variants from capability metadata."""
    tasks = []
    domain = cap.domain.replace("_", " ").title()

    # For system agents, create task variants from description
    if cap.type == CapabilityType.AGENT:
        # Use the description as base
        if cap.description:
            tasks.append(cap.description)

        # Create variants from actions + entities
        for action in cap.actions[:2]:
            for entity in cap.entities[:2]:
                tasks.append(f"{action.capitalize()} {entity}")

    # For integrations, create natural requests
    else:
        # Common action patterns
        for action in cap.actions[:3]:
            # Extract action verb (e.g., "gmail-send-email" -> "send email")
            action_clean = action.replace(f"{cap.domain}-", "").replace("-", " ")
            if action_clean and not action_clean.endswith("mcp"):
                tasks.append(f"{action_clean.capitalize()} using {domain}")

        # Generic integration task
        if cap.entities:
            tasks.append(f"Work with {cap.entities[0]} in {domain}")

    return tasks[:3]  # Limit to 3 variants per capability


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
        "Each example teaches: given a task (INPUT), use this tool (OUTPUT).",
        "",
        "Auto-generated + curated examples.",
        "Regenerate with: uv run python scripts/convert_capabilities_to_examples.py",
        '"""',
        "",
        "import dspy",
        "",
        "",
        "def _tool_example(task: str, tool_id: str) -> dspy.Example:",
        '    """Create a tool selection example.',
        "",
        "    Args:",
        "        task: Natural language request (INPUT)",
        "        tool_id: Tool to use for this task (OUTPUT)",
        '    """',
        "    return dspy.Example(",
        "        task=task,",
        "        tool_id=tool_id,",
        '    ).with_inputs("task")',
        "",
        "",
        "# Curated examples for common tasks",
        "CURATED_TOOL_EXAMPLES: list[dspy.Example] = [",
    ]

    # Add curated examples
    for task, tool_id in CURATED_EXAMPLES:
        lines.append(f'    _tool_example("{task}", "{tool_id}"),')

    lines.append("]")
    lines.append("")
    lines.append("")
    lines.append("# Generated examples from capability descriptions")
    lines.append("GENERATED_TOOL_EXAMPLES: list[dspy.Example] = [")

    # Generate examples from capabilities
    for cap in registry.all():
        tasks = generate_task_variants(cap)
        for task in tasks:
            # Escape quotes
            task_escaped = task.replace('"', '\\"').replace("\n", " ")
            if len(task_escaped) > 200:
                task_escaped = task_escaped[:197] + "..."
            lines.append(f'    _tool_example("{task_escaped}", "{cap.id}"),')

    lines.append("]")
    lines.append("")
    lines.append("")
    lines.append("# Combined: curated first (higher quality), then generated")
    lines.append("TOOL_EXAMPLES: list[dspy.Example] = CURATED_TOOL_EXAMPLES + GENERATED_TOOL_EXAMPLES")
    lines.append("")

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_python_code(), file=sys.stdout)
