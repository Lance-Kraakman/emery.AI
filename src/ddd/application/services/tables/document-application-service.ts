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

import { createDebugLogger } from '@/lib/utils/debug-logger';
import { DocumentField } from '@/ddd/domain/tables/entities/document-field-entity';

const logger = createDebugLogger('DocumentService');
import { DocumentFieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { FileUseCases } from './file-application-service';
import { OrganizationId, TableId, FieldId, UserId } from '@/ddd/domain/shared/value-objects';
import { Result } from '@/ddd/domain/shared/result';
import { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import { Row } from '@/ddd/domain/tables/value-objects/row';
import { FieldValue } from '@/ddd/domain/tables/value-objects/field-values';
import { IFileStorageRepository } from '@/ddd/domain/tables/repositories/file-storage-repository';
import { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import { getFieldDefaultValue } from '@/app/mappers/dsg-mapper';
import { FieldMapper } from '@/app/mappers/field-mapper';

export interface CreateTiptapDocumentCommand {
  organizationId: OrganizationId;
  tableId: TableId;
  fieldId: FieldId;
  title: string;
  initialContent?: object[];
  createdBy: UserId;
  rowId?: string; // Optional: if provided, add document to existing row; if not, create new row
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
    private readonly fileUseCases: FileUseCases,  // For file upload/creation operations
    private readonly fileStorageRepository: IFileStorageRepository,  // Direct S3 access
    private readonly dynamicTableService: DynamicTableService,  // Table metadata queries
    private readonly tableRepository: IDynamicTableRepository  // Direct row queries
  ) {}

  /**
   * Get a document field value from the database
   * This provides the actual document data with proper mimeType, name, etc.
   */
  async getDocumentFieldValue(
    documentId: string,
    organizationId: OrganizationId,
    tableId: TableId,
    fieldId: FieldId
  ): Promise<Result<DocumentFieldValue>> {
    try {
      const documentData = await this.findDocumentInTable(
        documentId,
        organizationId,
        tableId,
        fieldId
      );

      if (!documentData) {
        return { success: false, error: 'Document not found' };
      }

      // CRITICAL FIX: Return the actual document data from storage
      // instead of creating a new object with hardcoded defaults (size: 0, etc.)
      return {
        success: true,
        data: documentData
      };
    } catch (error) {
      console.error('[DOCUMENT-APP-SERVICE] Error getting document field value:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get document field value'
      };
    }
  }

  /**
   * Private helper to find document data in table rows
   * Returns the complete DocumentFieldValue with all metadata
   */
  private async findDocumentInTable(
    documentId: string,
    organizationId: OrganizationId,
    tableId: TableId,
    fieldId: FieldId
  ): Promise<DocumentFieldValue | null> {
    try {
      // Get table and validate field
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table || !table.isOwnedBy(organizationId)) {
        return null;
      }

      const field = table.getFieldById(fieldId);
      if (!field || (field.type !== 'file' && field.type !== 'document')) {
        return null;
      }

      // Get all rows using proper repository pattern (using high limit for document search)
      const rows = await this.tableRepository.getRows(tableId, { limit: 10000, offset: 0 });

      // Find the document in the rows
      for (const row of rows) {
        try {
          const fieldValue = row.getFieldValue(field.id.value.toString());
          if (!fieldValue || !fieldValue.value) continue;

          // Document fields are always arrays (DocumentFieldValue[])
          const files = fieldValue.value as DocumentFieldValue[];
          const matchingFile = files.find((f: any) => f && f.id === documentId);

          if (matchingFile && matchingFile.s3Key) {
            // CRITICAL FIX: Return the ENTIRE document object with all metadata
            // instead of cherry-picking properties and losing size, uploadedAt, etc.
            return matchingFile;
          }
        } catch (error) {
          console.warn('[DOCUMENT-APP-SERVICE] Error parsing document data from row:', error);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('[DOCUMENT-APP-SERVICE] Error finding document in table:', error);
      return null;
    }
  }

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

      // 4. Add document to row (create new or update existing)
      const table = await this.dynamicTableService.getTable(command.tableId);
      if (!table) {
        return { success: false, error: 'Table not found' };
      }

      const field = table.getFieldById(command.fieldId);
      if (!field) {
        return { success: false, error: 'Field not found' };
      }

      const fieldIdStr = command.fieldId.value.toString();

      if (command.rowId) {
        // Update existing row - append document to field
        const existingRow = await this.tableRepository.getRow(command.tableId, command.rowId);
        if (!existingRow) {
          return { success: false, error: `Row ${command.rowId} not found` };
        }

        // Get current documents in field (or empty array if none)
        const currentDocs = (existingRow.getFieldValue(fieldIdStr)?.value || []) as DocumentFieldValue[];
        const updatedDocs = [...currentDocs, documentFieldValue];

        // Build update row with all existing field values plus updated document field
        const rowData: Record<string, any> = { id: command.rowId };
        for (const fv of existingRow.fieldValues) {
          rowData[fv.fieldId] = fv.fieldId === fieldIdStr ? updatedDocs : fv.value;
        }

        const updatedRow = Row.fromPlainObject(rowData, table.id.value, table.fields as any);
        await this.tableRepository.updateRows(command.tableId, [{ rowId: command.rowId, row: updatedRow }]);

        logger.debug(`[DOCUMENT-APP-SERVICE] Added document to existing row ${command.rowId}`);
      } else {
        // Create new row with document + defaults for required fields
        const rowData: Record<string, any> = {
          [fieldIdStr]: [documentFieldValue]
        };

        // Populate defaults for required fields (except the document field)
        for (const f of table.fields) {
          const fIdStr = f.id.value.toString();
          if (fIdStr === fieldIdStr) continue; // Skip document field (already set)
          if (!f.required) continue; // Skip optional fields

          const fieldDTO = FieldMapper.toDTO(f);
          rowData[fIdStr] = getFieldDefaultValue(fieldDTO);
        }

        const newRow = Row.fromPlainObject(rowData, table.id.value, table.fields as any);
        await this.tableRepository.insertRows(command.tableId, [newRow]);

        logger.debug(`[DOCUMENT-APP-SERVICE] Created new row with document`);
      }

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
      // 1. Get existing document data to retrieve s3Key for proper update
      const existingDocument = await this.findDocumentInTable(
        command.documentId,
        command.organizationId,
        command.tableId,
        command.fieldId
      );

      if (!existingDocument) {
        return { success: false, error: 'Document not found in database' };
      }

      // 2. Get existing document content to preserve metadata
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

      // 3. Create updated content with incremented version
      // IMPORTANT: command.content is the FULL TipTap JSON from editor.getJSON()
      // It should contain: { type: "doc", content: [...nodes with attrs...] }
      console.log('[DOCUMENT-APP-SERVICE] updateTiptapDocument - command.content:', JSON.stringify(command.content));

      const updatedJson = {
        ...command.content,
        metadata: {
          ...existingContent.data?.metadata,
          updatedAt: new Date().toISOString(),
          version: (existingContent.data?.metadata?.version || 1) + 1,
          lastEditedBy: command.updatedBy.value
        }
      };

      console.log('[DOCUMENT-APP-SERVICE] updateTiptapDocument - updatedJson to save:', JSON.stringify(updatedJson));

      const fileBuffer = Buffer.from(JSON.stringify(updatedJson, null, 2), 'utf-8');
      console.log('[DOCUMENT-APP-SERVICE] updateTiptapDocument - fileBuffer size:', fileBuffer.length);

      // 4. Update existing file using updateFile to preserve the same S3 key/ID
      const updateResult = await this.fileUseCases.updateFile({
        fileId: existingDocument.s3Key,
        fieldId: command.fieldId,
        tableId: command.tableId,
        organizationId: command.organizationId,
        file: {
          buffer: fileBuffer,
          filename: `${existingContent.data?.metadata?.title || 'document'}.tiptap.json`,
          mimeType: 'application/vnd.tiptap+json'
        }
      });

      if (!updateResult.success) {
        return { success: false, error: updateResult.error };
      }

      // 4. Create updated document field value
      const documentField = DocumentField.fromFieldValue(
        {
          ...updateResult.data,
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
    console.log('[DOCUMENT-APP-SERVICE] getTiptapContent() called with:', {
      documentId: command.documentId,
      organizationId: command.organizationId.value,
      tableId: command.tableId.value,
      fieldId: command.fieldId.value,
      requestedBy: command.requestedBy.value
    });

    try {
      // 1. Find the document in the table to get the actual s3Key
      console.log('[DOCUMENT-APP-SERVICE] Searching for document in table...');
      const documentData = await this.findDocumentInTable(
        command.documentId,
        command.organizationId,
        command.tableId,
        command.fieldId
      );

      if (!documentData) {
        console.error('[DOCUMENT-APP-SERVICE] Document not found in table');
        return { success: false, error: 'Document not found in database' };
      }

      console.log('[DOCUMENT-APP-SERVICE] Found document data:', {
        s3Key: documentData.s3Key,
        name: documentData.name,
        mimeType: documentData.mimeType
      });

      // 2. Generate signed URL using the actual s3Key
      console.log('[DOCUMENT-APP-SERVICE] Generating signed URL for s3Key:', documentData.s3Key);
      const downloadUrl = await this.fileStorageRepository.generateDownloadUrl(documentData.s3Key, {
        expiresIn: 3600 // 1 hour expiry
      });

      console.log('[DOCUMENT-APP-SERVICE] About to fetch from S3 URL:', downloadUrl);

      const response = await fetch(downloadUrl);

      console.log('[DOCUMENT-APP-SERVICE] Fetch response:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorMsg = `Failed to fetch document content: ${response.status} ${response.statusText}`;
        console.error('[DOCUMENT-APP-SERVICE]', errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log('[DOCUMENT-APP-SERVICE] Parsing JSON content...');
      const tiptapJson = await response.json();

      console.log('[DOCUMENT-APP-SERVICE] Parsed JSON:', {
        type: tiptapJson.type,
        hasContent: !!tiptapJson.content,
        hasMetadata: !!tiptapJson.metadata,
        keys: Object.keys(tiptapJson)
      });

      // Log the FULL content to debug attrs being stripped
      console.log('[DOCUMENT-APP-SERVICE] Full loaded content:', JSON.stringify(tiptapJson));

      // 3. Validate it's a TipTap document
      if (!tiptapJson.type || tiptapJson.type !== 'doc') {
        const errorMsg = `Invalid TipTap document format - expected type 'doc', got '${tiptapJson.type}'`;
        console.error('[DOCUMENT-APP-SERVICE]', errorMsg);
        return { success: false, error: errorMsg };
      }

      console.log('[DOCUMENT-APP-SERVICE] Successfully loaded TipTap content');
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
      console.log('[DOCUMENT-APP-SERVICE] getDocumentFileUrl - Searching for document in table...');

      // Find the document in the table to get the actual s3Key
      const documentData = await this.findDocumentInTable(
        command.documentId,
        command.organizationId,
        command.tableId,
        command.fieldId
      );

      if (!documentData) {
        console.error('[DOCUMENT-APP-SERVICE] getDocumentFileUrl - Document not found in table');
        return { success: false, error: 'Document not found in database' };
      }

      console.log('[DOCUMENT-APP-SERVICE] getDocumentFileUrl - Found document data:', {
        s3Key: documentData.s3Key,
        name: documentData.name,
        mimeType: documentData.mimeType
      });

      // Generate signed URL using the actual s3Key
      const downloadUrl = await this.fileStorageRepository.generateDownloadUrl(documentData.s3Key, {
        expiresIn: 3600 // 1 hour expiry
      });

      console.log('[DOCUMENT-APP-SERVICE] getDocumentFileUrl - Generated download URL for s3Key:', documentData.s3Key);

      return {
        success: true,
        data: {
          url: downloadUrl,
          filename: documentData.name
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