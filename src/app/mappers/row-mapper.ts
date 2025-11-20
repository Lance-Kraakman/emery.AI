import type { Row, FieldValue } from '@/ddd/domain/tables/value-objects/row';
import type {
  FieldValue as DomainFieldValue,
  FileFieldValue,
  DocumentFieldValue,
  RelationFieldValue,
  FileArrayFieldValue,
  DocumentArrayFieldValue,
  RelationArrayFieldValue,
  TextFieldValue,
  NumberFieldValue,
  BooleanFieldValue,
  DateFieldValue
} from '@/ddd/domain/tables/value-objects/field-values';
import type { TableField } from '@/ddd/domain/tables/value-objects/table-field';
import { getFieldDefaultValue } from './dsg-mapper';
import { FieldMapper } from './field-mapper';

// ========================================
// Use Domain Value Objects Directly - No DTO Layer Needed
// ========================================

// Re-export domain types for backward compatibility
export type { 
  FileFieldValue,
  DocumentFieldValue,
  RelationFieldValue,
  FileArrayFieldValue,
  DocumentArrayFieldValue,
  RelationArrayFieldValue,
  TextFieldValue,
  NumberFieldValue,
  BooleanFieldValue,
  DateFieldValue
};

// Main field value type uses domain value objects directly  
export type FieldValueDTO = DomainFieldValue;

export interface TypedFieldValueDTO {
  fieldId: string;  // AIDEV-NOTE: Numeric field ID (e.g., "1", "10"), not field name
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
        fieldId: fv.fieldId,  // AIDEV-NOTE: Now uses numeric field ID instead of field name
        value: RowMapper.domainToDTO(fv.value, fv.fieldType),
        fieldType: fv.fieldType as TypedFieldValueDTO['fieldType']
      }))
    };
  }

  private static domainToDTO(value: any, fieldType: string): FieldValueDTO {
    if (value === null || value === undefined) return value;

    switch (fieldType) {
      case 'text':
        return value as TextFieldValue;
      case 'number':
        return value as NumberFieldValue;
      case 'boolean':
        return value as BooleanFieldValue;
      case 'date':
        // Keep as Date object for protobuf serialization (gRPC handles timestamps natively)
        if (value === null || value === undefined) return null;
        if (value instanceof Date) return value;
        if (typeof value === 'string') return new Date(value);
        return new Date(value);
      case 'file':
        // CRITICAL FIX: Handle "[object Object]" strings from bad serialization
        if (typeof value === 'string' && value === '[object Object]') {
          console.warn('File field contains "[object Object]" string - data serialization issue detected');
          return [];
        }
        // Return as-is since domain objects are already plain objects
        return Array.isArray(value) ? value : [];
      case 'document':
        // CRITICAL FIX: Handle "[object Object]" strings from bad serialization
        if (typeof value === 'string' && value === '[object Object]') {
          console.warn('Document field contains "[object Object]" string - data serialization issue detected');
          return [];
        }
        // Return as-is since domain objects are already plain objects
        return Array.isArray(value) ? value : [];
      case 'relation':
        // CRITICAL FIX: Handle "[object Object]" strings from bad serialization
        if (typeof value === 'string' && value === '[object Object]') {
          console.warn('Relation field contains "[object Object]" string - data serialization issue detected');
          return [];
        }
        // Return as-is since domain objects are already plain objects
        return Array.isArray(value) ? value : [];
      case 'single-select':
      case 'multi-select':
        // Select fields store option IDs as numbers or strings
        // Return as-is since the value is already the option ID
        return value;
      default:
        console.warn(`Unknown field type: ${fieldType}, returning value as-is`);
        return value;
    }
  }

  // NOTE: Conversion methods removed since we use domain objects directly
  // Domain value objects are already plain interfaces, no conversion needed
  
  // Keep for backwards compatibility
  static fieldValueToDTO(fieldValue: FieldValue): TypedFieldValueDTO {
    return {
      fieldId: fieldValue.fieldId,  // AIDEV-NOTE: Now uses numeric field ID instead of field name
      value: RowMapper.domainToDTO(fieldValue.value, fieldValue.fieldType),
      fieldType: fieldValue.fieldType as TypedFieldValueDTO['fieldType']
    };
  }

  /**
   * Apply default values for missing/invalid fields (data migration)
   *
   * ARCHITECTURE NOTE: This belongs in the application layer (mapper), NOT infrastructure.
   * Infrastructure (ArrowDataStorageService) should only handle storage - it returns raw data.
   * Application layer (RowMapper) handles data transformation and migration.
   *
   * Handles legacy data with:
   * - Missing columns (field added after data was stored)
   * - Empty strings in old data for required fields
   * - Null/undefined values
   *
   * @param data - Raw row data from storage
   * @param fields - Table field definitions (domain objects)
   * @returns Data with valid defaults applied
   */
  static applyDefaults(
    data: Record<string, any>,
    fields: TableField[]
  ): Record<string, any> {
    const result = { ...data };

    for (const field of fields) {
      const value = result[field.name];

      // Only apply defaults for primitive field types with empty strings
      // Complex fields (file, document, relation) with empty arrays are valid
      const isPrimitiveField = ['text', 'number', 'boolean', 'date'].includes(field.type);
      const needsDefault = isPrimitiveField && (value === '' || value === null || value === undefined);

      if (needsDefault) {
        // Convert TableField (domain) to FieldDTO using FieldMapper
        const fieldDTO = FieldMapper.toDTO(field);

        result[field.name] = getFieldDefaultValue(fieldDTO);
      }
    }

    return result;
  }
}