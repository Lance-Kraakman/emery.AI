"""
HuggingFace Model Registry for Python Workers

Centralized catalog of available AI models with pricing, capabilities, and metadata.
Used for model selection, billing calculations, and access control in agent execution.

AIDEV-NOTE: This mirrors the TypeScript model registry in src/lib/ai/model-registry.ts.
Keep both files in sync when adding or updating models.
"""

from dataclasses import dataclass
from typing import Dict, List, Literal, Optional
from enum import Enum


class ModelCategory(Enum):
    """Performance category for models."""
    FAST = "fast"
    BALANCED = "balanced"
    ADVANCED = "advanced"


class ModelTier(Enum):
    """Minimum subscription tier required to access model."""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


@dataclass
class ModelCapabilities:
    """Model capability flags."""
    tool_calling: bool       # Supports function/tool calling
    streaming: bool          # Supports streaming responses
    vision: bool             # Supports image inputs
    json_mode: bool          # Supports JSON output mode
    multimodal: bool         # Supports multiple input types


@dataclass
class ModelPricing:
    """Model pricing information."""
    input_per_1m: float      # Cost per 1M input tokens in USD
    output_per_1m: float     # Cost per 1M output tokens in USD
    currency: str = "USD"


@dataclass
class ModelEndpoint:
    """Endpoint configuration."""
    type: Literal["dedicated", "inference-api"]
    url: Optional[str] = None  # For dedicated endpoints


@dataclass
class ModelMetadata:
    """Complete model metadata."""
    id: str                  # Unique identifier
    name: str                # Display name
    provider: str            # Provider name
    description: str         # Model description

    # Technical specifications
    context_window: int      # Maximum context length in tokens
    max_output_tokens: int   # Maximum output tokens

    # Capabilities
    capabilities: ModelCapabilities

    # Pricing
    pricing: ModelPricing

    # Access control
    tier: ModelTier          # Minimum tier required
    category: ModelCategory  # Performance category

    # Endpoint
    endpoint: ModelEndpoint


# AIDEV-NOTE: HuggingFace Model Registry
# Keep pricing updated from HuggingFace Inference API pricing page
HUGGINGFACE_MODELS: Dict[str, ModelMetadata] = {
    # Current production model (dedicated endpoint)
    "ibm-granite/granite-3.3-8b-instruct": ModelMetadata(
        id="ibm-granite/granite-3.3-8b-instruct",
        name="IBM Granite 3.3 8B Instruct",
        provider="huggingface",
        description="Production model on dedicated endpoint. Optimized for tool calling and instruction following.",
        context_window=8192,
        max_output_tokens=2048,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(
            input_per_1m=0.15,   # Custom pricing - adjust based on contract
            output_per_1m=0.60,  # Custom pricing - adjust based on contract
        ),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(
            type="dedicated",
            url="https://dxv8q9ubsizxcp4v.us-east-1.aws.endpoints.huggingface.cloud",
        ),
    ),

    # HuggingFace Inference API models
    "Qwen/Qwen2.5-7B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-7B-Instruct",
        name="Qwen 2.5 7B Instruct",
        provider="huggingface",
        description="Fast and efficient model for general chat and instruction following.",
        context_window=32768,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.10, output_per_1m=0.40),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "Qwen/Qwen2.5-14B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-14B-Instruct",
        name="Qwen 2.5 14B Instruct",
        provider="huggingface",
        description="Balanced model with strong reasoning capabilities and tool calling support.",
        context_window=32768,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.20, output_per_1m=0.80),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "Qwen/Qwen2.5-Coder-7B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-Coder-7B-Instruct",
        name="Qwen 2.5 Coder 7B",
        provider="huggingface",
        description="Specialized model for code generation and programming tasks.",
        context_window=32768,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.10, output_per_1m=0.40),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "meta-llama/Llama-3.2-3B-Instruct": ModelMetadata(
        id="meta-llama/Llama-3.2-3B-Instruct",
        name="Llama 3.2 3B Instruct",
        provider="huggingface",
        description="Ultra-fast model for simple tasks and high-throughput scenarios.",
        context_window=8192,
        max_output_tokens=2048,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=True,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.05, output_per_1m=0.20),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "mistralai/Mistral-7B-Instruct-v0.3": ModelMetadata(
        id="mistralai/Mistral-7B-Instruct-v0.3",
        name="Mistral 7B Instruct",
        provider="huggingface",
        description="High-quality open model with strong performance on reasoning tasks.",
        context_window=32768,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.15, output_per_1m=0.60),
        tier=ModelTier.PRO,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # Multimodal models with tool calling (2025)
    "HuggingFaceTB/SmolVLM-256M-Instruct": ModelMetadata(
        id="HuggingFaceTB/SmolVLM-256M-Instruct",
        name="SmolVLM 256M Instruct",
        provider="huggingface",
        description="Ultra-lightweight vision-language model with tool calling. Perfect for edge deployment and fast inference with image understanding.",
        context_window=8192,
        max_output_tokens=2048,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,
            json_mode=True,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0.05, output_per_1m=0.20),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "HuggingFaceTB/SmolVLM-500M-Instruct": ModelMetadata(
        id="HuggingFaceTB/SmolVLM-500M-Instruct",
        name="SmolVLM 500M Instruct",
        provider="huggingface",
        description="Small vision-language model with tool calling. Balanced performance and efficiency for multimodal agent workflows.",
        context_window=8192,
        max_output_tokens=2048,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,
            json_mode=True,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0.08, output_per_1m=0.30),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "microsoft/Phi-4-multimodal-instruct": ModelMetadata(
        id="microsoft/Phi-4-multimodal-instruct",
        name="Microsoft Phi-4 Multimodal",
        provider="huggingface",
        description="Advanced multimodal model with vision, audio, and tool calling. Excellent instruction following and function calling capabilities. 128K context.",
        context_window=128000,
        max_output_tokens=4096,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,
            json_mode=True,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0.25, output_per_1m=1.00),
        tier=ModelTier.FREE,
        category=ModelCategory.ADVANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),
}


def get_model_metadata(model_id: str) -> Optional[ModelMetadata]:
    """Get model metadata by ID."""
    return HUGGINGFACE_MODELS.get(model_id)


def get_all_models() -> List[ModelMetadata]:
    """Get all available models."""
    return list(HUGGINGFACE_MODELS.values())


def get_models_for_tier(tier: ModelTier) -> List[ModelMetadata]:
    """Get models available for a specific subscription tier."""
    tier_hierarchy = {
        ModelTier.FREE: 0,
        ModelTier.PRO: 1,
        ModelTier.ENTERPRISE: 2,
    }
    user_tier_level = tier_hierarchy[tier]

    return [
        model for model in get_all_models()
        if tier_hierarchy[model.tier] <= user_tier_level
    ]


def get_models_by_category(category: ModelCategory) -> List[ModelMetadata]:
    """Get models by performance category."""
    return [model for model in get_all_models() if model.category == category]


def get_models_with_capability(capability: str) -> List[ModelMetadata]:
    """Get models with a specific capability."""
    return [
        model for model in get_all_models()
        if getattr(model.capabilities, capability, False)
    ]


def calculate_token_cost(model_id: str, input_tokens: int, output_tokens: int) -> float:
    """
    Calculate cost for token usage.

    Args:
        model_id: Model identifier
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens

    Returns:
        Cost in USD
    """
    model = get_model_metadata(model_id)
    if not model:
        print(f"Warning: Model {model_id} not found in registry, returning 0 cost")
        return 0.0

    input_cost = (input_tokens / 1_000_000) * model.pricing.input_per_1m
    output_cost = (output_tokens / 1_000_000) * model.pricing.output_per_1m

    return input_cost + output_cost


def get_default_model_for_tier(tier: ModelTier) -> str:
    """Get default model for organization tier."""
    # Default to production model for all tiers
    return "ibm-granite/granite-3.3-8b-instruct"


def can_access_model(
    model_id: str,
    organization_tier: ModelTier,
    available_models: Optional[List[str]] = None
) -> bool:
    """
    Validate model access for organization.

    Args:
        model_id: Model to check access for
        organization_tier: Organization subscription tier
        available_models: Optional whitelist of allowed models

    Returns:
        True if organization can access the model
    """
    model = get_model_metadata(model_id)
    if not model:
        return False

    # Check tier access
    tier_hierarchy = {
        ModelTier.FREE: 0,
        ModelTier.PRO: 1,
        ModelTier.ENTERPRISE: 2,
    }
    user_tier_level = tier_hierarchy[organization_tier]
    model_tier_level = tier_hierarchy[model.tier]

    if model_tier_level > user_tier_level:
        return False

    # Check organization whitelist if provided
    if available_models and len(available_models) > 0:
        return model_id in available_models

    return True
