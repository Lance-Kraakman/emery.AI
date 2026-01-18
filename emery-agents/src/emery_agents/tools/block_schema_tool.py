"""
Block Schema Tool

Provides on-demand access to Puck block schemas for agents.
Enables schema lookup, validation, and block reference generation.

Usage:
    # List all blocks (categorized)
    block_schema(action="list")

    # Get detailed schema for specific blocks
    block_schema(action="get", block_types=["Hero", "Card", "Button"])

    # Validate templateData before creating page
    block_schema(action="validate", template_data={...})
"""

import json
import logging
from typing import Any, Dict, List, Optional

from smolagents import Tool

from .validators.puck_validator import (
    get_all_block_names,
    get_blocks_schema,
    render_block_reference,
    validate_page_template,
    PuckValidator,
)

logger = logging.getLogger(__name__)


# Block categories for organized listing
BLOCK_CATEGORIES = {
    "Layout": ["Grid", "Flex", "Container", "Space", "Divider"],
    "Typography": ["Heading", "Text"],
    "Actions": ["Button", "LinkBlock"],
    "Authentication": ["LoginBlock", "SignOutBlock"],
    "Data": ["DataBlock", "TableBlock", "MetricBlock", "ChartBlock", "FormBlock"],
    "Fields": [
        "TextField", "NumberField", "BooleanField", "DateField",
        "SelectField", "ImageField", "FileField", "DocumentField",
        "RelationField", "LinkField"
    ],
    "Logic": ["ConditionalBlock"],
    "Content": ["EditorBlock", "MarkdownBlock"],
    "Structure": ["HeaderBlock", "FooterBlock"],
    "Templates": ["Hero", "Card", "Logos", "Stats"],
}


def render_block_list() -> str:
    """Render all blocks categorized for easy reference."""
    lines = ["## Available Puck Blocks (38 total)", ""]

    for category, blocks in BLOCK_CATEGORIES.items():
        lines.append(f"**{category}:** {', '.join(blocks)}")

    lines.append("")
    lines.append("Use block_schema(action='get', block_types=[...]) for detailed props.")

    return "\n".join(lines)


def format_validation_errors(errors: List[Dict[str, str]]) -> str:
    """Format validation errors for LLM consumption."""
    if not errors:
        return "No errors"

    lines = []
    for i, error in enumerate(errors[:5], 1):
        path = error.get("path", "root")
        message = error.get("message", "Unknown error")
        lines.append(f"{i}. {path}: {message}")

    if len(errors) > 5:
        lines.append(f"... and {len(errors) - 5} more errors")

    return "\n".join(lines)


class BlockSchemaTool(Tool):
    """
    Tool for accessing Puck block schemas.

    Provides three actions:
    - list: Get all available block types (categorized)
    - get: Get detailed schema for specific block types
    - validate: Validate templateData structure before creating pages
    """

    name = "block_schema"
    description = (
        "Get Puck block schema for validation and reference. "
        "Use 'list' to see all blocks, 'get' to get detailed props for specific blocks, "
        "'validate' to check templateData before creating a page."
    )

    inputs = {
        "action": {
            "type": "string",
            "description": "Action to perform: 'list' (all blocks), 'get' (specific blocks), 'validate' (check templateData)",
        },
        "block_types": {
            "type": "array",
            "description": "Block types to get schema for (required for 'get' action). Example: ['Hero', 'Card', 'Button']",
            "nullable": True,
        },
        "template_data": {
            "type": "object",
            "description": "templateData object to validate (required for 'validate' action)",
            "nullable": True,
        },
    }

    output_type = "string"

    def forward(
        self,
        action: str,
        block_types: Optional[List[str]] = None,
        template_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Execute the block schema action."""
        action = action.lower().strip()

        if action == "list":
            return self._handle_list()
        elif action == "get":
            return self._handle_get(block_types)
        elif action == "validate":
            return self._handle_validate(template_data)
        else:
            return f"FAILED: Unknown action '{action}'. Use 'list', 'get', or 'validate'."

    def _handle_list(self) -> str:
        """List all available blocks categorized."""
        return render_block_list()

    def _handle_get(self, block_types: Optional[List[str]]) -> str:
        """Get detailed schema for specific blocks."""
        if not block_types:
            return "FAILED: block_types required for 'get' action. Example: block_types=['Hero', 'Card']"

        # Handle string input (LLMs sometimes pass strings)
        if isinstance(block_types, str):
            block_types = [b.strip() for b in block_types.split(",")]

        # Get schemas
        schemas = get_blocks_schema(block_types)

        if not schemas:
            all_blocks = get_all_block_names()
            return f"FAILED: No matching blocks found. Valid blocks: {', '.join(all_blocks[:10])}..."

        # Format output
        lines = []
        for block_type, schema in schemas.items():
            description = schema.get("description", "No description")
            props = schema.get("props", {})

            lines.append(f"## {block_type}")
            lines.append(f"{description}")
            lines.append("")
            lines.append("**Props:**")

            for prop_name, prop_def in props.items():
                prop_type = prop_def.get("type", "any")
                required = " (required)" if prop_def.get("required") else ""
                default = prop_def.get("default")
                default_str = f" [default: {default}]" if default is not None else ""

                lines.append(f"- `{prop_name}`: {prop_type}{required}{default_str}")

                # Show enum options if applicable
                if prop_type == "enum" and "enum" in prop_def:
                    options = prop_def["enum"]
                    lines.append(f"  Options: {options}")

            lines.append("")

        # Check for missing blocks
        missing = set(block_types) - set(schemas.keys())
        if missing:
            lines.append(f"**Not found:** {', '.join(missing)}")
            all_blocks = get_all_block_names()
            lines.append(f"**Available:** {', '.join(all_blocks)}")

        return "\n".join(lines)

    def _handle_validate(self, template_data: Optional[Dict[str, Any]]) -> str:
        """Validate templateData structure."""
        if template_data is None:
            return "FAILED: template_data required for 'validate' action"

        # Handle JSON string input
        if isinstance(template_data, str):
            try:
                template_data = json.loads(template_data)
            except json.JSONDecodeError as e:
                return f"FAILED: Invalid JSON - {e}"

        if not isinstance(template_data, dict):
            return f"FAILED: template_data must be object, got {type(template_data).__name__}"

        # Validate
        is_valid, errors = validate_page_template(template_data)

        if is_valid:
            # Count blocks for confirmation
            content_count = len(template_data.get("content", []))
            zones = template_data.get("zones", {})
            zone_count = sum(len(z) for z in zones.values() if isinstance(z, list))

            return f"VALID: templateData is correct ({content_count} content blocks, {zone_count} zone blocks)"
        else:
            error_details = format_validation_errors(errors)
            return f"INVALID: Fix these errors:\n{error_details}"


# Convenience function for direct import
def create_block_schema_tool() -> BlockSchemaTool:
    """Create a BlockSchemaTool instance."""
    return BlockSchemaTool()
