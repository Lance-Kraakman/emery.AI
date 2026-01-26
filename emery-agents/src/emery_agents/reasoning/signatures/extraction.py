"""
DSPy Signatures for structured output extraction.

Dynamic signature factory for extracting typed outputs from agent execution results.
"""

from __future__ import annotations

from typing import Any, Type

import dspy
from pydantic import Field, create_model


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


def create_extraction_signature(
    skill_outputs: list[dict[str, Any]],
    target_field_metadata: dict[str, Any] | None = None,
) -> Type[dspy.Signature]:
    """
    Create a dynamic DSPy signature for extracting skill outputs.

    Args:
        skill_outputs: List of {name, type, description} dicts defining expected outputs
        target_field_metadata: Optional field constraints (options, etc.) from target table

    Returns:
        A dspy.Signature class with typed OutputFields matching the skill outputs
    """
    output_fields: dict[str, Any] = {}

    for output in skill_outputs:
        name = output["name"]
        output_type = output.get("type", "text")
        description = output.get("description", "")

        # Get target constraints if available (e.g., select options)
        target = (target_field_metadata or {}).get(name, {})
        options = target.get("options", [])
        if options:
            description += f" One of: {', '.join(str(o) for o in options)}"

        # Map skill type to Python type
        python_type = SKILL_TYPE_MAP.get(output_type, str)

        # Make all outputs Optional to allow null for missing data
        output_fields[name] = (python_type | None, Field(description=description or name))

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

    return ExtractOutputs
