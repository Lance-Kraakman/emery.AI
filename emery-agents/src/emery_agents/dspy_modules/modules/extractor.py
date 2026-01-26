"""
DSPy Output Extractor Module.

Extracts structured outputs from agent execution results using typed signatures.
Replaces the tool-based output capture pattern with a cleaner extraction step.
"""

from __future__ import annotations

import logging
from typing import Any

import dspy

from emery_agents.dspy_modules.signatures.extraction import create_extraction_signature

logger = logging.getLogger(__name__)


class OutputExtractorModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for extracting structured outputs from agent execution results.

    This module replaces the tool-based output capture pattern where agents had to
    call submit_result(). Instead, extraction is a separate post-processing step
    that uses TypedChainOfThought to extract values from the agent's response.
    """

    def __init__(
        self,
        skill_outputs: list[dict[str, Any]],
        target_field_metadata: dict[str, Any] | None = None,
    ) -> None:
        """
        Initialize the output extractor.

        Args:
            skill_outputs: List of {name, type, description} dicts defining expected outputs
            target_field_metadata: Optional field constraints from target table (options, etc.)
        """
        super().__init__()
        self.skill_outputs = skill_outputs
        self.target_field_metadata = target_field_metadata

        # Create dynamic signature based on outputs
        signature = create_extraction_signature(skill_outputs, target_field_metadata)
        self.extractor = dspy.TypedChainOfThought(signature)

    def forward(self, content: str) -> dict[str, Any]:
        """
        Extract outputs from content.

        Args:
            content: The agent execution result to extract outputs from

        Returns:
            Dict of {output_name: value} with nulls for missing data
        """
        try:
            result = self.extractor(content=content)
            outputs = result.outputs  # type: ignore[union-attr]
            return outputs.model_dump() if outputs else {}
        except Exception as e:
            logger.error(f"Output extraction failed: {e}")
            # Return nulls for all fields on failure
            return {o["name"]: None for o in self.skill_outputs}

    def extract(self, content: str) -> dict[str, Any]:
        """
        Alias for forward() for more intuitive API.

        Args:
            content: The agent execution result to extract outputs from

        Returns:
            Dict of {output_name: value} with nulls for missing data
        """
        return self.forward(content)
