"""
Tool-specific instruction loader.

Builds contextual tool instructions based on:
1. Available tools passed to agent
2. Tool categories (email, messaging, etc.)
3. Specific integrations (gmail, slack, etc.)

AIDEV-NOTE: Only includes instructions for tools actually available to the agent.
This keeps prompts focused and avoids confusing the model with irrelevant instructions.

Usage:
    from emery_agents.prompts.tools import get_tool_instructions

    # Build instructions for available tools
    tool_instructions = get_tool_instructions(tools)
    if tool_instructions:
        full_instructions = f"{base_instructions}\n\n{tool_instructions}"
"""

import logging
from typing import List, Any, Set

from .. import get_loader

logger = logging.getLogger(__name__)


# Map tool prefixes to integration-specific templates
INTEGRATION_MAP = {
    "gmail": "tools/integrations/gmail.j2",
    "slack": "tools/integrations/slack.j2",
    "slack_bot": "tools/integrations/slack.j2",
    "microsoft_365": "tools/integrations/microsoft_365.j2",
    "microsoft_teams": "tools/integrations/microsoft_365.j2",
    "google_sheets": "tools/integrations/google_sheets.j2",
    "google_calendar": "tools/integrations/google_calendar.j2",
}

# Map tool prefixes to category templates (generic patterns)
CATEGORY_MAP = {
    # Email integrations
    "gmail": "tools/categories/email.j2",
    "amazon_ses": "tools/categories/email.j2",
    "outlook": "tools/categories/email.j2",
    "sendgrid": "tools/categories/email.j2",
    "mailgun": "tools/categories/email.j2",
    # Messaging integrations
    "slack": "tools/categories/messaging.j2",
    "slack_bot": "tools/categories/messaging.j2",
    "microsoft_teams": "tools/categories/messaging.j2",
    "discord": "tools/categories/messaging.j2",
    "telegram": "tools/categories/messaging.j2",
    # Calendar integrations
    "google_calendar": "tools/categories/calendar.j2",
    "microsoft_365_calendar": "tools/categories/calendar.j2",
    "calendly": "tools/categories/calendar.j2",
    # Spreadsheet integrations
    "google_sheets": "tools/categories/spreadsheet.j2",
    "airtable": "tools/categories/spreadsheet.j2",
}

# Emery internal tool templates
EMERY_TOOL_MAP = {
    "table_crud": "tools/emery/table_crud.j2",
    "skill_crud": "tools/emery/skill_crud.j2",
    "agent_crud": "tools/emery/agent_crud.j2",
    "file_crud": "tools/emery/file_crud.j2",
    "document_crud": "tools/emery/document_crud.j2",
    "database_crud": "tools/emery/crud_operations.j2",
    "team_crud": "tools/emery/crud_operations.j2",
}

# Template for dynamic skill execution tools (from @skill:name references)
# These are prefix-matched, not exact-matched like EMERY_TOOL_MAP
SKILL_EXECUTION_TEMPLATE = "tools/emery/skill_execution.j2"


def get_tool_instructions(tools: List[Any]) -> str:
    """
    Build tool-specific instructions based on available tools.

    Analyzes the tools passed to an agent and renders relevant instruction
    templates. Uses a layered approach:
    1. Emery tools get specific instructions
    2. External tools get category instructions (email, messaging, etc.)
    3. Popular integrations get additional specific instructions (gmail, slack)

    Args:
        tools: List of tool objects with .name attribute

    Returns:
        Rendered tool instructions string, or empty string if no relevant templates
    """
    if not tools:
        return ""

    # Extract tool names
    tool_names = {t.name for t in tools if hasattr(t, 'name')}

    if not tool_names:
        return ""

    templates_to_render: Set[str] = set()
    seen_categories: Set[str] = set()

    # Check for skill execution tools (skill_* from @skill:name, NOT skill_crud)
    # These are dynamic tools created when user references a skill
    for tool_name in tool_names:
        if tool_name.startswith("skill_") and tool_name != "skill_crud":
            templates_to_render.add(SKILL_EXECUTION_TEMPLATE)
            logger.info(f"📝 Adding skill execution template for: {tool_name}")
            break  # Only need to add template once

    # Check for emery tools (exact match)
    for tool_name, template in EMERY_TOOL_MAP.items():
        if tool_name in tool_names:
            templates_to_render.add(template)
            logger.debug(f"📝 Adding emery tool template: {template}")

    # Check for integration-specific tools
    for tool_name in tool_names:
        # Check integration templates
        for prefix, template in INTEGRATION_MAP.items():
            if tool_name.startswith(prefix) or tool_name.startswith(f"{prefix}-"):
                templates_to_render.add(template)
                logger.debug(f"📝 Adding integration template: {template}")

                # Also add category template (but only once per category)
                if prefix in CATEGORY_MAP:
                    cat_template = CATEGORY_MAP[prefix]
                    if cat_template not in seen_categories:
                        templates_to_render.add(cat_template)
                        seen_categories.add(cat_template)
                        logger.debug(f"📝 Adding category template: {cat_template}")
                break

        # Check category templates for tools not in integration map
        for prefix, template in CATEGORY_MAP.items():
            if tool_name.startswith(prefix) or tool_name.startswith(f"{prefix}-"):
                if template not in seen_categories:
                    templates_to_render.add(template)
                    seen_categories.add(template)
                    logger.debug(f"📝 Adding category template: {template}")
                break

    if not templates_to_render:
        logger.debug("📝 No tool-specific templates to render")
        return ""

    # Render and combine all relevant templates
    loader = get_loader()
    parts = []

    # Sort to ensure consistent ordering (categories before integrations)
    for template in sorted(templates_to_render):
        try:
            rendered = loader.render(template, tools=tools, tool_names=tool_names)
            if rendered.strip():
                parts.append(rendered)
                logger.debug(f"📝 Rendered template '{template}' ({len(rendered)} chars)")
        except Exception as e:
            logger.warning(f"⚠️ Failed to render tool template '{template}': {e}")

    if not parts:
        return ""

    combined = "\n\n".join(parts)
    logger.info(f"📝 Built tool instructions from {len(parts)} templates ({len(combined)} chars)")
    return combined
