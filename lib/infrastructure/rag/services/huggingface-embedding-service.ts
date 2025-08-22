// AIDEV-NOTE: HuggingFace embedding service implementation
// Provides embedding generation using the AI SDK

import { embed } from 'ai';
import { getEmbeddingModel } from '@/lib/ai/models';
import { type EmbeddingGenerator } from '@/lib/domain/rag/services';

export class HuggingFaceEmbeddingService implements EmbeddingGenerator {
  private readonly embeddingModel = getEmbeddingModel();

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty for embedding generation');
    }

    try {
      const { embedding } = await embed({
        model: this.embeddingModel,
        value: text.trim(),
      });

      if (!embedding || embedding.length === 0) {
        throw new Error('Generated embedding is empty');
      }

      return embedding;
    } catch (error) {
      console.error('[HUGGINGFACE-EMBEDDING] Failed to generate embedding:', error);
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      dimensions: 768 // Default dimensions for this model
    };
  }
}