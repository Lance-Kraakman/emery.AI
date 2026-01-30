import type { TableField, FieldType, FieldMetadata } from '@/ddd/domain/tables/value-objects/table-field';
import { normalizeSelectMetadata } from '@/lib/utils/normalize-select-metadata';

export interface FieldDTO {
  id: number;
  name: string;
  type: FieldType;
  orderIndex: number | null;
  relatedTableId?: number | null;
  required: boolean | null;
  metadata?: FieldMetadata | null;
  createdAt: Date | null;
}

export class FieldMapper {
  static toDTO(field: TableField): FieldDTO {
    const rawMetadata = field.metadata || {};
    return {
      id: field.id.value,
      name: field.name,
      type: field.type,
      orderIndex: field.orderIndex,
      relatedTableId: field.relatedTableId?.value || null,
      required: field.required,
      metadata: normalizeSelectMetadata(field.type, rawMetadata) || null,
      createdAt: field.createdAt
    };
  }
}