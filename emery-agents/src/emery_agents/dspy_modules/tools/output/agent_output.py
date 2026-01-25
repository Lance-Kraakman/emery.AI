"""
Agent Output Tool - Captures structured outputs from agent execution.

Ported from tools/output_tool.py as DSPy-compatible function.

When a skill has outputs with mappings, this tool is added to the agent's toolset.
The agent MUST call this tool to complete the task.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Callable

logger = logging.getLogger(__name__)

# Type mapping from skill output types to smolagents input types
OUTPUT_TYPE_MAP: dict[str, str] = {
    # Basic types
    "text": "string",
    "number": "number",
    "boolean": "boolean",
    "date": "string",  # ISO format string
    "json": "any",
    # Format-specific
    "email": "string",
    "phone": "string",
    # Select types
    "single-select": "string",
    "multi-select": "any",  # Array
    # Media types (URLs)
    "image": "string",
    "file": "string",
    "audio": "string",
    "video": "string",
    "document": "string",
}


@dataclass
class TargetFieldMetadata:
    """Metadata about the target database field for LLM guidance."""

    field_type: str  # "single-select", "multi-select", "number", etc.
    options: list[str] | None = None  # For select fields
    max_selections: int | None = None  # For multi-select
    field_name: str | None = None  # Target field name


@dataclass
class ExtractionStats:
    """Statistics about field extraction."""

    extracted: int = 0
    not_found: int = 0
    total: int = 0


@dataclass
class CapturedOutput:
    """Stores captured output values from agent execution."""

    values: dict[str, Any] = field(default_factory=dict)
    called: bool = False
    extraction_stats: ExtractionStats = field(default_factory=ExtractionStats)


class OutputCollector:
    """Stateful container for collecting agent outputs."""

    def __init__(self) -> None:
        self.captured: CapturedOutput = CapturedOutput()

    def get_captured_values(self) -> dict[str, Any]:
        """Get the captured output values."""
        return self.captured.values if self.captured.called else {}

    def was_called(self) -> bool:
        """Check if the tool was called by the agent."""
        return self.captured.called

    def get_extraction_stats(self) -> ExtractionStats:
        """Get extraction statistics."""
        return self.captured.extraction_stats

    def reset(self) -> None:
        """Reset captured state for reuse."""
        self.captured = CapturedOutput()


def create_output_tool(
    collector: OutputCollector,
    skill_outputs: list[Any],
    target_field_metadata: dict[str, TargetFieldMetadata] | None = None,
) -> Callable[..., str]:
    """
    Factory: Create submit_result function with collector captured in closure.

    Args:
        collector: OutputCollector instance to store captured outputs
        skill_outputs: List of skill output objects (proto or dict format)
        target_field_metadata: Optional dict mapping output_name to target field info

    Returns:
        submit_result function that DSPy ReAct can use
    """
    # Build expected output names from skill_outputs
    expected_outputs: set[str] = set()
    for output in skill_outputs:
        if hasattr(output, "name"):
            name = output.name
        else:
            name = output.get("name")
        if name:
            expected_outputs.add(name)

    logger.info(
        f"Created output tool with {len(expected_outputs)} output fields: "
        f"{list(expected_outputs)}"
    )

    def submit_result(**kwargs: Any) -> str:
        """Submit your final results.

        You MUST call this tool to complete the task.
        Provide values for each required output field.

        Args:
            **kwargs: Output values keyed by output name

        Returns:
            Confirmation message with extraction stats
        """
        logger.info(f"submit_result called with: {list(kwargs.keys())}")

        # Count extracted vs null values
        extracted_count = 0
        null_count = 0

        for key, value in kwargs.items():
            if value is None:
                null_count += 1
                logger.debug(f"  - {key}: null (not found)")
            else:
                extracted_count += 1
                value_preview = (
                    str(value)[:100] + "..."
                    if len(str(value)) > 100
                    else str(value)
                )
                logger.debug(f"  - {key}: {value_preview}")

        total = len(kwargs)

        # Reject if nothing was extracted
        if extracted_count == 0:
            logger.warning(f"No data extracted - all {total} fields were null")
            return "FAILED: No data could be extracted. All fields were null/not found."

        # Store captured values (including nulls for transparency)
        collector.captured.values = kwargs
        collector.captured.called = True
        collector.captured.extraction_stats = ExtractionStats(
            extracted=extracted_count,
            not_found=null_count,
            total=total,
        )

        logger.info(
            f"Extracted {extracted_count}/{total} fields ({null_count} not found)"
        )
        return f"Results submitted. Extracted {extracted_count}/{total} fields."

    return submit_result


def build_target_field_metadata_from_mappings(
    skill_outputs: list[Any],
) -> dict[str, TargetFieldMetadata]:
    """
    Extract target field metadata from skill output mappings.

    With multi-table output mapping, we iterate through table_mappings
    and their nested mappings to find target_field_metadata.

    Args:
        skill_outputs: List of proto SkillOutput objects with output_mapping

    Returns:
        Dict mapping output_name to TargetFieldMetadata
    """
    metadata: dict[str, TargetFieldMetadata] = {}

    for output in skill_outputs:
        name = output.name
        output_mapping = output.output_mapping

        # Check for table_mappings (multi-table structure)
        if not name or not output_mapping or not output_mapping.table_mappings:
            continue

        # Iterate through table mappings to find field metadata
        for table_mapping in output_mapping.table_mappings:
            if not table_mapping.mappings:
                continue

            for mapping in table_mapping.mappings:
                tfm = mapping.target_field_metadata
                if tfm and tfm.field_type:
                    metadata[name] = TargetFieldMetadata(
                        field_type=tfm.field_type,
                        options=list(tfm.options) if tfm.options else None,
                        max_selections=tfm.max_selections or None,
                        field_name=tfm.field_name or None,
                    )
                    break

            if name in metadata:
                break  # Found metadata for this output

    return metadata
