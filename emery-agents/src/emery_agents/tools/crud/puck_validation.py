"""
Puck templateData validation against the blocks schema.

Validates that templateData conforms to the Puck blocks schema,
checking for valid block types, required props, enum values, and
parent constraints (e.g., field blocks must be inside DataBlock zones).

## What We Validate (Structural)
- Block type exists in schema
- Required props are present
- Enum values are valid
- DataBlock parent constraints (field blocks must be in zones)

## TODO: Future Workspace-Aware Validation (requires database context)
- [ ] viewId references a valid view in the workspace
- [ ] fieldId references a valid field in the referenced view's table
- [ ] Prop type checking (e.g., viewId should be number, not string)
- [ ] Slot children validation (what blocks can go in which slots)
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Path to blocks-schema.generated.json relative to this file
# This file is at: emery-agents/src/emery_agents/tools/crud/puck_validation.py
# Schema is at: src/components/puck/blocks-schema.generated.json
# So we go up 5 levels to repo root, then down to src/components/puck
SCHEMA_PATH = (
    Path(__file__).parents[5]
    / "src"
    / "components"
    / "puck"
    / "blocks-schema.generated.json"
)


@lru_cache(maxsize=1)
def load_puck_schema() -> dict[str, Any]:
    """Load Puck blocks schema with caching.

    Returns:
        The parsed blocks schema dictionary.

    Raises:
        FileNotFoundError: If the schema file doesn't exist.
        json.JSONDecodeError: If the schema file is invalid JSON.
    """
    logger.info(f"Loading Puck blocks schema from: {SCHEMA_PATH}")
    with open(SCHEMA_PATH) as f:
        schema = json.load(f)
    logger.info(f"Loaded schema with {len(schema.get('blocks', {}))} block types")
    return schema


def validate_puck_template(template_data: dict[str, Any]) -> list[str]:
    """Validate templateData against Puck blocks schema.

    Checks:
    - Block types exist in schema
    - Required props are present
    - Enum values are valid
    - Parent constraints are satisfied (e.g., TextField requires DataBlock parent)

    Args:
        template_data: The templateData object with content, root, and zones.

    Returns:
        List of validation error messages (empty if valid).
    """
    try:
        schema = load_puck_schema()
    except FileNotFoundError:
        logger.warning(f"Puck schema not found at {SCHEMA_PATH}, skipping validation")
        return []  # Don't block if schema file missing
    except json.JSONDecodeError as e:
        logger.warning(f"Invalid Puck schema JSON: {e}, skipping validation")
        return []

    errors: list[str] = []

    # Validate content blocks (top-level blocks)
    content = template_data.get("content", [])
    if isinstance(content, list):
        for _idx, block in enumerate(content):
            if isinstance(block, dict):
                block_errors = _validate_block(block, schema, parent_zone=None)
                errors.extend(block_errors)

    # Validate zone blocks (nested blocks inside slots)
    zones = template_data.get("zones", {})
    if isinstance(zones, dict):
        for zone_name, zone_blocks in zones.items():
            if isinstance(zone_blocks, list):
                for _idx, block in enumerate(zone_blocks):
                    if isinstance(block, dict):
                        block_errors = _validate_block(
                            block, schema, parent_zone=zone_name
                        )
                        errors.extend(block_errors)

    return errors


def _validate_block(
    block: dict[str, Any],
    schema: dict[str, Any],
    parent_zone: str | None = None,
) -> list[str]:
    """Validate a single block against the schema.

    Args:
        block: The block object with type and props.
        schema: The full Puck blocks schema.
        parent_zone: The zone name if this block is nested, None if top-level.

    Returns:
        List of validation error messages for this block.
    """
    errors: list[str] = []
    block_type = block.get("type")
    props = block.get("props", {})

    if not block_type:
        errors.append("Block missing 'type' property")
        return errors

    # Check block type exists in schema
    blocks_schema = schema.get("blocks", {})
    if block_type not in blocks_schema:
        errors.append(f"Unknown block type: '{block_type}'")
        return errors

    block_schema = blocks_schema[block_type]

    # Check required props (skip 'id' as it's auto-generated)
    props_schema = block_schema.get("props", {})
    for prop_name, prop_def in props_schema.items():
        if prop_def.get("required") and prop_name != "id":
            if prop_name not in props:
                errors.append(f"{block_type}: missing required prop '{prop_name}'")

    # Check enum values
    if isinstance(props, dict):
        for prop_name, value in props.items():
            prop_def = props_schema.get(prop_name, {})
            if "enum" in prop_def:
                allowed_values = prop_def["enum"]
                if value not in allowed_values:
                    errors.append(
                        f"{block_type}.{prop_name}: invalid value '{value}', "
                        f"must be one of {allowed_values}"
                    )

    # Check parent constraints
    # Some blocks require being inside a DataBlock (in zones, not root content)
    requires = block_schema.get("requires")
    if requires and "DataBlock" in requires:
        if parent_zone is None:
            errors.append(
                f"{block_type}: must be inside a DataBlock (in zones), not in root content. "
                f"Move this block to a zone like 'data-block-id:children'."
            )

    return errors


def get_valid_block_types() -> list[str]:
    """Get list of valid block type names.

    Returns:
        List of block type names from the schema.
    """
    try:
        schema = load_puck_schema()
        return list(schema.get("blocks", {}).keys())
    except Exception:
        return []


def get_block_schema(block_type: str) -> dict[str, Any] | None:
    """Get the schema definition for a specific block type.

    Args:
        block_type: The block type name (e.g., "Hero", "TableBlock").

    Returns:
        The block's schema definition or None if not found.
    """
    try:
        schema = load_puck_schema()
        return schema.get("blocks", {}).get(block_type)
    except Exception:
        return None
