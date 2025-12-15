"""
OutputTool - Captures structured outputs from agent execution

When a skill has outputs with mappings, this tool is added to the agent's toolset.
The agent MUST call this tool to complete the task - it's the only way to report outputs.

AIDEV-NOTE: Created for agent mode output mappings (2025-01)
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List

from smolagents import Tool

logger = logging.getLogger(__name__)

# Type mapping from skill output types to smolagents input types
OUTPUT_TYPE_MAP: Dict[str, str] = {
    'text': 'string',
    'number': 'number',
    'boolean': 'boolean',
    'image': 'string',
    'file': 'string',
    'audio': 'string',
    'video': 'string',
    'document': 'string',
    'json': 'any',
}


@dataclass
class CapturedOutput:
    """Stores captured output values from agent execution."""
    values: Dict[str, Any] = field(default_factory=dict)
    called: bool = False


class OutputTool(Tool):
    """
    Tool for capturing structured outputs from agent execution.

    Dynamically generates input schema from skill output definitions.
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

    def __init__(self, skill_outputs: List[Any]):
        """
        Initialize OutputTool with skill output definitions.

        Args:
            skill_outputs: List of skill output objects (proto or dict format)
        """
        super().__init__()
        self.skill_outputs = skill_outputs
        self.captured = CapturedOutput()
        self.inputs = self._build_inputs_schema()
        logger.info(f"Created OutputTool with {len(self.inputs)} output fields: {list(self.inputs.keys())}")

    def _build_inputs_schema(self) -> Dict[str, Dict[str, str]]:
        """Convert skill outputs to tool input schema."""
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

            smolagent_type = OUTPUT_TYPE_MAP.get(output_type, 'string')
            schema[name] = {
                'type': smolagent_type,
                'description': f"Value for '{name}' output"
            }

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
