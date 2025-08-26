/**
 * Field Schema Service
 * 
 * Domain service that coordinates field schema operations across multiple repositories.
 * Handles dynamic field operations for S3/Arrow storage including schema evolution,
 * data migration, and validation.
 * 
 * AIDEV-NOTE: Service layer that orchestrates field schema operations between 
 * field metadata (PostgreSQL), table data (S3/Arrow), and query optimization (DuckDB)
 */

import type { Field, FieldType } from '../entities/field';
import type { Result } from '@/ddd/domain/shared/result';

export interface FieldValidation {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface SchemaChange {
  type: 'ADD_FIELD' | 'REMOVE_FIELD' | 'MODIFY_FIELD' | 'RENAME_FIELD';
  fieldId: number;
  field?: Field;
  changes?: {
    newType?: FieldType;
    newRequired?: boolean;
    newName?: string;
  };
}

export interface SchemaEvolutionResult {
  success: boolean;
  appliedChanges: SchemaChange[];
  skippedChanges: SchemaChange[];
  warnings: string[];
  error?: string;
}

/**
 * Field Schema Service Interface
 * 
 * Extracted from IFieldRepositoryFuture to properly separate concerns:
 * - Repository handles CRUD operations
 * - Service handles schema operations that span multiple repositories
 */
export interface FieldSchemaService {
  // Physical Schema Operations (S3/Arrow DDL equivalent)
  addFieldToTable(tableId: number, field: Field): Promise<Result<void>>;
  removeFieldFromTable(tableId: number, fieldId: number): Promise<Result<void>>;
  modifyFieldInTable(tableId: number, fieldId: number, newType: FieldType, newRequired?: boolean): Promise<Result<void>>;
  renameFieldInTable(tableId: number, fieldId: number, newName: string): Promise<Result<void>>;
  
  // Field Validation and Integrity
  validateField(field: Field): Promise<Result<FieldValidation>>;
  validateFieldData(fieldId: number, value: any): Promise<Result<{ valid: boolean; error?: string }>>;
  validateBulkFields(fields: Field[]): Promise<Result<FieldValidation[]>>;
  
  // Schema Evolution and Migration
  previewSchemaChange(tableId: number, change: SchemaChange): Promise<Result<{
    affectedRows: number;
    dataLossRisk: 'none' | 'low' | 'medium' | 'high';
    sampleTransformations: Array<{ before: any; after: any }>;
    warnings: string[];
  }>>;
  
  applySchemaChanges(tableId: number, changes: SchemaChange[]): Promise<Result<SchemaEvolutionResult>>;
  
  // Field Migration and Transformation
  migrateFieldType(fieldId: number, newType: FieldType, transformFunction?: string): Promise<Result<{
    migrationId: string;
    affectedRows: number;
    success: boolean;
  }>>;
  
  // Field Dependencies and Constraints
  validateFieldIntegrity(fieldId: number): Promise<Result<{
    valid: boolean;
    orphanedRecords: number;
    issues: string[];
  }>>;
  
  getFieldDependencies(fieldId: number): Promise<Result<{
    relatedFields: Field[];
    dependentRecords: number;
    systemReferences: string[];
  }>>;
  
  // Business Logic Validation
  canDeleteField(fieldId: number): Promise<Result<{ 
    canDelete: boolean; 
    blockers: string[]; 
    warnings: string[] 
  }>>;
  
  canModifyField(fieldId: number, newType: FieldType): Promise<Result<{ 
    canModify: boolean; 
    blockers: string[]; 
    warnings: string[] 
  }>>;
}