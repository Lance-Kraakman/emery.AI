import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { FileUploadRequest, StoredFile, FileStorageError, FileKey, FileUrlOptions, FileValidationRule, FileValidationResult } from '@/ddd/domain/tables/entities/file-storage';
import { IFileStorageRepository, type StorageBreakdown } from '@/ddd/domain/tables/repositories/file-storage-repository';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import {
  getOrgPrefixes,
  getTaskAttachmentPrefix,
  getDatabaseFileKey,
  extractOrgIdFromKey,
  type StorageCategory,
} from '@/lib/s3/path-registry';

// Cache for storage breakdown results to reduce expensive ListObjectsV2 calls
// TTL: 1 hour (3600000 ms)
const STORAGE_BREAKDOWN_CACHE_TTL_MS = 60 * 60 * 1000;
const storageBreakdownCache = new Map<number, { data: StorageBreakdown; cachedAt: number }>();

/**
 * Invalidate storage breakdown cache for an organization.
 * Exported so chat/skill attachment services can call it after uploads.
 */
export function invalidateOrgStorageCache(organizationId: number): void {
  storageBreakdownCache.delete(organizationId);
}

export class S3FileStorageRepository implements IFileStorageRepository {
  private readonly bucketName: string;
  private readonly s3: typeof s3Client;

  constructor(bucketName?: string) {
    this.bucketName = bucketName || BUCKET_NAME;
    this.s3 = s3Client;
  }

  /**
   * Invalidate storage breakdown cache for an organization.
   * Call this after file upload/delete operations.
   */
  invalidateStorageBreakdownCache(organizationId: number): void {
    invalidateOrgStorageCache(organizationId);
  }

  private shouldUseEncryption(): boolean {
    const customEndpoint = process.env.S3_ENDPOINT_URL;
    return !customEndpoint;
  }


  // Core file upload operation
  async uploadFile(request: FileUploadRequest): Promise<StoredFile> {
    try {
      const fileId = uuidv4();
      const sanitizedFilename = request.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      const key = getDatabaseFileKey(
        request.organizationId!.value,
        request.tableId!.value,
        request.fieldId!.value,
        fileId,
        sanitizedFilename,
      );

      // Generate checksums for integrity verification
      const md5Hash = crypto.createHash('md5').update(request.buffer).digest('hex');
      const sha256Hash = crypto.createHash('sha256').update(request.buffer).digest('hex');

      // Build command parameters - conditionally include encryption
      const commandParams: any = {
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
      };

      // Only add encryption for real AWS S3 (not MinIO/development)
      if (this.shouldUseEncryption()) {
        commandParams.ServerSideEncryption = 'AES256';
      }

      const command = new PutObjectCommand(commandParams);

      await this.s3.send(command);

      // Invalidate storage breakdown cache for this organization
      if (request.organizationId) {
        this.invalidateStorageBreakdownCache(request.organizationId.value);
      }

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

  // Update existing file with new content
  async updateFile(key: FileKey, request: FileUploadRequest): Promise<StoredFile> {
    try {
      const md5Hash = crypto.createHash('md5').update(request.buffer).digest('hex');
      const sha256Hash = crypto.createHash('sha256').update(request.buffer).digest('hex');

      const commandParams: any = {
        Bucket: this.bucketName,
        Key: key, // Use existing key (FileKey is already a string)
        Body: request.buffer,
        ContentType: request.mimeType,
        Metadata: {
          originalName: request.filename.replace(/[^\w.-]/g, '_'),
          fieldId: request.fieldId?.value?.toString() || '',
          uploadedAt: new Date().toISOString(),
          md5: md5Hash,
          sha256: sha256Hash,
          ...(request.metadata || {}),
        },
      };

      if (this.shouldUseEncryption()) {
        commandParams.ServerSideEncryption = 'AES256';
      }

      const command = new PutObjectCommand(commandParams);
      await this.s3.send(command);

      return {
        id: key, // Return the same ID (FileKey is already a string)
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
        `Failed to update file: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

      // Invalidate storage breakdown cache using the path registry
      const orgId = extractOrgIdFromKey(key);
      if (orgId !== null) {
        this.invalidateStorageBreakdownCache(orgId);
      }
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

  // Download file content as Buffer for processing (e.g., RAG indexing)
  async downloadFile(key: FileKey): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3.send(command);

      if (!response.Body) {
        throw new FileStorageError(
          `File content not found for key: ${key}`,
          'NOT_FOUND',
          { key }
        );
      }

      // Convert the stream to Buffer
      return Buffer.from(await response.Body.transformToByteArray());

    } catch (error: any) {
      throw new FileStorageError(
        `Failed to download file: ${error.message}`,
        'NETWORK_ERROR',
        { key }
      );
    }
  }

  /**
   * Scan S3 storage for an organization and calculate actual usage breakdown.
   *
   * Scans ALL prefixes that belong to an organization:
   *   - org_{id}/               → database storage (tables, files, delta-lake)
   *   - chat-attachments/{id}/  → chat attachment storage
   *   - skill-attachments/{id}/ → skill attachment storage
   *
   * Note: Workspaces are stored on EFS (SharedFilesystemStorage), not S3.
   * Results are cached for 1 hour to reduce expensive S3 calls.
   * Cache is invalidated on file upload/delete.
   */
  async getOrganizationStorageBreakdown(organizationId: number): Promise<StorageBreakdown> {
    // Check cache first
    const cached = storageBreakdownCache.get(organizationId);
    if (cached && Date.now() - cached.cachedAt < STORAGE_BREAKDOWN_CACHE_TTL_MS) {
      return cached.data;
    }

    const breakdown: StorageBreakdown = {
      totalBytes: 0,
      databaseStorageBytes: 0,
      chatStorageBytes: 0,
      skillStorageBytes: 0,
      workspaceStorageBytes: 0,
      fileCount: 0,
      scannedAt: new Date(),
    };

    try {
      // Scan all org-scoped prefixes in S3
      // Note: Workspaces are on EFS, not S3 - workspaceStorageBytes is always 0 here
      const prefixes = getOrgPrefixes(organizationId);
      const prefixEntries: Array<{ prefix: string; category: StorageCategory }> = [
        { prefix: prefixes.database, category: 'database' },
        { prefix: prefixes.chat, category: 'chat' },
        { prefix: prefixes.skill, category: 'skill' },
        { prefix: getTaskAttachmentPrefix(organizationId), category: 'database' },
      ];

      for (const { prefix, category } of prefixEntries) {
        let continuationToken: string | undefined;

        do {
          const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken,
            MaxKeys: 1000,
          });

          const response = await this.s3.send(command);

          if (response.Contents && response.Contents.length > 0) {
            for (const object of response.Contents) {
              if (!object.Key || !object.Size) continue;

              const size = object.Size;
              breakdown.totalBytes += size;
              breakdown.fileCount++;

              switch (category) {
                case 'database':
                  breakdown.databaseStorageBytes += size;
                  break;
                case 'chat':
                  breakdown.chatStorageBytes += size;
                  break;
                case 'skill':
                  breakdown.skillStorageBytes += size;
                  break;
                // Note: workspace storage is on EFS, not S3
              }
            }
          }

          continuationToken = response.NextContinuationToken;
        } while (continuationToken);
      }

      // Cache the result
      storageBreakdownCache.set(organizationId, { data: breakdown, cachedAt: Date.now() });

      return breakdown;
    } catch (error) {
      throw new FileStorageError(
        `Failed to scan storage for organization ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR',
        { organizationId }
      );
    }
  }

}
