// AIDEV-NOTE: Embedding service implementation
// Provides embedding generation using the AI SDK with HuggingFace models

import { createDebugLogger } from '@/lib/utils/debug-logger';
import { getEmbeddingModel } from '@/lib/ai/models';
import { type EmbeddingGenerator } from '@/ddd/domain/rag/services';
import crypto from 'crypto';

const logger = createDebugLogger('EmbeddingService');

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
      logger.error('CRITICAL: HF_TOKEN is not set - Set from https://huggingface.co/settings/tokens');
      throw new Error('HF_TOKEN environment variable is required for embeddings');
    }

    const timeout = options?.timeout || 30000; // Default 30s timeout
    logger.debug('Starting embedding generation', {
      chars: text.length,
      timeout: `${timeout}ms`,
      preview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      model: this.embeddingModel.modelId,
      provider: this.embeddingModel.provider
    });
    
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

      logger.summary('Embedding generated', { dimensions: embedding.length, time: `${elapsed}ms` });

      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding', error);
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
      logger.error('CRITICAL: HF_TOKEN is not set - Set from https://huggingface.co/settings/tokens');
      throw new Error('HF_TOKEN environment variable is required for embeddings');
    }

    const timeout = options?.timeout || 45000; // Default 45s timeout for batch operations
    const totalChars = validTexts.reduce((sum, text) => sum + text.length, 0);
    logger.debug('Starting BATCH embedding generation', {
      count: validTexts.length,
      timeout: `${timeout}ms`,
      totalChars,
      model: this.embeddingModel.modelId,
      provider: this.embeddingModel.provider
    });
    
    try {
      const startTime = Date.now();
      
      // Use direct HuggingFace API with batch
      logger.debug('Calling HuggingFace batch API');

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

      logger.summary('Batch embeddings generated', {
        count: embeddings.length,
        dimensions: embeddings[0]?.length || 0,
        time: `${elapsed}ms`,
        avgPerEmbedding: `${Math.round(elapsed / embeddings.length)}ms`
      });

      return embeddings;
    } catch (error) {
      logger.error(`Failed to generate batch embeddings for ${validTexts.length} texts`, error);

      if (error instanceof Error) {
        logger.error(`Error type: ${error.constructor.name}, message: ${error.message}`);

        // Enhanced error logging for HuggingFace API errors
        if (error.message.includes('HTTP') || error.message.includes('fetch') || error.message.includes('Failed to perform inference')) {
          logger.error('HuggingFace API Error - server may be overloaded. Consider: 1) Retry later, 2) Use different model, 3) Check HF status');

          // Check if this is an InferenceClientProviderApiError from @huggingface/inference
          if (error.constructor.name === 'InferenceClientProviderApiError') {
            logger.debug('HuggingFace API Error Context', {
              url: 'url' in error ? (error as any).url : undefined,
              method: 'method' in error ? (error as any).method : undefined,
              requestId: 'requestId' in error ? (error as any).requestId : undefined
            });
            if ('body' in error) logger.debug('Response Body', (error as any).body);
          }
        }

        // Log more details if available
        if ('cause' in error && error.cause) {
          logger.error(`Cause: ${error.cause}`);
        }
        if ('status' in error && error.status) {
          logger.error(`HTTP Status: ${(error as any).status}`);
        }
        if (error.stack) {
          logger.debug(`Stack trace: ${error.stack.split('\n').slice(0, 5).join(' | ')}`);
        }
      } else {
        logger.error(`Unknown error type: ${typeof error}`, error);
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