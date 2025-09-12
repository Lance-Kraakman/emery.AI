import type { Row, FieldValue } from '@/ddd/domain/tables/value-objects/row';

// ========================================
// Typed DTO Field Values - Mirror domain types but ensure JSON serializability
// ========================================

export type TextFieldValueDTO = string;
export type NumberFieldValueDTO = number;
export type BooleanFieldValueDTO = boolean;
export type DateFieldValueDTO = string; // ISO date string

// Complex types - plain objects only (no classes)
export interface FileFieldValueDTO {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  s3Key: string;
  uploadedAt: string; // ISO string
}

export interface DocumentFieldValueDTO extends FileFieldValueDTO {
  documentMetadata?: {
    title: string;
    version: number;
    documentType: 'tiptap' | 'file';
    lastEditedBy?: string;
    lastEditedAt?: string; // ISO string
    tiptapMetadata?: {
      wordCount?: number;
      characterCount?: number;
      estimatedReadTime?: number;
    };
  };
}

export interface RelationFieldValueDTO {
  id: string | number;
  value: string;
}

// Array types
export type FileArrayFieldValueDTO = FileFieldValueDTO[];
export type DocumentArrayFieldValueDTO = DocumentFieldValueDTO[];
export type RelationArrayFieldValueDTO = RelationFieldValueDTO[];

// Union type for all possible field values
export type FieldValueDTO = 
  | TextFieldValueDTO
  | NumberFieldValueDTO
  | BooleanFieldValueDTO
  | DateFieldValueDTO
  | FileArrayFieldValueDTO
  | RelationArrayFieldValueDTO
  | DocumentArrayFieldValueDTO
  | null
  | undefined;

export interface TypedFieldValueDTO {
  fieldSlug: string;
  value: FieldValueDTO;
  fieldType: 'text' | 'number' | 'boolean' | 'date' | 'file' | 'relation' | 'document';
}

export interface RowDTO {
  id: string;
  tableId: number;
  fieldValues: TypedFieldValueDTO[];
}

export class RowMapper {
  static toDTO(row: Row): RowDTO {
    return {
      id: row.id.value,
      tableId: row.tableId,
      fieldValues: row.fieldValues.map(fv => ({
        fieldSlug: fv.fieldSlug,
        value: RowMapper.domainToDTO(fv.value, fv.fieldType),
        fieldType: fv.fieldType as TypedFieldValueDTO['fieldType']
      }))
    };
  }

  private static domainToDTO(value: any, fieldType: string): FieldValueDTO {
    if (value === null || value === undefined) return value;

    switch (fieldType) {
      case 'text':
        return value as TextFieldValueDTO;
      case 'number':
        return value as NumberFieldValueDTO;
      case 'boolean':
        return value as BooleanFieldValueDTO;
      case 'date':
        // Ensure dates are ISO strings for JSON serialization
        return typeof value === 'string' ? value : 
               value instanceof Date ? value.toISOString() : 
               new Date(value).toISOString();
      case 'file':
        return Array.isArray(value) ? value.map(RowMapper.fileToDTO) : [];
      case 'document':
        // CRITICAL FIX: Handle case where document field is a string "[object Object]"
        if (typeof value === 'string' && value === '[object Object]') {
          console.warn('Document field contains "[object Object]" string - data serialization issue detected');
          return [];
        }
        return Array.isArray(value) ? value.map(RowMapper.documentToDTO) : [];
      case 'relation':
        return Array.isArray(value) ? value.map(RowMapper.relationToDTO) : [];
      default:
        console.warn(`Unknown field type: ${fieldType}, returning value as-is`);
        return value;
    }
  }

  private static fileToDTO(file: any): FileFieldValueDTO {
    return {
      id: file.id,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      s3Key: file.s3Key,
      uploadedAt: file.uploadedAt
    };
  }

  private static documentToDTO(doc: any): DocumentFieldValueDTO {
    return {
      ...RowMapper.fileToDTO(doc),
      documentMetadata: doc.documentMetadata ? {
        title: doc.documentMetadata.title,
        version: doc.documentMetadata.version,
        documentType: doc.documentMetadata.documentType,
        lastEditedBy: doc.documentMetadata.lastEditedBy,
        lastEditedAt: doc.documentMetadata.lastEditedAt,
        tiptapMetadata: doc.documentMetadata.tiptapMetadata
      } : undefined
    };
  }

  private static relationToDTO(rel: any): RelationFieldValueDTO {
    return {
      id: rel.id,
      value: rel.value
    };
  }
  
  // Keep for backwards compatibility
  static fieldValueToDTO(fieldValue: FieldValue): TypedFieldValueDTO {
    return {
      fieldSlug: fieldValue.fieldSlug,
      value: RowMapper.domainToDTO(fieldValue.value, fieldValue.fieldType),
      fieldType: fieldValue.fieldType as TypedFieldValueDTO['fieldType']
    };
  }
}