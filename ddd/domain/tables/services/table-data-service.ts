/**
 * Table Data Service
 * 
 * Domain service that coordinates table data operations with schema evolution.
 * Handles data migration, schema versioning, and integrity validation for S3/Arrow storage.
 * 
 * AIDEV-NOTE: Service layer that orchestrates table data operations between 
 * data storage (S3/Arrow), schema validation, and query optimization
 */

import type { Result } from '@/ddd/domain/shared/result';
import type { TableSchema, FieldSchema } from '../value-objects/table-schema';
import type { StorageMetadata } from './data-storage-service';

export interface DataMigration {
  migrationId: string;
  sourceSchema: TableSchema;
  targetSchema: TableSchema;
  transformations: Array<{
    fieldId: number;
    operation: 'add' | 'remove' | 'modify' | 'rename';
    transformer?: string; // JavaScript function as string
  }>;
}

export interface IntegrityReport {
  valid: boolean;
  totalRows: number;
  validRows: number;
  issues: Array<{
    rowId: string;
    fieldId: number;
    issue: string;
    severity: 'warning' | 'error';
  }>;
  summary: {
    missingRequiredFields: number;
    invalidFieldTypes: number;
    orphanedRelations: number;
    corruptedFiles: number;
  };
}

export interface SchemaEvolutionPlan {
  currentVersion: number;
  targetVersion: number;
  changes: Array<{
    type: 'ADD_FIELD' | 'REMOVE_FIELD' | 'MODIFY_FIELD' | 'RENAME_FIELD';
    fieldId: number;
    details: any;
  }>;
  estimatedDuration: number; // in seconds
  backupRequired: boolean;
}

export interface DataMigrationResult {
  success: boolean;
  migrationId: string;
  processedRows: number;
  failedRows: number;
  errors: string[];
  warnings: string[];
  duration: number; // in milliseconds
  newSchemaVersion: number;
}

/**
 * Table Data Service Interface
 * 
 * Builds on existing DataStorageService but adds schema evolution capabilities
 */
export interface TableDataService {
  // Schema Evolution Operations
  evolveSchema(tableId: number, schemaChanges: SchemaEvolutionPlan): Promise<Result<DataMigrationResult>>;
  
  previewSchemaEvolution(tableId: number, targetSchema: TableSchema): Promise<Result<{
    plan: SchemaEvolutionPlan;
    impact: {
      affectedRows: number;
      dataLossRisk: 'none' | 'low' | 'medium' | 'high';
      estimatedTime: number;
      backupSize: number;
    };
  }>>;
  
  // Data Migration Operations
  migrateExistingData(tableId: number, migration: DataMigration): Promise<Result<DataMigrationResult>>;
  
  createMigrationPlan(tableId: number, sourceSchema: TableSchema, targetSchema: TableSchema): Promise<Result<DataMigration>>;
  
  rollbackMigration(tableId: number, migrationId: string): Promise<Result<void>>;
  
  // Data Integrity and Validation
  validateDataIntegrity(tableId: number): Promise<Result<IntegrityReport>>;
  
  repairDataIntegrity(tableId: number, repairOptions: {
    fixMissingRequired?: boolean;
    removeInvalidTypes?: boolean;
    cleanupOrphanedRelations?: boolean;
  }): Promise<Result<{
    repaired: number;
    removed: number;
    warnings: string[];
  }>>;
  
  // Schema Versioning
  getSchemaHistory(tableId: number): Promise<Result<Array<{
    version: number;
    schema: TableSchema;
    createdAt: Date;
    createdBy: string;
    changes: string[];
  }>>>;
  
  revertToSchemaVersion(tableId: number, version: number): Promise<Result<DataMigrationResult>>;
  
  // Data Optimization
  optimizeTableData(tableId: number, options: {
    compactFiles?: boolean;
    rebuildIndexes?: boolean;
    cleanupDeletedRows?: boolean;
  }): Promise<Result<{
    originalSize: number;
    optimizedSize: number;
    spaceSaved: number;
    operations: string[];
  }>>;
  
  analyzeTablePerformance(tableId: number): Promise<Result<{
    totalRows: number;
    fileCount: number;
    averageFileSize: number;
    queryPerformance: {
      averageSelectTime: number;
      averageInsertTime: number;
      bottlenecks: string[];
    };
    recommendations: string[];
  }>>;
  
  // Backup and Recovery
  createTableBackup(tableId: number, backupOptions: {
    includeSchema: boolean;
    includeData: boolean;
    compressionLevel?: number;
  }): Promise<Result<{
    backupId: string;
    location: string;
    size: number;
    schemaVersion: number;
  }>>;
  
  restoreFromBackup(tableId: number, backupId: string): Promise<Result<DataMigrationResult>>;
  
  // Data Export/Import with Schema Evolution
  exportTableWithSchema(tableId: number, format: 'json' | 'csv' | 'arrow'): Promise<Result<{
    data: Buffer;
    schema: TableSchema;
    metadata: StorageMetadata;
  }>>;
  
  importTableWithSchema(tableId: number, data: Buffer, sourceSchema: TableSchema, mergeStrategy: 'replace' | 'append' | 'merge'): Promise<Result<DataMigrationResult>>;
}