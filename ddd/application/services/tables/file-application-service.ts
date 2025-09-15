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
import type { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import type { Result } from '@/ddd/domain/shared/result';
import { FieldId, OrganizationId, TableId } from '@/ddd/domain/shared/value-objects';
import type { FileFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { FileKey } from '@/ddd/domain/tables/entities/file-storage';

export interface UploadFileCommand {
  organizationId: OrganizationId;
  tableId: TableId;
  fieldId: FieldId; // Use fieldId to match repository interface
  file: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  };
}

export interface DownloadFileCommand {
  fileId: FileKey;
  fieldId: FieldId; // Use fieldId to match repository interface
  tableId: TableId; // Need table context
  organizationId: OrganizationId;
}

export interface DeleteFileCommand {
  fileId: FileKey;
  fieldId: FieldId; // Use fieldId to match repository interface  
  tableId: TableId; // Need table context
  organizationId: OrganizationId;
}

export interface GetFilesCommand {
  fieldId?: FieldId;
  tableId?: TableId;
  organizationId: OrganizationId;
}

export class FileUseCases {
  constructor(
    private readonly fileStorageRepository: IFileStorageRepository,
    private readonly dynamicTableService: DynamicTableService
  ) {}

  /**
   * Upload a file to a specific field in a dynamic table
   */
  async uploadFile(command: UploadFileCommand): Promise<Result<any>> {
    try {
      // 1. Validate organization and table exist
      const table = await this.dynamicTableService.getTable(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      if (!table.isOwnedBy(command.organizationId)) {
        return {
          success: false,
          error: 'Access denied: table not in your organization'
        };
      }

      // 2. Validate field exists and is a file field using table aggregate
      const field = table.getFieldById(command.fieldId);
      if (!field) {
        return {
          success: false,
          error: `Field with ID '${command.fieldId}' not found in table`
        };
      }

      // Field belongs to table by definition since we got it from table.getFieldById()
      // No need to validate tableId separately

      if (field.type !== 'file' && field.type !== 'document') {
        return {
          success: false,
          error: `Field ${field.name} is not a file or document field`
        };
      }

      // 3. Upload file directly to storage
      const uploadRequest = {
        buffer: command.file.buffer,
        filename: command.file.filename,
        mimeType: command.file.mimeType,
        metadata: {
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
  async generateDownloadUrl(command: DownloadFileCommand): Promise<Result<{ url: string; filename: string }>> {
    try {
      // 1. Get table and validate field exists and is a file field
      const table = await this.dynamicTableService.getTable(command.tableId);
      if (!table) {
        return {
          success: false,
          error: 'Table not found'
        };
      }

      // Verify table belongs to organization
      if (!table.isOwnedBy(command.organizationId)) {
        return {
          success: false,
          error: 'Access denied: table not in your organization'
        };
      }

      const field = table.getFieldById(command.fieldId);
      if (!field) {
        return {
          success: false,
          error: `Field with ID '${command.fieldId}' not found in table`
        };
      }

      if (field.type !== 'file' && field.type !== 'document') {
        return {
          success: false,
          error: `Field ${field.name} is not a file or document field`
        };
      }

      // 2. Get file metadata and generate download URL
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
  async deleteFile(command: DeleteFileCommand): Promise<Result<void>> {
    try {
      // 1. Get table and validate field exists and is a file field
      const table = await this.dynamicTableService.getTable(command.tableId);
      if (!table) {
        return {
          success: false,
          error: 'Table not found'
        };
      }

      // Verify table belongs to organization
      if (!table.isOwnedBy(command.organizationId)) {
        return {
          success: false,
          error: 'Access denied: table not in your organization'
        };
      }

      const field = table.getFieldById(command.fieldId);
      if (!field) {
        return {
          success: false,
          error: `Field with ID '${command.fieldId}' not found in table`
        };
      }

      if (field.type !== 'file' && field.type !== 'document') {
        return {
          success: false,
          error: `Field ${field.name} is not a file or document field`
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
  async getFiles(command: GetFilesCommand): Promise<Result<FileFieldValue[]>> {
    try {
      // 1. Get table and validate access
      if (!command.tableId) {
        return {
          success: false,
          error: 'Table ID is required'
        };
      }

      const table = await this.dynamicTableService.getTable(command.tableId);
      if (!table) {
        return {
          success: false,
          error: 'Table not found'
        };
      }

      // Verify table belongs to organization
      if (!table.isOwnedBy(command.organizationId)) {
        return {
          success: false,
          error: 'Access denied: table not in your organization'
        };
      }

      // 2. If fieldId is provided, validate field access
      if (command.fieldId) {
        const field = table.getFieldById(command.fieldId);
        if (!field) {
          return {
            success: false,
            error: `Field with ID '${command.fieldId}' not found in table`
          };
        }

        if (field.type !== 'file' && field.type !== 'document') {
          return {
            success: false,
            error: `Field ${field.name} is not a file or document field`
          };
        }

        // Get files for specific field (would need implementation in FileFieldService)
        // For now, return empty array as placeholder
        return {
          success: true,
          data: []
        };
      } else {
        // Get all file fields for table and their files
        const fileFields = table.fields.filter(field => field.type === 'file');

        // Get files for all file fields (would need aggregation implementation)
        // For now, return empty array as placeholder
        return {
          success: true,
          data: []
        };
      }

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
  async getStorageStats(organizationId: number): Promise<Result<{
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
  async cleanupOrphanedFiles(organizationId: number): Promise<Result<{
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