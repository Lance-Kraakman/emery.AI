"""
DSPy Configuration and Model Provider.

This module configures DSPy to work with the existing HuggingFace model registry,
supporting dedicated endpoints, Inference API, and Google Gemini models.
"""

from __future__ import annotations

import os

import dspy

from emery_agents.services.models import (
    ModelMetadata,
    ModelTier,
    get_default_model_for_tier,
    get_model_metadata,
)


class DSPyModelProvider:
    """
    DSPy model provider that wraps the existing HuggingFace infrastructure.

    Supports:
    - Dedicated HuggingFace inference endpoints
    - HuggingFace Inference API
    - Google Gemini via OpenAI-compatible API
    - Model selection hierarchy (skill > agent > org > default)
    """

    def __init__(self) -> None:
        """Initialize the DSPy model provider."""
        self.hf_token = os.getenv("HF_TOKEN")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")

    def get_dspy_lm(
        self,
        model_id: str | None = None,
        skill_model: str | None = None,
        agent_model: str | None = None,
        org_model: str | None = None,
    ) -> dspy.LM:
        """
        Get DSPy LM using the model selection hierarchy.

        Priority: skill_model > agent_model > org_model > model_id > default

        Args:
            model_id: Explicit model ID to use
            skill_model: Model specified by skill configuration
            agent_model: Model specified by agent configuration
            org_model: Model specified by organization settings

        Returns:
            Configured DSPy LM instance
        """
        # Resolve model using hierarchy
        resolved_model = (
            skill_model
            or agent_model
            or org_model
            or model_id
            or get_default_model_for_tier(ModelTier.FREE)
        )

        # Get model metadata from registry
        metadata = get_model_metadata(resolved_model)
        if not metadata:
            # Fall back to default if model not found
            resolved_model = get_default_model_for_tier(ModelTier.FREE)
            metadata = get_model_metadata(resolved_model)

        if not metadata:
            raise ValueError(f"Could not find model metadata for {resolved_model}")

        return self._create_lm_for_model(metadata)

    def _create_lm_for_model(self, metadata: ModelMetadata) -> dspy.LM:
        """
        Create appropriate DSPy LM based on model metadata.

        Args:
            metadata: Model metadata from registry

        Returns:
            Configured DSPy LM instance
        """
        # Google Gemini via OpenAI-compatible API
        if metadata.id.startswith("google/"):
            gemini_model_id = metadata.id.replace("google/", "")
            return dspy.LM(
                model=f"openai/{gemini_model_id}",
                api_base="https://generativelanguage.googleapis.com/v1beta/openai/",
                api_key=self.gemini_api_key,
            )

        # Dedicated HuggingFace endpoint
        if metadata.endpoint.type == "dedicated" and metadata.endpoint.url:
            return dspy.LM(
                model=f"huggingface/{metadata.id}",
                api_base=metadata.endpoint.url,
                api_key=self.hf_token,
            )

        # HuggingFace Inference API (serverless)
        return dspy.LM(
            model=f"huggingface/{metadata.id}",
            api_key=self.hf_token,
        )


def get_dspy_lm(
    model_id: str | None = None,
    skill_model: str | None = None,
    agent_model: str | None = None,
    org_model: str | None = None,
) -> dspy.LM:
    """
    Get a DSPy LM without calling dspy.configure() (safe for async contexts).

    Use this with dspy.context(lm=lm) in async code:

        lm = get_dspy_lm(org_model="google/gemini-2.0-flash")
        with dspy.context(lm=lm):
            result = planner(request=request, ...)

    Args:
        model_id: Explicit model ID to use
        skill_model: Model specified by skill configuration
        agent_model: Model specified by agent configuration
        org_model: Model specified by organization settings

    Returns:
        DSPy LM instance (not configured globally)
    """
    provider = DSPyModelProvider()
    return provider.get_dspy_lm(
        model_id=model_id,
        skill_model=skill_model,
        agent_model=agent_model,
        org_model=org_model,
    )


def configure_dspy(
    model_id: str | None = None,
    skill_model: str | None = None,
    agent_model: str | None = None,
    org_model: str | None = None,
) -> dspy.LM:
    """
    Configure DSPy with a model from the registry (for sync contexts only).

    WARNING: Do not call this from async code! Use get_dspy_lm() with
    dspy.context(lm=lm) instead.

    Args:
        model_id: Explicit model ID to use
        skill_model: Model specified by skill configuration
        agent_model: Model specified by agent configuration
        org_model: Model specified by organization settings

    Returns:
        Configured DSPy LM instance
    """
    lm = get_dspy_lm(
        model_id=model_id,
        skill_model=skill_model,
        agent_model=agent_model,
        org_model=org_model,
    )
    dspy.configure(lm=lm)
    return lm


def configure_dspy_for_model(model_id: str) -> dspy.LM:
    """
    Configure DSPy with a specific model.

    Convenience function for when you know the exact model ID.

    Args:
        model_id: Model ID from the registry

    Returns:
        Configured DSPy LM instance
    """
    return configure_dspy(model_id=model_id)


def get_lm_for_task(
    task_type: str,
    prefer_fast: bool = False,
    prefer_vision: bool = False,
) -> dspy.LM:
    """
    Get an appropriate LM for a specific task type.

    Args:
        task_type: Type of task ("planning", "execution", "evaluation")
        prefer_fast: Whether to prefer faster models over more capable ones
        prefer_vision: Whether the task requires vision capabilities

    Returns:
        Configured DSPy LM instance
    """
    from emery_agents.services.models.registry import get_default_vision_model

    provider = DSPyModelProvider()

    # Select model based on task requirements
    if prefer_vision:
        model_id = get_default_vision_model()
    elif prefer_fast:
        # Use a smaller, faster model
        model_id = "ibm-granite/granite-3.3-8b-instruct"
    else:
        # Use the default model
        model_id = get_default_model_for_tier(ModelTier.FREE)

    return provider.get_dspy_lm(model_id=model_id)
