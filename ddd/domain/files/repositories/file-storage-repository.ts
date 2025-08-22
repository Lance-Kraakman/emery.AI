// AIDEV-NOTE: File storage repository interface - abstracts file storage operations from specific providers
// Defines contract that can be implemented by S3, Azure Blob, GCP Cloud Storage, local filesystem, etc.

import type {
  StoredFile,
  FileUploadRequest,
  FileDownloadResponse,
  FileUrlOptions,
  FileListOptions,
  FileListResponse,
  FileStorageStats,
  FileCleanupOptions,
  FileCleanupResult,
  FileValidationRule,
  FileValidationResult,
  FileTransformRequest,
  FileTransformResult,
  FileAccessPolicy,
  FileAccessContext,
  FileBatchOperation,
  FileBatchResult,
  FileKey,
  FileOperationResult
} from '../entities/file-storage';

export interface IFileStorageRepository {
  // Essential CRUD operations - what's actually used in the application
  uploadFile(request: FileUploadRequest): Promise<StoredFile>;
  deleteFile(key: FileKey): Promise<void>;
  generateDownloadUrl(key: FileKey, options?: FileUrlOptions): Promise<string>;
  validateFile(request: FileUploadRequest, rules: FileValidationRule): Promise<FileValidationResult>;
  getStorageUsage(organizationId?: number): Promise<{
    totalFiles: number;
    totalSize: number;
    quotaUsed: number;
    quotaLimit?: number;
  }>;

  // RAG indexing operations
  findByOrganization(organizationId: number): Promise<StoredFile[]>;
  countByOrganization(organizationId: number): Promise<number>;
}

// FUTURE-WORK: Additional methods to implement as needed
// The following methods were part of the original comprehensive interface
// but are not currently used in the application. They are preserved here
// for future implementation when these features are required:
/*
export interface IFileStorageRepositoryFuture extends IFileStorageRepository {
  // Core file operations
  downloadFile(key: FileKey): Promise<FileDownloadResponse>;
  fileExists(key: FileKey): Promise<boolean>;
  getFileMetadata(key: FileKey): Promise<StoredFile>;
  
  // URL generation for external access
  generateUploadUrl(key: FileKey, options?: FileUrlOptions): Promise<string>;
  
  // File listing and discovery
  listFiles(options?: FileListOptions): Promise<FileListResponse>;
  searchFiles(query: string, options?: FileListOptions): Promise<FileListResponse>;
  getStorageStats(): Promise<FileStorageStats>;
  
  // Batch operations for performance
  uploadMultipleFiles(requests: FileUploadRequest[]): Promise<StoredFile[]>;
  deleteMultipleFiles(keys: FileKey[]): Promise<FileOperationResult[]>;
  batchOperation(operation: FileBatchOperation): Promise<FileBatchResult>;
  
  // File validation and integrity
  verifyFileIntegrity(key: FileKey): Promise<{ valid: boolean; checksums?: Record<string, string> }>;
  
  // File transformations (for image processing, etc.)
  transformFile(key: FileKey, transform: FileTransformRequest): Promise<FileTransformResult>;
  generateThumbnail(key: FileKey, sizes: string[]): Promise<StoredFile[]>;
  
  // Cleanup and maintenance operations
  cleanupOrphanedFiles(options?: FileCleanupOptions): Promise<FileCleanupResult>;
  cleanupExpiredFiles(options?: FileCleanupOptions): Promise<FileCleanupResult>;
  
  // Access control and security
  checkFileAccess(key: FileKey, context: FileAccessContext): Promise<boolean>;
  setFileAccessPolicy(key: FileKey, policy: FileAccessPolicy): Promise<void>;
  getFileAccessPolicy(key: FileKey): Promise<FileAccessPolicy | null>;
  
  // File versioning (optional, for advanced implementations)
  createFileVersion(key: FileKey, newContent: Buffer): Promise<StoredFile>;
  getFileVersions(key: FileKey): Promise<StoredFile[]>;
  restoreFileVersion(key: FileKey, versionId: string): Promise<StoredFile>;
  deleteFileVersion(key: FileKey, versionId: string): Promise<void>;
  
  // File metadata management
  updateFileMetadata(key: FileKey, metadata: Record<string, any>): Promise<StoredFile>;
  addFileTag(key: FileKey, tags: Record<string, string>): Promise<void>;
  removeFileTag(key: FileKey, tagKeys: string[]): Promise<void>;
  searchFilesByTags(tags: Record<string, string>): Promise<StoredFile[]>;
  
  // Storage provider specific operations
  getProviderInfo(): {
    name: string;
    version: string;
    capabilities: string[];
    limits: {
      maxFileSize: number;
      maxFiles?: number;
      allowedTypes?: string[];
    };
  };
  
  // Health and monitoring
  healthCheck(): Promise<{
    healthy: boolean;
    latency?: number;
    errors?: string[];
  }>;
}
*/

// Extended interface for cloud providers with advanced features
export interface ICloudFileStorageRepository extends IFileStorageRepository {
  // CDN and caching
  enableCdn(key: FileKey, ttl?: number): Promise<string>;
  disableCdn(key: FileKey): Promise<void>;
  purgeFromCache(key: FileKey): Promise<void>;
  
  // Cross-region replication
  replicateToRegion(key: FileKey, targetRegion: string): Promise<StoredFile>;
  getFileLocations(key: FileKey): Promise<string[]>;
  
  // Lifecycle management
  setFileLifecycle(key: FileKey, rules: {
    deleteAfterDays?: number;
    archiveAfterDays?: number;
    transitionToIA?: number;
  }): Promise<void>;
  
  // Analytics and insights
  getFileAccessStats(key: FileKey): Promise<{
    downloads: number;
    lastAccessed: Date;
    bandwidth: number;
  }>;
}

// Factory for creating storage repository instances
export interface IFileStorageRepositoryFactory {
  create(provider: 'S3' | 'Azure' | 'GCP' | 'Local', config: Record<string, any>): IFileStorageRepository;
  createFromConfig(configName: string): IFileStorageRepository;
  getAvailableProviders(): string[];
}