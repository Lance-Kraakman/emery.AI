// AIDEV-NOTE: Domain interface for content processing operations
// Defines contract for processing files and generating embeddings

import type { StoredFile } from '@/ddd/domain/files/entities/file-storage';
import type { DocumentMetadata } from '../entities';

/**
 * Extended file data for RAG processing with context information
 */
export interface FileProcessingContext extends StoredFile {
  // Database context
  databaseName?: string;
  databaseId?: number;
  
  // Table context  
  tableName?: string;
  tableId?: number;
  
  // Field context
  fieldName?: string;
  fieldId?: number;
  
  // Organization context
  organizationId?: number;
}

export interface ProcessedContent {
  content: string;
  metadata: DocumentMetadata;
  embedding: number[];
  contentHash: string;
}

export interface EmbeddingGeneratorConfig {
  chunkSize: number;
  chunkOverlap: number;
  maxFileSize: number;
}

/**
 * Domain service interface for content processing
 * Implementations can use different providers (LlamaIndex, OpenAI, local models, etc.)
 */
export interface EmbeddingGeneratorService {
  /**
   * Generate embeddings for text content
   */
  generateEmbedding(content: string): Promise<number[]>;

  /**
   * Generate embedding vectors for multiple texts in batch (more efficient)
   */
  generateEmbeddingsBatch(texts: string[]): Promise<number[][]>;

  /**
   * Calculate content hash for deduplication
   */
  calculateContentHash(content: string): string;

  /**
   * Process file content into searchable chunks with embeddings
   */
  processFileContent(fileData: FileProcessingContext): Promise<ProcessedContent[]>;

  /**
   * Get supported file MIME types
   */
  getSupportedFileTypes(): string[];

  /**
   * Check if a file type is supported
   */
  isFileTypeSupported(mimeType: string): boolean;

  /**
   * Get processing configuration
   */
  getProcessingConfig(): EmbeddingGeneratorConfig;
}