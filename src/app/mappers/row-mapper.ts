import type { Row, FieldValue } from '@/src/ddd/domain/tables/value-objects/row';
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
} from '@/src/ddd/domain/tables/value-objects/field-values';

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
        return value as TextFieldValue;
      case 'number':
        return value as NumberFieldValue;
      case 'boolean':
        return value as BooleanFieldValue;
      case 'date':
        // Ensure dates are ISO strings for JSON serialization
        return typeof value === 'string' ? value : 
               value instanceof Date ? value.toISOString() : 
               new Date(value).toISOString();
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
      fieldSlug: fieldValue.fieldSlug,
      value: RowMapper.domainToDTO(fieldValue.value, fieldValue.fieldType),
      fieldType: fieldValue.fieldType as TypedFieldValueDTO['fieldType']
    };
  }
}