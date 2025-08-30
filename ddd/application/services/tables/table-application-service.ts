/**
 * Table Application Service
 * 
 * Orchestrates dynamic table operations with business logic and validation.
 * Handles table creation, updates, deletion, and access control.
 * 
 * AIDEV-NOTE: Application service for table management - handles business
 * rules, validation, and coordination between repositories
 */

import type { DynamicTableService } from '@/ddd/domain/tables/services/dynamic-table-service';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { DynamicTable, CreateDynamicTableData } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { generateTableName } from '@/utils/slugify';
import { OrganizationId, DatabaseId, UserId, TableId } from '@/ddd/domain/shared/value-objects';
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata';
import type { TableField, FieldType } from '@/ddd/domain/tables/value-objects/table-field';

export interface CreateTableCommand {
  name: string;
  databaseId: number;
  organizationId: number;
  createdBy: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTableCommand {
  id: number;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TableFilters {
  organizationId?: number;
  databaseId?: number;
  createdBy?: string;
}

// Field operation interfaces
export interface CreateFieldCommand {
  tableId: number;
  name: string;
  type: FieldType;
  required?: boolean;
  relatedTableId?: number;
  metadata?: Record<string, any>;
}

export interface UpdateFieldCommand {
  tableId: number;
  fieldName: string;
  name?: string;
  required?: boolean;
  type?: FieldType;
  metadata?: Record<string, any>;
}

export interface ReorderFieldsCommand {
  tableId: number;
  fieldOrders: Array<{ fieldName: string; orderIndex: number }>;
}

// Use unified Result interface from domain shared types
export type TableApplicationServiceResult<T = any> = Result<T>;

export class TableApplicationService {
  constructor(
    private readonly dynamicTableService: DynamicTableService,
    private readonly databaseRepository: IDatabaseRepository,
    private readonly organizationRepository: IOrganizationRepository
  ) {}

  /**
   * Create a new dynamic table
   */
  async createTable(command: CreateTableCommand): Promise<TableApplicationServiceResult<DynamicTable>> {
    try {
      // 1. Validate organization exists
      const organization = await this.organizationRepository.findById(OrganizationId.fromNumber(command.organizationId));
      if (!organization) {
        return {
          success: false,
          error: `Organization ${command.organizationId} not found`
        };
      }

      // 2. Validate database exists and belongs to organization
      const database = await this.databaseRepository.findById(command.databaseId);
      if (!database) {
        return {
          success: false,
          error: `Database ${command.databaseId} not found`
        };
      }

      if (database.organizationId !== command.organizationId) {
        return {
          success: false,
          error: 'Database does not belong to the specified organization'
        };
      }

      // 3. Create table metadata using TableMetadata value object
      let tableMetadata: TableMetadata | undefined = undefined;
      if (command.description || command.metadata) {
        const metadataResult = TableMetadata.fromPartial({
          description: command.description,
          metadata: command.metadata
        });
        if (!metadataResult.success) {
          return ResultHelpers.failure(`Invalid table metadata: ${metadataResult.error}`);
        }
        
        tableMetadata = metadataResult.data;
      }

      // 4. Create table using DynamicTableService
      const createTableCommand = {
        name: command.name,
        databaseId: DatabaseId.fromNumber(command.databaseId),
        organizationId: OrganizationId.fromNumber(command.organizationId),
        createdBy: UserId.fromString(command.createdBy),
        description: command.description,
        metadata: command.metadata
      };

      const createResult = await this.dynamicTableService.createTable(createTableCommand);
      if (!createResult.success) {
        return createResult;
      }
      
      if (!createResult.data) {
        return {
          success: false,
          error: 'Table creation succeeded but no table data returned'
        };
      }
      
      const newTable = createResult.data;

      console.log(`[TABLE-APP-SERVICE] Created table: ${newTable.name} (S3: ${newTable.storageLocation})`);

      return {
        success: true,
        data: newTable
      };

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error creating table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create table'
      };
    }
  }

  /**
   * Update an existing table
   */
  async updateTable(command: UpdateTableCommand): Promise<TableApplicationServiceResult<DynamicTable>> {
    try {
      // 1. Get existing table
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(command.id));
      if (!table) {
        return {
          success: false,
          error: `Table ${command.id} not found`
        };
      }

      // 2. Update table properties using business methods
      let hasChanges = false;
      
      if (command.name && command.name !== table.name) {
        table.updateName(command.name);
        hasChanges = true;
      }

      // Handle metadata updates using TableMetadata value object
      if (command.description !== undefined || command.metadata !== undefined) {
        // Start with existing metadata if available
        const existingMetadata = table.metadata;
        const existingExtra = existingMetadata?.getAllExtra() || {};
        
        const metadataResult = TableMetadata.create({
          description: command.description !== undefined ? command.description : existingMetadata?.description,
          extra: command.metadata ? { ...existingExtra, ...command.metadata } : existingExtra
        });
        if (!metadataResult.success) {
          return ResultHelpers.failure(`Invalid table metadata: ${metadataResult.error}`);
        }
        
        table.updateMetadata(metadataResult.data);
        hasChanges = true;
      }

      // 3. Update table if there are changes
      if (hasChanges) {
        const updateCommand = {
          id: table.id,
          name: command.name,
          description: command.description,
          metadata: command.metadata
        };
        const updateResult = await this.dynamicTableService.updateTable(updateCommand);
        if (!updateResult.success) {
          return updateResult;
        }
        
        if (!updateResult.data) {
          return {
            success: false,
            error: 'Update succeeded but no table data returned'
          };
        }
        
        console.log(`[TABLE-APP-SERVICE] Updated table: ${updateResult.data.name}`);
        
        return {
          success: true,
          data: updateResult.data
        };
      }

      return {
        success: true,
        data: table
      };

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error updating table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update table'
      };
    }
  }

  /**
   * Delete a table and all its associated data
   */
  async deleteTable(tableId: TableId): Promise<TableApplicationServiceResult<void>> {
    try {
      // 1. Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${tableId} not found`
        };
      }

      // 2. Check if table has any rows (optional - could be expensive)
      const hasData = await this.dynamicTableService.hasRows(tableId);
      if (hasData) {
        console.warn(`[TABLE-APP-SERVICE] Deleting table ${table.name} with existing data`);
      }

      // 3. Fields are now part of table aggregate - deletion handled by table service
      // 4. Delete the table (handles both metadata, fields, and physical table)
      const deleteResult = await this.dynamicTableService.deleteTable(tableId);
      if (!deleteResult.success) {
        return deleteResult;
      }

      console.log(`[TABLE-APP-SERVICE] Deleted table: ${table.name} (S3: ${table.storageLocation})`);

      return {
        success: true
      };

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error deleting table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete table'
      };
    }
  }

  /**
   * Get table by ID
   */
  async getTable(tableId: TableId): Promise<DynamicTable | null> {
    return await this.dynamicTableService.getTable(tableId);
  }

  /**
   * Get tables for an organization
   */
  async getTablesForOrganization(organizationId: OrganizationId): Promise<DynamicTable[]> {
    return await this.dynamicTableService.getTablesByOrganization(organizationId);
  }

  // =====================================
  // FIELD OPERATIONS (consolidated)
  // =====================================

  /**
   * Create a new field for a table using table aggregate
   */
  async createField(command: CreateFieldCommand): Promise<TableApplicationServiceResult<TableField>> {
    try {
      // 1. Get table and verify it exists
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(command.tableId));
      if (!table) {
        return ResultHelpers.failure(`Table ${command.tableId} not found`);
      }

      // 2. Validate related table if it's a relation field
      if (command.type === 'relation' && command.relatedTableId) {
        const relatedTable = await this.dynamicTableService.getTable(TableId.fromNumber(command.relatedTableId));
        if (!relatedTable) {
          return ResultHelpers.failure(`Related table ${command.relatedTableId} not found`);
        }

        // Ensure related table is in the same organization
        if (!relatedTable.organizationId.equals(table.organizationId)) {
          return ResultHelpers.failure('Related table must be in the same organization');
        }
      }

      // 3. Calculate order index based on existing fields
      const orderIndex = table.fields.length;

      // 4. Add field to table using domain method
      const addResult = table.addField({
        name: command.name,
        type: command.type,
        orderIndex,
        relatedTableId: command.relatedTableId ? TableId.fromNumber(command.relatedTableId) : undefined,
        required: command.required || false,
        metadata: command.metadata
      });

      if (!addResult.success) {
        return ResultHelpers.failure(addResult.error || 'Failed to add field to table');
      }

      // 5. Save the updated table with its fields
      const saveResult = await this.dynamicTableService.saveTable(table);
      if (!saveResult.success) {
        return ResultHelpers.failure(saveResult.error || 'Failed to save table with new field');
      }

      // 6. Get the newly added field
      const newField = table.getField(command.name);
      if (!newField) {
        return ResultHelpers.failure('Field was added but could not be retrieved');
      }

      console.log(`[TABLE-APP-SERVICE] Created field: ${newField.name} (${newField.type}) for table ${table.name}`);

      return ResultHelpers.success(newField);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error creating field:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to create field');
    }
  }

  /**
   * Update an existing field using table aggregate
   */
  async updateField(command: UpdateFieldCommand): Promise<TableApplicationServiceResult<TableField>> {
    try {
      // 1. Get table and verify it exists
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(command.tableId));
      if (!table) {
        return ResultHelpers.failure(`Table ${command.tableId} not found`);
      }

      // 2. Check if field exists
      const existingField = table.getField(command.fieldName);
      if (!existingField) {
        return ResultHelpers.failure(`Field '${command.fieldName}' not found in table`);
      }

      // 3. Handle required flag change - check if table has rows
      if (command.required !== undefined && command.required !== existingField.required) {
        if (command.required) {
          const hasRows = await this.dynamicTableService.hasRows(table.id);
          if (hasRows) {
            return ResultHelpers.failure('Cannot make field required when table has existing data');
          }
        }
      }

      // 4. Update field using table domain method
      const updateResult = table.updateField(command.fieldName, {
        name: command.name,
        type: command.type,
        required: command.required,
        metadata: command.metadata
      });

      if (!updateResult.success) {
        return ResultHelpers.failure(updateResult.error || 'Failed to update field');
      }

      // 5. Save the updated table
      const saveResult = await this.dynamicTableService.updateTable(table);
      if (!saveResult.success) {
        return ResultHelpers.failure(saveResult.error || 'Failed to save table with updated field');
      }

      // 6. Get the updated field (name might have changed)
      const fieldName = command.name || command.fieldName;
      const updatedField = table.getField(fieldName);
      if (!updatedField) {
        return ResultHelpers.failure('Field was updated but could not be retrieved');
      }

      console.log(`[TABLE-APP-SERVICE] Updated field: ${updatedField.name}`);
      return ResultHelpers.success(updatedField);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error updating field:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to update field');
    }
  }

  /**
   * Delete a field from a table using table aggregate
   */
  async deleteField(tableId: number, fieldName: string): Promise<TableApplicationServiceResult<void>> {
    try {
      // 1. Get table and verify it exists
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(tableId));
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId} not found`);
      }

      // 2. Verify field exists
      const field = table.getField(fieldName);
      if (!field) {
        return ResultHelpers.failure(`Field '${fieldName}' not found in table`);
      }

      // 3. Check if table has rows - deletion might require data migration
      const hasRows = await this.dynamicTableService.hasRows(table.id);
      if (hasRows) {
        console.warn(`[TABLE-APP-SERVICE] Deleting field '${fieldName}' from table with existing data`);
      }

      // 4. Remove field from table using domain method
      const removeResult = table.removeField(fieldName);
      if (!removeResult.success) {
        return ResultHelpers.failure(removeResult.error || 'Failed to remove field from table');
      }

      // 5. Save the updated table
      const saveResult = await this.dynamicTableService.updateTable(table);
      if (!saveResult.success) {
        return ResultHelpers.failure(saveResult.error || 'Failed to save table after field removal');
      }

      console.log(`[TABLE-APP-SERVICE] Deleted field: ${fieldName} from table ${table.name}`);
      return ResultHelpers.success(undefined);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error deleting field:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to delete field');
    }
  }

  /**
   * Get fields for a table using table aggregate
   */
  async getFieldsForTable(tableId: number): Promise<TableField[]> {
    try {
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(tableId));
      if (!table) {
        return [];
      }

      // Return fields sorted by order index
      return [...table.fields].sort((a, b) => a.orderIndex - b.orderIndex);
    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error getting fields for table:', error);
      return [];
    }
  }

  /**
   * Validate field value based on field type using TableField value object
   */
  validateFieldValue(field: TableField, value: any): { valid: boolean; error?: string } {
    // Handle null/undefined
    if (value === null || value === undefined) {
      if (field.required) {
        return { valid: false, error: `Field "${field.name}" is required` };
      }
      return { valid: true };
    }

    // Type-specific validation
    switch (field.type) {
      case 'text':
      case 'email':
      case 'url':
        if (typeof value !== 'string') {
          return { valid: false, error: `Field "${field.name}" must be a string` };
        }
        
        if (field.type === 'email' && value) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return { valid: false, error: `Field "${field.name}" must be a valid email` };
          }
        }
        
        if (field.type === 'url' && value) {
          try {
            new URL(value);
          } catch {
            return { valid: false, error: `Field "${field.name}" must be a valid URL` };
          }
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: `Field "${field.name}" must be a number` };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: false, error: `Field "${field.name}" must be a boolean` };
        }
        break;

      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return { valid: false, error: `Field "${field.name}" must be a valid date` };
        }
        break;

      case 'relation':
        // Relation fields store JSONB data
        if (typeof value !== 'object') {
          return { valid: false, error: `Field "${field.name}" must be an object` };
        }
        break;

      case 'file':
        // File fields store file metadata as JSONB
        if (typeof value !== 'object') {
          return { valid: false, error: `Field "${field.name}" must be a file object` };
        }
        break;

      default:
        return { valid: false, error: `Unknown field type: ${field.type}` };
    }

    return { valid: true };
  }

  /**
   * Batch validate multiple field values using table aggregate
   */
  async validateRowData(tableId: number, data: Record<string, any>): Promise<{
    valid: boolean;
    errors: Array<{ field: string; error: string }>;
  }> {
    try {
      const table = await this.dynamicTableService.getTable(TableId.fromNumber(tableId));
      if (!table) {
        return {
          valid: false,
          errors: [{ field: 'table', error: `Table ${tableId} not found` }]
        };
      }

      const errors: Array<{ field: string; error: string }> = [];

      // Validate each field value
      for (const field of table.fields) {
        const value = data[field.name]; // Use field name instead of slug
        const validation = this.validateFieldValue(field, value);
        
        if (!validation.valid && validation.error) {
          errors.push({ field: field.name, error: validation.error });
        }
      }

      // Check for required fields that are missing
      for (const field of table.fields) {
        if (field.required && !(field.name in data)) {
          errors.push({ field: field.name, error: `Field "${field.name}" is required` });
        }
      }

      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error validating row data:', error);
      return {
        valid: false,
        errors: [{ field: 'system', error: error instanceof Error ? error.message : 'Validation failed' }]
      };
    }
  }
  
}