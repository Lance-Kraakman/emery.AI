/**
 * Document Application Service
 * 
 * Orchestrates document operations using the existing file infrastructure.
 * Documents are treated as enhanced file field values with additional metadata
 * and business logic. This service coordinates between DocumentField entities,
 * the existing FileUseCases, and storage operations.
 * 
 * AIDEV-NOTE: Documents reuse the entire file infrastructure (S3, FileUseCases, API routes)
 * while adding rich document semantics on top of the base file field system.
 */

import { DocumentField } from '@/ddd/domain/tables/entities/document-field-entity';
import { DocumentFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { FileUseCases } from './file-application-service';
import { OrganizationId, TableId, FieldId, UserId } from '@/ddd/domain/shared/value-objects';
import { Result } from '@/ddd/domain/shared/result';

export interface CreateTiptapDocumentCommand {
  organizationId: OrganizationId;
  tableId: TableId;
  fieldId: FieldId;
  title: string;
  initialContent?: object[];
  createdBy: UserId;
}

export interface UpdateTiptapDocumentCommand {
  documentId: string;  // File ID
  organizationId: OrganizationId;
  tableId: TableId;
  fieldId: FieldId;
  content: object;
  updatedBy: UserId;
}

export interface GetTiptapContentCommand {
  documentId: string;  // File ID
  organizationId: OrganizationId;
  tableId: TableId;
  fieldId: FieldId;
  requestedBy: UserId;
}

export interface GetDocumentFileUrlCommand {
  documentId: string;  // File ID
  organizationId: OrganizationId;
  tableId: TableId;
  fieldId: FieldId;
  requestedBy: UserId;
}

export class DocumentApplicationService {
  constructor(
    private readonly fileUseCases: FileUseCases  // Reuse existing file infrastructure
  ) {}

  /**
   * Create a new TipTap document as a special file type
   */
  async createTiptapDocument(command: CreateTiptapDocumentCommand): Promise<Result<DocumentFieldValue>> {
    try {
      // 1. Create document field entity with file buffer
      const { documentField, fileBuffer } = DocumentField.createTiptap({
        title: command.title,
        organizationId: command.organizationId,
        tableId: command.tableId,
        fieldId: command.fieldId,
        createdBy: command.createdBy,
        initialContent: command.initialContent
      });

      // 2. Use existing file upload service
      const uploadResult = await this.fileUseCases.uploadFile({
        organizationId: command.organizationId,
        tableId: command.tableId,
        fieldId: command.fieldId,
        file: {
          buffer: fileBuffer,
          filename: documentField.generateFileName(),
          mimeType: documentField.mimeType
        }
      });

      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }

      // 3. Update document field with actual upload data and convert to field value
      const updatedDocumentField = DocumentField.fromFieldValue(
        {
          ...uploadResult.data,
          documentMetadata: documentField.metadata
        },
        command.organizationId,
        command.tableId,
        command.fieldId
      );

      const documentFieldValue = updatedDocumentField.toFieldValue();

      console.log(`[DOCUMENT-APP-SERVICE] Created TipTap document "${command.title}" with ID ${uploadResult.data.id}`);
      return { success: true, data: documentFieldValue };

    } catch (error) {
      console.error('[DOCUMENT-APP-SERVICE] Error creating TipTap document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create TipTap document'
      };
    }
  }

  /**
   * Update TipTap document content
   */
  async updateTiptapDocument(command: UpdateTiptapDocumentCommand): Promise<Result<DocumentFieldValue>> {
    try {
      // 1. Get existing document content to preserve metadata
      const existingContent = await this.getTiptapContent({
        documentId: command.documentId,
        organizationId: command.organizationId,
        tableId: command.tableId,
        fieldId: command.fieldId,
        requestedBy: command.updatedBy
      });

      if (!existingContent.success) {
        return { success: false, error: 'Could not retrieve existing document' };
      }

      // 2. Create updated content with incremented version
      const updatedJson = {
        ...command.content,
        metadata: {
          ...existingContent.data?.metadata,
          updatedAt: new Date().toISOString(),
          version: (existingContent.data?.metadata?.version || 1) + 1,
          lastEditedBy: command.updatedBy.value
        }
      };

      const fileBuffer = Buffer.from(JSON.stringify(updatedJson, null, 2), 'utf-8');

      // 3. Delete old file and upload new version using existing service
      await this.fileUseCases.deleteFile({
        fileId: command.documentId,
        fieldId: command.fieldId,
        tableId: command.tableId,
        organizationId: command.organizationId
      });

      const uploadResult = await this.fileUseCases.uploadFile({
        organizationId: command.organizationId,
        tableId: command.tableId,
        fieldId: command.fieldId,
        file: {
          buffer: fileBuffer,
          filename: `${existingContent.data?.metadata?.title || 'document'}.tiptap.json`,
          mimeType: 'application/vnd.tiptap+json'
        }
      });

      if (!uploadResult.success) {
        return { success: false, error: uploadResult.error };
      }

      // 4. Create updated document field value
      const documentField = DocumentField.fromFieldValue(
        {
          ...uploadResult.data,
          documentMetadata: {
            title: existingContent.data?.metadata?.title || 'Untitled',
            version: updatedJson.metadata.version,
            documentType: 'tiptap',
            lastEditedBy: command.updatedBy.value,
            lastEditedAt: new Date().toISOString()
          }
        },
        command.organizationId,
        command.tableId,
        command.fieldId
      );

      // Update the document field entity
      documentField.updateContent(command.updatedBy);

      console.log(`[DOCUMENT-APP-SERVICE] Updated TipTap document ${command.documentId} (version ${updatedJson.metadata.version})`);
      return { success: true, data: documentField.toFieldValue() };

    } catch (error) {
      console.error('[DOCUMENT-APP-SERVICE] Error updating TipTap document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update TipTap document'
      };
    }
  }

  /**
   * Get TipTap document content for editing
   */
  async getTiptapContent(command: GetTiptapContentCommand): Promise<Result<{ content: object; metadata: any }>> {
    try {
      // 1. Use existing file service to generate download URL
      const downloadResult = await this.fileUseCases.generateDownloadUrl({
        fileId: command.documentId,
        fieldId: command.fieldId,
        tableId: command.tableId,
        organizationId: command.organizationId
      });

      if (!downloadResult.success) {
        return { success: false, error: downloadResult.error };
      }

      // 2. Fetch and parse JSON content
      if (!downloadResult.data) {
        return { success: false, error: 'Failed to download TipTap document content' };
      }
      const response = await fetch(downloadResult.data.url);
      if (!response.ok) {
        return { success: false, error: `Failed to fetch document content: ${response.statusText}` };
      }

      const tiptapJson = await response.json();

      // 3. Validate it's a TipTap document
      if (!tiptapJson.type || tiptapJson.type !== 'doc') {
        return { success: false, error: 'Invalid TipTap document format' };
      }

      return { 
        success: true, 
        data: {
          content: tiptapJson,
          metadata: tiptapJson.metadata || {}
        }
      };

    } catch (error) {
      console.error('[DOCUMENT-APP-SERVICE] Error getting TipTap content:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get TipTap content'
      };
    }
  }

  /**
   * Get document file URL for viewing/downloading
   */
  async getDocumentFileUrl(command: GetDocumentFileUrlCommand): Promise<Result<{ url: string; filename: string }>> {
    try {
      // Use existing file service for download URL
      const downloadResult = await this.fileUseCases.generateDownloadUrl({
        fileId: command.documentId,
        fieldId: command.fieldId,
        tableId: command.tableId,
        organizationId: command.organizationId
      });

      if (!downloadResult.success) {
        return { success: false, error: downloadResult.error };
      }

      return {
        success: true,
        data: {
          url: downloadResult.data?.url || '',
          filename: downloadResult.data?.filename || ''
        }
      };

    } catch (error) {
      console.error('[DOCUMENT-APP-SERVICE] Error generating download URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate download URL'
      };
    }
  }

  /**
   * Create document from uploaded file
   */
  async createDocumentFromFile(
    fileFieldValue: import('@/ddd/domain/tables/value-objects/field-values').FileFieldValue,
    organizationId: OrganizationId,
    tableId: TableId,
    fieldId: FieldId,
    createdBy: UserId,
    title?: string
  ): Promise<Result<DocumentFieldValue>> {
    try {
      // Convert file field value to document field value
      const documentFieldValue: DocumentFieldValue = {
        ...fileFieldValue,
        documentMetadata: {
          title: title || fileFieldValue.name,
          version: 1,
          documentType: 'file',
          lastEditedBy: createdBy.value,
          lastEditedAt: new Date().toISOString()
        }
      };

      console.log(`[DOCUMENT-APP-SERVICE] Created document from file "${fileFieldValue.name}" with ID ${fileFieldValue.id}`);
      return { success: true, data: documentFieldValue };

    } catch (error) {
      console.error('[DOCUMENT-APP-SERVICE] Error creating document from file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create document from file'
      };
    }
  }

  /**
   * Helper methods for document type detection
   */
  isTiptapDocument(fieldValue: DocumentFieldValue): boolean {
    return fieldValue.mimeType === 'application/vnd.tiptap+json' &&
           fieldValue.documentMetadata?.documentType === 'tiptap';
  }

  isViewableFile(fieldValue: DocumentFieldValue): boolean {
    const viewableTypes = [
      'application/pdf',
      'image/',
      'text/',
      'video/',
      'audio/',
      'application/json',
      'application/xml'
    ];
    
    return viewableTypes.some(type => 
      fieldValue.mimeType.startsWith(type.endsWith('/') ? type : type)
    );
  }

  getDocumentDisplayName(fieldValue: DocumentFieldValue): string {
    if (this.isTiptapDocument(fieldValue)) {
      return fieldValue.documentMetadata?.title || 
             fieldValue.name.replace(/\.tiptap\.json$/, '');
    }
    return fieldValue.name;
  }

  /**
   * Update TipTap document metadata (word count, reading time, etc.)
   */
  async updateTiptapMetadata(
    documentId: string,
    organizationId: OrganizationId,
    tableId: TableId,
    fieldId: FieldId,
    metadata: { wordCount?: number; characterCount?: number; estimatedReadTime?: number }
  ): Promise<Result<void>> {
    try {
      // This would be called from the frontend after analyzing TipTap content
      // For now, just log the update - in a full implementation you might
      // store this in the document metadata or update the file content
      
      console.log(`[DOCUMENT-APP-SERVICE] Updated TipTap metadata for document ${documentId}:`, metadata);
      return { success: true };

    } catch (error) {
      console.error('[DOCUMENT-APP-SERVICE] Error updating TipTap metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update TipTap metadata'
      };
    }
  }
}