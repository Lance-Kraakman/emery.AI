/**
 * Document Field Entity
 * 
 * Domain entity representing documents as enhanced file field values.
 * Documents are composed of a FileField plus document-specific metadata.
 * This follows our pattern of files being table field values rather than
 * independent entities, while adding rich document semantics.
 * 
 * AIDEV-NOTE: Documents extend the file field concept with additional
 * metadata and business logic for rich text editing and document management.
 */

import { DocumentFieldValue, DocumentMetadata, validateDocumentFieldValue } from '../value-objects/field-values';
import { FileField } from './file-field-entity';
import { OrganizationId, TableId, FieldId, UserId } from '@/ddd/domain/shared/value-objects';
import crypto from 'crypto';

export class DocumentField { 
  private constructor(
    private readonly _fileField: FileField,
    private _metadata: DocumentMetadata
  ) {}

  // Delegate to file field
  get id(): string { return this._fileField.id; }
  get name(): string { return this._fileField.name; }
  get size(): number { return this._fileField.size; }
  get mimeType(): string { return this._fileField.mimeType; }
  get s3Key(): string { return this._fileField.s3Key; }
  get uploadedAt(): Date { return this._fileField.uploadedAt; }
  get organizationId(): OrganizationId { return this._fileField.organizationId; }
  get tableId(): TableId { return this._fileField.tableId; }
  get fieldId(): FieldId { return this._fileField.fieldId; }

  // Document-specific properties
  get metadata(): DocumentMetadata { return this._metadata; }
  get title(): string { return this._metadata.title; }
  get version(): number { return this._metadata.version; }
  get documentType(): 'tiptap' | 'file' { return this._metadata.documentType; }
  get lastEditedBy(): string | undefined { return this._metadata.lastEditedBy; }
  get lastEditedAt(): Date | undefined { 
    return this._metadata.lastEditedAt ? new Date(this._metadata.lastEditedAt) : undefined;
  }
  get tiptapMetadata(): DocumentMetadata['tiptapMetadata'] { return this._metadata.tiptapMetadata; }

  // Business logic
  isTiptapDocument(): boolean {
    return this._metadata.documentType === 'tiptap' && 
           this._fileField.isTiptapFile();
  }

  isViewableFile(): boolean {
    return this._metadata.documentType === 'file' && this._fileField.isViewableFile();
  }

  getDisplayName(): string {
    if (this.isTiptapDocument()) {
      return this._metadata.title;
    }
    return this._fileField.name;
  }

  canBeEditedBy(userId: UserId): boolean {
    // Basic permission check - can be expanded
    return this._metadata.lastEditedBy === userId.value || !this._metadata.lastEditedBy;
  }

  isOwnedBy(organizationId: OrganizationId): boolean {
    return this._fileField.isOwnedBy(organizationId);
  }

  belongsToTable(tableId: TableId): boolean {
    return this._fileField.belongsToTable(tableId);
  }

  belongsToField(fieldId: FieldId): boolean {
    return this._fileField.belongsToField(fieldId);
  }

  getFormattedSize(): string {
    return this._fileField.getFormattedSize();
  }

  getFileExtension(): string | null {
    return this._fileField.getFileExtension();
  }

  // Update methods
  updateContent(updatedBy: UserId): void {
    if (!this.isTiptapDocument()) {
      throw new Error('Cannot update content of non-TipTap document');
    }
    
    this._metadata = {
      ...this._metadata,
      version: this._metadata.version + 1,
      lastEditedBy: updatedBy.value,
      lastEditedAt: new Date().toISOString()
    };
  }

  updateTitle(title: string, updatedBy: UserId): void {
    this._metadata = {
      ...this._metadata,
      title,
      lastEditedBy: updatedBy.value,
      lastEditedAt: new Date().toISOString()
    };
  }

  updateTiptapMetadata(metadata: { wordCount?: number; characterCount?: number; estimatedReadTime?: number }): void {
    if (!this.isTiptapDocument()) {
      throw new Error('Cannot update TipTap metadata of non-TipTap document');
    }
    
    this._metadata = {
      ...this._metadata,
      tiptapMetadata: {
        ...this._metadata.tiptapMetadata,
        ...metadata
      }
    };
  }

  // Factory methods
  static createTiptap(data: {
    title: string;
    fileName?: string;
    organizationId: OrganizationId;
    tableId: TableId;
    fieldId: FieldId;
    createdBy: UserId;
    initialContent?: object[];
  }): { documentField: DocumentField; fileBuffer: Buffer } {
    // Generate unique ID for the document/file
    const fileId = crypto.randomUUID();
    const fileName = data.fileName || `${data.title.replace(/[^a-zA-Z0-9]/g, '_')}.tiptap.json`;
    
    // Create TipTap JSON structure
    const tiptapJson = {
      type: 'doc',
      content: data.initialContent || [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Start writing...' }]
        }
      ],
      metadata: {
        title: data.title,
        createdAt: new Date().toISOString(),
        version: 1,
        createdBy: data.createdBy.value
      }
    };

    const fileBuffer = Buffer.from(JSON.stringify(tiptapJson, null, 2), 'utf-8');
    
    // Generate S3 key
    const s3Key = `org-${data.organizationId.value}/table-${data.tableId.value}/field-${data.fieldId.value}/documents/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${fileId}_${fileName}`;

    const fileField = FileField.create({
      id: fileId,
      name: fileName,
      size: fileBuffer.length,
      mimeType: 'application/vnd.tiptap+json',
      s3Key: s3Key,
      organizationId: data.organizationId,
      tableId: data.tableId,
      fieldId: data.fieldId
    });

    const metadata: DocumentMetadata = {
      title: data.title,
      version: 1,
      documentType: 'tiptap',
      lastEditedBy: data.createdBy.value,
      lastEditedAt: new Date().toISOString()
    };

    const documentField = new DocumentField(fileField, metadata);

    return { documentField, fileBuffer };
  }

  static fromFile(
    fileField: FileField,
    createdBy: UserId,
    title?: string
  ): DocumentField {
    const metadata: DocumentMetadata = {
      title: title || fileField.name,
      version: 1,
      documentType: 'file',
      lastEditedBy: createdBy.value,
      lastEditedAt: fileField.uploadedAt.toISOString()
    };

    return new DocumentField(fileField, metadata);
  }

  static fromFieldValue(
    value: DocumentFieldValue,
    organizationId: OrganizationId,
    tableId: TableId,
    fieldId: FieldId
  ): DocumentField {
    // Validate that value has all required fields - will throw descriptive error if not
    validateDocumentFieldValue(value);
    
    const fileField = FileField.fromFieldValue(value, organizationId, tableId, fieldId);
    
    const metadata = value.documentMetadata || {
      title: value.name.replace(/\.tiptap\.json$/, ''), // Safe now - validation ensures name exists
      version: 1,
      documentType: value.mimeType === 'application/vnd.tiptap+json' ? 'tiptap' : 'file'
    };

    return new DocumentField(fileField, metadata);
  }

  // Convert to field value for storage
  toFieldValue(): DocumentFieldValue {
    return {
      ...this._fileField.toFieldValue(),
      documentMetadata: this._metadata
    };
  }

  // Helper method for generating file names
  generateFileName(): string {
    if (this.isTiptapDocument()) {
      return `${this._metadata.title.replace(/[^a-zA-Z0-9]/g, '_')}.tiptap.json`;
    }
    return this._fileField.name;
  }

  // Get estimated reading time for TipTap documents
  getEstimatedReadTime(): number | undefined {
    if (!this.isTiptapDocument()) return undefined;
    
    return this._metadata.tiptapMetadata?.estimatedReadTime;
  }

  // Get word count for TipTap documents
  getWordCount(): number | undefined {
    if (!this.isTiptapDocument()) return undefined;
    
    return this._metadata.tiptapMetadata?.wordCount;
  }
}