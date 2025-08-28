/**
 * Field Mapper Infrastructure Service
 * 
 * Infrastructure service for handling field-to-database mapping concerns.
 * Handles PostgreSQL-specific type mapping, column naming, and indexing requirements.
 * 
 * AIDEV-NOTE: Infrastructure service that handles database-specific field mapping.
 * Moved from Field entity to properly separate domain from infrastructure concerns.
 */

import type { Field, FieldType } from '@/ddd/domain/fields/entities/field';
import type { FieldId } from '@/ddd/domain/shared/value-objects';

export interface DatabaseFieldMapping {
  columnName: string;
  postgresType: string;
  requiresIndex: boolean;
}

export interface SlugToColumnMapping {
  [fieldSlug: string]: string;  // slug -> field_{id}
}

export interface ColumnToSlugMapping {
  [columnName: string]: string;  // field_{id} -> slug
}

export class FieldMapper {
  // PostgreSQL type mapping - moved from Field entity
  private static readonly POSTGRES_TYPE_MAPPING: Record<FieldType, string> = {
    text: 'TEXT',
    number: 'INTEGER', 
    boolean: 'BOOLEAN',
    email: 'TEXT',
    url: 'TEXT',
    date: 'DATE',
    relation: 'JSONB',
    file: 'JSONB',
  } as const;

  // Field types that require GIN indexes for performance - moved from Field entity
  private static readonly JSONB_FIELD_TYPES: FieldType[] = ['relation', 'file'];

  /**
   * Get database mapping information for a field
   */
  getDatabaseMapping(field: Field): DatabaseFieldMapping {
    return {
      columnName: this.getColumnName(field.id),
      postgresType: this.getPostgresType(field.type),
      requiresIndex: this.requiresGinIndex(field.type)
    };
  }

  /**
   * Get PostgreSQL column name for a field (field_{id} format)
   */
  getColumnName(fieldId: FieldId): string {
    return `field_${fieldId.value}`;
  }

  /**
   * Get PostgreSQL type for a field type
   */
  getPostgresType(fieldType: FieldType): string {
    return FieldMapper.POSTGRES_TYPE_MAPPING[fieldType];
  }

  /**
   * Check if field type requires GIN index (for JSONB fields)
   */
  requiresGinIndex(fieldType: FieldType): boolean {
    return FieldMapper.JSONB_FIELD_TYPES.includes(fieldType);
  }

  /**
   * Create mapping from field slugs to column names
   */
  createSlugToColumnMapping(fields: Field[]): SlugToColumnMapping {
    const mapping: SlugToColumnMapping = {};
    
    for (const field of fields) {
      mapping[field.slug] = this.getColumnName(field.id);
    }
    
    return mapping;
  }

  /**
   * Create mapping from column names to field slugs
   */
  createColumnToSlugMapping(fields: Field[]): ColumnToSlugMapping {
    const mapping: ColumnToSlugMapping = {};
    
    for (const field of fields) {
      mapping[this.getColumnName(field.id)] = field.slug;
    }
    
    return mapping;
  }

  /**
   * Convert row data from slug-based to column-based format
   */
  convertRowToColumnFormat(fields: Field[], rowData: Record<string, any>): Record<string, any> {
    const columnData: Record<string, any> = {
      // Preserve system fields
      id: rowData.id,
      created_at: rowData.created_at,
      updated_at: rowData.updated_at
    };

    for (const field of fields) {
      const value = rowData[field.slug];
      if (value !== undefined) {
        columnData[this.getColumnName(field.id)] = value;
      }
    }

    return columnData;
  }

  /**
   * Convert row data from column-based to slug-based format
   */
  convertRowToSlugFormat(fields: Field[], columnData: Record<string, any>): Record<string, any> {
    const slugData: Record<string, any> = {
      // Preserve system fields
      id: columnData.id,
      created_at: columnData.created_at,
      updated_at: columnData.updated_at
    };

    for (const field of fields) {
      const columnName = this.getColumnName(field.id);
      const value = columnData[columnName];
      if (value !== undefined) {
        slugData[field.slug] = value;
      }
    }

    return slugData;
  }

  /**
   * Validate field type and return proper FieldType
   * Ensures field types conform to domain specifications
   */
  validateFieldType(fieldType: string): FieldType {
    const validTypes: FieldType[] = ['text', 'number', 'boolean', 'email', 'url', 'date', 'relation', 'file'];
    
    if (validTypes.includes(fieldType as FieldType)) {
      return fieldType as FieldType;
    }
    
    console.warn(`[FieldMapper] Invalid field type: ${fieldType}, defaulting to 'text'`);
    return 'text';
  }

  /**
   * Get all supported PostgreSQL types
   */
  static getSupportedPostgresTypes(): string[] {
    return Object.values(FieldMapper.POSTGRES_TYPE_MAPPING);
  }

  /**
   * Get all field types that require special indexing
   */
  static getIndexedFieldTypes(): FieldType[] {
    return [...FieldMapper.JSONB_FIELD_TYPES];
  }
}