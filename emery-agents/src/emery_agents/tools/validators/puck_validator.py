"""
Puck templateData Validator

Validates Puck page templateData against generated JSON Schema.
Catches errors like invalid block types, missing required props,
and structural issues before they reach the frontend.

AIDEV-NOTE: This validator uses the generated blocks-schema.generated.json
which is created by running `pnpm generate:blocks-schema` from the TypeScript
source files. Falls back to manual blocks-schema.json if generated not found.

Usage:
    from emery_agents.tools.validators import validate_page_template

    is_valid, errors = validate_page_template(template_data)
    if not is_valid:
        # Handle validation errors
        for error in errors:
            print(f"{error['path']}: {error['message']}")
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


class PuckValidationError(Exception):
    """Raised when templateData validation fails."""

    def __init__(self, errors: List[Dict[str, Any]]):
        self.errors = errors
        message = "; ".join(e.get("message", str(e)) for e in errors[:5])
        if len(errors) > 5:
            message += f" (and {len(errors) - 5} more errors)"
        super().__init__(f"Template validation failed: {message}")


class PuckValidator:
    """
    Validates Puck templateData structure and block definitions.

    Uses generated JSON schema for comprehensive validation including:
    - Valid block types (no "HeroSection", must be "Hero")
    - Required props per block type
    - Correct prop types (string, number, enum values)
    - Proper zones structure for nested content

    The validator loads schema once and caches it for performance.
    """

    _schema: Optional[Dict[str, Any]] = None
    _valid_blocks: Optional[Set[str]] = None

    # Path resolution: go up from validators/ to emery-agents root, then to frontend
    _schema_dir: Path = Path(__file__).parent.parent.parent.parent.parent.parent / "src/components/puck"

    @classmethod
    def load_schema(cls) -> Dict[str, Any]:
        """Load and cache the blocks schema from generated file."""
        if cls._schema is None:
            # Use ONLY the generated schema - run `pnpm generate:blocks-schema` to create it
            schema_path = cls._schema_dir / "blocks-schema.generated.json"

            if not schema_path.exists():
                logger.warning(
                    f"Generated blocks schema not found at {schema_path}. "
                    "Run `pnpm generate:blocks-schema` to generate it. Using minimal validation."
                )
                cls._schema = {"blocks": {}}
                cls._valid_blocks = set()
                return cls._schema

            try:
                with open(schema_path) as f:
                    cls._schema = json.load(f)
                cls._valid_blocks = set(cls._schema.get("blocks", {}).keys())
                logger.info(f"Loaded Puck blocks schema with {len(cls._valid_blocks)} blocks")
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"Failed to load blocks schema: {e}")
                cls._schema = {"blocks": {}}
                cls._valid_blocks = set()

        return cls._schema

    @classmethod
    def get_valid_blocks(cls) -> Set[str]:
        """Get set of valid block type names."""
        if cls._valid_blocks is None:
            cls.load_schema()
        return cls._valid_blocks or set()

    @classmethod
    def validate_template_data(cls, template_data: Dict[str, Any]) -> Tuple[bool, List[Dict[str, str]]]:
        """
        Validate complete templateData structure.

        Args:
            template_data: The templateData dict to validate

        Returns:
            Tuple of (is_valid, errors_list)

        Validates:
        - Root structure (root, content, zones keys)
        - Block types exist in schema
        - Blocks have 'props' object
        - Required props are present
        - Prop types match schema (basic type checking)
        """
        errors: List[Dict[str, str]] = []
        schema = cls.load_schema()
        valid_blocks = cls.get_valid_blocks()

        # 1. Validate root structure
        if not isinstance(template_data, dict):
            errors.append({
                "path": "",
                "message": f"templateData must be object, got {type(template_data).__name__}"
            })
            return False, errors

        # Check required top-level keys
        if "root" not in template_data:
            errors.append({"path": "", "message": "Missing required key: root"})
        if "content" not in template_data:
            errors.append({"path": "", "message": "Missing required key: content"})

        # 2. Validate content array
        content = template_data.get("content", [])
        if not isinstance(content, list):
            errors.append({
                "path": "content",
                "message": f"content must be array, got {type(content).__name__}"
            })
        else:
            for i, block in enumerate(content):
                block_errors = cls._validate_block(block, f"content[{i}]", valid_blocks, schema)
                errors.extend(block_errors)

        # 3. Validate zones
        zones = template_data.get("zones", {})
        if zones and not isinstance(zones, dict):
            errors.append({
                "path": "zones",
                "message": f"zones must be object, got {type(zones).__name__}"
            })
        elif zones:
            for zone_key, zone_content in zones.items():
                if not isinstance(zone_content, list):
                    errors.append({
                        "path": f"zones.{zone_key}",
                        "message": "zone content must be array"
                    })
                else:
                    for i, block in enumerate(zone_content):
                        block_errors = cls._validate_block(
                            block, f"zones.{zone_key}[{i}]", valid_blocks, schema
                        )
                        errors.extend(block_errors)

        return len(errors) == 0, errors

    @classmethod
    def _validate_block(
        cls,
        block: Any,
        path: str,
        valid_blocks: Set[str],
        schema: Dict[str, Any]
    ) -> List[Dict[str, str]]:
        """Validate a single block definition."""
        errors: List[Dict[str, str]] = []

        # Must be a dict
        if not isinstance(block, dict):
            errors.append({
                "path": path,
                "message": f"block must be object, got {type(block).__name__}"
            })
            return errors

        # Must have 'type' field
        if "type" not in block:
            errors.append({
                "path": path,
                "message": "block missing required 'type' field"
            })
            return errors

        block_type = block.get("type")
        if not isinstance(block_type, str):
            errors.append({
                "path": f"{path}.type",
                "message": f"block type must be string, got {type(block_type).__name__}"
            })
            return errors

        # Validate block type exists
        if valid_blocks and block_type not in valid_blocks:
            suggestions = cls._get_suggestions(block_type, valid_blocks)
            suggestion_str = f" Did you mean: {', '.join(suggestions)}?" if suggestions else ""
            errors.append({
                "path": f"{path}.type",
                "message": f"Unknown block type '{block_type}'.{suggestion_str}"
            })
            return errors

        # Validate props exist (blocks should have props)
        if "props" not in block:
            errors.append({
                "path": path,
                "message": f"block '{block_type}' missing 'props' field"
            })
            return errors

        props = block.get("props")
        if not isinstance(props, dict):
            errors.append({
                "path": f"{path}.props",
                "message": f"props must be object, got {type(props).__name__}"
            })
            return errors

        # Validate required props for this block type
        block_schema = schema.get("blocks", {}).get(block_type, {})
        prop_schemas = block_schema.get("props", {})

        for prop_name, prop_def in prop_schemas.items():
            if isinstance(prop_def, dict) and prop_def.get("required"):
                if prop_name not in props:
                    errors.append({
                        "path": f"{path}.props",
                        "message": f"block '{block_type}' missing required prop: {prop_name}"
                    })

        # Validate prop types (optional deep validation)
        for prop_name, prop_value in props.items():
            prop_schema = prop_schemas.get(prop_name)
            if prop_schema:
                prop_errors = cls._validate_prop(
                    prop_value, prop_schema, f"{path}.props.{prop_name}"
                )
                errors.extend(prop_errors)

        return errors

    @classmethod
    def _validate_prop(
        cls,
        value: Any,
        schema: Dict[str, Any],
        path: str
    ) -> List[Dict[str, str]]:
        """Validate a single prop value against its schema."""
        errors: List[Dict[str, str]] = []

        prop_type = schema.get("type")

        # Skip validation for complex/any types
        if prop_type in ("any", "object", "slot", None):
            return errors

        # Type checking
        if prop_type == "string" and not isinstance(value, str):
            # Allow numbers/booleans that can be stringified
            if not isinstance(value, (str, int, float, bool)):
                errors.append({
                    "path": path,
                    "message": f"expected string, got {type(value).__name__}"
                })

        elif prop_type == "number":
            if not isinstance(value, (int, float)):
                errors.append({
                    "path": path,
                    "message": f"expected number, got {type(value).__name__}"
                })

        elif prop_type == "boolean":
            if not isinstance(value, bool):
                errors.append({
                    "path": path,
                    "message": f"expected boolean, got {type(value).__name__}"
                })

        elif prop_type == "array":
            if not isinstance(value, list):
                errors.append({
                    "path": path,
                    "message": f"expected array, got {type(value).__name__}"
                })

        elif prop_type == "enum":
            options = schema.get("enum", [])
            if options and value not in options:
                errors.append({
                    "path": path,
                    "message": f"invalid enum value '{value}', expected one of: {options}"
                })

        return errors

    @classmethod
    def _get_suggestions(cls, invalid_type: str, valid_types: Set[str]) -> List[str]:
        """Get fuzzy match suggestions for invalid block type."""
        invalid_lower = invalid_type.lower()
        suggestions: List[str] = []

        for valid in valid_types:
            valid_lower = valid.lower()

            # Check if invalid contains valid or vice versa
            if invalid_lower in valid_lower or valid_lower in invalid_lower:
                suggestions.append(valid)

            # Check common misspellings/variations
            elif invalid_lower.replace("section", "") == valid_lower:
                suggestions.append(valid)
            elif invalid_lower.replace("block", "") == valid_lower:
                suggestions.append(valid)
            elif invalid_lower.replace("component", "") == valid_lower:
                suggestions.append(valid)

        return suggestions[:3]  # Max 3 suggestions

    @classmethod
    def reset_cache(cls) -> None:
        """Reset the cached schema (for testing or schema updates)."""
        cls._schema = None
        cls._valid_blocks = None


def validate_page_template(template_data: Dict[str, Any]) -> Tuple[bool, List[Dict[str, str]]]:
    """
    Convenience function to validate page templateData.

    Args:
        template_data: The templateData dict to validate

    Returns:
        Tuple of (is_valid, errors_list)

    Example:
        is_valid, errors = validate_page_template({
            "root": {"props": {"title": "Test"}},
            "content": [{"type": "Hero", "props": {"title": "Hello"}}],
            "zones": {}
        })
        if not is_valid:
            for error in errors:
                print(f"{error['path']}: {error['message']}")
    """
    return PuckValidator.validate_template_data(template_data)


def get_block_schema(block_type: str) -> Optional[Dict[str, Any]]:
    """
    Get schema for a specific block type.

    Args:
        block_type: The block type name (e.g., "Hero", "Card")

    Returns:
        Block schema dict with description, props, slots, etc.
        None if block type not found.

    Example:
        schema = get_block_schema("Hero")
        # Returns: {"description": "...", "props": {"title": {...}, ...}}
    """
    schema = PuckValidator.load_schema()
    return schema.get("blocks", {}).get(block_type)


def get_blocks_schema(block_types: List[str]) -> Dict[str, Any]:
    """
    Get schema for multiple specific block types.

    Use this to inject only relevant block context into prompts
    when working on specific blocks.

    Args:
        block_types: List of block type names

    Returns:
        Dict mapping block_type -> schema for requested blocks

    Example:
        schemas = get_blocks_schema(["Hero", "Card", "Button"])
        # Returns: {"Hero": {...}, "Card": {...}, "Button": {...}}
    """
    schema = PuckValidator.load_schema()
    blocks = schema.get("blocks", {})
    return {bt: blocks[bt] for bt in block_types if bt in blocks}


def render_block_reference(block_types: Optional[List[str]] = None, compact: bool = True) -> str:
    """
    Render block schema as text for prompt context.

    Args:
        block_types: Specific blocks to include. If None, includes all blocks.
        compact: If True, renders minimal format. If False, includes full props.

    Returns:
        Formatted string suitable for prompt injection.

    Example (compact=True):
        Hero: Hero section with CTA (title, description, buttons[], backgroundImage)
        Card: Card container (title, description)

    Example (compact=False):
        ## Hero
        Hero section with CTA
        Props:
        - title (string)
        - description (string)
        - buttons (array)
        - backgroundImage (string)
    """
    schema = PuckValidator.load_schema()
    blocks = schema.get("blocks", {})

    if block_types:
        blocks = {bt: blocks[bt] for bt in block_types if bt in blocks}

    if not blocks:
        return ""

    lines = []
    for block_type, block_schema in sorted(blocks.items()):
        description = block_schema.get("description", "")
        props = block_schema.get("props", {})
        prop_names = list(props.keys())

        if compact:
            # One-line format: BlockType: description (prop1, prop2, prop3)
            props_str = ", ".join(prop_names[:6])  # Max 6 props shown
            if len(prop_names) > 6:
                props_str += ", ..."
            lines.append(f"{block_type}: {description} ({props_str})")
        else:
            # Multi-line format with prop details
            lines.append(f"## {block_type}")
            if description:
                lines.append(description)
            lines.append("Props:")
            for prop_name, prop_def in props.items():
                prop_type = prop_def.get("type", "any")
                required = " (required)" if prop_def.get("required") else ""
                lines.append(f"- {prop_name} ({prop_type}){required}")
            lines.append("")

    return "\n".join(lines)


def get_all_block_names() -> List[str]:
    """
    Get list of all valid block type names.

    Returns:
        Sorted list of block type names.
    """
    return sorted(PuckValidator.get_valid_blocks())
