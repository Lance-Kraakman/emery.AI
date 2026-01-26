"""
Model Provider with DSPy and Model Registry Support.

AIDEV-NOTE: Centralized model provider for DSPy-based execution.
Integrates with model registry for pricing, capabilities, and access control.
Supports model selection hierarchy: skill > agent > organization > default.
"""

from __future__ import annotations

import os
import logging
from typing import Optional
from dataclasses import dataclass

import dspy

from .model_registry import (
    get_model_metadata,
    get_default_model_for_tier,
    get_default_vision_model,
    ModelTier,
)

logger = logging.getLogger(__name__)


@dataclass
class TokenUsage:
    """Token usage information with cost tracking."""
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    model_name: str = ""


class ModelProvider:
    """
    Model provider with DSPy and registry support.

    Supports:
    - Model selection hierarchy: skill override > agent default > org default > system default
    - DSPy LM configuration for all execution
    - Model registry integration for pricing and capabilities
    """

    def __init__(self) -> None:
        """Initialize provider with HuggingFace token."""
        self.hf_token = self._get_hf_token()
        logger.info("ModelProvider initialized with model registry support")

    def resolve_model_selection(
        self,
        skill_model: Optional[str] = None,
        agent_model: Optional[str] = None,
        org_model: Optional[str] = None,
        has_images: bool = False,
    ) -> str:
        """
        Resolve model selection using hierarchy with vision model support.

        Priority:
        1. skill_model (if provided)
        2. agent_model (if provided)
        3. org_model (if provided)
        4. vision_model (if has_images=True and no explicit model)
        5. default model

        Args:
            skill_model: Model override from skill configuration
            agent_model: Default model from agent configuration
            org_model: Default model from organization configuration
            has_images: Whether the input contains images (triggers vision model)

        Returns:
            Model ID to use for execution
        """
        logger.info(f"[MODEL-PROVIDER] resolve_model_selection called with:")
        logger.info(f"[MODEL-PROVIDER] - skill_model: {repr(skill_model)}")
        logger.info(f"[MODEL-PROVIDER] - agent_model: {repr(agent_model)}")
        logger.info(f"[MODEL-PROVIDER] - org_model: {repr(org_model)}")
        logger.info(f"[MODEL-PROVIDER] - has_images: {has_images}")

        if skill_model:
            logger.info(f"Using skill model override: {skill_model}")
            return skill_model

        if agent_model:
            logger.info(f"Using agent default model: {agent_model}")
            return agent_model

        if org_model:
            logger.info(f"Using organization default model: {org_model}")
            return org_model

        # Smart selection: vision model if images present, otherwise default
        if has_images:
            vision_model = get_default_vision_model()
            logger.info(f"Images detected, using vision model: {vision_model}")
            return vision_model

        # Fall back to system default
        default_model = get_default_model_for_tier(ModelTier.FREE)
        logger.info(f"Using system default model: {default_model}")
        return default_model

    def _get_hf_token(self) -> str:
        """Get HuggingFace token from environment."""
        token = os.getenv('HF_TOKEN')
        if not token:
            raise EnvironmentError(
                "HF_TOKEN environment variable is required for HuggingFace API access. "
                "Get your token from https://huggingface.co/settings/tokens"
            )
        return token

    # =========================================================================
    # DSPy Integration
    # =========================================================================

    def get_dspy_lm(self, model_id: str | None = None) -> dspy.LM:
        """
        Get a DSPy LM instance for the given model.

        Args:
            model_id: Model ID to use (defaults to system default)

        Returns:
            Configured dspy.LM instance
        """
        if not model_id:
            model_id = get_default_model_for_tier(ModelTier.FREE)

        metadata = get_model_metadata(model_id)
        if not metadata:
            logger.warning(f"Model {model_id} not in registry, using default")
            model_id = get_default_model_for_tier(ModelTier.FREE)
            metadata = get_model_metadata(model_id)

        actual_model_id = metadata.id

        # Handle Google Gemini models
        if actual_model_id.startswith("google/"):
            gemini_model_id = actual_model_id.replace("google/", "")
            gemini_api_key = os.environ.get("GEMINI_API_KEY")
            if not gemini_api_key:
                raise EnvironmentError("GEMINI_API_KEY required for Gemini models")
            logger.info(f"Creating DSPy LM for Gemini: {gemini_model_id}")
            return dspy.LM(
                f"openai/{gemini_model_id}",
                api_base="https://generativelanguage.googleapis.com/v1beta/openai/",
                api_key=gemini_api_key,
            )

        # Handle HuggingFace models via dedicated endpoint or inference API
        if metadata.endpoint.type == "dedicated" and metadata.endpoint.url:
            endpoint_url = metadata.endpoint.url
            logger.info(f"Creating DSPy LM for dedicated endpoint: {endpoint_url}")
            return dspy.LM(
                f"huggingface/{actual_model_id}",
                api_base=endpoint_url,
                api_key=self.hf_token,
            )

        # Standard HuggingFace inference API
        logger.info(f"Creating DSPy LM for HF model: {actual_model_id}")
        return dspy.LM(
            f"huggingface/{actual_model_id}",
            api_key=self.hf_token,
        )

    def configure_dspy(self, model_id: str | None = None) -> None:
        """
        Configure DSPy global settings with the specified model.

        Args:
            model_id: Model ID to use as default LM
        """
        lm = self.get_dspy_lm(model_id)
        dspy.settings.configure(lm=lm)
        logger.info(f"Configured DSPy with model: {model_id or 'default'}")
