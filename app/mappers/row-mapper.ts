import type { Row, FieldValue } from '@/ddd/domain/tables/value-objects/row';

export interface FieldValueDTO {
  fieldSlug: string;
  value: any;
  fieldType: string;
}

export interface RowDTO {
  id: string;
  tableId: number;
  fieldValues: FieldValueDTO[];
}

export class RowMapper {
  static toDTO(row: Row): RowDTO {
    return {
      id: row.id.value,
      tableId: row.tableId,
      fieldValues: row.fieldValues.map(fv => ({
        fieldSlug: fv.fieldSlug,
        value: fv.value,
        fieldType: fv.fieldType
      }))
    };
  }
  
  static fieldValueToDTO(fieldValue: FieldValue): FieldValueDTO {
    return {
      fieldSlug: fieldValue.fieldSlug,
      value: fieldValue.value,
      fieldType: fieldValue.fieldType
    };
  }
}