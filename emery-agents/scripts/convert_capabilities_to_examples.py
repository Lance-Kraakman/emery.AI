#!/usr/bin/env python3
"""
Convert capabilities to dspy.Example for KNNFewShot tool selection.

This script converts Capability objects into dspy.Example format suitable
for KNNFewShot. Each example maps a natural language task to a tool.

Usage:
    # Generate examples from all capabilities
    uv run python scripts/convert_capabilities_to_examples.py

    # With specific prefix filter
    uv run python scripts/convert_capabilities_to_examples.py --prefix integration:

    # Output to file
    uv run python scripts/convert_capabilities_to_examples.py --output tool_examples.json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import dspy

from emery_agents.entities.models.capability import Capability, CapabilityType
from emery_agents.tools.capability_bootstrap import (
    populate_integration_services,
    populate_system_agents,
)
from emery_agents.tools.capability_registry import CapabilityRegistry

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def capability_to_example(cap: Capability) -> dspy.Example:
    """Convert a Capability to a dspy.Example for KNNFewShot.

    Creates an example that teaches the model:
    - Given a task description → use this tool

    The 'task' field is synthesized from the capability's description,
    actions, and entities to create natural language queries.
    """
    # Synthesize a natural task description
    task = _synthesize_task(cap)

    return dspy.Example(
        task=task,
        tool_id=cap.id,
        tool_name=cap.name,
        tool_type=cap.type.value,
        tool_domain=cap.domain,
        tool_description=cap.description,
        tool_actions=cap.actions,
        tool_entities=cap.entities,
    ).with_inputs("task")


def _synthesize_task(cap: Capability) -> str:
    """Synthesize a natural language task from capability metadata.

    Examples:
        gmail_send_email → "Send an email using Gmail"
        schema_builder → "Create database tables and fields"
        slack_post_message → "Post a message to Slack"
    """
    # For system agents (emery domain), use description directly - they're well-written
    if cap.domain == "emery" and cap.description:
        return cap.description.strip()

    # For integrations, create a concise task based on domain and primary actions
    if cap.id.startswith("integration:"):
        return _synthesize_integration_task(cap)

    # For other tools, try to extract meaningful task
    desc = cap.description.strip()

    # Skip verbose descriptions that start with integration pattern
    if " integration (" in desc.lower():
        return _synthesize_integration_task(cap)

    # If description is concise and action-oriented, use it
    if desc and len(desc) < 100 and not desc.startswith(("This ", "A ", "The ")):
        return desc

    # Synthesize from actions and entities
    if cap.actions and cap.entities:
        action = _humanize_action(cap.actions[0])
        entity = cap.entities[0]
        domain = _humanize_domain(cap.domain)
        if domain:
            return f"{action} {entity} using {domain}"
        return f"{action} {entity}"

    if cap.actions:
        action = _humanize_action(cap.actions[0])
        domain = _humanize_domain(cap.domain)
        return f"{action} using {domain}" if domain else action

    # Fallback
    return f"Use {_humanize_domain(cap.domain) or cap.name}"


def _synthesize_integration_task(cap: Capability) -> str:
    """Create a concise task for integration capabilities.

    Instead of: "gmail integration (21 actions): Emit new event..."
    Create: "Send emails, manage labels, and handle attachments using Gmail"
    """
    domain = _humanize_domain(cap.domain)

    # Prioritize actual actions over event triggers
    # Actions typically: send, create, update, delete, get, list, add, remove
    # Events typically: new-*, emit, watch, trigger
    action_verbs = {"send", "create", "update", "delete", "get", "list", "add", "remove", "post", "upload", "download"}
    event_prefixes = {"new-", "emit", "watch", "trigger"}

    actions_list = []
    events_list = []

    for action in cap.actions:
        # Skip generic MCP actions
        if action.endswith("-mcp") or "generic" in action.lower():
            continue

        # Extract the action part (e.g., "gmail-send-email" → "send email")
        action_part = action.replace(f"{cap.domain}-", "").replace("_", "-")

        # Check if it's an event or action
        is_event = any(action_part.startswith(prefix) for prefix in event_prefixes)
        first_word = action_part.split("-")[0] if "-" in action_part else action_part

        if is_event:
            events_list.append(action_part.replace("-", " "))
        elif first_word in action_verbs:
            actions_list.append(action_part.replace("-", " "))
        else:
            actions_list.append(action_part.replace("-", " "))

    # Prefer actions over events
    meaningful = actions_list[:3] if actions_list else events_list[:3]

    if meaningful:
        if len(meaningful) == 1:
            return f"{meaningful[0].capitalize()} using {domain}"
        elif len(meaningful) == 2:
            return f"{meaningful[0].capitalize()} and {meaningful[1]} using {domain}"
        else:
            primary = meaningful[0].capitalize()
            return f"{primary}, {meaningful[1]}, {meaningful[2]} using {domain}"

    # Fallback to simple domain-based task
    return f"Integrate with {domain}"


def _humanize_action(action: str) -> str:
    """Convert action ID to human-readable form."""
    # Remove domain prefix if present (e.g., "gmail-send-email" → "send-email")
    if "-" in action:
        parts = action.split("-")
        # Skip first part if it looks like a domain
        if len(parts) > 1 and len(parts[0]) > 2:
            action = "-".join(parts[1:]) if parts[1] else action

    # Convert to title case with spaces
    return action.replace("-", " ").replace("_", " ").capitalize()


def _humanize_domain(domain: str) -> str:
    """Convert domain ID to human-readable form."""
    if not domain or domain == "emery":
        return ""

    # Remove leading underscores (e.g., "_0codekit" → "0codekit")
    domain = domain.lstrip("_")

    # Known domain mappings
    domain_names = {
        "gmail": "Gmail",
        "slack": "Slack",
        "github": "GitHub",
        "google_sheets": "Google Sheets",
        "google_docs": "Google Docs",
        "google_calendar": "Google Calendar",
        "google_drive": "Google Drive",
        "microsoft_outlook": "Outlook",
        "microsoft_teams": "Teams",
        "notion": "Notion",
        "airtable": "Airtable",
        "shopify": "Shopify",
        "stripe": "Stripe",
        "twilio": "Twilio",
        "sendgrid": "SendGrid",
        "mailchimp": "Mailchimp",
        "hubspot": "HubSpot",
        "salesforce": "Salesforce",
        "zendesk": "Zendesk",
        "jira": "Jira",
        "asana": "Asana",
        "trello": "Trello",
        "dropbox": "Dropbox",
        "aws": "AWS",
        "azure": "Azure",
        "openai": "OpenAI",
    }

    if domain.lower() in domain_names:
        return domain_names[domain.lower()]

    # Title case for unknown domains
    return domain.replace("_", " ").replace("-", " ").title()


def capability_to_dict(cap: Capability, example: dspy.Example) -> dict[str, Any]:
    """Convert capability + example to serializable dict."""
    return {
        "capability_id": cap.id,
        "capability_name": cap.name,
        "capability_type": cap.type.value,
        "capability_domain": cap.domain,
        "capability_description": cap.description,
        "capability_actions": cap.actions,
        "capability_entities": cap.entities,
        "synthesized_task": example.task,
        "example_inputs": list(example.inputs().keys()),
    }


def convert_capabilities(
    registry: CapabilityRegistry,
    prefix: str | None = None,
    capability_type: CapabilityType | None = None,
) -> list[tuple[Capability, dspy.Example]]:
    """Convert all matching capabilities to examples.

    Args:
        registry: Capability registry with loaded capabilities
        prefix: Optional ID prefix filter (e.g., "integration:", "agent:")
        capability_type: Optional type filter

    Returns:
        List of (capability, example) tuples
    """
    results = []

    for cap in registry.all():
        # Apply filters
        if prefix and not cap.id.startswith(prefix):
            continue
        if capability_type and cap.type != capability_type:
            continue

        example = capability_to_example(cap)
        results.append((cap, example))

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert capabilities to dspy.Example")
    parser.add_argument(
        "--prefix",
        type=str,
        default=None,
        help="Filter by ID prefix (e.g., 'integration:', 'agent:')",
    )
    parser.add_argument(
        "--type",
        type=str,
        choices=["agent", "skill", "tool"],
        default=None,
        help="Filter by capability type",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file path (JSON). If not specified, prints to stdout.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of capabilities to convert",
    )
    parser.add_argument(
        "--stats-only",
        action="store_true",
        help="Only show statistics, don't output examples",
    )
    args = parser.parse_args()

    # Initialize registry and load capabilities
    logger.info("Initializing capability registry...")
    registry = CapabilityRegistry()

    logger.info("Loading system agents...")
    agent_count = populate_system_agents(registry)
    logger.info(f"  Loaded {agent_count} system agents")

    logger.info("Loading integration services...")
    integration_count = populate_integration_services(registry)
    logger.info(f"  Loaded {integration_count} integration services")

    total = registry.count()
    logger.info(f"Total capabilities: {total}")

    # Convert capabilities
    cap_type = CapabilityType(args.type) if args.type else None
    results = convert_capabilities(registry, prefix=args.prefix, capability_type=cap_type)

    if args.limit:
        results = results[: args.limit]

    logger.info(f"Converted {len(results)} capabilities to examples")

    # Show statistics
    if args.stats_only:
        by_type: dict[str, int] = {}
        by_domain: dict[str, int] = {}
        for cap, _ in results:
            by_type[cap.type.value] = by_type.get(cap.type.value, 0) + 1
            by_domain[cap.domain] = by_domain.get(cap.domain, 0) + 1

        logger.info("\nBy type:")
        for t, count in sorted(by_type.items()):
            logger.info(f"  {t}: {count}")

        logger.info("\nTop 20 domains:")
        for domain, count in sorted(by_domain.items(), key=lambda x: -x[1])[:20]:
            logger.info(f"  {domain}: {count}")
        return

    # Output examples
    output_data = [capability_to_dict(cap, ex) for cap, ex in results]

    if args.output:
        output_path = Path(args.output)
        output_path.write_text(json.dumps(output_data, indent=2))
        logger.info(f"Wrote {len(output_data)} examples to {output_path}")
    else:
        # Print sample to stdout
        logger.info("\nSample examples:")
        for item in output_data[:5]:
            logger.info(f"\n  Task: {item['synthesized_task']}")
            logger.info(f"  Tool: {item['capability_id']}")
            logger.info(f"  Domain: {item['capability_domain']}")

        if len(output_data) > 5:
            logger.info(f"\n  ... and {len(output_data) - 5} more")


if __name__ == "__main__":
    main()
