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

export interface ModelMetadata {
  id: string;                 // Unique model identifier (e.g., 'ibm-granite/granite-3.3-8b-instruct')
  name: string;               // Display name
  provider: 'huggingface';
  description: string;

  // Technical specs
  contextWindow: number;      // Maximum context length in tokens
  maxOutputTokens: number;    // Maximum output tokens

  // Capabilities
  capabilities: ModelCapabilities;

  // Pricing
  pricing: ModelPricing;

  // Access control
  tier: 'free' | 'pro' | 'enterprise'; // Minimum plan tier required

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
    description: 'Fast and efficient model for general chat and instruction following.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      toolCalling: false,
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
    description: 'Specialized model for code generation and programming tasks.',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    capabilities: {
      toolCalling: false,
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
export function getModelsForTier(tier: 'free' | 'pro' | 'enterprise'): ModelMetadata[] {
  const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
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
export function getDefaultModelForTier(tier: 'free' | 'pro' | 'enterprise'): string {
  // Default to production model
  return 'ibm-granite/granite-3.3-8b-instruct';
}

/**
 * Validate model access for organization
 */
export function canAccessModel(
  modelId: string,
  organizationTier: 'free' | 'pro' | 'enterprise',
  availableModels?: string[]
): boolean {
  const model = getModelMetadata(modelId);
  if (!model) return false;

  // Check tier access
  const tierHierarchy = { free: 0, pro: 1, enterprise: 2 };
  const userTierLevel = tierHierarchy[organizationTier];
  const modelTierLevel = tierHierarchy[model.tier];

  if (modelTierLevel > userTierLevel) return false;

  // Check organization whitelist if provided
  if (availableModels && availableModels.length > 0) {
    return availableModels.includes(modelId);
  }

  return true;
}
