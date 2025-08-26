// AIDEV-NOTE: Simplified Field repository interface - just essential CRUD operations
// Focuses on the methods actually used in the application

import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  LinkToTableConfig,
  FileFieldConfig
} from '../entities/field';

export interface IFieldRepository {
  // Basic CRUD
  findById(id: number): Promise<Field | null>;
  findByTableId(tableId: number): Promise<Field[]>;
  create(data: CreateFieldData): Promise<Field>;
  update(id: number, data: UpdateFieldData): Promise<Field>;
  delete(id: number): Promise<void>;
  
  // Essential business logic
  checkSlugUniqueness(tableId: number, slug: string, excludeFieldId?: number): Promise<boolean>;
  canDeleteField(fieldId: number): Promise<boolean>;
}

// AIDEV-NOTE: Physical schema operations (addFieldToTable, removeFieldFromTable, etc.)
// have been moved to FieldSchemaService for proper separation of concerns.
// Advanced field operations (templates, groups, constraints, etc.) can be 
// implemented as additional services when needed.