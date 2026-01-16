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
    MAX = "max"


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

    # Recommended flag for dedicated endpoints with high reliability
    recommended: bool = False

    # Description of what the model is recommended for
    recommended_for: Optional[str] = None


# AIDEV-NOTE: HuggingFace Model Registry
# Keep pricing updated from HuggingFace Inference API pricing page
HUGGINGFACE_MODELS: Dict[str, ModelMetadata] = {
    # Primary recommended model (dedicated endpoint) - Qwen2.5-Coder-32B
    "Qwen/Qwen2.5-Coder-32B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-Coder-32B-Instruct",
        name="Qwen 2.5 Coder 32B",
        provider="huggingface",
        description="Primary model on dedicated endpoint. 128K context, excellent for complex reasoning, code generation, tool calling and workflow planning.",
        context_window=128000,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(
            input_per_1m=0.30,
            output_per_1m=0.80,
        ),
        tier=ModelTier.FREE,
        category=ModelCategory.ADVANCED,
        endpoint=ModelEndpoint(
            type="dedicated",
            url="https://ehrauj4szamxqrll.us-east-1.aws.endpoints.huggingface.cloud",
        ),
        recommended=True,
        recommended_for="Complex reasoning & workflows",
    ),

    # Dedicated endpoint - small & fast for simple tasks
    "HuggingFaceTB/SmolLM3-3B": ModelMetadata(
        id="HuggingFaceTB/SmolLM3-3B",
        name="SmolLM3 3B",
        provider="huggingface",
        description="Fast 3B model on dedicated endpoint. Optimized for simple logical reasoning and quick tasks.",
        context_window=128000,
        max_output_tokens=2048,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(
            input_per_1m=0.05,
            output_per_1m=0.20,
        ),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(
            type="dedicated",
            url="https://becue6pro40rf66y.us-east-1.aws.endpoints.huggingface.cloud",
        ),
        recommended=True,
        recommended_for="Simple & fast tasks",
    ),

    # Dedicated endpoint - fast & cost-efficient
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
        recommended=True,
        recommended_for="Fast & cost-efficient",
    ),

    # ============================================================================
    # GOOGLE GEMINI MODELS (via OpenAI-compatible API)
    # ============================================================================

    "google/gemini-2.0-flash": ModelMetadata(
        id="google/gemini-2.0-flash",
        name="Gemini 2.0 Flash",
        provider="google",
        description="Fast, efficient Gemini model. Great for most tasks with 1M context window.",
        context_window=1000000,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,
            json_mode=True,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0.10, output_per_1m=0.40),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
        recommended=True,
        recommended_for="Fast & reliable fallback",
    ),

    "google/gemini-1.5-pro": ModelMetadata(
        id="google/gemini-1.5-pro",
        name="Gemini 1.5 Pro",
        provider="google",
        description="Most capable Gemini model. Excellent reasoning and 2M context window.",
        context_window=2000000,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,
            json_mode=True,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=1.25, output_per_1m=5.00),
        tier=ModelTier.FREE,
        category=ModelCategory.ADVANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "google/gemini-2.0-flash-lite": ModelMetadata(
        id="google/gemini-2.0-flash-lite",
        name="Gemini 2.0 Flash Lite",
        provider="google",
        description="Lightweight Gemini model. Ultra-fast for simple tasks.",
        context_window=1000000,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,
            json_mode=True,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0.075, output_per_1m=0.30),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # HUGGINGFACE INFERENCE API MODELS
    # ============================================================================

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
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # Vision-language model for image understanding
    "Qwen/Qwen2.5-VL-7B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-VL-7B-Instruct",
        name="Qwen2.5-VL 7B Instruct",
        provider="huggingface",
        description="Updated vision-language model for image understanding and analysis with tool calling support. Trained on agentic tasks (April 2025), 32k context window.",
        context_window=32768,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,       # Vision capability for image inputs
            json_mode=True,
            multimodal=True,   # Multimodal support (text + images)
        ),
        pricing=ModelPricing(input_per_1m=0.20, output_per_1m=0.80),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # Vision model (basic)
    "llava-hf/llava-1.5-7b-hf": ModelMetadata(
        id="llava-hf/llava-1.5-7b-hf",
        name="LLaVA 1.5 7B",
        provider="huggingface",
        description="Vision-language model for image understanding and visual question answering.",
        context_window=4096,
        max_output_tokens=2048,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=True,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0.10, output_per_1m=0.40),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # CHAT LLMs WITH TOOL CALLING - 32B CLASS (Sweet Spot)
    # ============================================================================

    "Qwen/Qwen2.5-32B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-32B-Instruct",
        name="Qwen 2.5 32B Instruct",
        provider="huggingface",
        description="Excellent balance of capability and speed. 128K context, strong reasoning and tool calling.",
        context_window=128000,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.30, output_per_1m=0.80),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "Qwen/QwQ-32B": ModelMetadata(
        id="Qwen/QwQ-32B",
        name="Qwen QwQ 32B (Reasoning)",
        provider="huggingface",
        description="Specialized reasoning model with chain-of-thought. Excellent for complex problem-solving.",
        context_window=32768,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.30, output_per_1m=0.80),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # CHAT LLMs WITH TOOL CALLING - SMALLER (Fast)
    # ============================================================================

    "meta-llama/Llama-3.1-8B-Instruct": ModelMetadata(
        id="meta-llama/Llama-3.1-8B-Instruct",
        name="Llama 3.1 8B Instruct",
        provider="huggingface",
        description="Fast and reliable with 128K context. Multi-provider support.",
        context_window=128000,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
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

    # ============================================================================
    # CHAT LLMs WITH TOOL CALLING - LARGER (Advanced)
    # ============================================================================

    "meta-llama/Llama-3.1-70B-Instruct": ModelMetadata(
        id="meta-llama/Llama-3.1-70B-Instruct",
        name="Llama 3.1 70B Instruct",
        provider="huggingface",
        description="Powerful 70B model with 128K context. Excellent reasoning and tool calling capabilities.",
        context_window=128000,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.60, output_per_1m=1.20),
        tier=ModelTier.FREE,
        category=ModelCategory.ADVANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "Qwen/Qwen2.5-72B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-72B-Instruct",
        name="Qwen 2.5 72B Instruct",
        provider="huggingface",
        description="Top-tier 72B model with 128K context. State-of-the-art reasoning and tool use.",
        context_window=128000,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.50, output_per_1m=1.00),
        tier=ModelTier.FREE,
        category=ModelCategory.ADVANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "deepseek-ai/DeepSeek-R1": ModelMetadata(
        id="deepseek-ai/DeepSeek-R1",
        name="DeepSeek R1 (Reasoning)",
        provider="huggingface",
        description="Advanced reasoning model with extended thinking. Excellent for complex analytical tasks.",
        context_window=65536,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=False,
            json_mode=True,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.50, output_per_1m=2.00),
        tier=ModelTier.FREE,
        category=ModelCategory.ADVANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # VLM (Vision + Tool Calling)
    # ============================================================================

    "Qwen/Qwen2.5-VL-32B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-VL-32B-Instruct",
        name="Qwen 2.5 VL 32B",
        provider="huggingface",
        description="Vision-language model with tool calling. Excellent for image understanding and analysis.",
        context_window=32768,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,
            json_mode=True,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0.40, output_per_1m=1.00),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "Qwen/Qwen2.5-VL-72B-Instruct": ModelMetadata(
        id="Qwen/Qwen2.5-VL-72B-Instruct",
        name="Qwen 2.5 VL 72B",
        provider="huggingface",
        description="Top-tier vision-language model. State-of-the-art image understanding with tool calling.",
        context_window=32768,
        max_output_tokens=8192,
        capabilities=ModelCapabilities(
            tool_calling=True,
            streaming=True,
            vision=True,
            json_mode=True,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0.60, output_per_1m=1.20),
        tier=ModelTier.FREE,
        category=ModelCategory.ADVANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Image Generation
    # ============================================================================

    "black-forest-labs/FLUX.1-schnell": ModelMetadata(
        id="black-forest-labs/FLUX.1-schnell",
        name="FLUX.1 Schnell",
        provider="huggingface",
        description="Fast image generation. 4 steps, high quality.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "black-forest-labs/FLUX.1-dev": ModelMetadata(
        id="black-forest-labs/FLUX.1-dev",
        name="FLUX.1 Dev",
        provider="huggingface",
        description="High-quality image generation. More steps, better detail.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "stabilityai/stable-diffusion-xl-base-1.0": ModelMetadata(
        id="stabilityai/stable-diffusion-xl-base-1.0",
        name="SDXL Base 1.0",
        provider="huggingface",
        description="Classic SDXL. Reliable, well-supported image generation.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "ByteDance/SDXL-Lightning": ModelMetadata(
        id="ByteDance/SDXL-Lightning",
        name="SDXL Lightning",
        provider="huggingface",
        description="Ultra-fast SDXL. 4-step generation with great quality.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Image-to-Image
    # ============================================================================

    "black-forest-labs/FLUX.1-Kontext-dev": ModelMetadata(
        id="black-forest-labs/FLUX.1-Kontext-dev",
        name="FLUX.1 Kontext",
        provider="huggingface",
        description="Image editing and transformation. High-quality prompt-guided image modification.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "timbrooks/instruct-pix2pix": ModelMetadata(
        id="timbrooks/instruct-pix2pix",
        name="InstructPix2Pix",
        provider="huggingface",
        description="Edit images with text instructions. Follow natural language editing commands.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Text-to-Video
    # ============================================================================

    "tencent/HunyuanVideo": ModelMetadata(
        id="tencent/HunyuanVideo",
        name="HunyuanVideo",
        provider="huggingface",
        description="High-quality video generation. State-of-the-art text-to-video. Requires fal-ai provider.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.ADVANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "genmo/mochi-1-preview": ModelMetadata(
        id="genmo/mochi-1-preview",
        name="Mochi 1 Preview",
        provider="huggingface",
        description="Fast video generation with good quality. Requires fal-ai provider.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Audio
    # ============================================================================

    "openai/whisper-large-v3": ModelMetadata(
        id="openai/whisper-large-v3",
        name="Whisper Large V3",
        provider="huggingface",
        description="State-of-the-art speech recognition. Transcribes audio to text.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "distil-whisper/distil-large-v3": ModelMetadata(
        id="distil-whisper/distil-large-v3",
        name="Distil Whisper Large V3",
        provider="huggingface",
        description="Fast speech recognition. 6x faster than Whisper with similar accuracy.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "openai/whisper-large-v3-turbo": ModelMetadata(
        id="openai/whisper-large-v3-turbo",
        name="Whisper Large V3 Turbo",
        provider="huggingface",
        description="Faster Whisper variant. Good balance of speed and accuracy.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "nvidia/parakeet-tdt-0.6b-v2": ModelMetadata(
        id="nvidia/parakeet-tdt-0.6b-v2",
        name="NVIDIA Parakeet TDT",
        provider="huggingface",
        description="Extremely fast ASR. 3386x real-time speed. WER 6.05%.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "suno/bark": ModelMetadata(
        id="suno/bark",
        name="Bark TTS",
        provider="huggingface",
        description="Text-to-speech generation. Creates natural-sounding audio from text.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "facebook/mms-tts-eng": ModelMetadata(
        id="facebook/mms-tts-eng",
        name="MMS TTS English",
        provider="huggingface",
        description="Fast multilingual TTS model. English variant with good quality and speed.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "parler-tts/parler-tts-mini-v1": ModelMetadata(
        id="parler-tts/parler-tts-mini-v1",
        name="Parler TTS Mini",
        provider="huggingface",
        description="High-quality TTS with voice description control. Describe voice characteristics in prompt.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Vision Analysis
    # ============================================================================

    "facebook/detr-resnet-50": ModelMetadata(
        id="facebook/detr-resnet-50",
        name="DETR Object Detection",
        provider="huggingface",
        description="Detects objects in images. Returns bounding boxes and labels.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "google/vit-base-patch16-224": ModelMetadata(
        id="google/vit-base-patch16-224",
        name="ViT Image Classification",
        provider="huggingface",
        description="Classifies images into categories. Returns labels with confidence scores.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Image Segmentation
    # ============================================================================

    "facebook/sam2-hiera-large": ModelMetadata(
        id="facebook/sam2-hiera-large",
        name="SAM 2 Large",
        provider="huggingface",
        description="Segment Anything 2. State-of-the-art image segmentation.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "facebook/detr-resnet-101-panoptic": ModelMetadata(
        id="facebook/detr-resnet-101-panoptic",
        name="DETR Panoptic Segmentation",
        provider="huggingface",
        description="Panoptic segmentation. Separates instances and semantic classes.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Image Captioning (Image-to-Text)
    # ============================================================================

    "Salesforce/blip-image-captioning-large": ModelMetadata(
        id="Salesforce/blip-image-captioning-large",
        name="BLIP Image Captioning",
        provider="huggingface",
        description="Generate captions for images. High-quality descriptions.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "nlpconnect/vit-gpt2-image-captioning": ModelMetadata(
        id="nlpconnect/vit-gpt2-image-captioning",
        name="ViT-GPT2 Image Captioning",
        provider="huggingface",
        description="Fast image captioning using ViT + GPT2 architecture.",
        context_window=0,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=True,
            json_mode=False,
            multimodal=True,
        ),
        pricing=ModelPricing(input_per_1m=0, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Text Processing
    # ============================================================================

    "deepset/roberta-base-squad2": ModelMetadata(
        id="deepset/roberta-base-squad2",
        name="RoBERTa Question Answering",
        provider="huggingface",
        description="Extractive question answering. Finds answers in provided context.",
        context_window=512,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.01, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "facebook/bart-large-mnli": ModelMetadata(
        id="facebook/bart-large-mnli",
        name="BART Zero-Shot Classification",
        provider="huggingface",
        description="Classifies text into custom categories. No training required.",
        context_window=1024,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.02, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "facebook/bart-large-cnn": ModelMetadata(
        id="facebook/bart-large-cnn",
        name="BART Summarization",
        provider="huggingface",
        description="Summarizes long text into concise summaries.",
        context_window=1024,
        max_output_tokens=142,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.02, output_per_1m=0.04),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Translation
    # ============================================================================

    "facebook/nllb-200-distilled-600M": ModelMetadata(
        id="facebook/nllb-200-distilled-600M",
        name="NLLB-200 Translation",
        provider="huggingface",
        description="No Language Left Behind. Supports 200 languages.",
        context_window=1024,
        max_output_tokens=1024,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.01, output_per_1m=0.02),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "Helsinki-NLP/opus-mt-en-de": ModelMetadata(
        id="Helsinki-NLP/opus-mt-en-de",
        name="OPUS MT English-German",
        provider="huggingface",
        description="Fast English to German translation.",
        context_window=512,
        max_output_tokens=512,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.01, output_per_1m=0.01),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "Helsinki-NLP/opus-mt-en-es": ModelMetadata(
        id="Helsinki-NLP/opus-mt-en-es",
        name="OPUS MT English-Spanish",
        provider="huggingface",
        description="Fast English to Spanish translation.",
        context_window=512,
        max_output_tokens=512,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.01, output_per_1m=0.01),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "Helsinki-NLP/opus-mt-en-fr": ModelMetadata(
        id="Helsinki-NLP/opus-mt-en-fr",
        name="OPUS MT English-French",
        provider="huggingface",
        description="Fast English to French translation.",
        context_window=512,
        max_output_tokens=512,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.01, output_per_1m=0.01),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    # ============================================================================
    # TASK-SPECIFIC MODELS - Embeddings
    # ============================================================================

    "BAAI/bge-large-en-v1.5": ModelMetadata(
        id="BAAI/bge-large-en-v1.5",
        name="BGE Large English",
        provider="huggingface",
        description="High-quality text embeddings for semantic search and RAG. 1024 dimensions.",
        context_window=512,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.01, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.FAST,
        endpoint=ModelEndpoint(type="inference-api"),
    ),

    "BAAI/bge-m3": ModelMetadata(
        id="BAAI/bge-m3",
        name="BGE M3 (Multilingual)",
        provider="huggingface",
        description="Multilingual embeddings supporting 100+ languages. 1024 dimensions.",
        context_window=8192,
        max_output_tokens=0,
        capabilities=ModelCapabilities(
            tool_calling=False,
            streaming=False,
            vision=False,
            json_mode=False,
            multimodal=False,
        ),
        pricing=ModelPricing(input_per_1m=0.02, output_per_1m=0),
        tier=ModelTier.FREE,
        category=ModelCategory.BALANCED,
        endpoint=ModelEndpoint(type="inference-api"),
    ),
}


def normalize_model_id(model_id: str) -> str:
    """
    Normalize model ID to match registry format.

    Handles cases where model ID might be missing provider prefix:
    - "gemini-2.0-flash" → "google/gemini-2.0-flash"
    - "google/gemini-2.0-flash" → "google/gemini-2.0-flash" (no change)

    AIDEV-NOTE: This is needed because smolagents OpenAIModel stores the short
    model name (without provider prefix) in token_usage, but the registry uses
    the full prefixed format for Google models.
    """
    # If already has a provider prefix, return as-is
    if "/" in model_id:
        return model_id

    # Check if this is a Gemini model without prefix
    if model_id.startswith("gemini-"):
        return f"google/{model_id}"

    # Return as-is for other models
    return model_id


def get_model_metadata(model_id: str) -> Optional[ModelMetadata]:
    """Get model metadata by ID."""
    # Normalize model ID to handle missing prefixes (e.g., Gemini models)
    normalized_id = normalize_model_id(model_id)
    return HUGGINGFACE_MODELS.get(normalized_id)


def get_all_models() -> List[ModelMetadata]:
    """Get all available models."""
    return list(HUGGINGFACE_MODELS.values())


def get_models_for_tier(tier: ModelTier) -> List[ModelMetadata]:
    """Get models available for a specific subscription tier."""
    tier_hierarchy = {
        ModelTier.FREE: 0,
        ModelTier.PRO: 1,
        ModelTier.MAX: 2,
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


def get_recommended_models() -> List[ModelMetadata]:
    """Get recommended models (dedicated endpoints with high reliability)."""
    return [model for model in get_all_models() if model.recommended]


def get_default_model_for_tier(tier: ModelTier) -> str:
    """Get default model for organization tier."""
    # Default to primary recommended model (dedicated endpoint)
    return "Qwen/Qwen2.5-Coder-32B-Instruct"


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
        ModelTier.MAX: 2,
    }
    user_tier_level = tier_hierarchy[organization_tier]
    model_tier_level = tier_hierarchy[model.tier]

    if model_tier_level > user_tier_level:
        return False

    # Check organization whitelist if provided
    if available_models and len(available_models) > 0:
        return model_id in available_models

    return True


def get_default_vision_model() -> str:
    """Get default vision model for multimodal tasks with images."""
    return "Qwen/Qwen2.5-VL-7B-Instruct"
