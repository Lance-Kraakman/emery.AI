"""
DSPy Signatures for structured output extraction.

Dynamic signature factory for extracting typed outputs from agent execution results.
"""

import re
from dataclasses import dataclass, field as dataclass_field
from typing import Any, Type

import dspy
from pydantic import Field, create_model


@dataclass
class TargetFieldMeta:
    """Target field constraints from the destination table.

    Used by both the extraction signature (LLM guidance) and
    the post-extraction coercion step (deterministic cleanup).
    """

    type: str = "text"
    options: list[str] = dataclass_field(default_factory=list)


# Type mapping from skill output types to Python types
SKILL_TYPE_MAP: dict[str, type] = {
    "text": str,
    "number": float,
    "boolean": bool,
    "date": str,  # ISO format
    "email": str,
    "phone": str,
    "json": dict,
    "single-select": str,
    "multi-select": list,
}

# Format hints appended to field descriptions so the LLM returns cleaner data
FORMAT_HINTS: dict[str, str] = {
    "number": "Return as an integer if whole number, otherwise decimal.",
    "date": "Return in YYYY-MM-DD format.",
    "email": "Return a valid email address.",
    "phone": "Return phone number including country code if available.",
}


def _sanitize_field_name(name: str) -> str:
    """Convert output name to a valid Python identifier for Pydantic model fields."""
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '_', name).strip('_')
    sanitized = re.sub(r'_+', '_', sanitized).lower()
    if not sanitized or sanitized[0].isdigit():
        sanitized = f"field_{sanitized}"
    return sanitized


def create_extraction_signature(
    skill_outputs: list[dict[str, Any]],
    target_field_metadata: dict[str, TargetFieldMeta] | None = None,
) -> tuple[Type[dspy.Signature], dict[str, str]]:
    """
    Create a dynamic DSPy signature for extracting skill outputs.

    Args:
        skill_outputs: List of {name, type, description} dicts defining expected outputs
        target_field_metadata: Optional field constraints from target table

    Returns:
        Tuple of (signature_class, name_mapping) where name_mapping maps
        sanitized field names back to original output names.
    """
    output_fields: dict[str, Any] = {}
    name_mapping: dict[str, str] = {}  # sanitized -> original

    for output in skill_outputs:
        original_name = output["name"]
        sanitized_name = _sanitize_field_name(original_name)
        name_mapping[sanitized_name] = original_name

        output_type = output.get("type", "text")
        description = output.get("description", "")

        # Get target constraints if available (e.g., select options)
        target = (target_field_metadata or {}).get(original_name)
        if target and target.options:
            description += f" Must be one of: {', '.join(target.options)}"

        # Include original name in description so LLM knows what to extract
        field_desc = f"{original_name}: {description}".strip(": ") if description else original_name

        # Append format hint for the output type
        format_hint = FORMAT_HINTS.get(output_type, "")
        if format_hint:
            field_desc += f" {format_hint}"

        # Map skill type to Python type
        python_type = SKILL_TYPE_MAP.get(output_type, str)

        # Make all outputs Optional to allow null for missing data
        output_fields[sanitized_name] = (python_type | None, Field(description=field_desc))

    # Create dynamic Pydantic model for outputs
    OutputModel = create_model("SkillOutputs", **output_fields)

    # Create signature class with the dynamic output model
    class ExtractOutputs(dspy.Signature):  # type: ignore[misc]
        """Extract structured outputs from the given content.

        Only extract data that is explicitly present in the content.
        Use null for any output that cannot be found or determined.
        """

        content: str = dspy.InputField(desc="Content to extract outputs from")
        outputs: OutputModel = dspy.OutputField(desc="Extracted output values")  # type: ignore[valid-type]

    return ExtractOutputs, name_mapping
