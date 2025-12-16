"""
OutputTool - Captures structured outputs from agent execution

When a skill has outputs with mappings, this tool is added to the agent's toolset.
The agent MUST call this tool to complete the task - it's the only way to report outputs.

AIDEV-NOTE: Created for agent mode output mappings (2025-01)
AIDEV-NOTE: Enhanced with target field metadata for better LLM guidance (2025-01)
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from smolagents import Tool

logger = logging.getLogger(__name__)

# Type mapping from skill output types to smolagents input types
# Expanded to align with database field types
OUTPUT_TYPE_MAP: Dict[str, str] = {
    # Basic types
    'text': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'date': 'string',  # ISO format string
    'json': 'any',
    # Format-specific
    'email': 'string',
    'phone': 'string',
    # Select types
    'single-select': 'string',
    'multi-select': 'any',  # Array
    # Media types (URLs)
    'image': 'string',
    'file': 'string',
    'audio': 'string',
    'video': 'string',
    'document': 'string',
}


@dataclass
class TargetFieldMetadata:
    """Metadata about the target database field for LLM guidance."""
    field_type: str  # "single-select", "multi-select", "number", etc.
    options: Optional[List[str]] = None  # For select fields
    max_selections: Optional[int] = None  # For multi-select
    field_name: Optional[str] = None  # Target field name


@dataclass
class CapturedOutput:
    """Stores captured output values from agent execution."""
    values: Dict[str, Any] = field(default_factory=dict)
    called: bool = False


class OutputTool(Tool):
    """
    Tool for capturing structured outputs from agent execution.

    Dynamically generates input schema from skill output definitions.
    When target field metadata is provided, generates rich descriptions
    to guide the LLM on correct output format.

    The agent MUST call this tool to complete the task.
    """

    # Skip smolagents' forward signature validation since outputs are dynamic
    # This is the official pattern for tools with variable input schemas
    skip_forward_signature_validation = True

    name = "submit_result"
    description = (
        "Submit your final results. You MUST call this tool to complete the task. "
        "Provide values for each required output field."
    )
    output_type = "string"

    def __init__(
        self,
        skill_outputs: List[Any],
        target_field_metadata: Optional[Dict[str, TargetFieldMetadata]] = None
    ):
        """
        Initialize OutputTool with skill output definitions.

        Args:
            skill_outputs: List of skill output objects (proto or dict format)
            target_field_metadata: Optional dict mapping output_name → target field info
                Used to generate rich LLM descriptions based on database field types.
        """
        super().__init__()
        self.skill_outputs = skill_outputs
        self.target_field_metadata = target_field_metadata or {}
        self.captured = CapturedOutput()
        self.inputs = self._build_inputs_schema()
        logger.info(f"Created OutputTool with {len(self.inputs)} output fields: {list(self.inputs.keys())}")
        if self.target_field_metadata:
            logger.info(f"  Target field metadata provided for: {list(self.target_field_metadata.keys())}")

    def _get_smolagent_type(self, output_type: str, target_meta: Optional[TargetFieldMetadata]) -> str:
        """
        Map to smolagents primitives: string, number, boolean, any.

        Priority: target field metadata > output type
        """
        if target_meta:
            field_type = target_meta.field_type
            if field_type == 'number':
                return 'number'
            if field_type == 'boolean':
                return 'boolean'
            if field_type in ('multi-select', 'json'):
                return 'any'  # Arrays/objects

        # Fallback to output_type mapping
        return OUTPUT_TYPE_MAP.get(output_type, 'string')

    def _build_description(self, name: str, output_type: str, target_meta: Optional[TargetFieldMetadata]) -> str:
        """
        Build simple description for tool signature.

        Detailed type-aware guidance is in output_capture.j2 template.
        Tool signature just needs basic hints for smolagents.
        """
        return f"Value for '{name}'"

    def _build_inputs_schema(self) -> Dict[str, Dict[str, str]]:
        """Convert skill outputs to tool input schema with rich descriptions."""
        schema = {}

        for output in self.skill_outputs:
            # Handle both proto objects and dict format
            if hasattr(output, 'name'):
                name = output.name
                output_type = getattr(output, 'type', 'text') or 'text'
            else:
                name = output.get('name')
                output_type = output.get('type', 'text') or 'text'

            if not name:
                continue

            # Get target field metadata if available
            target_meta = self.target_field_metadata.get(name)

            # Determine smolagents type
            smolagent_type = self._get_smolagent_type(output_type, target_meta)

            # Build rich description
            description = self._build_description(name, output_type, target_meta)

            schema[name] = {
                'type': smolagent_type,
                'description': description
            }

            logger.debug(f"  Output '{name}': type={smolagent_type}, desc={description[:50]}...")

        return schema

    def forward(self, **kwargs) -> str:
        """
        Capture output values when the agent calls this tool.

        Args:
            **kwargs: Output values keyed by output name

        Returns:
            Confirmation message
        """
        logger.info(f"📤 OutputTool.submit_result called with: {list(kwargs.keys())}")

        # Store captured values
        self.captured.values = kwargs
        self.captured.called = True

        # Log each captured value
        for key, value in kwargs.items():
            value_preview = str(value)[:100] + "..." if len(str(value)) > 100 else str(value)
            logger.debug(f"  - {key}: {value_preview}")

        return "Results submitted successfully. Task complete."

    def get_captured_values(self) -> Dict[str, Any]:
        """Get the captured output values."""
        return self.captured.values if self.captured.called else {}

    def was_called(self) -> bool:
        """Check if the tool was called by the agent."""
        return self.captured.called

    def reset(self) -> None:
        """Reset captured state (for reuse)."""
        self.captured = CapturedOutput()


def build_target_field_metadata_from_mappings(
    skill_outputs: List[Any],
) -> Dict[str, TargetFieldMetadata]:
    """
    Extract target field metadata from skill output mappings.

    Extracts target_field_metadata from each output's output_mapping.mappings
    and creates a lookup dict by output name.

    Args:
        skill_outputs: List of proto SkillOutput objects with output_mapping

    Returns:
        Dict mapping output_name → TargetFieldMetadata
    """
    metadata: Dict[str, TargetFieldMetadata] = {}

    for output in skill_outputs:
        name = output.name
        output_mapping = output.output_mapping

        if not name or not output_mapping or not output_mapping.mappings:
            continue

        # Use first mapping with metadata (typically one mapping per output)
        for mapping in output_mapping.mappings:
            tfm = mapping.target_field_metadata
            if tfm and tfm.field_type:
                metadata[name] = TargetFieldMetadata(
                    field_type=tfm.field_type,
                    options=list(tfm.options) if tfm.options else None,
                    max_selections=tfm.max_selections or None,
                    field_name=tfm.field_name or None
                )
                break

    return metadata
