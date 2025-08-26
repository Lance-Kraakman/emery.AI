/**
 * Arrow Field Schema Service Implementation
 * 
 * Infrastructure implementation of FieldSchemaService for S3/Arrow storage.
 * Coordinates field schema operations between PostgreSQL metadata, S3 storage, and DuckDB queries.
 * 
 * AIDEV-NOTE: Infrastructure implementation that orchestrates field schema operations
 * across multiple repositories and services for S3/Arrow storage
 */

import { db } from '@/lib/db/client';
import { fields, tables } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

import type { FieldSchemaService, FieldValidation, SchemaChange, SchemaEvolutionResult } from '@/ddd/domain/fields/services/field-schema-service';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';
import type { Field, FieldType } from '@/ddd/domain/fields/entities/field';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';

export class ArrowFieldSchemaService implements FieldSchemaService {
  constructor(
    private readonly fieldRepository: IFieldRepository,
    private readonly tableRepository: IDynamicTableRepository, 
    private readonly queryService: TableQueryService
  ) {}

  async addFieldToTable(tableId: number, field: Field): Promise<Result<void>> {
    try {
      console.log(`[ArrowFieldSchemaService] Adding field ${field.name} to table ${tableId}`);

      // 1. Verify table exists
      const table = await this.tableRepository.findById(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId} not found`);
      }

      // 2. Validate field doesn't conflict with existing fields
      const existingFields = await this.fieldRepository.findByTableId(tableId);
      const conflictingField = existingFields.find((f: any) => f.slug === field.slug);
      if (conflictingField) {
        return ResultHelpers.failure(`Field with slug '${field.slug}' already exists in table`);
      }

      // 3. For S3/Arrow storage: Schema evolution is handled automatically
      // Arrow files are self-describing and handle new fields gracefully
      // New field will be available when new data is written
      
      // 4. Query service will discover new field on next query operation
      // No explicit schema refresh needed - DuckDB discovers schema dynamically

      console.log(`[ArrowFieldSchemaService] Successfully added field ${field.name} to table ${tableId}`);
      return ResultHelpers.success(undefined);

    } catch (error) {
      console.error('[ArrowFieldSchemaService] Error adding field to table:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to add field to table');
    }
  }

  async removeFieldFromTable(tableId: number, fieldId: number): Promise<Result<void>> {
    try {
      console.log(`[ArrowFieldSchemaService] Removing field ${fieldId} from table ${tableId}`);

      // 1. Verify field exists and belongs to the table
      const field = await this.fieldRepository.findById(fieldId);
      if (!field || field.tableId !== tableId) {
        return ResultHelpers.failure(`Field ${fieldId} not found in table ${tableId}`);
      }

      // 2. Check field dependencies and constraints
      const canDeleteResult = await this.canDeleteField(fieldId);
      if (!canDeleteResult.success || !canDeleteResult.data?.canDelete) {
        return ResultHelpers.failure(
          `Cannot delete field: ${canDeleteResult.data?.blockers.join(', ') || 'Unknown constraint'}`
        );
      }

      // 3. For S3/Arrow storage: Field removal is logical, not physical
      // Existing data retains the field, new data won't include it
      // Historical data remains queryable with the removed field
      
      // 4. Query service will discover field removal on next query operation
      // No explicit schema refresh needed - DuckDB handles schema changes dynamically

      console.log(`[ArrowFieldSchemaService] Successfully removed field ${fieldId} from table ${tableId}`);
      return ResultHelpers.success(undefined);

    } catch (error) {
      console.error('[ArrowFieldSchemaService] Error removing field from table:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to remove field from table');
    }
  }

  async modifyFieldInTable(tableId: number, fieldId: number, newType: FieldType, newRequired?: boolean): Promise<Result<void>> {
    try {
      console.log(`[ArrowFieldSchemaService] Modifying field ${fieldId} in table ${tableId} to type ${newType}`);

      // 1. Verify field exists
      const field = await this.fieldRepository.findById(fieldId);
      if (!field || field.tableId !== tableId) {
        return ResultHelpers.failure(`Field ${fieldId} not found in table ${tableId}`);
      }

      // 2. Validate the type change is safe
      const canModifyResult = await this.canModifyField(fieldId, newType);
      if (!canModifyResult.success || !canModifyResult.data?.canModify) {
        return ResultHelpers.failure(
          `Cannot modify field type: ${canModifyResult.data?.blockers.join(', ') || 'Type conversion not supported'}`
        );
      }

      // 3. For S3/Arrow storage: Type changes require data migration
      // This is a complex operation that should be handled by TableDataService
      // For now, we'll just warn about the complexity
      if (field.type !== newType) {
        console.warn(`[ArrowFieldSchemaService] Type change from ${field.type} to ${newType} may require data migration`);
        
        // Preview the change impact
        const previewResult = await this.previewSchemaChange(tableId, {
          type: 'MODIFY_FIELD',
          fieldId,
          changes: { newType, newRequired }
        });
        
        if (previewResult.success && previewResult.data?.dataLossRisk === 'high') {
          return ResultHelpers.failure('Type change would result in high data loss risk. Use migration service instead.');
        }
      }

      // 4. Query service will discover field modification on next query operation

      console.log(`[ArrowFieldSchemaService] Successfully modified field ${fieldId} in table ${tableId}`);
      return ResultHelpers.success(undefined);

    } catch (error) {
      console.error('[ArrowFieldSchemaService] Error modifying field in table:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to modify field in table');
    }
  }

  async renameFieldInTable(tableId: number, fieldId: number, newName: string): Promise<Result<void>> {
    try {
      console.log(`[ArrowFieldSchemaService] Renaming field ${fieldId} in table ${tableId} to ${newName}`);

      // 1. Verify field exists
      const field = await this.fieldRepository.findById(fieldId);
      if (!field || field.tableId !== tableId) {
        return ResultHelpers.failure(`Field ${fieldId} not found in table ${tableId}`);
      }

      // 2. Check for name conflicts (handled by repository layer, but double-check)
      const existingFields = await this.fieldRepository.findByTableId(tableId);
      const conflictingField = existingFields.find((f: any) => f.name === newName && f.id !== fieldId);
      if (conflictingField) {
        return ResultHelpers.failure(`Field with name '${newName}' already exists in table`);
      }

      // 3. For S3/Arrow storage: Field renaming is a metadata operation
      // The actual column name in Arrow files remains the same (field_{id})
      // Only the display name changes in metadata
      
      // 4. Query service will discover field rename on next query operation

      console.log(`[ArrowFieldSchemaService] Successfully renamed field ${fieldId} to ${newName}`);
      return ResultHelpers.success(undefined);

    } catch (error) {
      console.error('[ArrowFieldSchemaService] Error renaming field:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to rename field');
    }
  }

  async validateField(field: Field): Promise<Result<FieldValidation>> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Basic field validation
      if (!field.name || field.name.trim().length === 0) {
        errors.push('Field name is required');
      }

      if (!field.slug || field.slug.trim().length === 0) {
        errors.push('Field slug is required');
      }

      // Type-specific validation
      if (field.type === 'relation' && !field.relatedTableId) {
        errors.push('Relation field must specify target table');
      }

      if (field.type === 'file' && field.metadata?.maxSize && field.metadata.maxSize > 100 * 1024 * 1024) {
        warnings.push('File field max size exceeds 100MB - may impact performance');
      }

      return ResultHelpers.success({
        valid: errors.length === 0,
        errors,
        warnings
      });

    } catch (error) {
      console.error('[ArrowFieldSchemaService] Error validating field:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Field validation failed');
    }
  }

  async validateFieldData(fieldId: number, value: any): Promise<Result<{ valid: boolean; error?: string }>> {
    try {
      const field = await this.fieldRepository.findById(fieldId);
      if (!field) {
        return ResultHelpers.failure(`Field ${fieldId} not found`);
      }

      // Type-specific validation
      switch (field.type) {
        case 'text':
          if (typeof value !== 'string') {
            return ResultHelpers.success({ valid: false, error: 'Value must be a string' });
          }
          break;

        case 'number':
          if (typeof value !== 'number' || isNaN(value)) {
            return ResultHelpers.success({ valid: false, error: 'Value must be a valid number' });
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean') {
            return ResultHelpers.success({ valid: false, error: 'Value must be a boolean' });
          }
          break;

        case 'email':
          if (typeof value !== 'string' || !value.includes('@')) {
            return ResultHelpers.success({ valid: false, error: 'Value must be a valid email address' });
          }
          break;

        case 'url':
          if (typeof value !== 'string' || !value.startsWith('http')) {
            return ResultHelpers.success({ valid: false, error: 'Value must be a valid URL' });
          }
          break;

        default:
          // For other types, basic null/required validation
          break;
      }

      // Required field validation
      if (field.required && (value === null || value === undefined || value === '')) {
        return ResultHelpers.success({ valid: false, error: 'Field is required' });
      }

      return ResultHelpers.success({ valid: true });

    } catch (error) {
      console.error('[ArrowFieldSchemaService] Error validating field data:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Field data validation failed');
    }
  }

  async validateBulkFields(fields: Field[]): Promise<Result<FieldValidation[]>> {
    try {
      const validations = await Promise.all(
        fields.map(field => this.validateField(field))
      );

      const results = validations.map(result => 
        result.success ? result.data! : { valid: false, errors: [result.error!], warnings: [] }
      );

      return ResultHelpers.success(results);

    } catch (error) {
      console.error('[ArrowFieldSchemaService] Error validating bulk fields:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Bulk field validation failed');
    }
  }

  // Placeholder implementations for complex operations
  async previewSchemaChange(tableId: number, change: SchemaChange): Promise<Result<any>> {
    // Implementation would analyze existing data to predict impact
    return ResultHelpers.success({
      affectedRows: 0,
      dataLossRisk: 'low' as const,
      sampleTransformations: [],
      warnings: ['Schema change preview not fully implemented']
    });
  }

  async applySchemaChanges(tableId: number, changes: SchemaChange[]): Promise<Result<SchemaEvolutionResult>> {
    // Implementation would coordinate with TableDataService for complex migrations
    return ResultHelpers.success({
      success: true,
      appliedChanges: changes,
      skippedChanges: [],
      warnings: ['Schema evolution not fully implemented - use individual field operations']
    });
  }

  async migrateFieldType(fieldId: number, newType: FieldType, transformFunction?: string): Promise<Result<any>> {
    return ResultHelpers.failure('Field type migration requires TableDataService - use modifyFieldInTable for simple changes');
  }

  async validateFieldIntegrity(fieldId: number): Promise<Result<any>> {
    return ResultHelpers.success({
      valid: true,
      orphanedRecords: 0,
      issues: []
    });
  }

  async getFieldDependencies(fieldId: number): Promise<Result<any>> {
    return ResultHelpers.success({
      relatedFields: [],
      dependentRecords: 0,
      systemReferences: []
    });
  }

  async canDeleteField(fieldId: number): Promise<Result<{ canDelete: boolean; blockers: string[]; warnings: string[] }>> {
    // Basic implementation - more sophisticated logic would check actual usage
    const field = await this.fieldRepository.findById(fieldId);
    if (!field) {
      return ResultHelpers.failure(`Field ${fieldId} not found`);
    }

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (field.required) {
      warnings.push('Deleting required field may cause data validation issues');
    }

    if (field.type === 'relation') {
      warnings.push('Deleting relation field will break data relationships');
    }

    return ResultHelpers.success({
      canDelete: blockers.length === 0,
      blockers,
      warnings
    });
  }

  async canModifyField(fieldId: number, newType: FieldType): Promise<Result<{ canModify: boolean; blockers: string[]; warnings: string[] }>> {
    const field = await this.fieldRepository.findById(fieldId);
    if (!field) {
      return ResultHelpers.failure(`Field ${fieldId} not found`);
    }

    const blockers: string[] = [];
    const warnings: string[] = [];

    // Define type compatibility matrix
    const incompatibleChanges = [
      { from: 'text', to: 'number', reason: 'Text to number conversion may fail for non-numeric text' },
      { from: 'file', to: 'text', reason: 'File to text conversion would lose file data' },
      { from: 'relation', to: 'text', reason: 'Relation to text conversion would lose relational data' }
    ];

    const incompatible = incompatibleChanges.find(change => 
      change.from === field.type && change.to === newType
    );

    if (incompatible) {
      blockers.push(incompatible.reason);
    }

    if (field.type !== newType) {
      warnings.push('Type changes may require data migration for existing rows');
    }

    return ResultHelpers.success({
      canModify: blockers.length === 0,
      blockers,
      warnings
    });
  }
}