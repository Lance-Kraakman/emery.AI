/**
 * AI Model configuration for HuggingFace models
 * Uses HF_TOKEN for authentication
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

const HF_MODELS = {
  chat: {
    default: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    alternatives: [
      'Qwen/Qwen2.5-72B-Instruct',      // Best reasoning
      'Qwen/Qwen2.5-Coder-7B-Instruct', // Fastest
      'Qwen/Qwen2.5-14B-Instruct',      // Balanced
    ]
  },
  embedding: {
    default: 'BAAI/bge-m3',                             // Best quality: multilingual, 8192 tokens, 1024 dims
    alternatives: [
      'BAAI/bge-large-en-v1.5',                         // High quality (1024 dims)
      'sentence-transformers/all-mpnet-base-v2',        // Good quality (768 dims)
      'sentence-transformers/all-MiniLM-L6-v2',         // Fast (384 dims)
    ]
  }
}

/**
 * Get chat model for HuggingFace via OpenAI-compatible endpoint
 */
export function getAIModel(modelOverride?: string) {
  const hfToken = process.env.HF_TOKEN
  if (!hfToken) {
    throw new Error('HF_TOKEN required. Get token from https://huggingface.co/settings/tokens')
  }

  // Use HuggingFace via OpenAI-compatible endpoint
  const hfProvider = createOpenAICompatible({
    name: 'huggingface',
    baseURL: 'https://router.huggingface.co/v1',
    headers: { Authorization: `Bearer ${hfToken}` },
  })
  
  const modelName = modelOverride || HF_MODELS.chat.default
  return hfProvider(modelName)
}

/**
 * Get available chat models
 */
export function getAvailableChatModels() {
  return [HF_MODELS.chat.default, ...HF_MODELS.chat.alternatives]
}

/**
 * Get the appropriate embedding model using HuggingFace SDK
 * @param modelOverride - Optional embedding model override (can be 'default' or specific model name)
 * @returns Embedding model instance for use with AI SDK embed functions
 */
export function getEmbeddingModel(modelOverride?: string) {
  const hfToken = process.env.HF_TOKEN
  if (!hfToken) {
    throw new Error('HF_TOKEN environment variable is required. Please set your Hugging Face API token.')
  }

  // Handle special 'default' keyword or use override
  let modelName: string
  if (!modelOverride || modelOverride === 'default') {
    modelName = HF_MODELS.embedding.default
  } else {
    modelName = modelOverride
  }
  
  // Use official HuggingFace SDK for embeddings with AI SDK 5 compatibility
  return {
    modelId: modelName,
    provider: 'huggingface',
    specificationVersion: 'v2', // Required for AI SDK 5
    maxEmbeddingsPerCall: 32,
    supportsParallelCalls: true,
    
    async doEmbed({ values, abortSignal }) {
      const { HfInference } = await import('@huggingface/inference')
      const hf = new HfInference(hfToken)
      
      try {
        if (values.length === 1) {
          // Single embedding
          const result = await hf.featureExtraction({
            model: modelName,
            inputs: values[0]
          })
          return { embeddings: [result as number[]] }
        } else {
          // Batch embeddings
          const results = await Promise.all(
            values.map(value => 
              hf.featureExtraction({
                model: modelName,
                inputs: value
              })
            )
          )
          return { embeddings: results as number[][] }
        }
      } catch (error) {
        throw new Error(`HuggingFace embedding error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }
}

/**
 * Get available embedding models
 */
export function getAvailableEmbeddingModels() {
  return [HF_MODELS.embedding.default, ...HF_MODELS.embedding.alternatives]
}

/**
 * Check HuggingFace configuration status
 */
export function getAIProviderInfo() {
  const hfToken = process.env.HF_TOKEN
  return {
    provider: hfToken ? 'huggingface' : 'none',
    configured: Boolean(hfToken),
    defaultChatModel: HF_MODELS.chat.default,
    defaultEmbeddingModel: HF_MODELS.embedding.default,
  }
}

/**
 * Get model by use case
 */
export function getModelRecommendation(useCase: 'code' | 'chat' | 'general' | 'fast') {
  const models = {
    code: HF_MODELS.chat.default,                      // Qwen Coder 32B
    chat: 'Qwen/Qwen2.5-72B-Instruct',               // Best reasoning  
    general: 'Qwen/Qwen2.5-14B-Instruct',            // Balanced
    fast: 'Qwen/Qwen2.5-Coder-7B-Instruct',          // Fastest
  }
  return models[useCase] || models.code
}