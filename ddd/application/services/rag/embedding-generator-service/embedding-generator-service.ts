// AIDEV-NOTE: LlamaIndex infrastructure implementation of ContentProcessor
// Provides file processing using LlamaIndex library
// Refactored with template functions for maintainable content enhancement

import crypto from 'crypto';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SentenceSplitter } from 'llamaindex';
import { SimpleDirectoryReader } from "@llamaindex/readers/directory";

import { 
  type EmbeddingGeneratorService, 
  type ProcessedContent,
  type EmbeddingGeneratorConfig,
  type FileProcessingContext
} from '@/ddd/domain/rag/services/embedding-generator-service';
import { type EmbeddingGenerator } from '@/ddd/domain/rag/services';

/**
 * Template data interface for content enhancement
 */
interface TemplateData {
  tableName: string;
  databaseName: string;
  fieldName: string;
  fileName: string;
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Generate context template for file content
 */
function generateContextTemplate(data: TemplateData): string {
  return `

CONTEXT AND RELATIONSHIPS:
- This file belongs to the "${data.tableName}" table in the "${data.databaseName}" database
- Stored in field: "${data.fieldName}" (field type: file)
- This file contains data that is related to and belongs with other records in the "${data.tableName}" table
- Use this file's content in context with the "${data.tableName}" table structure and data when answering questions
- File location: Table "${data.tableName}" → Field "${data.fieldName}" → File "${data.fileName}"

CONTENT QUESTIONS: This content can answer questions like:
- What information is contained in ${data.fileName}?
- What data does ${data.fileName} have?
- Tell me about the contents of ${data.fileName}`;
}

/**
 * Generate chunk info template
 */
function generateChunkInfoTemplate(data: TemplateData): string {
  return `

CHUNK INFO: This is chunk ${data.chunkIndex + 1} of ${data.totalChunks} from ${data.fileName}, processed by LlamaIndex`;
}

/**
 * Generate context path template for metadata
 */
function generateContextPath(data: TemplateData): string {
  return `${data.databaseName} → ${data.tableName} → ${data.fieldName}`;
}

/**
 * Generate enhanced content by combining chunk text with templates
 */
function generateEnhancedContent(chunkText: string, templateData: TemplateData): string {
  const contextTemplate = generateContextTemplate(templateData);
  const chunkInfoTemplate = generateChunkInfoTemplate(templateData);
  
  return `${chunkText}${contextTemplate}${chunkInfoTemplate}`;
}

export class EmbeddingGeneratorDomainService implements EmbeddingGeneratorService {
  constructor(private readonly embeddingGenerator: EmbeddingGenerator) {}

  async processFileContent(fileData: FileProcessingContext): Promise<ProcessedContent[]> {
    try {
      console.log(`[LLAMAINDEX-PROCESSOR] Processing file: ${fileData.name}`);
      
      // Download file from S3 to temporary location
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileData.key
      }));

      if (!response.Body) {
        console.log(`[LLAMAINDEX-PROCESSOR] No body found for ${fileData.name}`);
        return [];
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const streamReader = response.Body.transformToWebStream().getReader();
      
      while (true) {
        const { done, value } = await streamReader.read();
        if (done) break;
        chunks.push(value);
      }
      
      const buffer = Buffer.concat(chunks);
      
      // Create temporary file
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'emery-rag-'));
      const tempFilePath = path.join(tempDir, fileData.name);
      await fs.writeFile(tempFilePath, buffer);

      try {
        // Use LlamaIndex to process the document
        const llamaReader = new SimpleDirectoryReader();
        const config = this.getProcessingConfig();
        const splitter = new SentenceSplitter({
          chunkSize: config.chunkSize,
          chunkOverlap: config.chunkOverlap
        });
        
        // Load and process document
        const documents = await llamaReader.loadData({ directoryPath: tempDir });
        console.log(`[LLAMAINDEX-PROCESSOR] Loaded ${documents.length} documents from ${fileData.name}`);
        
        if (documents.length === 0) {
          return [];
        }

        // Process each document
        const processedChunks: ProcessedContent[] = [];
        
        for (const doc of documents) {
          // Split into chunks
          const textChunks = await splitter.splitText(doc.text);
          console.log(`[LLAMAINDEX-PROCESSOR] Split ${fileData.name} into ${textChunks.length} chunks`);
          
          // Create processed chunks with metadata and embeddings
          for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
            const chunkText = textChunks[chunkIndex];
            
            // Prepare template data for content enhancement
            const templateData: TemplateData = {
              tableName: fileData.tableName || 'Unknown',
              databaseName: fileData.databaseName || 'Unknown', 
              fieldName: fileData.fieldName || 'Unknown',
              fileName: fileData.name,
              chunkIndex,
              totalChunks: textChunks.length
            };

            // Generate enhanced content using template functions
            const enhancedContent = generateEnhancedContent(chunkText, templateData);

            // Generate embedding for the enhanced content
            const embedding = await this.embeddingGenerator.generateEmbedding(enhancedContent);
            const contentHash = this.embeddingGenerator.calculateContentHash(enhancedContent);

            processedChunks.push({
              content: enhancedContent,
              metadata: {
                ...doc.metadata,
                chunkIndex: chunkIndex,
                totalChunks: textChunks.length,
                chunkSize: chunkText.length,
                fileName: fileData.name,
                mimeType: fileData.mimeType,
                fileSize: fileData.size,
                uploadedAt: fileData.uploadedAt,
                contextPath: generateContextPath(templateData),
                processingMethod: 'llamaindex'
              },
              embedding,
              contentHash
            });
          }
        }

        return processedChunks;

      } finally {
        // Clean up temporary file
        await fs.rm(tempDir, { recursive: true });
      }

    } catch (error) {
      console.error(`[LLAMAINDEX-PROCESSOR] Error processing ${fileData.name}:`, error);
      throw new Error(`File processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get supported file types for processing
   */
  getSupportedFileTypes(): string[] {
    return [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/json',
      'text/markdown'
    ];
  }

  /**
   * Check if a file type is supported for processing
   */
  isFileTypeSupported(mimeType: string): boolean {
    return this.getSupportedFileTypes().includes(mimeType);
  }

  /**
   * Get processing configuration
   */
  getProcessingConfig(): EmbeddingGeneratorConfig {
    return {
      chunkSize: 1024,
      chunkOverlap: 50,
      maxFileSize: 10 * 1024 * 1024 // 10MB
    };
  }

  /**
   * Delegate embedding generation to the underlying service
   */
  async generateEmbedding(content: string): Promise<number[]> {
    return this.embeddingGenerator.generateEmbedding(content);
  }

  /**
   * Delegate batch embedding generation to the underlying service
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    return this.embeddingGenerator.generateEmbeddingsBatch(texts);
  }

  /**
   * Delegate content hash calculation to the underlying service
   */
  calculateContentHash(content: string): string {
    return this.embeddingGenerator.calculateContentHash(content);
  }
}