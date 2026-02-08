"""
DSPy Output Extractor Module.

Extracts structured outputs from agent execution results using typed signatures.
Replaces the tool-based output capture pattern with a cleaner extraction step.
"""

import logging
from typing import Any

import dspy

from emery_agents.reasoning.signatures.extraction import (
    TargetFieldMeta,
    create_extraction_signature,
)

logger = logging.getLogger(__name__)


class OutputExtractorModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for extracting structured outputs from agent execution results.

    This module replaces the tool-based output capture pattern where agents had to
    call submit_result(). Instead, extraction is a separate post-processing step
    that uses ChainOfThought to extract values from the agent's response.
    """

    def __init__(
        self,
        skill_outputs: list[dict[str, Any]],
        target_field_metadata: dict[str, TargetFieldMeta] | None = None,
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

        # Create dynamic signature with Pydantic output model + name mapping
        signature, self.name_mapping = create_extraction_signature(
            skill_outputs, target_field_metadata
        )
        self.extractor = dspy.ChainOfThought(signature)

    def forward(self, content: str) -> dict[str, Any]:
        """Extract outputs from content.

        Returns dict keyed by original output names (not sanitized field names).
        """
        try:
            result = self.extractor(content=content)
            outputs = result.outputs
            if not outputs:
                return {}
            raw = outputs.model_dump()
            # Map sanitized field names back to original output names
            return {self.name_mapping.get(k, k): v for k, v in raw.items()}
        except Exception as e:
            logger.error(f"Output extraction failed: {e}")
            return {o["name"]: None for o in self.skill_outputs}

    def extract(self, content: str) -> dict[str, Any]:
        """Extract outputs from content via DSPy module call.

        Uses self() (not self.forward()) to go through DSPy's Module.__call__ routing.
        """
        return self(content=content)
