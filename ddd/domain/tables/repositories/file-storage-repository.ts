// AIDEV-NOTE: File storage repository interface - abstracts file storage operations from specific providers
// Defines contract that can be implemented by S3, Azure Blob, GCP Cloud Storage, local filesystem, etc.

import type {
  StoredFile,
  FileUploadRequest,
  FileUrlOptions,
  FileValidationRule,
  FileValidationResult,
  FileKey,
} from '../entities/file-storage';

export interface IFileStorageRepository {
  // Core file storage operations - abstracts storage provider (S3, Azure Blob, etc.)
  uploadFile(request: FileUploadRequest): Promise<StoredFile>;
  deleteFile(key: FileKey): Promise<void>;
  generateDownloadUrl(key: FileKey, options?: FileUrlOptions): Promise<string>;
  validateFile(request: FileUploadRequest, rules: FileValidationRule): Promise<FileValidationResult>;
  
  // File content retrieval for processing (e.g., RAG indexing)
  downloadFile(key: FileKey): Promise<Buffer>;
}