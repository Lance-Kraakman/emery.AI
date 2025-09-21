/**
 * File Field Entity
 * 
 * Domain entity wrapping FileFieldValue with business logic.
 * Files in our system are fundamentally table field values, not independent entities.
 * This entity provides rich behavior around file field values while maintaining
 * the storage pattern of files as JSONB values in dynamic table cells.
 * 
 * AIDEV-NOTE: Files moved from separate domain to tables domain since they are
 * fundamentally table field values, not independent domain entities.
 */

import { FileFieldValue, validateFileFieldValue } from '../value-objects/field-values';
import { OrganizationId, TableId, FieldId } from '@/ddd/domain/shared/value-objects';
import { FileTypeDetector } from '../services/file-type-detector';
import { FileViewerType, TIPTAP_MIME_TYPE } from '../value-objects/file-viewer-types';

export class FileField {
  private constructor(
    private readonly _value: FileFieldValue,
    private readonly _organizationId: OrganizationId,
    private readonly _tableId: TableId,
    private readonly _fieldId: FieldId
  ) {}

  // Getters for file properties
  get id(): string { return this._value.id; }
  get name(): string { return this._value.name; }
  get size(): number { return this._value.size; }
  get mimeType(): string { return this._value.mimeType; }
  get s3Key(): string { return this._value.s3Key; }
  get uploadedAt(): Date { return new Date(this._value.uploadedAt); }
  
  // Getters for context
  get organizationId(): OrganizationId { return this._organizationId; }
  get tableId(): TableId { return this._tableId; }
  get fieldId(): FieldId { return this._fieldId; }

  // Business logic methods
  isOwnedBy(organizationId: OrganizationId): boolean {
    return this._organizationId.equals(organizationId);
  }

  belongsToTable(tableId: TableId): boolean {
    return this._tableId.equals(tableId);
  }

  belongsToField(fieldId: FieldId): boolean {
    return this._fieldId.equals(fieldId);
  }

  isViewableFile(): boolean {
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
      this._value.mimeType.startsWith(type.endsWith('/') ? type : type)
    );
  }

  isTiptapFile(): boolean {
    return this._value.mimeType === TIPTAP_MIME_TYPE;
  }

  getViewerType(): FileViewerType {
    return FileTypeDetector.detectViewerType(this._value.name, this._value.mimeType);
  }

  isViewableInApp(): boolean {
    return FileTypeDetector.isViewableInApp(this.getViewerType());
  }

  getFileExtension(): string | null {
    const lastDotIndex = this._value.name.lastIndexOf('.');
    return lastDotIndex > 0 ? this._value.name.substring(lastDotIndex + 1).toLowerCase() : null;
  }

  getFormattedSize(): string {
    const bytes = this._value.size;
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Factory methods
  static fromFieldValue(
    value: FileFieldValue,
    organizationId: OrganizationId,
    tableId: TableId,
    fieldId: FieldId
  ): FileField {
    // Validate that value has all required fields - will throw descriptive error if not
    validateFileFieldValue(value);
    
    return new FileField(value, organizationId, tableId, fieldId);
  }

  static create(data: {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    s3Key: string;
    organizationId: OrganizationId;
    tableId: TableId;
    fieldId: FieldId;
    uploadedAt?: Date;
  }): FileField {
    const fieldValue: FileFieldValue = {
      id: data.id,
      name: data.name,
      size: data.size,
      mimeType: data.mimeType,
      s3Key: data.s3Key,
      uploadedAt: (data.uploadedAt || new Date()).toISOString()
    };
    
    return new FileField(fieldValue, data.organizationId, data.tableId, data.fieldId);
  }

  // Convert back to field value for storage
  toFieldValue(): FileFieldValue {
    return { ...this._value };
  }

  // Helper method to create file upload metadata
  getUploadMetadata(): Record<string, any> {
    return {
      originalName: this._value.name,
      organizationId: this._organizationId.value.toString(),
      tableId: this._tableId.value.toString(),
      fieldId: this._fieldId.value.toString(),
      uploadedAt: this._value.uploadedAt,
      fileType: this.getFileExtension() || 'unknown'
    };
  }
}