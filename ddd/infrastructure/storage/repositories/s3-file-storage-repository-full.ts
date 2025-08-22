// AIDEV-NOTE: S3 implementation of IFileStorageRepository interface
// Provides concrete implementation using AWS S3 for file storage operations

import { 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { StoredFile, FileUploadRequest, FileStorageError, FileKey, FileDownloadResponse, FileUrlOptions, FileListOptions, FileListResponse, FileStorageStats, FileOperationResult, FileValidationRule, FileValidationResult, FileBatchOperation, FileBatchResult, FileTransformRequest, FileTransformResult, FileCleanupOptions, FileCleanupResult, FileAccessContext, FileAccessPolicy } from '@/ddd/domain/files/entities/file-storage';

export class S3FileStorageRepository implements IFileStorageRepository {
  private readonly bucketName: string;
  private readonly s3: typeof s3Client;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || BUCKET_NAME;
    this.s3 = s3Client;
  }
  findByOrganization(organizationId: number): Promise<StoredFile[]> {
    throw new Error('Method not implemented.');
  }
  countByOrganization(organizationId: number): Promise<number> {
    throw new Error('Method not implemented.');
  }

  // Core file operations
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

  async downloadFile(key: FileKey): Promise<FileDownloadResponse> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3.send(command);
      
      if (!response.Body) {
        throw new FileStorageError(`File not found: ${key}`, 'NOT_FOUND');
      }

      // Convert stream to buffer
      const content = await this.streamToBuffer(response.Body as any);
      
      // Extract metadata from S3 response
      const metadata: StoredFile = {
        id: response.Metadata?.fileId || key.split('/').pop() || key,
        key,
        name: response.Metadata?.originalName || key.split('/').pop() || key,
        size: response.ContentLength || content.length,
        mimeType: response.ContentType || 'application/octet-stream',
        uploadedAt: response.LastModified || new Date(),
        metadata: response.Metadata,
        checksums: {
          md5: response.Metadata?.md5,
          sha256: response.Metadata?.sha256,
        },
      };

      return {
        content,
        metadata,
      };
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        throw new FileStorageError(`File not found: ${key}`, 'NOT_FOUND');
      }
      throw new FileStorageError(
        `Failed to download file: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  }

  async deleteFile(key: FileKey): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3.send(command);
    } catch (error: any) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        // File doesn't exist, consider delete successful
        return;
      }
      throw new FileStorageError(
        `Failed to delete file: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  }

  async fileExists(key: FileKey): Promise<boolean> {
    try {
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  async getFileMetadata(key: FileKey): Promise<StoredFile> {
    try {
      const response = await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));

      return {
        id: response.Metadata?.fileId || key.split('/').pop() || key,
        key,
        name: response.Metadata?.originalName || key.split('/').pop() || key,
        size: response.ContentLength || 0,
        mimeType: response.ContentType || 'application/octet-stream',
        uploadedAt: response.LastModified || new Date(),
        metadata: response.Metadata,
        checksums: {
          md5: response.Metadata?.md5,
          sha256: response.Metadata?.sha256,
        },
      };
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        throw new FileStorageError(`File not found: ${key}`, 'NOT_FOUND');
      }
      throw new FileStorageError(
        `Failed to get file metadata: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  }

  // URL generation for external access
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

  async generateUploadUrl(key: FileKey, options?: FileUrlOptions): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: options?.contentType,
    });

    const expiresIn = options?.expiresIn || 900;
    return await getSignedUrl(this.s3, command, { expiresIn });
  }

  // File listing and discovery
  async listFiles(options?: FileListOptions): Promise<FileListResponse> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: options?.prefix,
        MaxKeys: options?.limit || 1000,
        ContinuationToken: options?.continuationToken,
      });

      const response = await this.s3.send(command);

      const files: StoredFile[] = await Promise.all(
        (response.Contents || []).map(async (item) => {
          const metadata = await this.getFileMetadata(item.Key!);
          return metadata;
        })
      );

      return {
        files,
        nextContinuationToken: response.NextContinuationToken,
        totalCount: response.KeyCount,
      };
    } catch (error: any) {
      throw new FileStorageError(
        `Failed to list files: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  }

  async searchFiles(query: string, options?: FileListOptions): Promise<FileListResponse> {
    // For S3, we'll search by prefix and filter by filename
    const listResponse = await this.listFiles(options);
    
    const filteredFiles = listResponse.files.filter(file => 
      file.name.toLowerCase().includes(query.toLowerCase()) ||
      file.key.toLowerCase().includes(query.toLowerCase())
    );

    return {
      ...listResponse,
      files: filteredFiles,
      totalCount: filteredFiles.length,
    };
  }

  async getStorageStats(): Promise<FileStorageStats> {
    try {
      const listResponse = await this.listFiles();
      
      const totalSize = listResponse.files.reduce((sum, file) => sum + file.size, 0);
      
      return {
        totalFiles: listResponse.files.length,
        totalSize,
        storageProvider: 'S3',
        lastUpdated: new Date(),
      };
    } catch (error: any) {
      throw new FileStorageError(
        `Failed to get storage stats: ${error.message}`,
        'NETWORK_ERROR'
      );
    }
  }

  // Batch operations (simplified implementations for MVP)
  async uploadMultipleFiles(requests: FileUploadRequest[]): Promise<StoredFile[]> {
    const results = await Promise.allSettled(
      requests.map(request => this.uploadFile(request))
    );

    const storedFiles: StoredFile[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        storedFiles.push(result.value);
      }
    }

    return storedFiles;
  }

  async deleteMultipleFiles(keys: FileKey[]): Promise<FileOperationResult[]> {
    const results = await Promise.allSettled(
      keys.map(async (key) => {
        await this.deleteFile(key);
      })
    );

    return results.map((result, index) => ({
      success: result.status === 'fulfilled',
      error: result.status === 'rejected' ? result.reason.message : undefined,
    }));
  }

  // File validation
  async validateFile(request: FileUploadRequest, rules: FileValidationRule): Promise<FileValidationResult> {
    const errors: string[] = [];

    // Check file size
    if (rules.maxSize && request.buffer.length > rules.maxSize) {
      errors.push(`File size ${request.buffer.length} exceeds maximum allowed size ${rules.maxSize}`);
    }

    // Check MIME type
    if (rules.allowedTypes) {
      const isAllowed = rules.allowedTypes.some(type => {
        if (type.endsWith('*')) {
          return request.mimeType.startsWith(type.slice(0, -1));
        }
        return request.mimeType === type;
      });
      
      if (!isAllowed) {
        errors.push(`File type ${request.mimeType} is not allowed`);
      }
    }

    // Check file extension
    if (rules.requiredExtensions) {
      const fileExt = request.filename.split('.').pop()?.toLowerCase();
      if (!fileExt || !rules.requiredExtensions.includes(fileExt)) {
        errors.push(`File extension must be one of: ${rules.requiredExtensions.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async verifyFileIntegrity(key: FileKey): Promise<{ valid: boolean; checksums?: Record<string, string> }> {
    try {
      const { content, metadata } = await this.downloadFile(key);
      
      // Recalculate checksums
      const currentMd5 = crypto.createHash('md5').update(content).digest('hex');
      const currentSha256 = crypto.createHash('sha256').update(content).digest('hex');

      const storedMd5 = metadata.checksums?.md5;
      const storedSha256 = metadata.checksums?.sha256;

      const valid = (
        (!storedMd5 || currentMd5 === storedMd5) &&
        (!storedSha256 || currentSha256 === storedSha256)
      );

      return {
        valid,
        checksums: {
          md5: currentMd5,
          sha256: currentSha256,
        },
      };
    } catch (error: any) {
      return {
        valid: false,
      };
    }
  }

  // Provider info
  getProviderInfo() {
    return {
      name: 'AWS S3',
      version: '3.0',
      capabilities: [
        'upload', 'download', 'delete', 'list', 'metadata', 
        'signed-urls', 'server-side-encryption', 'versioning'
      ],
      limits: {
        maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB S3 limit
        allowedTypes: process.env.ALLOWED_FILE_TYPES?.split(','),
      },
    };
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; errors?: string[] }> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      // Simple bucket access test
      await this.s3.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: 'health-check-test',
      }));
    } catch (error: any) {
      // NotFound is expected for health check, other errors are problems
      if (error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404) {
        errors.push(`S3 access error: ${error.message}`);
      }
    }

    const latency = Date.now() - startTime;

    return {
      healthy: errors.length === 0,
      latency,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async getStorageUsage(organizationId?: number): Promise<{
    totalFiles: number;
    totalSize: number;
    quotaUsed: number;
    quotaLimit?: number;
  }> {
    const prefix = organizationId ? `files/organization-${organizationId}/` : 'files/';
    const listResponse = await this.listFiles({ prefix });
    
    const totalSize = listResponse.files.reduce((sum, file) => sum + file.size, 0);
    const quotaLimit = organizationId ? this.getOrganizationQuota(organizationId) : undefined;
    
    return {
      totalFiles: listResponse.files.length,
      totalSize,
      quotaUsed: quotaLimit ? (totalSize / quotaLimit) : 0,
      quotaLimit,
    };
  }

  // Simplified stubs for advanced features (to be implemented as needed)
  async batchOperation(operation: FileBatchOperation): Promise<FileBatchResult> {
    throw new Error('Batch operations not yet implemented');
  }

  async transformFile(key: FileKey, transform: FileTransformRequest): Promise<FileTransformResult> {
    throw new Error('File transformations not yet implemented');
  }

  async generateThumbnail(key: FileKey, sizes: string[]): Promise<StoredFile[]> {
    throw new Error('Thumbnail generation not yet implemented');
  }

  async cleanupOrphanedFiles(options?: FileCleanupOptions): Promise<FileCleanupResult> {
    throw new Error('Orphaned file cleanup not yet implemented');
  }

  async cleanupExpiredFiles(options?: FileCleanupOptions): Promise<FileCleanupResult> {
    throw new Error('Expired file cleanup not yet implemented');
  }

  async checkFileAccess(key: FileKey, context: FileAccessContext): Promise<boolean> {
    // Basic implementation - always allow for now
    return true;
  }

  async setFileAccessPolicy(key: FileKey, policy: FileAccessPolicy): Promise<void> {
    // Not implemented for basic S3
  }

  async getFileAccessPolicy(key: FileKey): Promise<FileAccessPolicy | null> {
    return null;
  }

  async createFileVersion(key: FileKey, newContent: Buffer): Promise<StoredFile> {
    throw new Error('File versioning requires S3 versioning enabled');
  }

  async getFileVersions(key: FileKey): Promise<StoredFile[]> {
    throw new Error('File versioning requires S3 versioning enabled');
  }

  async restoreFileVersion(key: FileKey, versionId: string): Promise<StoredFile> {
    throw new Error('File versioning requires S3 versioning enabled');
  }

  async deleteFileVersion(key: FileKey, versionId: string): Promise<void> {
    throw new Error('File versioning requires S3 versioning enabled');
  }

  async updateFileMetadata(key: FileKey, metadata: Record<string, any>): Promise<StoredFile> {
    // S3 doesn't support metadata updates without copying the object
    const originalFile = await this.downloadFile(key);
    const newKey = key + '-updated-' + Date.now();
    
    // This is a simplified implementation - in production you'd want to copy in-place
    const uploadRequest: FileUploadRequest = {
      buffer: originalFile.content,
      filename: originalFile.metadata.name,
      mimeType: originalFile.metadata.mimeType,
      metadata: { ...originalFile.metadata.metadata, ...metadata },
    };
    
    return await this.uploadFile(uploadRequest);
  }

  async addFileTag(key: FileKey, tags: Record<string, string>): Promise<void> {
    // S3 tagging would require separate TagResource API call
    throw new Error('File tagging not yet implemented');
  }

  async removeFileTag(key: FileKey, tagKeys: string[]): Promise<void> {
    throw new Error('File tagging not yet implemented');
  }

  async searchFilesByTags(tags: Record<string, string>): Promise<StoredFile[]> {
    throw new Error('Tag-based search not yet implemented');
  }

  // Private helper methods
  private generateS3Key(request: FileUploadRequest, fileId: string): string {
    const sanitizedFileName = request.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    
    if (request.organizationId && request.tableId && request.fieldId) {
      return `files/organization-${request.organizationId}/table-${request.tableId}/field-${request.fieldId}/${fileId}/${sanitizedFileName}`;
    }
    
    // Fallback for files without full context
    return `files/uploads/${fileId}/${sanitizedFileName}`;
  }

  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  }

  private getOrganizationQuota(organizationId: number): number {
    // Default quota - in production this would come from database/config
    return 10 * 1024 * 1024 * 1024; // 10GB default
  }
}