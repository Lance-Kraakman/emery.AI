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
import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import type { Result } from '@/ddd/domain/shared/result';
import { TableId, OrganizationId } from '@/ddd/domain/shared/value-objects';

export interface UploadFileCommand {
  organizationId: number;
  tableId: number;
  fieldName: string; // Use field name instead of fieldId
  file: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
  uploadedBy: string;
}

export interface DownloadFileCommand {
  fileId: string;
  fieldName: string; // Use field name instead of fieldId
  tableId: number; // Need table context
  organizationId: number;
  requestedBy: string;
}

export interface DeleteFileCommand {
  fileId: string;
  fieldName: string; // Use field name instead of fieldId
  tableId: number; // Need table context
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
    private readonly dynamicTableService: DynamicTableService
  ) {}

  /**
   * Upload a file to a specific field in a dynamic table
   */
  async uploadFile(command: UploadFileCommand): Promise<FileApplicationServiceResult<any>> {
    try {
      // 1. Validate organization and table exist
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(command.tableId));
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      if (table.organizationId.value !== command.organizationId) {
        return {
          success: false,
          error: 'Access denied: table not in your organization'
        };
      }

      // 2. Validate field exists and is a file field using table aggregate
      const field = table.getField(command.fieldName);
      if (!field) {
        return {
          success: false,
          error: `Field '${command.fieldName}' not found in table`
        };
      }

      // Field belongs to table by definition since we got it from table.getField()
      // No need to validate tableId separately

      if (field.type !== 'file') {
        return {
          success: false,
          error: `Field ${command.fieldName} is not a file field`
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
        fieldId: command.fieldName,
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
      const field = await this.fieldRepository.findById(FieldId.fromNumber(command.fieldName));
      if (!field) {
        return {
          success: false,
          error: `Field ${command.fieldName} not found`
        };
      }

      if (field.type !== 'file') {
        return {
          success: false,
          error: `Field ${command.fieldName} is not a file field`
        };
      }

      // 2. Validate table belongs to organization
      const table = await this.dynamicTableService.getTable(field.tableId);
      if (!table || table.organizationId.value !== command.organizationId) {
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
      const field = await this.fieldRepository.findById(FieldId.fromNumber(command.fieldName));
      if (!field) {
        return {
          success: false,
          error: `Field ${command.fieldName} not found`
        };
      }

      if (field.type !== 'file') {
        return {
          success: false,
          error: `Field ${command.fieldName} is not a file field`
        };
      }

      // 2. Validate table belongs to organization
      const table = await this.dynamicTableService.getTable(field.tableId);
      if (!table || table.organizationId.value !== command.organizationId) {
        return {
          success: false,
          error: 'Access denied: file not accessible to your organization'
        };
      }

      // 3. Delete the actual file from storage (fileId should be the S3 key)
      await this.fileStorageRepository.deleteFile(command.fileId);

      // TODO: Update field value to remove this file reference from the table row
      // This would require updating the row in the dynamic table to remove the file reference

      console.log(`[FILE-APP-SERVICE] Deleted file ${command.fileId} from field ${field.name} in table ${table.name}`);

      return {
        success: true
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
      if (command.fieldName) {
        const field = await this.fieldRepository.findById(FieldId.fromNumber(command.fieldName));
        if (!field) {
          return {
            success: false,
            error: `Field ${command.fieldName} not found`
          };
        }

        if (field.type !== 'file') {
          return {
            success: false,
            error: `Field ${command.fieldName} is not a file field`
          };
        }

        // Validate table belongs to organization
        const table = await this.dynamicTableService.getTable(field.tableId);
        if (!table || table.organizationId.value !== command.organizationId) {
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
        const table = await this.dynamicTableService.getTable(TableId.fromNumber(command.tableId));
        if (!table || table.organizationId.value !== command.organizationId) {
          return {
            success: false,
            error: 'Access denied: table not accessible to your organization'
          };
        }

        // Get all file fields for table
        const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(command.tableId));
        const fileFields = fields.filter((f: any) => f.type === 'file');

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
      // Use RowApplicationService to get files from organization's table data
      const { getRowApplicationService } = require('@/ddd/application/di/container');
      const rowService = getRowApplicationService();
      const files = await rowService.getFilesByOrganization(organizationId);
      
      const stats = {
        totalFiles: files.length,
        totalSize: files.reduce((acc: number, f: any) => acc + f.size, 0),
        filesByField: [] // TODO: Group by field if needed
      };

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
      // TODO: Implement orphaned file cleanup logic
      const cleanupResult = { deletedFiles: 0, freedBytes: 0 };

      console.log(`[FILE-APP-SERVICE] Cleanup completed for organization ${organizationId}: ${cleanupResult.deletedFiles} files deleted, ${cleanupResult.freedBytes} bytes freed`);

      return {
        success: true,
        data: {
          deletedFiles: cleanupResult.deletedFiles,
          freedBytes: cleanupResult.freedBytes
        },
        error: undefined
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