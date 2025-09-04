/**
 * AI Model configuration for HuggingFace models
 * Uses HF_TOKEN for authentication
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { FeatureExtractionOutput, HfInference } from '@huggingface/inference'

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
 * Helper function to process HuggingFace embedding result
 */
function processEmbeddingResult(result: FeatureExtractionOutput): number[] {
  if (!Array.isArray(result)) {
    throw new Error(`Unexpected result type: ${typeof result}`);
  }
  if (Array.isArray(result[0])) {
    return result[0] as number[];
  } else {
    return result as number[];
  }
}

/**
 * Helper function to generate single embedding via HuggingFace API
 */
async function generateSingleEmbedding(
  hf: HfInference, 
  modelName: string, 
  text: string
): Promise<number[]> {
  console.log(`[HF-PROVIDER] Single embedding for: "${text.substring(0, 50)}..."`);
  
  const result = await hf.featureExtraction({
    model: modelName,
    inputs: text
  });
  
  console.log(`[HF-PROVIDER] Got result type: ${typeof result}, isArray: ${Array.isArray(result)}`);
  
  const embedding = processEmbeddingResult(result);
  console.log(`[HF-PROVIDER] Returning embedding with ${embedding.length} dimensions`);
  
  return embedding;
}

/**
 * Helper function to generate batch embeddings via HuggingFace API  
 */
async function generateBatchEmbeddings(
  hf: HfInference,
  modelName: string, 
  texts: string[]
): Promise<number[][]> {
  console.log(`[HF-PROVIDER] Batch embedding for ${texts.length} values`);
  
  const results = await Promise.all(
    texts.map((text: string) => 
      hf.featureExtraction({
        model: modelName,
        inputs: text
      })
    )
  );
  
  return results.map(processEmbeddingResult);
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
  
  // Use HuggingFace SDK for embeddings with AI SDK compatibility
  return {
    modelId: modelName,
    provider: 'huggingface',
    specificationVersion: 'v2' as const, // Required for AI SDK 5
    maxEmbeddingsPerCall: 100, // HuggingFace API limit
    supportsParallelCalls: true, // HuggingFace supports parallel requests
    
    async doEmbed({ values, abortSignal }: { values: string[]; abortSignal?: AbortSignal }) {
      console.log(`[HF-PROVIDER] doEmbed called with ${values.length} values`);
      console.log(`[HF-PROVIDER] Model: ${modelName}`);
      console.log(`[HF-PROVIDER] HF_TOKEN: ${hfToken ? 'present' : 'missing'}`);
      
      const hf = new HfInference(hfToken);
      
      try {
        if (values.length === 1) {
          const embedding = await generateSingleEmbedding(hf, modelName, values[0]);
          return { embeddings: [embedding] };
        } else {
          const embeddings = await generateBatchEmbeddings(hf, modelName, values);
          return { embeddings };
        }
      } catch (error) {
        console.error(`[HF-PROVIDER] Error:`, error);
        throw new Error(`HuggingFace embedding error: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
