/**
 * HuggingFace Model Registry
 *
 * Centralized catalog of available AI models with pricing, capabilities, and metadata.
 * Used for model selection UI, billing calculations, and access control.
 *
 * AIDEV-NOTE: This is the source of truth for all model configurations.
 * Update pricing from HuggingFace Inference API pricing page.
 */

export interface ModelCapabilities {
  toolCalling: boolean;      // Supports function/tool calling
  streaming: boolean;         // Supports streaming responses
  vision: boolean;            // Supports image inputs
  jsonMode: boolean;          // Supports JSON output mode
  multimodal: boolean;        // Supports multiple input types
}

export interface ModelPricing {
  inputPer1M: number;         // Provider cost per 1M input tokens in USD (internal tracking)
  outputPer1M: number;        // Provider cost per 1M output tokens in USD (internal tracking)
  currency: 'USD';

  // Credit pricing for user-facing billing (1 credit = $0.001, with 2.5x markup on provider costs)
  // AIDEV-NOTE: Credits provide user-friendly billing units
  inputCreditsPerK: number;   // Credits consumed per 1K input tokens
  outputCreditsPerK: number;  // Credits consumed per 1K output tokens
}

// Task types for different model capabilities
export type ModelTaskType =
  | 'chat-completion'
  | 'text-to-image'
  | 'speech-to-text'
  | 'text-to-speech'
  | 'object-detection'
  | 'image-classification'
  | 'question-answering'
  | 'zero-shot-classification'
  | 'summarization'
  | 'feature-extraction';

// Output types for chat display
export type ModelOutputType = 'text' | 'image' | 'audio' | 'json' | 'embedding';

export interface ModelMetadata {
  id: string;                 // Unique model identifier (e.g., 'ibm-granite/granite-3.3-8b-instruct')
  name: string;               // Display name
  provider: 'huggingface';
  description: string;

  // Technical specs
  contextWindow: number;      // Maximum context length in tokens
  maxOutputTokens: number;    // Maximum output tokens

  // Task and output types (for non-chat models)
  taskType?: ModelTaskType;   // What kind of task this model performs
  outputType?: ModelOutputType; // What kind of output it returns in chat

  // Capabilities
  capabilities: ModelCapabilities;

  // Pricing
  pricing: ModelPricing;

  // Access control
  tier: 'free' | 'pro' | 'max' | 'enterprise'; // Minimum plan tier required

  // Performance category
  category: 'fast' | 'balanced' | 'advanced';

  // Endpoint configuration
  endpoint: {
    type: 'dedicated' | 'inference-api';
    url?: string;             // For dedicated endpoints
  };
}

/**
 * HuggingFace Model Registry
 *
 * PRICING NOTES:
 * - Dedicated endpoints: Custom pricing based on contract
 * - Inference API: Pay-per-token pricing (varies by model)
 * - Free tier: Limited quota, slower inference
 */
export const HUGGINGFACE_MODELS: Record<string, ModelMetadata> = {
  // Current production model (dedicated endpoint)
  'ibm-granite/granite-3.3-8b-instruct': {
    id: 'ibm-granite/granite-3.3-8b-instruct',
    name: 'IBM Granite 3.3 8B Instruct',
    provider: 'huggingface',
    description: 'Production model on dedicated endpoint. Optimized for tool calling and instruction following.',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.15,      // Custom pricing - adjust based on contract
      outputPer1M: 0.60,     // Custom pricing - adjust based on contract
      currency: 'USD',
      inputCreditsPerK: 0.375,   // 0.375 credits per 1K input tokens
      outputCreditsPerK: 1.5,    // 1.5 credits per 1K output tokens
    },
    tier: 'free',            // Available to all users
    category: 'balanced',
    endpoint: {
      type: 'dedicated',
      url: 'https://dxv8q9ubsizxcp4v.us-east-1.aws.endpoints.huggingface.cloud',
    },
  },

  // HuggingFace Inference API models (pay-per-use)
  'Qwen/Qwen2.5-7B-Instruct': {
    id: 'Qwen/Qwen2.5-7B-Instruct',
    name: 'Qwen 2.5 7B Instruct',
    provider: 'huggingface',
    description: 'Fast and efficient model for general chat, instruction following, and tool calling.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      toolCalling: true,  // Supports function/tool calling
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.10,
      outputPer1M: 0.40,
      currency: 'USD',
      inputCreditsPerK: 0.25,    // 0.25 credits per 1K input tokens
      outputCreditsPerK: 1.0,    // 1.0 credits per 1K output tokens
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'Qwen/Qwen2.5-14B-Instruct': {
    id: 'Qwen/Qwen2.5-14B-Instruct',
    name: 'Qwen 2.5 14B Instruct',
    provider: 'huggingface',
    description: 'Balanced model with strong reasoning capabilities and tool calling support.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.20,
      outputPer1M: 0.80,
      currency: 'USD',
      inputCreditsPerK: 0.5,     // 0.5 credits per 1K input tokens
      outputCreditsPerK: 2.0,    // 2.0 credits per 1K output tokens
    },
    tier: 'free',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  'Qwen/Qwen2.5-Coder-7B-Instruct': {
    id: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    name: 'Qwen 2.5 Coder 7B',
    provider: 'huggingface',
    description: 'Specialized model for code generation, programming tasks, and tool calling for development workflows.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      toolCalling: true,  // Excellent for tool use workflows
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.10,
      outputPer1M: 0.40,
      currency: 'USD',
      inputCreditsPerK: 0.25,    // 0.25 credits per 1K input tokens
      outputCreditsPerK: 1.0,    // 1.0 credits per 1K output tokens
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'meta-llama/Llama-3.2-3B-Instruct': {
    id: 'meta-llama/Llama-3.2-3B-Instruct',
    name: 'Llama 3.2 3B Instruct',
    provider: 'huggingface',
    description: 'Ultra-fast model for simple tasks and high-throughput scenarios.',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    capabilities: {
      toolCalling: false,
      streaming: true,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.05,
      outputPer1M: 0.20,
      currency: 'USD',
      inputCreditsPerK: 0.125,   // 0.125 credits per 1K input tokens
      outputCreditsPerK: 0.5,    // 0.5 credits per 1K output tokens
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'mistralai/Mistral-7B-Instruct-v0.3': {
    id: 'mistralai/Mistral-7B-Instruct-v0.3',
    name: 'Mistral 7B Instruct',
    provider: 'huggingface',
    description: 'High-quality open model with strong performance on reasoning tasks.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.15,
      outputPer1M: 0.60,
      currency: 'USD',
      inputCreditsPerK: 0.375,   // 0.375 credits per 1K input tokens
      outputCreditsPerK: 1.5,    // 1.5 credits per 1K output tokens
    },
    tier: 'pro',             // Pro tier only
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  // Vision models
  'llava-hf/llava-1.5-7b-hf': {
    id: 'llava-hf/llava-1.5-7b-hf',
    name: 'LLaVA 1.5 7B',
    provider: 'huggingface',
    description: 'Vision-language model for image understanding and visual question answering. Supports multimodal inputs.',
    contextWindow: 4096,
    maxOutputTokens: 2048,
    capabilities: {
      toolCalling: false,
      streaming: true,
      vision: true,
      jsonMode: false,
      multimodal: true,
    },
    pricing: {
      inputPer1M: 0.10,      // Estimated pricing for vision models
      outputPer1M: 0.40,     // Estimated pricing for vision models
      currency: 'USD',
      inputCreditsPerK: 0.25,    // 0.25 credits per 1K input tokens
      outputCreditsPerK: 1.0,    // 1.0 credits per 1K output tokens
    },
    tier: 'free',            // Available to all users
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  // Vision-language model for image understanding
  'Qwen/Qwen2.5-VL-7B-Instruct': {
    id: 'Qwen/Qwen2.5-VL-7B-Instruct',
    name: 'Qwen2.5-VL 7B Instruct',
    provider: 'huggingface',
    description: 'Updated vision-language model for image understanding and analysis with tool calling support. Trained on agentic tasks (April 2025), 32k context window.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: true,      // Vision capability for image inputs
      jsonMode: true,
      multimodal: true,  // Multimodal support (text + images)
    },
    pricing: {
      inputPer1M: 0.20,
      outputPer1M: 0.80,
      currency: 'USD',
      inputCreditsPerK: 0.5,     // 0.5 credits per 1K input tokens
      outputCreditsPerK: 2.0,    // 2.0 credits per 1K output tokens
    },
    tier: 'free',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  // AIDEV-NOTE: Multimodal models removed - SmolVLM and Phi-4 don't support text-only chat
  // through HF Inference API. They only work for image-to-text tasks, not conversational AI.
  // SmolVLM models throw: "Task 'conversational' not supported for provider 'replicate'"
  // Phi-4 multimodal is not deployed on HF Inference API (only Azure AI, DeepInfra, etc.)

  // ============================================================================
  // CHAT LLMs WITH TOOL CALLING - 32B CLASS (Sweet Spot)
  // Multi-provider support via HuggingFace Inference Providers
  // ============================================================================

  'Qwen/Qwen2.5-32B-Instruct': {
    id: 'Qwen/Qwen2.5-32B-Instruct',
    name: 'Qwen 2.5 32B Instruct',
    provider: 'huggingface',
    description: 'Excellent balance of capability and speed. 128K context, strong reasoning and tool calling.',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.30,
      outputPer1M: 0.80,
      currency: 'USD',
      inputCreditsPerK: 0.75,
      outputCreditsPerK: 2.0,
    },
    tier: 'pro',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  'Qwen/Qwen2.5-Coder-32B-Instruct': {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    name: 'Qwen 2.5 Coder 32B',
    provider: 'huggingface',
    description: 'Top-tier coding model. 128K context, excellent for code generation and tool use workflows.',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.30,
      outputPer1M: 0.80,
      currency: 'USD',
      inputCreditsPerK: 0.75,
      outputCreditsPerK: 2.0,
    },
    tier: 'pro',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  'Qwen/QwQ-32B': {
    id: 'Qwen/QwQ-32B',
    name: 'Qwen QwQ 32B (Reasoning)',
    provider: 'huggingface',
    description: 'Specialized reasoning model with chain-of-thought. Excellent for complex problem-solving.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.30,
      outputPer1M: 0.80,
      currency: 'USD',
      inputCreditsPerK: 0.75,
      outputCreditsPerK: 2.0,
    },
    tier: 'pro',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  // ============================================================================
  // CHAT LLMs WITH TOOL CALLING - SMALLER (Fast)
  // ============================================================================

  'meta-llama/Llama-3.1-8B-Instruct': {
    id: 'meta-llama/Llama-3.1-8B-Instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'huggingface',
    description: 'Fast and reliable with 128K context. Multi-provider support (Groq, Together, Fireworks).',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.10,
      outputPer1M: 0.40,
      currency: 'USD',
      inputCreditsPerK: 0.25,
      outputCreditsPerK: 1.0,
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  // ============================================================================
  // CHAT LLMs WITH TOOL CALLING - LARGER (Advanced)
  // ============================================================================

  'meta-llama/Llama-3.1-70B-Instruct': {
    id: 'meta-llama/Llama-3.1-70B-Instruct',
    name: 'Llama 3.1 70B Instruct',
    provider: 'huggingface',
    description: 'Powerful 70B model with 128K context. Excellent reasoning and tool calling capabilities.',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.60,
      outputPer1M: 1.20,
      currency: 'USD',
      inputCreditsPerK: 1.5,
      outputCreditsPerK: 3.0,
    },
    tier: 'pro',
    category: 'advanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  'Qwen/Qwen2.5-72B-Instruct': {
    id: 'Qwen/Qwen2.5-72B-Instruct',
    name: 'Qwen 2.5 72B Instruct',
    provider: 'huggingface',
    description: 'Top-tier 72B model with 128K context. State-of-the-art reasoning and tool use.',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.50,
      outputPer1M: 1.00,
      currency: 'USD',
      inputCreditsPerK: 1.25,
      outputCreditsPerK: 2.5,
    },
    tier: 'pro',
    category: 'advanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  'deepseek-ai/DeepSeek-R1': {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'DeepSeek R1 (Reasoning)',
    provider: 'huggingface',
    description: 'Advanced reasoning model with extended thinking. Excellent for complex analytical tasks.',
    contextWindow: 65536,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: false,
      jsonMode: true,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.50,
      outputPer1M: 2.00,
      currency: 'USD',
      inputCreditsPerK: 1.25,
      outputCreditsPerK: 5.0,
    },
    tier: 'max',
    category: 'advanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  // ============================================================================
  // VLM (Vision + Tool Calling)
  // ============================================================================

  'Qwen/Qwen2.5-VL-32B-Instruct': {
    id: 'Qwen/Qwen2.5-VL-32B-Instruct',
    name: 'Qwen 2.5 VL 32B',
    provider: 'huggingface',
    description: 'Vision-language model with tool calling. Excellent for image understanding and analysis.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: true,
      jsonMode: true,
      multimodal: true,
    },
    pricing: {
      inputPer1M: 0.40,
      outputPer1M: 1.00,
      currency: 'USD',
      inputCreditsPerK: 1.0,
      outputCreditsPerK: 2.5,
    },
    tier: 'pro',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  'Qwen/Qwen2.5-VL-72B-Instruct': {
    id: 'Qwen/Qwen2.5-VL-72B-Instruct',
    name: 'Qwen 2.5 VL 72B',
    provider: 'huggingface',
    description: 'Top-tier vision-language model. State-of-the-art image understanding with tool calling.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    taskType: 'chat-completion',
    outputType: 'text',
    capabilities: {
      toolCalling: true,
      streaming: true,
      vision: true,
      jsonMode: true,
      multimodal: true,
    },
    pricing: {
      inputPer1M: 0.60,
      outputPer1M: 1.20,
      currency: 'USD',
      inputCreditsPerK: 1.5,
      outputCreditsPerK: 3.0,
    },
    tier: 'max',
    category: 'advanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  // ============================================================================
  // TASK-SPECIFIC MODELS - Image Generation
  // Returns image file in chat
  // ============================================================================

  'black-forest-labs/FLUX.1-schnell': {
    id: 'black-forest-labs/FLUX.1-schnell',
    name: 'FLUX.1 Schnell',
    provider: 'huggingface',
    description: 'Fast image generation. 4 steps, high quality. Returns image file in chat.',
    contextWindow: 0,
    maxOutputTokens: 0,
    taskType: 'text-to-image',
    outputType: 'image',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0,
      outputCreditsPerK: 0.5, // Per image
    },
    tier: 'pro',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'black-forest-labs/FLUX.1-dev': {
    id: 'black-forest-labs/FLUX.1-dev',
    name: 'FLUX.1 Dev',
    provider: 'huggingface',
    description: 'High-quality image generation. More steps, better detail. Returns image file in chat.',
    contextWindow: 0,
    maxOutputTokens: 0,
    taskType: 'text-to-image',
    outputType: 'image',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0,
      outputCreditsPerK: 1.0, // Per image
    },
    tier: 'pro',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  // ============================================================================
  // TASK-SPECIFIC MODELS - Audio
  // Speech-to-text returns text, text-to-speech returns audio file
  // ============================================================================

  'openai/whisper-large-v3': {
    id: 'openai/whisper-large-v3',
    name: 'Whisper Large V3',
    provider: 'huggingface',
    description: 'State-of-the-art speech recognition. Transcribes audio to text in chat.',
    contextWindow: 0,
    maxOutputTokens: 0,
    taskType: 'speech-to-text',
    outputType: 'text',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: true,
    },
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.1, // Per minute of audio
      outputCreditsPerK: 0,
    },
    tier: 'free',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  'distil-whisper/distil-large-v3': {
    id: 'distil-whisper/distil-large-v3',
    name: 'Distil Whisper Large V3',
    provider: 'huggingface',
    description: 'Fast speech recognition. 6x faster than Whisper with similar accuracy.',
    contextWindow: 0,
    maxOutputTokens: 0,
    taskType: 'speech-to-text',
    outputType: 'text',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: true,
    },
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.05, // Per minute of audio
      outputCreditsPerK: 0,
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'suno/bark': {
    id: 'suno/bark',
    name: 'Bark TTS',
    provider: 'huggingface',
    description: 'Text-to-speech generation. Creates natural-sounding audio from text.',
    contextWindow: 0,
    maxOutputTokens: 0,
    taskType: 'text-to-speech',
    outputType: 'audio',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.1, // Per 1K characters
      outputCreditsPerK: 0,
    },
    tier: 'pro',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },

  // ============================================================================
  // TASK-SPECIFIC MODELS - Vision Analysis
  // Returns structured data (bounding boxes, labels) as JSON in chat
  // ============================================================================

  'facebook/detr-resnet-50': {
    id: 'facebook/detr-resnet-50',
    name: 'DETR Object Detection',
    provider: 'huggingface',
    description: 'Detects objects in images. Returns bounding boxes and labels.',
    contextWindow: 0,
    maxOutputTokens: 0,
    taskType: 'object-detection',
    outputType: 'json',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: true,
      jsonMode: false,
      multimodal: true,
    },
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.05, // Per image
      outputCreditsPerK: 0,
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'google/vit-base-patch16-224': {
    id: 'google/vit-base-patch16-224',
    name: 'ViT Image Classification',
    provider: 'huggingface',
    description: 'Classifies images into categories. Returns labels with confidence scores.',
    contextWindow: 0,
    maxOutputTokens: 0,
    taskType: 'image-classification',
    outputType: 'json',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: true,
      jsonMode: false,
      multimodal: true,
    },
    pricing: {
      inputPer1M: 0,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.02, // Per image
      outputCreditsPerK: 0,
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  // ============================================================================
  // TASK-SPECIFIC MODELS - Text Processing
  // Returns text in chat
  // ============================================================================

  'deepset/roberta-base-squad2': {
    id: 'deepset/roberta-base-squad2',
    name: 'RoBERTa Question Answering',
    provider: 'huggingface',
    description: 'Extractive question answering. Finds answers in provided context.',
    contextWindow: 512,
    maxOutputTokens: 0,
    taskType: 'question-answering',
    outputType: 'text',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.01,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.025,
      outputCreditsPerK: 0,
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'facebook/bart-large-mnli': {
    id: 'facebook/bart-large-mnli',
    name: 'BART Zero-Shot Classification',
    provider: 'huggingface',
    description: 'Classifies text into custom categories. No training required.',
    contextWindow: 1024,
    maxOutputTokens: 0,
    taskType: 'zero-shot-classification',
    outputType: 'json',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.02,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.05,
      outputCreditsPerK: 0,
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'facebook/bart-large-cnn': {
    id: 'facebook/bart-large-cnn',
    name: 'BART Summarization',
    provider: 'huggingface',
    description: 'Summarizes long text into concise summaries.',
    contextWindow: 1024,
    maxOutputTokens: 142,
    taskType: 'summarization',
    outputType: 'text',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.02,
      outputPer1M: 0.04,
      currency: 'USD',
      inputCreditsPerK: 0.05,
      outputCreditsPerK: 0.1,
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  // ============================================================================
  // TASK-SPECIFIC MODELS - Embeddings
  // Returns vectors for RAG/semantic search
  // ============================================================================

  'BAAI/bge-large-en-v1.5': {
    id: 'BAAI/bge-large-en-v1.5',
    name: 'BGE Large English',
    provider: 'huggingface',
    description: 'High-quality text embeddings for semantic search and RAG. 1024 dimensions.',
    contextWindow: 512,
    maxOutputTokens: 0,
    taskType: 'feature-extraction',
    outputType: 'embedding',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.01,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.025,
      outputCreditsPerK: 0,
    },
    tier: 'free',
    category: 'fast',
    endpoint: {
      type: 'inference-api',
    },
  },

  'BAAI/bge-m3': {
    id: 'BAAI/bge-m3',
    name: 'BGE M3 (Multilingual)',
    provider: 'huggingface',
    description: 'Multilingual embeddings supporting 100+ languages. 1024 dimensions.',
    contextWindow: 8192,
    maxOutputTokens: 0,
    taskType: 'feature-extraction',
    outputType: 'embedding',
    capabilities: {
      toolCalling: false,
      streaming: false,
      vision: false,
      jsonMode: false,
      multimodal: false,
    },
    pricing: {
      inputPer1M: 0.02,
      outputPer1M: 0,
      currency: 'USD',
      inputCreditsPerK: 0.05,
      outputCreditsPerK: 0,
    },
    tier: 'free',
    category: 'balanced',
    endpoint: {
      type: 'inference-api',
    },
  },
};

/**
 * Get model metadata by ID
 */
export function getModelMetadata(modelId: string): ModelMetadata | undefined {
  return HUGGINGFACE_MODELS[modelId];
}

/**
 * Get all available models
 */
export function getAllModels(): ModelMetadata[] {
  return Object.values(HUGGINGFACE_MODELS);
}

/**
 * Get models available for a specific tier
 */
export function getModelsForTier(tier: 'free' | 'pro' | 'max' | 'enterprise'): ModelMetadata[] {
  const tierHierarchy = { free: 0, pro: 1, max: 2, enterprise: 3 };
  const userTierLevel = tierHierarchy[tier];

  return getAllModels().filter(model => {
    const modelTierLevel = tierHierarchy[model.tier];
    return modelTierLevel <= userTierLevel;
  });
}

/**
 * Get models by category
 */
export function getModelsByCategory(category: 'fast' | 'balanced' | 'advanced'): ModelMetadata[] {
  return getAllModels().filter(model => model.category === category);
}

/**
 * Get models with specific capability
 */
export function getModelsWithCapability(capability: keyof ModelCapabilities): ModelMetadata[] {
  return getAllModels().filter(model => model.capabilities[capability]);
}

/**
 * Get models by task type
 */
export function getModelsByTaskType(taskType: ModelTaskType): ModelMetadata[] {
  return getAllModels().filter(model => model.taskType === taskType);
}

/**
 * Get models by output type
 */
export function getModelsByOutputType(outputType: ModelOutputType): ModelMetadata[] {
  return getAllModels().filter(model => model.outputType === outputType);
}

/**
 * Get conversational models (multi-turn dialogue)
 */
export function getConversationalModels(): ModelMetadata[] {
  return getAllModels().filter(model =>
    model.taskType === 'chat-completion' || !model.taskType
  );
}

/**
 * Get single-task models (one input → one output)
 * These still work through chat, but aren't conversational
 */
export function getSingleTaskModels(): ModelMetadata[] {
  return getAllModels().filter(model =>
    model.taskType && model.taskType !== 'chat-completion'
  );
}

/**
 * Calculate provider cost for token usage (internal tracking)
 */
export function calculateTokenCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModelMetadata(modelId);
  if (!model) {
    console.warn(`Model ${modelId} not found in registry, returning 0 cost`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * model.pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * model.pricing.outputPer1M;

  return inputCost + outputCost;
}

/**
 * Calculate credits consumed for token usage (user-facing billing)
 * 1 credit = $0.001 with 2.5x markup on provider costs
 */
export function calculateCreditsUsed(
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModelMetadata(modelId);
  if (!model) {
    console.warn(`Model ${modelId} not found in registry, returning 0 credits`);
    return 0;
  }

  const inputCredits = (inputTokens / 1_000) * model.pricing.inputCreditsPerK;
  const outputCredits = (outputTokens / 1_000) * model.pricing.outputCreditsPerK;

  return inputCredits + outputCredits;
}

/**
 * Get default model for organization tier
 */
export function getDefaultModelForTier(tier: 'free' | 'pro' | 'max' | 'enterprise'): string {
  // Default to production model
  return 'ibm-granite/granite-3.3-8b-instruct';
}

/**
 * Validate model access for organization
 */
export function canAccessModel(
  modelId: string,
  organizationTier: 'free' | 'pro' | 'max' | 'enterprise',
  availableModels?: string[]
): boolean {
  const model = getModelMetadata(modelId);
  if (!model) return false;

  // Check tier access
  const tierHierarchy = { free: 0, pro: 1, max: 2, enterprise: 3 };
  const userTierLevel = tierHierarchy[organizationTier];
  const modelTierLevel = tierHierarchy[model.tier];

  if (modelTierLevel > userTierLevel) return false;

  // Check organization whitelist if provided
  if (availableModels && availableModels.length > 0) {
    return availableModels.includes(modelId);
  }

  return true;
}
