// AIDEV-NOTE: Field repository interface - defines business operations for dynamic table field management
// Supports field_{id} column creation, type validation, and complex field operations

import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  FieldType,
  FieldValidation,
  FieldOperation,
  BulkFieldOperation,
  FieldStats,
  FieldQuery,
  FieldMigration,
  RelationFieldConfig,
  FileFieldConfig,
  FieldTemplate,
  FieldGroup
} from '../entities/field';

export interface IFieldRepository {
  // Basic Field CRUD operations
  findById(id: number): Promise<Field | null>;
  findByTableId(tableId: number): Promise<Field[]>;
  findBySlug(tableId: number, slug: string): Promise<Field | null>;
  create(data: CreateFieldData): Promise<Field>;
  update(id: number, data: UpdateFieldData): Promise<Field>;
  delete(id: number): Promise<void>;
  
  // Physical Schema Operations (PostgreSQL DDL)
  addFieldToTable(tableId: number, field: Field): Promise<void>;
  removeFieldFromTable(tableId: number, fieldId: number): Promise<void>;
  modifyFieldInTable(tableId: number, fieldId: number, newType: FieldType, newRequired?: boolean): Promise<void>;
  renameFieldInTable(tableId: number, fieldId: number, newName: string): Promise<void>;
  
  // Field Queries and Discovery
  findFieldsByType(tableId: number, type: FieldType): Promise<Field[]>;
  findFieldsByQuery(query: FieldQuery): Promise<Field[]>;
  findRequiredFields(tableId: number): Promise<Field[]>;
  findRelationFields(tableId: number): Promise<Field[]>;
  getFieldsByOrder(tableId: number): Promise<Field[]>;
  
  // Field Validation and Integrity
  validateField(field: CreateFieldData | UpdateFieldData): Promise<FieldValidation>;
  validateFieldData(fieldId: number, value: any): Promise<{ valid: boolean; error?: string }>;
  validateBulkFields(fields: (CreateFieldData | UpdateFieldData)[]): Promise<FieldValidation[]>;
  checkSlugUniqueness(tableId: number, slug: string, excludeFieldId?: number): Promise<boolean>;
  
  // Field Statistics and Analysis
  getFieldStats(fieldId: number): Promise<FieldStats>;
  analyzeFieldUsage(fieldId: number): Promise<{
    nullCount: number;
    uniqueCount: number;
    averageLength?: number;      // For text fields
    minValue?: any;              // For number/date fields
    maxValue?: any;              // For number/date fields
    topValues: Array<{ value: any; count: number }>;
  }>;
  
  // Bulk Field Operations
  createMultipleFields(fields: CreateFieldData[]): Promise<Field[]>;
  updateMultipleFields(updates: Array<{ id: number; data: UpdateFieldData }>): Promise<Field[]>;
  deleteMultipleFields(fieldIds: number[]): Promise<void>;
  executeBulkOperation(operation: BulkFieldOperation): Promise<Field[]>;
  
  // Field Reordering and Organization
  reorderFields(tableId: number, fieldOrders: Array<{ fieldId: number; orderIndex: number }>): Promise<Field[]>;
  moveFieldToPosition(fieldId: number, newOrderIndex: number): Promise<Field>;
  swapFieldPositions(fieldId1: number, fieldId2: number): Promise<Field[]>;
  
  // Relation Field Management
  createRelationField(data: CreateFieldData & { config: RelationFieldConfig }): Promise<Field>;
  updateRelationConfig(fieldId: number, config: RelationFieldConfig): Promise<Field>;
  getRelationConfig(fieldId: number): Promise<RelationFieldConfig | null>;
  getRelatedTableFields(fieldId: number): Promise<Field[]>;
  validateRelationIntegrity(fieldId: number): Promise<{
    valid: boolean;
    orphanedRecords: number;
    issues: string[];
  }>;
  
  // File Field Management
  createFileField(data: CreateFieldData & { config: FileFieldConfig }): Promise<Field>;
  updateFileConfig(fieldId: number, config: FileFieldConfig): Promise<Field>;
  getFileConfig(fieldId: number): Promise<FileFieldConfig | null>;
  cleanupOrphanedFiles(fieldId: number): Promise<{ deletedCount: number; freedBytes: number }>;
  
  // Field Migration and Transformation
  migrateFieldType(fieldId: number, newType: FieldType, transformFunction?: string): Promise<FieldMigration>;
  getFieldMigrationHistory(fieldId: number): Promise<FieldMigration[]>;
  rollbackFieldMigration(migrationId: string): Promise<Field>;
  previewFieldMigration(fieldId: number, newType: FieldType): Promise<{
    affectedRows: number;
    dataLossRisk: 'none' | 'low' | 'medium' | 'high';
    sampleTransformations: Array<{ before: any; after: any }>;
  }>;
  
  // Field Templates and Presets
  getFieldTemplates(): Promise<FieldTemplate[]>;
  createFieldFromTemplate(tableId: number, templateName: string, customData?: Partial<CreateFieldData>): Promise<Field>;
  saveFieldAsTemplate(fieldId: number, templateName: string, description?: string): Promise<FieldTemplate>;
  
  // Field Groups and Organization
  createFieldGroup(data: { tableId: number; name: string; fieldIds: number[] }): Promise<FieldGroup>;
  updateFieldGroup(groupId: number, data: Partial<FieldGroup>): Promise<FieldGroup>;
  deleteFieldGroup(groupId: number): Promise<void>;
  getFieldGroups(tableId: number): Promise<FieldGroup[]>;
  addFieldsToGroup(groupId: number, fieldIds: number[]): Promise<FieldGroup>;
  removeFieldsFromGroup(groupId: number, fieldIds: number[]): Promise<FieldGroup>;
  
  // Business Logic Operations
  canDeleteField(fieldId: number): Promise<boolean>;
  getFieldDependencies(fieldId: number): Promise<{
    relatedFields: Field[];          // Fields that reference this field
    dependentRecords: number;        // Number of records with non-null values
    systemReferences: string[];      // System components that use this field
  }>;
  
  // Field Performance and Optimization
  analyzeFieldPerformance(fieldId: number): Promise<{
    queryCount: number;
    averageQueryTime: number;
    indexEfficiency: number;
    recommendations: string[];
  }>;
  optimizeFieldIndexes(fieldId: number): Promise<void>;
  rebuildFieldIndexes(fieldId: number): Promise<void>;
  
  // Field Constraints and Rules
  addFieldConstraint(fieldId: number, constraint: {
    type: 'CHECK' | 'UNIQUE' | 'FOREIGN_KEY';
    expression: string;
    name?: string;
  }): Promise<void>;
  removeFieldConstraint(fieldId: number, constraintName: string): Promise<void>;
  getFieldConstraints(fieldId: number): Promise<Array<{
    name: string;
    type: string;
    expression: string;
  }>>;
  
  // Data Quality and Cleanup
  findDuplicateValues(fieldId: number): Promise<Array<{ value: any; count: number; rowIds: string[] }>>;
  cleanupFieldData(fieldId: number, options: {
    removeNulls?: boolean;
    removeDuplicates?: boolean;
    normalizeText?: boolean;
    validateFormat?: boolean;
  }): Promise<{ updatedRows: number; issues: string[] }>;
  
  // Advanced Field Operations
  cloneField(sourceFieldId: number, targetTableId: number, newName?: string): Promise<Field>;
  compareFields(fieldId1: number, fieldId2: number): Promise<{
    compatible: boolean;
    differences: Array<{
      property: string;
      field1Value: any;
      field2Value: any;
    }>;
    migrationPath?: string[];
  }>;
  
  // Real-time Field Operations
  watchFieldChanges(fieldId: number, callback: (change: {
    type: 'FIELD_UPDATED' | 'FIELD_DELETED' | 'DATA_CHANGED';
    field: Field;
    oldValue?: any;
    newValue?: any;
    timestamp: Date;
  }) => void): Promise<() => void>; // Returns unsubscribe function
}