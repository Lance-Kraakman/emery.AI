// AIDEV-NOTE: Simplified S3 implementation of IFileStorageRepository
// Only implements the essential methods actually used in the application
// See s3-file-storage-repository-full.ts for the complete implementation with all features

import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand,
  ListObjectsV2Command
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, BUCKET_NAME } from '../../../s3/client';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import type { IFileStorageRepository } from '../../../domain/repositories/file-storage-repository';
import type {
  StoredFile,
  FileUploadRequest,
  FileUrlOptions,
  FileValidationRule,
  FileValidationResult,
  FileKey
} from '../../../domain/entities/file-storage';
import { FileStorageError } from '../../../domain/entities/file-storage';

export class S3FileStorageRepository implements IFileStorageRepository {
  private readonly bucketName: string;
  private readonly s3: typeof s3Client;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || BUCKET_NAME;
    this.s3 = s3Client;
  }

  // Core file upload operation
  async uploadFile(request: FileUploadRequest): Promise<StoredFile> {
    try {
      const fileId = uuidv4();
      const key = this.generateS3Key(request, fileId);
      
      // Generate checksums for integrity verification
      const md5Hash = crypto.createHash('md5').update(request.buffer).digest('hex');
      const sha256Hash = crypto.createHash('sha256').update(request.buffer).digest('hex');

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: request.buffer,
        ContentType: request.mimeType,
        Metadata: {
          ...(request.metadata || {}),
          originalName: request.filename.replace(/[^\w.-]/g, '_'),
          organizationId: request.organizationId?.toString() || '',
          tableId: request.tableId?.toString() || '',
          fieldId: request.fieldId?.toString() || '',
          uploadedAt: new Date().toISOString(),
          md5: md5Hash,
          sha256: sha256Hash,
        },
        ServerSideEncryption: 'AES256', // Enable server-side encryption
      });

      await this.s3.send(command);

      return {
        id: fileId,
        key,
        name: request.filename,
        size: request.buffer.length,
        mimeType: request.mimeType,
        uploadedAt: new Date(),
        metadata: request.metadata,
        checksums: {
          md5: md5Hash,
          sha256: sha256Hash,
        },
      };
    } catch (error) {
      throw new FileStorageError(
        `Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        { filename: request.filename, size: request.buffer.length }
      );
    }
  }

  // Delete file from storage
  async deleteFile(key: FileKey): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      
      await this.s3.send(command);
    } catch (error: any) {
      throw new FileStorageError(
        `Failed to delete file: ${error.message}`,
        'NETWORK_ERROR',
        { key }
      );
    }
  }

  // Generate pre-signed URL for file download
  async generateDownloadUrl(key: FileKey, options?: FileUrlOptions): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentDisposition: options?.downloadFilename 
        ? `attachment; filename="${options.downloadFilename}"` 
        : undefined,
      ResponseContentType: options?.contentType,
    });

    const expiresIn = options?.expiresIn || 900; // 15 minutes default
    return await getSignedUrl(this.s3, command, { expiresIn });
  }

  // Validate file before upload
  async validateFile(request: FileUploadRequest, rules: FileValidationRule): Promise<FileValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (rules.maxSize && request.buffer.length > rules.maxSize) {
      errors.push(`File size ${request.buffer.length} exceeds maximum allowed size ${rules.maxSize}`);
    }

    // Check mime type
    if (rules.allowedTypes && rules.allowedTypes.length > 0) {
      const isAllowed = rules.allowedTypes.some(type => {
        if (type.endsWith('*')) {
          // Wildcard match (e.g., 'image/*')
          return request.mimeType.startsWith(type.slice(0, -1));
        }
        return request.mimeType === type;
      });

      if (!isAllowed) {
        errors.push(`File type ${request.mimeType} is not allowed. Allowed types: ${rules.allowedTypes.join(', ')}`);
      }
    }

    // Check file extension
    if (rules.requiredExtensions && rules.requiredExtensions.length > 0) {
      const extension = request.filename.split('.').pop()?.toLowerCase();
      if (!extension || !rules.requiredExtensions.includes(extension)) {
        errors.push(`File extension must be one of: ${rules.requiredExtensions.join(', ')}`);
      }
    }

    // Validate file content (basic check for empty files)
    if (request.buffer.length === 0) {
      errors.push('File is empty');
    }

    // Add warnings for large files
    if (request.buffer.length > 10 * 1024 * 1024) { // 10MB
      warnings.push('Large file size may affect upload performance');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // Get storage usage statistics
  async getStorageUsage(organizationId?: number): Promise<{
    totalFiles: number;
    totalSize: number;
    quotaUsed: number;
    quotaLimit?: number;
  }> {
    try {
      const prefix = organizationId ? `org-${organizationId}/` : undefined;
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
      });

      let totalFiles = 0;
      let totalSize = 0;
      let continuationToken: string | undefined;

      // Paginate through all objects
      do {
        const paginatedCommand = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });
        const response = await this.s3.send(paginatedCommand);

        if (response.Contents) {
          totalFiles += response.Contents.length;
          totalSize += response.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      // Calculate quota (example: 5GB per organization)
      const quotaLimit = 5 * 1024 * 1024 * 1024; // 5GB in bytes
      const quotaUsed = (totalSize / quotaLimit) * 100;

      return {
        totalFiles,
        totalSize,
        quotaUsed,
        quotaLimit,
      };
    } catch (error: any) {
      throw new FileStorageError(
        `Failed to get storage usage: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  }

  // Helper method to generate S3 key
  private generateS3Key(request: FileUploadRequest, fileId: string): string {
    const parts: string[] = [];
    
    if (request.organizationId) {
      parts.push(`org-${request.organizationId}`);
    }
    
    if (request.tableId) {
      parts.push(`table-${request.tableId}`);
    }
    
    if (request.fieldId) {
      parts.push(`field-${request.fieldId}`);
    }
    
    // Add year/month for partitioning
    const now = new Date();
    parts.push(now.getFullYear().toString());
    parts.push((now.getMonth() + 1).toString().padStart(2, '0'));
    
    // Add file ID and sanitized filename
    const sanitizedFilename = request.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    parts.push(`${fileId}_${sanitizedFilename}`);
    
    return parts.join('/');
  }
}

// FUTURE-WORK: Additional methods from the full implementation
// The following methods are available in s3-file-storage-repository-full.ts
// but are not currently used in the application:
/*
  - downloadFile(key: FileKey): Promise<FileDownloadResponse>
  - fileExists(key: FileKey): Promise<boolean>
  - getFileMetadata(key: FileKey): Promise<StoredFile>
  - generateUploadUrl(key: FileKey, options?: FileUrlOptions): Promise<string>
  - listFiles(options?: FileListOptions): Promise<FileListResponse>
  - searchFiles(query: string, options?: FileListOptions): Promise<FileListResponse>
  - getStorageStats(): Promise<FileStorageStats>
  - uploadMultipleFiles(requests: FileUploadRequest[]): Promise<StoredFile[]>
  - deleteMultipleFiles(keys: FileKey[]): Promise<FileOperationResult[]>
  - batchOperation(operation: FileBatchOperation): Promise<FileBatchResult>
  - verifyFileIntegrity(key: FileKey): Promise<{ valid: boolean; checksums?: Record<string, string> }>
  - transformFile(key: FileKey, transform: FileTransformRequest): Promise<FileTransformResult>
  - generateThumbnail(key: FileKey, sizes: string[]): Promise<StoredFile[]>
  - cleanupOrphanedFiles(options?: FileCleanupOptions): Promise<FileCleanupResult>
  - cleanupExpiredFiles(options?: FileCleanupOptions): Promise<FileCleanupResult>
  - checkFileAccess(key: FileKey, context: FileAccessContext): Promise<boolean>
  - setFileAccessPolicy(key: FileKey, policy: FileAccessPolicy): Promise<void>
  - getFileAccessPolicy(key: FileKey): Promise<FileAccessPolicy | null>
  - createFileVersion(key: FileKey, newContent: Buffer): Promise<StoredFile>
  - getFileVersions(key: FileKey): Promise<StoredFile[]>
  - restoreFileVersion(key: FileKey, versionId: string): Promise<StoredFile>
  - deleteFileVersion(key: FileKey, versionId: string): Promise<void>
  - updateFileMetadata(key: FileKey, metadata: Record<string, any>): Promise<StoredFile>
  - addFileTag(key: FileKey, tags: Record<string, string>): Promise<void>
  - removeFileTag(key: FileKey, tagKeys: string[]): Promise<void>
  - searchFilesByTags(tags: Record<string, string>): Promise<StoredFile[]>
  - getProviderInfo(): { name, version, capabilities, limits }
  - healthCheck(): Promise<{ healthy, latency, errors }>
  - streamToBuffer(stream: any): Promise<Buffer>
*/