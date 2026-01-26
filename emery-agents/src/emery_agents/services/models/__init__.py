"""
Models Module

LLM/Model management services.

- ModelProvider: Central LLM provider with DSPy integration
- Model registry functions for metadata, pricing, and capabilities
"""

from .provider import ModelProvider, TokenUsage
from .registry import (
    ModelCategory,
    ModelTier,
    ModelCapabilities,
    ModelPricing,
    ModelEndpoint,
    ModelMetadata,
    normalize_model_id,
    get_model_metadata,
    get_all_models,
    get_models_for_tier,
)


__all__ = [
    # Provider
    "ModelProvider",
    "TokenUsage",
    # Registry
    "ModelCategory",
    "ModelTier",
    "ModelCapabilities",
    "ModelPricing",
    "ModelEndpoint",
    "ModelMetadata",
    "normalize_model_id",
    "get_model_metadata",
    "get_all_models",
    "get_models_for_tier",
]
