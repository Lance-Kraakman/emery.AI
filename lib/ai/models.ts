/**
 * AI Model configuration for HuggingFace models
 * Uses HF_TOKEN for authentication
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { HfInference } from '@huggingface/inference'

const HF_MODELS = {
  chat: {
    default: 'Qwen/Qwen2.5-7B-Instruct',  // Only model with default interface provider
    alternatives: []  // Using single model only
  },
  embedding: {
    default: 'sentence-transformers/all-mpnet-base-v2',  // High quality, reliable (768 dims)
    alternatives: [
      'thenlper/gte-base',                               // Alternative high quality (768 dims)
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
  return [HF_MODELS.chat.default]  // Only Qwen/Qwen-7B-Instruct
}

/**
 * Get the appropriate embedding model using direct HuggingFace API
 * @param modelOverride - Optional embedding model override (can be 'default' or specific model name)
 * @returns HuggingFace inference client configured for embeddings
 */
export function getEmbeddingModel(modelOverride?: string) {
  const hfToken = process.env.HF_TOKEN
  if (!hfToken) {
    throw new Error('HF_TOKEN environment variable is required. Please set your Hugging Face API token.')
  }

  // Handle special 'default' keyword or use override
  const modelName = modelOverride && modelOverride !== 'default' 
    ? modelOverride 
    : HF_MODELS.embedding.default
  
  // Use direct HuggingFace API for embeddings (OpenAI-compatible doesn't support embeddings)
  const hfClient = new HfInference(hfToken)
  
  // Return an object that matches the expected embedding interface
  return {
    modelId: modelName,
    provider: 'huggingface',
    
    // Method to generate embeddings compatible with AI SDK
    async generateEmbedding(text: string): Promise<number[]> {
      const result = await hfClient.featureExtraction({
        model: modelName,
        inputs: text,
      })
      
      // Handle nested array response from HuggingFace
      if (Array.isArray(result) && Array.isArray(result[0])) {
        return result[0] as number[]
      } else if (Array.isArray(result)) {
        return result as number[]
      } else {
        throw new Error('Unexpected embedding response format from HuggingFace')
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
    provider: 'auto',
    configured: Boolean(hfToken),
    defaultChatModel: HF_MODELS.chat.default,
    defaultEmbeddingModel: HF_MODELS.embedding.default,
  }
}

/**
 * Get model by use case
 */
export function getModelRecommendation(useCase: 'code' | 'chat' | 'general' | 'fast') {
  // All use cases use the same model since it's the only one with default interface provider
  return HF_MODELS.chat.default  // Qwen/Qwen-7B-Instruct
}
