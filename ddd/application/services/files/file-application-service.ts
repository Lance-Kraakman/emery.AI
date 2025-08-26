/**
 * File Application Service
 * 
 * Orchestrates file operations with business logic and validation.
 * Handles file upload/download, permissions, and lifecycle management.
 * Integrates files with dynamic table fields for organizational scoping.
 * 
 * AIDEV-NOTE: Application service for file management - coordinates between
 * FileFieldService, storage repositories, and business rules for files connected to dynamic tables
 */

import type { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { FileFieldValue } from '@/ddd/domain/fields/entities/field';
import type { Result } from '@/ddd/domain/shared/result';

export interface UploadFileCommand {
  organizationId: number;
  tableId: number;
  fieldId: number;
  file: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
  uploadedBy: string;
}

export interface DownloadFileCommand {
  fileId: string;
  fieldId: number;
  organizationId: number;
  requestedBy: string;
}

export interface DeleteFileCommand {
  fileId: string;
  fieldId: number;
  organizationId: number;
  deletedBy: string;
}

export interface GetFilesCommand {
  fieldId?: number;
  tableId?: number;
  organizationId: number;
  requestedBy: string;
}

// Use unified Result interface from domain shared types
export type FileApplicationServiceResult<T = any> = Result<T>;

export class FileApplicationService {
  constructor(
    private readonly fileStorageRepository: IFileStorageRepository,
    private readonly fieldRepository: IFieldRepository,
    private readonly tableRepository: IDynamicTableRepository
  ) {}

  /**
   * Upload a file to a specific field in a dynamic table
   */
  async uploadFile(command: UploadFileCommand): Promise<FileApplicationServiceResult<FileFieldValue>> {
    try {
      // 1. Validate organization and table exist
      const table = await this.tableRepository.findById(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      if (table.organizationId !== command.organizationId) {
        return {
          success: false,
          error: 'Access denied: table not in your organization'
        };
      }

      // 2. Validate field exists and is a file field
      const field = await this.fieldRepository.findById(command.fieldId);
      if (!field) {
        return {
          success: false,
          error: `Field ${command.fieldId} not found`
        };
      }

      if (field.tableId !== command.tableId) {
        return {
          success: false,
          error: 'Field does not belong to the specified table'
        };
      }

      if (field.type !== 'file') {
        return {
          success: false,
          error: `Field ${command.fieldId} is not a file field`
        };
      }

      // 3. Upload file directly to storage
      const uploadRequest = {
        buffer: command.file.buffer,
        filename: command.file.filename,
        mimeType: command.file.mimeType,
        metadata: {
          uploadedBy: command.uploadedBy,
          uploadedAt: new Date().toISOString()
        },
        organizationId: command.organizationId,
        tableId: command.tableId,
        fieldId: command.fieldId,
      };

      const storedFile = await this.fileStorageRepository.uploadFile(uploadRequest);
      
      // 4. Create file field value
      const uploadedFile: FileFieldValue = {
        id: storedFile.id,
        name: storedFile.name,
        size: storedFile.size,
        mimeType: storedFile.mimeType,
        s3Key: storedFile.key,
        uploadedAt: storedFile.uploadedAt.toISOString(),
        url: await this.fileStorageRepository.generateDownloadUrl(storedFile.key),
        metadata: storedFile.metadata,
      };

      console.log(`[FILE-APP-SERVICE] Uploaded file ${uploadedFile.name} to field ${field.name} in table ${table.name}`);

      return {
        success: true,
        data: uploadedFile
      };

    } catch (error) {
      console.error('[FILE-APP-SERVICE] Error uploading file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload file'
      };
    }
  }

  /**
   * Generate a download URL for a file
   */
  async generateDownloadUrl(command: DownloadFileCommand): Promise<FileApplicationServiceResult<{ url: string; filename: string }>> {
    try {
      // 1. Validate field exists and user has access
      const field = await this.fieldRepository.findById(command.fieldId);
      if (!field) {
        return {
          success: false,
          error: `Field ${command.fieldId} not found`
        };
      }

      if (field.type !== 'file') {
        return {
          success: false,
          error: `Field ${command.fieldId} is not a file field`
        };
      }

      // 2. Validate table belongs to organization
      const table = await this.tableRepository.findById(field.tableId);
      if (!table || table.organizationId !== command.organizationId) {
        return {
          success: false,
          error: 'Access denied: file not accessible to your organization'
        };
      }

      // 3. Get file metadata and generate download URL
      // Note: This would require getting current file values from the field
      // For now, we'll generate URL directly using the file storage repository
      const downloadUrl = await this.fileStorageRepository.generateDownloadUrl(command.fileId, { 
        expiresIn: 3600 // 1 hour expiry
      });

      console.log(`[FILE-APP-SERVICE] Generated download URL for file ${command.fileId} in field ${field.name}`);

      return {
        success: true,
        data: {
          url: downloadUrl,
          filename: command.fileId // Would be actual filename from metadata
        }
      };

    } catch (error) {
      console.error('[FILE-APP-SERVICE] Error generating download URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL'
      };
    }
  }

  /**
   * Delete a file from a field
   */
  async deleteFile(command: DeleteFileCommand): Promise<FileApplicationServiceResult<void>> {
    try {
      // 1. Validate field exists and user has access
      const field = await this.fieldRepository.findById(command.fieldId);
      if (!field) {
        return {
          success: false,
          error: `Field ${command.fieldId} not found`
        };
      }

      if (field.type !== 'file') {
        return {
          success: false,
          error: `Field ${command.fieldId} is not a file field`
        };
      }

      // 2. Validate table belongs to organization
      const table = await this.tableRepository.findById(field.tableId);
      if (!table || table.organizationId !== command.organizationId) {
        return {
          success: false,
          error: 'Access denied: file not accessible to your organization'
        };
      }

      // 3. Use FileFieldService to handle file detachment
      const result = await this.fileFieldService.detachFiles({
        fieldId: command.fieldId,
        fileIds: [command.fileId]
      });

      if (!result.success) {
        return {
          success: false,
          error: result.errors?.join(', ') || 'Failed to delete file',
          warnings: result.warnings
        };
      }

      console.log(`[FILE-APP-SERVICE] Deleted file ${command.fileId} from field ${field.name} in table ${table.name}`);

      return {
        success: true,
        warnings: result.warnings
      };

    } catch (error) {
      console.error('[FILE-APP-SERVICE] Error deleting file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      };
    }
  }

  /**
   * Get files for a field or table with organization scoping
   */
  async getFiles(command: GetFilesCommand): Promise<FileApplicationServiceResult<FileFieldValue[]>> {
    try {
      // 1. If fieldId is provided, validate field access
      if (command.fieldId) {
        const field = await this.fieldRepository.findById(command.fieldId);
        if (!field) {
          return {
            success: false,
            error: `Field ${command.fieldId} not found`
          };
        }

        if (field.type !== 'file') {
          return {
            success: false,
            error: `Field ${command.fieldId} is not a file field`
          };
        }

        // Validate table belongs to organization
        const table = await this.tableRepository.findById(field.tableId);
        if (!table || table.organizationId !== command.organizationId) {
          return {
            success: false,
            error: 'Access denied: field not accessible to your organization'
          };
        }

        // Get files for specific field (would need implementation in FileFieldService)
        // For now, return empty array as placeholder
        return {
          success: true,
          data: []
        };
      }

      // 2. If tableId is provided, get all file fields and their files
      if (command.tableId) {
        const table = await this.tableRepository.findById(command.tableId);
        if (!table || table.organizationId !== command.organizationId) {
          return {
            success: false,
            error: 'Access denied: table not accessible to your organization'
          };
        }

        // Get all file fields for table
        const fields = await this.fieldRepository.findByTableId(command.tableId);
        const fileFields = fields.filter(f => f.type === 'file');

        // Get files for all file fields (would need aggregation implementation)
        // For now, return empty array as placeholder
        return {
          success: true,
          data: []
        };
      }

      // 3. Get all files for organization (would need organization-wide query)
      return {
        success: true,
        data: []
      };

    } catch (error) {
      console.error('[FILE-APP-SERVICE] Error getting files:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get files'
      };
    }
  }

  /**
   * Get storage statistics for an organization
   */
  async getStorageStats(organizationId: number): Promise<FileApplicationServiceResult<{
    totalFiles: number;
    totalSize: number;
    filesByField: Array<{
      fieldId: number;
      fieldName: string;
      fileCount: number;
      totalSize: number;
    }>;
  }>> {
    try {
      const stats = await this.fileFieldService.getFileFieldStorageStats(organizationId);

      console.log(`[FILE-APP-SERVICE] Retrieved storage stats for organization ${organizationId}: ${stats.totalFiles} files, ${stats.totalSize} bytes`);

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('[FILE-APP-SERVICE] Error getting storage stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get storage statistics'
      };
    }
  }

  /**
   * Cleanup orphaned files for an organization
   */
  async cleanupOrphanedFiles(organizationId: number): Promise<FileApplicationServiceResult<{
    deletedFiles: number;
    freedBytes: number;
  }>> {
    try {
      const cleanupResult = await this.fileFieldService.cleanupOrphanedFiles(organizationId);

      console.log(`[FILE-APP-SERVICE] Cleanup completed for organization ${organizationId}: ${cleanupResult.deletedFiles} files deleted, ${cleanupResult.freedBytes} bytes freed`);

      return {
        success: cleanupResult.errors.length === 0,
        data: {
          deletedFiles: cleanupResult.deletedFiles,
          freedBytes: cleanupResult.freedBytes
        },
        error: cleanupResult.errors.length > 0 ? cleanupResult.errors.join(', ') : undefined
      };

    } catch (error) {
      console.error('[FILE-APP-SERVICE] Error during cleanup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup orphaned files'
      };
    }
  }
}