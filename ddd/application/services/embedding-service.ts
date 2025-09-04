// AIDEV-NOTE: Embedding service implementation
// Provides embedding generation using the AI SDK with HuggingFace models

import { embed } from 'ai';
import { getEmbeddingModel } from '@/lib/ai/models';
import { type EmbeddingGenerator } from '@/ddd/domain/rag/services';

export class EmbeddingService implements EmbeddingGenerator {
  private readonly embeddingModel = getEmbeddingModel();

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty for embedding generation');
    }

    // Check if HF_TOKEN is available
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      console.error('[EMBEDDING-SERVICE] 🔴 CRITICAL: HF_TOKEN is not set!');
      console.error('[EMBEDDING-SERVICE] Set HF_TOKEN environment variable from https://huggingface.co/settings/tokens');
      throw new Error('HF_TOKEN environment variable is required for embeddings');
    }

    console.log(`[EMBEDDING-SERVICE] Starting embedding generation for ${text.length} chars`);
    console.log(`[EMBEDDING-SERVICE] Model: ${this.embeddingModel.modelId}`);
    console.log(`[EMBEDDING-SERVICE] Provider: ${this.embeddingModel.provider}`);
    console.log(`[EMBEDDING-SERVICE] HF_TOKEN present: ${hfToken ? 'YES' : 'NO'}`);
    
    try {
      const startTime = Date.now();
      
      // Use AI SDK's embed function
      console.log('[EMBEDDING-SERVICE] Calling AI SDK embed function...');
      const result = await embed({
        model: this.embeddingModel,
        value: text.trim(),
      });

      const elapsed = Date.now() - startTime;
      
      if (!result.embedding || result.embedding.length === 0) {
        throw new Error('Generated embedding is empty');
      }

      console.log(`[EMBEDDING-SERVICE] ✅ SUCCESS: Got ${result.embedding.length} dimensions in ${elapsed}ms`);
      
      // Log usage info if available
      if (result.usage) {
        console.log(`[EMBEDDING-SERVICE] Tokens used: ${result.usage.tokens}`);
      }
      
      return result.embedding;
    } catch (error) {
      console.error('[EMBEDDING-SERVICE] 🔴 FAILED to generate embedding!');
      
      if (error instanceof Error) {
        console.error(`[EMBEDDING-SERVICE] Error type: ${error.constructor.name}`);
        console.error(`[EMBEDDING-SERVICE] Error message: ${error.message}`);
        
        // Log more details if it's an AI SDK error
        if ('cause' in error && error.cause) {
          console.error(`[EMBEDDING-SERVICE] Cause: ${error.cause}`);
        }
        if ('response' in error && error.response) {
          console.error(`[EMBEDDING-SERVICE] Response: ${JSON.stringify(error.response)}`);
        }
        if (error.stack) {
          console.error(`[EMBEDDING-SERVICE] Stack trace:`);
          console.error(error.stack.split('\n').slice(0, 5).join('\n'));
        }
      } else {
        console.error(`[EMBEDDING-SERVICE] Unknown error type: ${typeof error}`);
        console.error(error);
      }
      
      // Re-throw the error - let the caller handle it
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    // For now, process sequentially to avoid rate limits
    // TODO: Implement proper batch processing when AI SDK supports it
    const embeddings: number[][] = [];
    
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  /**
   * Get the embedding model configuration
   */
  getModelInfo(): {
    model: string;
    dimensions: number;
  } {
    return {
      model: 'sentence-transformers/all-mpnet-base-v2',
      dimensions: 768 // High quality 768-dimensional embeddings
    };
  }
}