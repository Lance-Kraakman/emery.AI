// AIDEV-NOTE: Embedding service implementation
// Provides embedding generation using the AI SDK with HuggingFace models

import { getEmbeddingModel } from '@/src/lib/ai/models';
import { type EmbeddingGenerator } from '@/src/ddd/domain/rag/services';
import crypto from 'crypto';

export class EmbeddingService implements EmbeddingGenerator {
  private readonly embeddingModel = getEmbeddingModel();


  calculateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async generateEmbedding(text: string, options?: { timeout?: number }): Promise<number[]> {
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

    const timeout = options?.timeout || 30000; // Default 30s timeout
    console.log(`[EMBEDDING-SERVICE] Starting embedding generation for ${text.length} chars (timeout: ${timeout}ms)`);
    console.log(`[EMBEDDING-SERVICE] Text preview: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    console.log(`[EMBEDDING-SERVICE] Model: ${this.embeddingModel.modelId}`);
    console.log(`[EMBEDDING-SERVICE] Provider: ${this.embeddingModel.provider}`);
    console.log(`[EMBEDDING-SERVICE] HF_TOKEN present: ${hfToken ? 'YES' : 'NO'}`);
    console.log(`[EMBEDDING-SERVICE] HF_TOKEN length: ${hfToken.length} chars`);
    console.log(`[EMBEDDING-SERVICE] HF_TOKEN prefix: ${hfToken.substring(0, 8)}...`);
    
    try {
      const startTime = Date.now();
            
      // Apply timeout to embedding generation
      const embeddingPromise = this.embeddingModel.generateEmbedding(text.trim());
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Embedding generation timed out after ${timeout}ms`)), timeout);
      });

      const embedding = await Promise.race([embeddingPromise, timeoutPromise]);

      const elapsed = Date.now() - startTime;
      
      if (!embedding || embedding.length === 0) {
        throw new Error('Generated embedding is empty');
      }

      console.log(`[EMBEDDING-SERVICE] ✅ SUCCESS: Got ${embedding.length} dimensions in ${elapsed}ms`);
      
      return embedding;
    } catch (error) {
      console.error('[EMBEDDING-SERVICE] 🔴 FAILED to generate embedding!');
      console.log('error generating embedding:', error)
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in a single batch API call
   * More efficient than multiple individual calls
   */
  async generateEmbeddingsBatch(texts: string[], options?: { timeout?: number }): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      throw new Error('Texts array cannot be empty for batch embedding generation');
    }

    // Filter out empty texts
    const validTexts = texts.filter(text => text && text.trim().length > 0);
    if (validTexts.length === 0) {
      throw new Error('No valid texts provided for batch embedding generation');
    }

    // Check if HF_TOKEN is available
    const hfToken = process.env.HF_TOKEN;
    if (!hfToken) {
      console.error('[EMBEDDING-SERVICE] 🔴 CRITICAL: HF_TOKEN is not set!');
      console.error('[EMBEDDING-SERVICE] Set HF_TOKEN environment variable from https://huggingface.co/settings/tokens');
      throw new Error('HF_TOKEN environment variable is required for embeddings');
    }

    const timeout = options?.timeout || 45000; // Default 45s timeout for batch operations
    console.log(`[EMBEDDING-SERVICE] Starting BATCH embedding generation for ${validTexts.length} texts (timeout: ${timeout}ms)`);
    console.log(`[EMBEDDING-SERVICE] Total characters: ${validTexts.reduce((sum, text) => sum + text.length, 0)}`);
    console.log(`[EMBEDDING-SERVICE] Model: ${this.embeddingModel.modelId}`);
    console.log(`[EMBEDDING-SERVICE] Provider: ${this.embeddingModel.provider}`);
    
    try {
      const startTime = Date.now();
      
      // Use direct HuggingFace API with batch
      console.log('[EMBEDDING-SERVICE] Calling HuggingFace batch API directly...');
      
      // Apply timeout to batch embedding generation
      const embeddingPromise = this.embeddingModel.generateEmbeddingsBatch(validTexts.map(text => text.trim()));
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Batch embedding generation timed out after ${timeout}ms`)), timeout);
      });

      const embeddings = await Promise.race([embeddingPromise, timeoutPromise]);

      const elapsed = Date.now() - startTime;
      
      if (!embeddings || embeddings.length === 0) {
        throw new Error('Generated batch embeddings are empty');
      }

      if (embeddings.length !== validTexts.length) {
        throw new Error(`Batch embedding count mismatch: expected ${validTexts.length}, got ${embeddings.length}`);
      }

      console.log(`[EMBEDDING-SERVICE] ✅ BATCH SUCCESS: Got ${embeddings.length} embeddings with ${embeddings[0]?.length || 0} dimensions in ${elapsed}ms`);
      console.log(`[EMBEDDING-SERVICE] Average: ${Math.round(elapsed / embeddings.length)}ms per embedding`);
      
      return embeddings;
    } catch (error) {
      console.error('[EMBEDDING-SERVICE] 🔴 FAILED to generate batch embeddings!');
      console.error(`[EMBEDDING-SERVICE] Failed batch size: ${validTexts.length} texts`);
      
      if (error instanceof Error) {
        console.error(`[EMBEDDING-SERVICE] Error type: ${error.constructor.name}`);
        console.error(`[EMBEDDING-SERVICE] Error message: ${error.message}`);
        
        // Enhanced error logging for HuggingFace API errors
        if (error.message.includes('HTTP') || error.message.includes('fetch') || error.message.includes('Failed to perform inference')) {
          console.error('[EMBEDDING-SERVICE] 🌐 HuggingFace API Error Details:');
          console.error(`[EMBEDDING-SERVICE] This appears to be a HuggingFace API server error`);
          console.error(`[EMBEDDING-SERVICE] The model server may be overloaded or experiencing issues`);
          console.error(`[EMBEDDING-SERVICE] Consider: 1) Retry later, 2) Use different model, 3) Check HF status`);
          
          // Check if this is an InferenceClientProviderApiError from @huggingface/inference
          if (error.constructor.name === 'InferenceClientProviderApiError') {
            console.error('[EMBEDDING-SERVICE] 📋 HuggingFace API Error Context:');
            if ('url' in error) console.error(`[EMBEDDING-SERVICE] API URL: ${error.url}`);
            if ('method' in error) console.error(`[EMBEDDING-SERVICE] HTTP Method: ${error.method}`);
            if ('requestId' in error) console.error(`[EMBEDDING-SERVICE] Request ID: ${error.requestId}`);
            if ('body' in error) console.error(`[EMBEDDING-SERVICE] Response Body:`, error.body);
          }
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
        const enhancedError = new Error(`HuggingFace batch embedding error: ${error.message}`);
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