// AIDEV-NOTE: Simplified Field repository interface - just essential CRUD operations
// Focuses on the methods actually used in the application

import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
} from '../entities/field';
import { FieldId, TableId } from '@/ddd/domain/shared/value-objects';

export interface IFieldRepository {
  // Basic CRUD
  findById(id: FieldId): Promise<Field | null>;
  findByTableId(tableId: TableId): Promise<Field[]>;
  create(data: CreateFieldData): Promise<Field>;
  update(id: FieldId, data: UpdateFieldData): Promise<Field>;
  delete(id: FieldId): Promise<void>;
  
  // Essential business logic
  checkSlugUniqueness(tableId: TableId, slug: string, excludeFieldId?: FieldId): Promise<boolean>;
  canDeleteField(fieldId: FieldId): Promise<boolean>;
}

// AIDEV-NOTE: Physical schema operations (addFieldToTable, removeFieldFromTable, etc.)
// have been moved to FieldSchemaService for proper separation of concerns.
// Advanced field operations (templates, groups, constraints, etc.) can be 
// implemented as additional services when needed.