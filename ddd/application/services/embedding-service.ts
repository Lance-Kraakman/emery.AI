// AIDEV-NOTE: Embedding service implementation
// Provides embedding generation using the AI SDK with HuggingFace models

import { getEmbeddingModel } from '@/lib/ai/models';
import { type EmbeddingGenerator } from '@/ddd/domain/rag/services';
import crypto from 'crypto';

export class EmbeddingService implements EmbeddingGenerator {
  private readonly embeddingModel = getEmbeddingModel();


  calculateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty for embedding generation');
    }

    // Production embedding generation only

    // Check if HF_TOKEN is available
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      console.error('[EMBEDDING-SERVICE] 🔴 CRITICAL: HF_TOKEN is not set!');
      console.error('[EMBEDDING-SERVICE] Set HF_TOKEN environment variable from https://huggingface.co/settings/tokens');
      throw new Error('HF_TOKEN environment variable is required for embeddings');
    }

    console.log(`[EMBEDDING-SERVICE] Starting embedding generation for ${text.length} chars`);
    console.log(`[EMBEDDING-SERVICE] Text preview: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    console.log(`[EMBEDDING-SERVICE] Model: ${this.embeddingModel.modelId}`);
    console.log(`[EMBEDDING-SERVICE] Provider: ${this.embeddingModel.provider}`);
    console.log(`[EMBEDDING-SERVICE] HF_TOKEN present: ${hfToken ? 'YES' : 'NO'}`);
    console.log(`[EMBEDDING-SERVICE] HF_TOKEN length: ${hfToken.length} chars`);
    console.log(`[EMBEDDING-SERVICE] HF_TOKEN prefix: ${hfToken.substring(0, 8)}...`);
    
    try {
      const startTime = Date.now();
      
      // Use direct HuggingFace API
      console.log('[EMBEDDING-SERVICE] Calling HuggingFace API directly...');
      
      const embedding = await this.embeddingModel.generateEmbedding(text.trim());

      const elapsed = Date.now() - startTime;
      
      if (!embedding || embedding.length === 0) {
        throw new Error('Generated embedding is empty');
      }

      console.log(`[EMBEDDING-SERVICE] ✅ SUCCESS: Got ${embedding.length} dimensions in ${elapsed}ms`);
      
      return embedding;
    } catch (error) {
      console.error('[EMBEDDING-SERVICE] 🔴 FAILED to generate embedding!');
      console.error(`[EMBEDDING-SERVICE] Failed text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
      
      if (error instanceof Error) {
        console.error(`[EMBEDDING-SERVICE] Error type: ${error.constructor.name}`);
        console.error(`[EMBEDDING-SERVICE] Error message: ${error.message}`);
        
        // Enhanced error logging for HuggingFace API errors
        if (error.message.includes('HTTP') || error.message.includes('fetch')) {
          console.error('[EMBEDDING-SERVICE] 🌐 HuggingFace API Error Details:');
          console.error(`[EMBEDDING-SERVICE] This appears to be a HuggingFace API server error`);
          console.error(`[EMBEDDING-SERVICE] The model server may be overloaded or experiencing issues`);
          console.error(`[EMBEDDING-SERVICE] Consider: 1) Retry later, 2) Use different model, 3) Check HF status`);
        }
        
        // Log more details if available
        if ('cause' in error && error.cause) {
          console.error(`[EMBEDDING-SERVICE] Cause: ${error.cause}`);
        }
        if ('status' in error && error.status) {
          console.error(`[EMBEDDING-SERVICE] HTTP Status: ${(error as any).status}`);
        }
        if (error.stack) {
          console.error(`[EMBEDDING-SERVICE] Stack trace:`);
          console.error(error.stack.split('\n').slice(0, 5).join('\n'));
        }
      } else {
        console.error(`[EMBEDDING-SERVICE] Unknown error type: ${typeof error}`);
        console.error(error);
      }
      
      // Create a more descriptive error for upstream handling
      if (error instanceof Error && error.message.includes('HTTP')) {
        const enhancedError = new Error(`HuggingFace embedding error: ${error.message}`);
        (enhancedError as any).cause = error;
        throw enhancedError;
      }
      
      throw error;
    }
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