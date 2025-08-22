// AIDEV-NOTE: LlamaIndex content processor implementation
// Provides file processing and content generation capabilities

import crypto from 'crypto';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { SentenceSplitter } from 'llamaindex';
import { SimpleDirectoryReader } from "@llamaindex/readers/directory";

import { 
  type ContentProcessor, 
  type ProcessedContent,
  type FileData 
} from '@/ddd/domain/rag/services';
import { type EmbeddingGenerator } from '@/ddd/domain/rag/services';

export class LlamaIndexContentProcessor implements ContentProcessor {
  constructor(private readonly embeddingGenerator: EmbeddingGenerator) {}

  async generateEmbedding(content: string): Promise<number[]> {
    return this.embeddingGenerator.generateEmbedding(content);
  }

  calculateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async processFileContent(fileData: FileData): Promise<ProcessedContent[]> {
    try {
      console.log(`[LLAMAINDEX-PROCESSOR] Processing file: ${fileData.name}`);
      
      // Download file from S3 to temporary location
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileData.s3Key
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
        const splitter = new SentenceSplitter({
          chunkSize: 1024,
          chunkOverlap: 50
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
            
            // Add context to improve search relevance
            const baseContext = `

CONTEXT AND RELATIONSHIPS:
- This file belongs to the "${fileData.tableName}" table in the "${fileData.databaseName}" database
- Stored in field: "${fileData.fieldName}" (field type: file)
- This file contains data that is related to and belongs with other records in the "${fileData.tableName}" table
- Use this file's content in context with the "${fileData.tableName}" table structure and data when answering questions
- File location: Table "${fileData.tableName}" → Field "${fileData.fieldName}" → File "${fileData.name}"

CONTENT QUESTIONS: This content can answer questions like:
- What information is contained in ${fileData.name}?
- What data does ${fileData.name} have?
- Tell me about the contents of ${fileData.name}`;

            const enhancedContent = `${chunkText}${baseContext}

CHUNK INFO: This is chunk ${chunkIndex + 1} of ${textChunks.length} from ${fileData.name}, processed by LlamaIndex`;

            // Generate embedding for the enhanced content
            const embedding = await this.generateEmbedding(enhancedContent);
            const contentHash = this.calculateContentHash(enhancedContent);

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
                contextPath: `${fileData.databaseName} → ${fileData.tableName} → ${fileData.fieldName}`,
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
  getProcessingConfig(): {
    chunkSize: number;
    chunkOverlap: number;
    maxFileSize: number;
  } {
    return {
      chunkSize: 1024,
      chunkOverlap: 50,
      maxFileSize: 10 * 1024 * 1024 // 10MB
    };
  }
}