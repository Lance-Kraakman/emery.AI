// AIDEV-NOTE: Service layer that coordinates file field operations between database and storage
// Handles the complex orchestration of field data storage and file storage operations

import type { IFileStorageRepository } from '../repositories/file-storage-repository';
import type { IFieldRepository } from '../../fields/repositories/field-repository';
import type {
  FileFieldValue,
  FileFieldConfig,
  Field,
  CreateFieldData,
  UpdateFieldData
} from '../../fields/entities/field';
import type {
  FileUploadRequest,
  StoredFile,
  FileValidationRule,
  FileValidationResult,
  FileStorageError
} from '../entities/file-storage';
import { FileValidationError } from '../entities/file-storage';

export interface FileFieldServiceConfig {
  maxFileSize?: number;
  allowedTypes?: string[];
  maxFilesPerField?: number;
}

export interface FileAttachmentRequest {
  fieldId: number;
  organizationId: number;
  tableId: number;
  files: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    metadata?: Record<string, any>;
  }[];
}

export interface FileDetachmentRequest {
  fieldId: number;
  fileIds: string[];
}

export interface FileFieldOperationResult {
  success: boolean;
  files?: FileFieldValue[];
  errors?: string[];
  warnings?: string[];
}

export class FileFieldService {
  constructor(
    private readonly fieldRepository: IFieldRepository,
    private readonly fileStorageRepository: IFileStorageRepository,
    private readonly config: FileFieldServiceConfig = {}
  ) {}

  /**
   * Creates a new file field with storage configuration
   */
  async createFileField(
    fieldData: CreateFieldData & { type: 'file' },
    config?: FileFieldConfig
  ): Promise<Field> {
    // Basic validation - ensure required fields are present
    if (!fieldData.name || !fieldData.slug || !fieldData.tableId) {
      throw new FileValidationError(
        'Invalid field data',
        ['Name, slug, and tableId are required']
      );
    }

    // Create field in database using standard create method
    const field = await this.fieldRepository.create({
      ...fieldData,
      type: 'file'
    });

    return field;
  }

  /**
   * Updates file field configuration
   */
  async updateFileFieldConfig(
    fieldId: number,
    config: Partial<FileFieldConfig>
  ): Promise<Field> {
    const field = await this.fieldRepository.findById(fieldId);
    if (!field) {
      throw new Error(`Field with ID ${fieldId} not found`);
    }

    if (field.type !== 'file') {
      throw new Error(`Field ${fieldId} is not a file field`);
    }

    // For now, just update the field name if provided in config
    // File-specific configuration would need to be stored elsewhere or in field metadata
    return await this.fieldRepository.update(fieldId, {
      name: field.name, // Keep existing name unless specified
    });
  }

  /**
   * Attaches files to a file field
   */
  async attachFiles(request: FileAttachmentRequest): Promise<FileFieldOperationResult> {
    const field = await this.fieldRepository.findById(request.fieldId);
    if (!field || field.type !== 'file') {
      return {
        success: false,
        errors: [`Field ${request.fieldId} is not a valid file field`]
      };
    }

    // Use default file configuration since we don't store specific config per field yet
    const fileConfig = this.getDefaultFileConfig();

    const errors: string[] = [];
    const warnings: string[] = [];
    const uploadedFiles: FileFieldValue[] = [];

    // Check field limits
    if (fileConfig.maxFiles) {
      const currentFiles = await this.getCurrentFileValues(request.fieldId);
      const newTotal = currentFiles.length + request.files.length;
      
      if (newTotal > fileConfig.maxFiles) {
        return {
          success: false,
          errors: [`Cannot attach ${request.files.length} files. Field allows maximum ${fileConfig.maxFiles} files, currently has ${currentFiles.length}`]
        };
      }
    }

    // Process each file
    for (const fileRequest of request.files) {
      try {
        // Validate file against field configuration
        const validationRule: FileValidationRule = {
          maxSize: fileConfig.maxSize || this.config.maxFileSize,
          allowedTypes: fileConfig.allowedTypes || this.config.allowedTypes,
          // Note: FileFieldConfig doesn't have allowedExtensions, using global config
          requiredExtensions: this.config.allowedTypes?.map(type => 
            type.includes('/') ? type.split('/')[1] : type
          ).filter(ext => !ext.includes('*')),
        };

        const uploadRequest: FileUploadRequest = {
          buffer: fileRequest.buffer,
          filename: fileRequest.filename,
          mimeType: fileRequest.mimeType,
          metadata: fileRequest.metadata,
          organizationId: request.organizationId,
          tableId: request.tableId,
          fieldId: request.fieldId,
        };

        const validation = await this.fileStorageRepository.validateFile(uploadRequest, validationRule);
        if (!validation.valid) {
          errors.push(`File ${fileRequest.filename}: ${validation.errors.join(', ')}`);
          continue;
        }

        // Upload file to storage
        const storedFile = await this.fileStorageRepository.uploadFile(uploadRequest);

        // Create file field value
        const fileValue: FileFieldValue = {
          id: storedFile.id,
          name: storedFile.name,
          size: storedFile.size,
          mimeType: storedFile.mimeType,
          s3Key: storedFile.key,
          uploadedAt: storedFile.uploadedAt.toISOString(),
          url: await this.fileStorageRepository.generateDownloadUrl(storedFile.key),
          metadata: storedFile.metadata,
        };

        uploadedFiles.push(fileValue);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`File ${fileRequest.filename}: ${errorMessage}`);
      }
    }

    return {
      success: uploadedFiles.length > 0,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Detaches files from a file field
   */
  async detachFiles(request: FileDetachmentRequest): Promise<FileFieldOperationResult> {
    const field = await this.fieldRepository.findById(request.fieldId);
    if (!field || field.type !== 'file') {
      return {
        success: false,
        errors: [`Field ${request.fieldId} is not a valid file field`]
      };
    }

    const currentFiles = await this.getCurrentFileValues(request.fieldId);
    const errors: string[] = [];
    const warnings: string[] = [];
    const deletedFiles: string[] = [];

    for (const fileId of request.fileIds) {
      try {
        const fileValue = currentFiles.find(f => f.id === fileId);
        if (!fileValue) {
          warnings.push(`File ${fileId} not found in field ${request.fieldId}`);
          continue;
        }

        // Delete from storage
        await this.fileStorageRepository.deleteFile(fileValue.s3Key);
        deletedFiles.push(fileId);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`File ${fileId}: ${errorMessage}`);
      }
    }

    return {
      success: deletedFiles.length > 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Generates fresh download URLs for file field values
   */
  async refreshFileUrls(
    files: FileFieldValue[],
    expiresIn?: number
  ): Promise<FileFieldValue[]> {
    const refreshedFiles: FileFieldValue[] = [];

    for (const file of files) {
      try {
        const newUrl = await this.fileStorageRepository.generateDownloadUrl(
          file.s3Key, 
          { expiresIn }
        );
        
        refreshedFiles.push({
          ...file,
          url: newUrl,
        });
      } catch (error) {
        // Keep original file info but mark URL as expired
        refreshedFiles.push({
          ...file,
          url: undefined, // Remove expired URL
          metadata: {
            ...file.metadata,
            urlExpired: true,
          },
        });
      }
    }

    return refreshedFiles;
  }

  /**
   * Validates file field data for compliance with field configuration
   */
  async validateFileFieldData(
    fieldId: number,
    files: FileFieldValue[]
  ): Promise<FileValidationResult> {
    const field = await this.fieldRepository.findById(fieldId);
    if (!field || field.type !== 'file') {
      return {
        valid: false,
        errors: ['Field is not a file field'],
      };
    }

    // Use default file configuration since we don't store specific config per field yet
    const fileConfig = this.getDefaultFileConfig();
    
    const errors: string[] = [];

    // Check file count limits
    if (fileConfig.maxFiles && files.length > fileConfig.maxFiles) {
      errors.push(`Too many files: ${files.length} exceeds limit of ${fileConfig.maxFiles}`);
    }

    // Check individual files
    for (const file of files) {
      // Check file size
      if (fileConfig.maxSize && file.size > fileConfig.maxSize) {
        errors.push(`File ${file.name} size ${file.size} exceeds limit ${fileConfig.maxSize}`);
      }

      // Check file type
      if (fileConfig.allowedTypes && fileConfig.allowedTypes.length > 0) {
        const isAllowed = fileConfig.allowedTypes.some((type: any) => {
          if (type.endsWith('*')) {
            return file.mimeType.startsWith(type.slice(0, -1));
          }
          return file.mimeType === type;
        });
        
        if (!isAllowed) {
          errors.push(`File ${file.name} type ${file.mimeType} is not allowed`);
        }
      }

      // Validate S3 key format
      if (!file.s3Key || !this.isValidS3Key(file.s3Key)) {
        errors.push(`File ${file.name} has invalid storage key`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets storage usage statistics for file fields
   */
  async getFileFieldStorageStats(organizationId: number): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByField: Array<{
      fieldId: number;
      fieldName: string;
      fileCount: number;
      totalSize: number;
    }>;
  }> {
    const storageUsage = await this.fileStorageRepository.getStorageUsage(organizationId);
    
    // This is a simplified implementation - in production you'd want more detailed tracking
    return {
      totalFiles: storageUsage.totalFiles,
      totalSize: storageUsage.totalSize,
      filesByField: [], // Would need to aggregate by field from actual file metadata
    };
  }

  /**
   * Cleanup orphaned files that are no longer referenced by any field
   */
  async cleanupOrphanedFiles(organizationId: number): Promise<{
    deletedFiles: number;
    freedBytes: number;
    errors: string[];
  }> {
    // This would require cross-referencing storage files with database field values
    // Implementation depends on specific cleanup strategy
    return {
      deletedFiles: 0,
      freedBytes: 0,
      errors: ['Orphaned file cleanup not yet implemented'],
    };
  }

  // Private helper methods
  private async getCurrentFileValues(fieldId: number): Promise<FileFieldValue[]> {
    // This would need to query actual field data from dynamic tables
    // For now, return empty array as placeholder
    return [];
  }

  private getDefaultFileConfig(): FileFieldConfig {
    return {
      maxSize: this.config.maxFileSize || 5 * 1024 * 1024, // 5MB default
      allowedTypes: this.config.allowedTypes || [
        'image/*',
        'application/pdf',
        'text/*',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      maxFiles: this.config.maxFilesPerField || 10,
      generateThumbnails: true,
      thumbnailSizes: ['small', 'medium', 'large'],
    };
  }

  private isValidS3Key(s3Key: string): boolean {
    // Basic S3 key validation
    return s3Key.length > 0 && 
           s3Key.length <= 1024 && 
           !s3Key.startsWith('/') && 
           !s3Key.endsWith('/') &&
           !/\/\//.test(s3Key); // No double slashes
  }
}