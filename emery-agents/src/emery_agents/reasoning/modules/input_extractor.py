"""
DSPy Input Extractor Module.

Extracts structured inputs from user text for skill execution.
Analogous to OutputExtractorModule but runs before execution rather than after.
"""

import json
import logging
from typing import Any

import dspy

logger = logging.getLogger(__name__)


class ExtractSkillInputs(dspy.Signature):  # type: ignore[misc]
    """Extract input values from user text for a skill.

    Given a user message and the skill's expected input definitions,
    extract the values for each input from the user's text.
    Return a JSON object mapping input names to their extracted values.
    Use null for any input that cannot be determined from the text.
    """

    user_text: str = dspy.InputField(desc="The user's message text")
    input_schema: str = dspy.InputField(
        desc="JSON array of skill input definitions with name, type, and description"
    )
    extracted_inputs: str = dspy.OutputField(
        desc="JSON object mapping input_name to extracted value"
    )


class InputExtractorModule(dspy.Module):  # type: ignore[misc]
    """
    DSPy module for extracting structured inputs from user text.

    Takes the user's message and a skill's input definitions,
    uses an LLM to extract input values from the text.
    """

    def __init__(self, skill_inputs: list[dict[str, Any]]) -> None:
        """
        Initialize the input extractor.

        Args:
            skill_inputs: List of {name, type, description} dicts defining expected inputs
        """
        super().__init__()
        self.skill_inputs = skill_inputs
        self.extractor = dspy.ChainOfThought(ExtractSkillInputs)

    def forward(self, user_text: str) -> dict[str, Any]:
        """Extract inputs from user text.

        Returns dict mapping input names to extracted values.
        Inputs that could not be extracted are omitted.
        """
        schema_json = json.dumps(self.skill_inputs, indent=2)

        try:
            result = self.extractor(
                user_text=user_text,
                input_schema=schema_json,
            )
            raw = result.extracted_inputs
            if isinstance(raw, str):
                parsed = json.loads(raw)
            else:
                parsed = raw

            if not isinstance(parsed, dict):
                logger.warning(f"InputExtractor returned non-dict: {type(parsed)}")
                return {}

            # Filter out null/None values
            return {k: v for k, v in parsed.items() if v is not None}

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Input extraction failed: {e}")
            return {}

    def extract(self, user_text: str) -> dict[str, Any]:
        """Extract inputs from user text via DSPy module call."""
        return self(user_text=user_text)
