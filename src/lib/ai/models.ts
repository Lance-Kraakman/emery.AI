/**
 * AI Model configuration for HuggingFace models
 * Uses HF_TOKEN for authentication
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { InferenceClient } from '@huggingface/inference'

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
  
  // Use direct HuggingFace Serverless API for embeddings (bypasses router issues)
  const hfClient = new InferenceClient(hfToken, {
    // Use direct model endpoint instead of router to avoid provider selection issues
    endpointUrl: `https://cq8xpkgutl12uji0.us-east-1.aws.endpoints.huggingface.cloud`,
    retry_on_error: true,
  })
  
  // Return an object that matches the expected embedding interface
  return {
    modelId: modelName,
    provider: 'huggingface',
    
    // Method to generate embeddings compatible with AI SDK
    async generateEmbedding(text: string): Promise<number[]> {
      try {
        const result = await hfClient.featureExtraction({
          inputs: text,
        })
        
        // Handle nested array response from HuggingFace
        if (Array.isArray(result) && Array.isArray(result[0])) {
          const embedding = result[0] as number[];
          console.log(`[HF-EMBEDDING] Got ${embedding.length} dimensions`);
          return embedding;
        } else if (Array.isArray(result)) {
          const embedding = result as number[];
          console.log(`[HF-EMBEDDING] Got ${embedding.length} dimensions`);
          return embedding;
        } else {
          console.error(`[HF-EMBEDDING] Unexpected response:`, result);
          throw new Error('Unexpected embedding response format from HuggingFace')
        }
      } catch (error) {
        console.error(`[HF-EMBEDDING] API Error:`, error);
        throw error;
      }
    },

    // Method to generate batch embeddings using HuggingFace batch API
    async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
      console.log(`[HF-BATCH] Processing ${texts.length} texts`);
      
      try {
        const result = await hfClient.featureExtraction({
          inputs: texts,
        })
        
        // HuggingFace returns array of embeddings for batch input
        if (Array.isArray(result)) {
          if (result.length > 0 && Array.isArray(result[0])) {
            const embeddings = result as number[][];
            console.log(`[HF-BATCH] Got ${embeddings.length} embeddings, ${embeddings[0]?.length || 0} dimensions each`);
            return embeddings;
          } else {
            console.error(`[HF-BATCH] Unexpected batch response:`, result);
            throw new Error('Unexpected batch embedding response format from HuggingFace')
          }
        } else {
          console.error(`[HF-BATCH] Expected array, got:`, result);
          throw new Error('Expected array response for batch embedding generation')
        }
      } catch (error) {
        console.error(`[HF-BATCH] API Error:`, error);
        throw error;
      }
    }
  }
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
