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
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { OrganizationId, DatabaseId, UserId, TableId } from '@/ddd/domain/shared/value-objects';
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata';
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { type FileFieldValue, isFileArray } from '@/ddd/domain/tables/value-objects/field-values';
import { Row, RowId } from '@/ddd/domain/tables/value-objects/row';
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence';
import { createDebugLogger } from '@/lib/utils/debug-logger';
import type { ITriggerMatchingService } from '@/ddd/domain/scheduling/services/trigger-matching-service';
import type { TableChangeEvent } from '@/ddd/domain/scheduling/types/scheduling-types';
import type { DatabaseOperation } from '@/ddd/domain/scheduling/value-objects/trigger-config';
import type { ITaskRepository, CreateTaskData } from '@/ddd/domain/tasks/repositories/task-repository';
import { type TriggerContext } from '@/ddd/domain/tasks/entities/task';
import { TaskId } from '@/ddd/domain/tasks/value-objects/task-id';
import { AutoFieldProcessor } from './auto-field-processor';

const logger = createDebugLogger('TableService');

// Application-layer context type for files with table information
interface FileWithTableContext {
  file: FileFieldValue;           // Pure domain type
  tableId: TableId;               // Domain value object
  tableName: string;
  fieldId: number;                // Field ID (primitive as per current pattern)
  fieldName: string;
  databaseId: DatabaseId;         // Domain value object  
  organizationId: OrganizationId; // Domain value object
}

// No need for TableWithFieldsContext - DynamicTable already has fields getter

export interface CreateTableCommand {
  name: string;
  databaseId: DatabaseId;
  organizationId: OrganizationId;
  ownerId: UserId;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTableCommand {
  id: TableId;
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
}

// AIDEV-NOTE: Repository DTOs moved from entity file - these should eventually be replaced
// with proper domain value objects or entity factory methods
export interface CreateDynamicTableData {
  databaseId: DatabaseId;
  organizationId: OrganizationId;
  name: string;
  description?: string;
  storageLocation: string;             // Generated storage location (S3 path, table name, etc.)
  metadata?: TableMetadata;
  ownerId: UserId;
}

// Field operation interfaces
export interface CreateFieldCommand {
  tableId: TableId;
  name: string;
  type: FieldType;
  required?: boolean;
  relatedTableId?: TableId;
  metadata?: Record<string, any>;
}

export interface UpdateFieldCommand {
  tableId: TableId;
  fieldName: string;
  name?: string;
  required?: boolean;
  type?: FieldType;
  metadata?: Record<string, any>;
}

export interface ReorderFieldsCommand {
  tableId: TableId;
  fieldOrders: Array<{ fieldName: string; orderIndex: number }>;
}

// Row operation commands
export interface CreateRowCommand {
  tableId: TableId;
  data: Row;
  createdBy?: UserId;
}

export interface CreateRowsCommand {
  tableId: TableId;
  rows: Row[];
  createdBy?: UserId;
}

export interface UpdateRowCommand {
  tableId: TableId;
  rowId: RowId;
  data: Row;
  updatedBy?: UserId;
}

export interface BulkCreateRowsCommand {
  tableId: TableId;
  rows: Row[];
  createdBy?: UserId;
}

export interface BulkUpdateRowsCommand {
  tableId: TableId;
  updates: Array<{
    rowId: RowId;
    data: Row;
  }>;
  updatedBy?: UserId;
}

export interface SearchTableRowsCommand {
  tableId: TableId;
  query: string;
  limit?: number;
  organizationId: OrganizationId;
}

// Use unified Result interface from domain shared types
export type TableApplicationServiceResult<T = any> = Result<T>;

export class TableApplicationService {
  private readonly autoFieldProcessor: AutoFieldProcessor;

  constructor(
    private readonly dynamicTableService: DynamicTableService,
    private readonly databaseRepository: IDatabaseRepository,
    private readonly organizationRepository: IOrganizationRepository,
    private readonly dynamicTableRepository: IDynamicTableRepository,
    private readonly triggerMatchingService?: ITriggerMatchingService,
    private readonly taskRepository?: ITaskRepository
  ) {
    // AIDEV-NOTE: Initialize AutoFieldProcessor for handling auto-generated fields
    // (created-at, last-updated, autonumber)
    this.autoFieldProcessor = new AutoFieldProcessor();
  }

  /**
   * Create a new dynamic table
   */
  async createTable(command: CreateTableCommand): Promise<TableApplicationServiceResult<DynamicTable>> {
    try {
      // 1. Validate organization exists
      const organization = await this.organizationRepository.findById(command.organizationId);
      if (!organization) {
        return {
          success: false,
          error: `Organization ${command.organizationId.value} not found`
        };
      }

      // 2. Validate database exists and belongs to organization
      const database = await this.databaseRepository.findById(command.databaseId);
      if (!database) {
        return {
          success: false,
          error: `Database ${command.databaseId.value} not found`
        };
      }

      if (!database.organizationId.equals(command.organizationId)) {
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
        databaseId: command.databaseId,
        organizationId: command.organizationId,
        ownerId: command.ownerId,
        description: command.description,
        metadata: tableMetadata
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

      logger.summary(`Created table: ${newTable.name} (S3: ${newTable.storageLocation})`);

      return {
        success: true,
        data: newTable
      };

    } catch (error) {
      logger.error('Error creating table:', error);
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
      const table = await this.dynamicTableService.getTable(command.id);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.id.value} not found`
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
          metadata: table.metadata
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
        
        logger.summary(`Updated table: ${updateResult.data.name}`);
        
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
      logger.error('Error updating table:', error);
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
        logger.debug(`Deleting table ${table.name} with existing data`);
      }

      const deleteResult = await this.dynamicTableService.deleteTable(tableId);
      if (!deleteResult.success) {
        return deleteResult;
      }

      logger.summary(`Deleted table: ${table.name} (S3: ${table.storageLocation})`);

      return {
        success: true
      };

    } catch (error) {
      logger.error('Error deleting table:', error);
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

  /**
   * Create a new field for a table using table aggregate
   */
  async createField(command: CreateFieldCommand): Promise<TableApplicationServiceResult<TableField>> {
    try {
      // 1. Get table and verify it exists
      const table = await this.dynamicTableService.getTable(command.tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${command.tableId.value} not found`);
      }

      // 2. Validate related table if it's a relation field
      if (command.type === 'relation' && command.relatedTableId) {
        const relatedTable = await this.dynamicTableService.getTable(command.relatedTableId);
        if (!relatedTable) {
          return ResultHelpers.failure(`Related table ${command.relatedTableId.value} not found`);
        }

        // Ensure related table is in the same organization
        if (!relatedTable.organizationId.equals(table.organizationId)) {
          return ResultHelpers.failure('Related table must be in the same organization');
        }
      }

      // 3. Validate field name is not reserved (especially 'id')
      // AIDEV-NOTE: 'id' is reserved for the system row identifier (UUID column)
      if (command.name.toLowerCase() === 'id') {
        return ResultHelpers.failure(`Field name 'id' is reserved for the system row identifier. Please choose a different name.`);
      }

      // 4. Calculate order index based on existing fields
      const orderIndex = table.fields.length;

      // 5. Validate field name uniqueness (business logic moved from entity)
      if (table.hasField(command.name)) {
        return ResultHelpers.failure(`Field name '${command.name}' already exists`);
      }

      // 6. Create field using domain factory
      const field = TableField.create({
        name: command.name,
        type: command.type,
        orderIndex,
        relatedTableId: command.relatedTableId,
        required: command.required || false,
        metadata: command.metadata
      });

      // 7. Add field to table using internal method
      table.addField(field);

      // 8. Save the updated table with its fields
      const saveResult = await this.dynamicTableService.saveTable(table);
      if (!saveResult.success) {
        return ResultHelpers.failure(saveResult.error || 'Failed to save table with new field');
      }

      // 9. Get the newly added field
      const newField = table.getField(command.name);
      if (!newField) {
        return ResultHelpers.failure('Field was added but could not be retrieved');
      }

      logger.summary(`Created field: ${newField.name} (${newField.type}) for table ${table.name}`);

      return ResultHelpers.success(newField);

    } catch (error) {
      logger.error('Error creating field:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to create field');
    }
  }

  /**
   * Update an existing field using table aggregate
   */
  async updateField(command: UpdateFieldCommand): Promise<TableApplicationServiceResult<TableField>> {
    try {
      // 1. Get table and verify it exists
      const table = await this.dynamicTableService.getTable(command.tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${command.tableId.value} not found`);
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

      // 4. Validate field name uniqueness if changing name
      if (command.name && command.name !== command.fieldName) {
        if (table.hasField(command.name)) {
          return ResultHelpers.failure(`Field name '${command.name}' already exists`);
        }
      }

      // 5. Create updated field
      let updatedField = existingField;
      if (command.name) updatedField = updatedField.updateName(command.name);
      if (command.type) updatedField = updatedField.updateType(command.type);
      if (command.required !== undefined) updatedField = updatedField.updateRequired(command.required);
      if (command.metadata !== undefined) updatedField = updatedField.updateMetadata(command.metadata);

      // 6. Update field in table using internal method
      table.updateField(existingField.id, updatedField);

      console.log('[updateField] Calling saveTable with updated field', {
        fieldName: updatedField.name,
        fieldId: updatedField.id.value,
        hasMetadata: !!updatedField.metadata,
        metadataKeys: updatedField.metadata ? Object.keys(updatedField.metadata) : []
      });

      // 7. Save the updated table (use saveTable to persist field changes)
      const saveResult = await this.dynamicTableService.saveTable(table);
      if (!saveResult.success) {
        return ResultHelpers.failure(saveResult.error || 'Failed to save table with updated field');
      }

      // 6. Get the updated field (name might have changed)
      const fieldName = command.name || command.fieldName;
      const finalField = table.getField(fieldName);
      if (!finalField) {
        return ResultHelpers.failure('Field was updated but could not be retrieved');
      }

      logger.summary(`Updated field: ${finalField.name}`);
      return ResultHelpers.success(finalField);

    } catch (error) {
      logger.error('Error updating field:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to update field');
    }
  }

  /**
   * Delete a field from a table using table aggregate
   */
  async deleteField(tableId: TableId, fieldName: string): Promise<TableApplicationServiceResult<void>> {
    try {
      // 1. Get table and verify it exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // 2. Verify field exists
      const field = table.getField(fieldName);
      if (!field) {
        return ResultHelpers.failure(`Field '${fieldName}' not found in table`);
      }

      // 3. Check if table has rows - deletion might require data migration
      const hasRows = await this.dynamicTableService.hasRows(table.id);
      if (hasRows) {
        logger.debug(`Deleting field '${fieldName}' from table with existing data`);
      }

      // 4. Remove field from table using internal method
      table.removeField(field.id);
      console.log(`[deleteField] After removeField - table has ${table.fields.length} fields`);

      // 5. Save the updated table (use saveTable to persist field changes)
      const saveResult = await this.dynamicTableService.saveTable(table);
      if (!saveResult.success) {
        return ResultHelpers.failure(saveResult.error || 'Failed to save table after field removal');
      }

      logger.summary(`Deleted field: ${fieldName} from table ${table.name}`);
      return ResultHelpers.success(undefined);

    } catch (error) {
      logger.error('Error deleting field:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to delete field');
    }
  }

  /**
   * Reorder fields in a table
   * Updates the orderIndex of fields based on the provided field orders
   * OPTIMIZED: Uses batch update instead of N+1 operations
   */
  async reorderFields(command: ReorderFieldsCommand): Promise<TableApplicationServiceResult<void>> {
    try {
      // 1. Get table and verify it exists
      const table = await this.dynamicTableService.getTable(command.tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${command.tableId.value} not found`);
      }

      // 2. Validate all field names exist in the table
      const tableFieldNames = table.fields.map(f => f.name);
      const commandFieldNames = command.fieldOrders.map(fo => fo.fieldName);
      
      for (const fieldName of commandFieldNames) {
        if (!tableFieldNames.includes(fieldName)) {
          return ResultHelpers.failure(`Field '${fieldName}' not found in table`);
        }
      }

      // 3. Simplified validation - only check for duplicate order indices
      const orderIndices = command.fieldOrders.map(fo => fo.orderIndex);
      const uniqueOrders = new Set(orderIndices);
      if (uniqueOrders.size !== orderIndices.length) {
        return ResultHelpers.failure('Order indices must be unique');
      }

      // 4. OPTIMIZED: Use batch update instead of N+1 operations
      // Direct repository call for efficient bulk order update
      await this.dynamicTableRepository.updateFieldOrders(command.tableId, command.fieldOrders);

      logger.summary(`Batch reordered ${command.fieldOrders.length} fields in table ${table.name}`);
      return ResultHelpers.success(undefined);

    } catch (error) {
      logger.error('Error reordering fields:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to reorder fields');
    }
  }

  /**
   * Get fields for a table using table aggregate
   */
  async getFieldsForTable(tableId: TableId): Promise<TableField[]> {
    try {
      logger.debug('getFieldsForTable called', { tableId: tableId.value });

      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        logger.debug('Table not found', { tableId: tableId.value });
        return [];
      }

      logger.debug('Table found', {
        id: table.id.value,
        name: table.name,
        fieldsCount: table.fields.length
      });

      // Return fields sorted by order index (handle nullable orderIndex)
      const sortedFields = [...table.fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

      logger.debug('Fields sorted', { count: sortedFields.length });
      
      return sortedFields;
    } catch (error) {
      logger.error('Error getting fields for table:', error);
      return [];
    }
  }

  /**
   * Get all files stored in organization tables
   * Used by RAG indexing to discover files for content processing
   */
  async getFilesForOrganization(organizationId: OrganizationId): Promise<FileWithTableContext[]> {
    try {
      // 1. Get all tables for the organization
      const tables = await this.dynamicTableRepository.findByOrganization(organizationId);
      
      if (tables.length === 0) {
        logger.summary(`No tables found for organization ${organizationId.value}`);
        return [];
      }

      logger.summary(`Found ${tables.length} tables for organization ${organizationId.value}`);

      const allFiles: FileWithTableContext[] = [];

      // 2. Process each table
      for (const table of tables) {
        try {
          // Find file fields in this table
          const fileFields = table.fields.filter(field => field.type === 'file');
          
          if (fileFields.length === 0) {
            continue;
          }

          logger.summary(`Found ${fileFields.length} file fields in table ${table.name}`);

          // Get all rows from the table (using high limit for file cleanup operation)
          const rows = await this.dynamicTableRepository.getRows(table.id, { limit: 10000, offset: 0 });
          
          // Extract file values from each row
          for (const row of rows) {
            for (const field of fileFields) {
              const fieldValue = row.getFieldValue(field.id.value.toString());
              
              // Check if the field contains files
              if (isFileArray(fieldValue)) {
                for (const file of fieldValue) {
                  // Create context object with domain value objects
                  allFiles.push({
                    file: file,                    // Pure domain type
                    tableId: table.id,            // Domain value object
                    tableName: table.name,
                    fieldId: field.id.value,            // Primitive as per current pattern
                    fieldName: field.name,
                    databaseId: table.databaseId, // Domain value object
                    organizationId: table.organizationId // Domain value object
                  });
                }
              }
            }
          }
        } catch (error) {
          logger.error(`Error processing table ${table.name}`, error);
          // Continue with other tables
        }
      }

      logger.summary(`Found ${allFiles.length} files across ${tables.length} tables`);
      return allFiles;

    } catch (error) {
      logger.error('Error getting files for organization:', error);
      return [];
    }
  }

  /**
   * Get all tables with their fields for an organization
   * Used by RAG indexing to get table metadata (not row data)
   */
  async getTablesWithFieldsForOrganization(organizationId: OrganizationId): Promise<DynamicTable[]> {
    try {
      // Get all tables for organization - tables already contain their fields
      const tables = await this.dynamicTableRepository.findByOrganization(organizationId);
      
      logger.summary(`Found ${tables.length} tables with fields for organization ${organizationId.value}`);
      
      return tables;
    } catch (error) {
      logger.error('Error getting tables with fields for organization:', error);
      return [];
    }
  }

  // ========================================
  // Row Operations (replacing TableRowDomainService)
  // ========================================

  /**
   * Validate relation fields in a row
   */
  private async validateRelationFields(
    table: any, // DynamicTable type
    data: any // Row type
  ): Promise<{ valid: boolean; error?: string }> {
    const relationFields = table.fields.filter((field: any) => field.type === 'relation');

    for (const field of relationFields) {
      if (!field.relatedTableId) {
        continue;
      }

      const fieldValue = data.getFieldValue(field.id.value.toString());
      if (!fieldValue || fieldValue.isNull()) {
        if (field.required) {
          return { valid: false, error: `${field.name} is required` };
        }
        continue;
      }

      const relations = fieldValue.value as any[];
      
      // Validate each relation ID exists
      for (const relation of relations) {
        const row = await this.dynamicTableRepository.getRow(
          field.relatedTableId!,
          relation.id.toString()
        );
        
        if (!row) {
          return { 
            valid: false, 
            error: `Related record ${relation.id} not found in table ${field.relatedTableId.value}` 
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Create a new row in a table
   */
  async createRow(command: CreateRowCommand): Promise<TableApplicationServiceResult<Row>> {
    try {
      const { tableId, data } = command;

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // AIDEV-NOTE: Process auto-fields BEFORE storing to data lake
      // Use plain object with field IDs to prevent field name/ID conversion bugs
      const plainData = data.toPlainObject(table.fields);
      const enrichedPlainData = this.autoFieldProcessor.processAutoFields(
        table,
        plainData,
        'create'
      );
      const enrichedRow = Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);

      // Validate relation fields
      const relationValidation = await this.validateRelationFields(table, enrichedRow);
      if (!relationValidation.valid) {
        return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
      }

      // Insert single row using batch method
      const rows = await this.dynamicTableRepository.insertRows(tableId, [enrichedRow]);
      const createdRow = rows[0];

      // Emit table trigger event (non-blocking)
      await this.handleTableTriggers({
        tableId: tableId.value,
        tableName: table.name,
        operation: 'INSERT',
        organizationId: table.organizationId,
        rowId: createdRow.id.value,
        rowData: createdRow.toPlainObject(table.fields),
        timestamp: new Date()
      });

      return ResultHelpers.success(createdRow);

    } catch (error) {
      logger.error('Error creating row:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to create row');
    }
  }

  /**
   * Create multiple rows in a table (batch operation)
   */
  async createRows(command: CreateRowsCommand): Promise<TableApplicationServiceResult<Row[]>> {
    try {
      const { tableId, rows } = command;

      if (rows.length === 0) {
        return ResultHelpers.success([]);
      }

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // AIDEV-NOTE: Process auto-fields for all rows in batch
      // Each row gets its own created-at timestamp and sequential autonumber
      // Use plain object with field IDs to prevent field name/ID conversion bugs
      const enrichedRows = rows.map(row => {
        const plainData = row.toPlainObject(table.fields);
        const enrichedPlainData = this.autoFieldProcessor.processAutoFields(table, plainData, 'create');
        return Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);
      });

      // Validate relation fields for all enriched rows
      for (const row of enrichedRows) {
        const relationValidation = await this.validateRelationFields(table, row);
        if (!relationValidation.valid) {
          return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
        }
      }

      // Batch insert all rows in single gRPC call
      const createdRows = await this.dynamicTableRepository.insertRows(tableId, enrichedRows);

      // Emit table trigger events for each created row (non-blocking)
      // AIDEV-NOTE: For bulk operations, emit event per row to allow fine-grained agent triggering
      for (const createdRow of createdRows) {
        await this.handleTableTriggers({
          tableId: tableId.value,
          tableName: table.name,
          operation: 'INSERT',
          organizationId: table.organizationId,
          rowId: createdRow.id.value,
          rowData: createdRow.toPlainObject(table.fields),
          timestamp: new Date()
        });
      }

      return ResultHelpers.success(createdRows);

    } catch (error) {
      logger.error('Error creating rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to create rows');
    }
  }

  /**
   * Update an existing row in a table
   */
  async updateRow(command: UpdateRowCommand): Promise<TableApplicationServiceResult<Row>> {
    try {
      const { tableId, rowId, data } = command;

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Get previous row data for UPDATE trigger event and watchFields comparison
      const previousRow = await this.dynamicTableRepository.getRow(tableId, rowId.value);

      // AIDEV-NOTE: Process auto-fields for updates (last-updated timestamps)
      // Use plain object with field IDs to prevent field name/ID conversion bugs
      const plainData = data.toPlainObject(table.fields);
      const enrichedPlainData = this.autoFieldProcessor.processAutoFields(
        table,
        plainData,
        'update',
        previousRow?.toPlainObject(table.fields)
      );
      const enrichedRow = Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);

      // Validate relation fields
      const relationValidation = await this.validateRelationFields(table, enrichedRow);
      if (!relationValidation.valid) {
        return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
      }

      // Update single row using batch method
      const updatedRows = await this.dynamicTableRepository.updateRows(tableId, [{
        rowId: rowId.value,
        row: enrichedRow
      }]);
      const updatedRow = updatedRows[0];

      // Emit table trigger event (non-blocking)
      await this.handleTableTriggers({
        tableId: tableId.value,
        tableName: table.name,
        operation: 'UPDATE',
        organizationId: table.organizationId,
        rowId: updatedRow.id.value,
        rowData: updatedRow.toPlainObject(table.fields),
        previousRowData: previousRow?.toPlainObject(table.fields),
        timestamp: new Date()
      });

      return ResultHelpers.success(updatedRow);

    } catch (error) {
      logger.error('Error updating row:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to update row');
    }
  }

  /**
   * Update multiple rows in a table (bulk update)
   * OPTIMIZED: Single transaction, single Delta Lake merge operation
   */
  async updateRows(command: BulkUpdateRowsCommand): Promise<TableApplicationServiceResult<Row[]>> {
    try {
      const { tableId, updates } = command;

      if (updates.length === 0) {
        return ResultHelpers.success([]);
      }

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // AIDEV-NOTE: Process auto-fields for bulk updates
      // For performance, we don't fetch previous row data for watchFields comparison in bulk updates
      // All last-updated fields will be updated
      //
      // CRITICAL FIX: Use toPlainObject/fromPlainObject to work with field IDs throughout
      // This prevents field name/ID conversion bugs that corrupt single-select values
      const enrichedUpdates = updates.map(update => {
        const plainData = update.data.toPlainObject(table.fields); // {2: 1} not {singleSelect: 1}
        logger.debug('[updateRows] Row before auto-field processing', {
          rowId: update.rowId.value,
          plainDataKeys: Object.keys(plainData),
          sampleFieldId: Object.keys(plainData)[1],
          sampleValue: plainData[Object.keys(plainData)[1]]
        });
        const enrichedPlainData = this.autoFieldProcessor.processAutoFields(table, plainData, 'update');
        const enrichedRow = Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);
        return {
          rowId: update.rowId,
          data: enrichedRow
        };
      });

      // Validate relation fields for all enriched rows
      for (const update of enrichedUpdates) {
        const relationValidation = await this.validateRelationFields(table, update.data);
        if (!relationValidation.valid) {
          return ResultHelpers.failure(
            `Relation validation failed for row ${update.rowId.value}: ${relationValidation.error}`
          );
        }
      }

      // Fetch previous row data for all rows being updated (needed for UPDATE trigger events)
      const previousRows = await Promise.all(
        enrichedUpdates.map(update => 
          this.dynamicTableRepository.getRow(tableId, update.rowId.value)
        )
      );
      const previousRowsMap = new Map(
        previousRows.filter(row => row !== null).map(row => [row!.id.value, row])
      );

      // Bulk update using repository (single Delta Lake merge)
      const updatedRows = await this.dynamicTableRepository.updateRows(
        tableId,
        enrichedUpdates.map(u => ({
          rowId: u.rowId.value,
          row: u.data
        }))
      );

      // Emit table trigger events for each updated row (non-blocking)
      // AIDEV-NOTE: For bulk operations, emit event per row to allow fine-grained agent triggering
      for (const updatedRow of updatedRows) {
        const previousRow = previousRowsMap.get(updatedRow.id.value);
        await this.handleTableTriggers({
          tableId: tableId.value,
          tableName: table.name,
          operation: 'UPDATE',
          organizationId: table.organizationId,
          rowId: updatedRow.id.value,
          rowData: updatedRow.toPlainObject(table.fields),
          previousRowData: previousRow?.toPlainObject(table.fields),
          timestamp: new Date()
        });
      }

      logger.summary('Bulk update completed', {
        rows: updatedRows.length,
        tableId: tableId.value
      });
      return ResultHelpers.success(updatedRows);

    } catch (error) {
      logger.error('Error bulk updating rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to bulk update rows');
    }
  }

  /**
   * Delete a row from a table
   */
  async deleteRow(tableId: TableId, rowId: RowId): Promise<TableApplicationServiceResult<void>> {
    try {
      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Get row data before deletion for DELETE trigger event
      const rowToDelete = await this.dynamicTableRepository.getRow(tableId, rowId.value);

      // Delete row using repository (pass as single-element array)
      await this.dynamicTableRepository.deleteRows(tableId, [rowId.value]);

      // Emit table trigger event (non-blocking)
      if (rowToDelete) {
        await this.handleTableTriggers({
          tableId: tableId.value,
          tableName: table.name,
          operation: 'DELETE',
          organizationId: table.organizationId,
          rowId: rowId.value,
          rowData: rowToDelete.toPlainObject(table.fields),
          timestamp: new Date()
        });
      }

      return ResultHelpers.success(undefined);

    } catch (error) {
      logger.error('Error deleting row:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to delete row');
    }
  }

  /**
   * Get a single row from a table
   */
  async getRow(tableId: TableId, rowId: RowId): Promise<Row | null> {
    try {
      return await this.dynamicTableRepository.getRow(tableId, rowId.value);
    } catch (error) {
      logger.error('Error getting row:', error);
      return null;
    }
  }

  /**
   * Get rows from a table with pagination
   */
  async getRows(tableId: TableId, options: RowQueryOptions): Promise<Row[]> {
    try {
      return await this.dynamicTableRepository.getRows(tableId, options);
    } catch (error) {
      logger.error('Error getting rows:', error);
      return [];
    }
  }

  /**
   * Get rows using pre-fetched table data (bypasses findById)
   * Used for public view access where table metadata is already fetched via rawDb
   *
   * AIDEV-NOTE: This method accepts table metadata directly, bypassing RLS.
   * The actual row retrieval goes to Delta Lake which has no RLS.
   */
  async getRowsWithTableData(
    tableData: { tableId: number; s3Path: string; organizationId: number; databaseId: number },
    fields: TableField[],
    options: RowQueryOptions
  ): Promise<Row[]> {
    try {
      return await this.dynamicTableRepository.getRowsWithParams(
        {
          tableId: tableData.tableId,
          s3Path: tableData.s3Path,
          organizationId: tableData.organizationId,
        },
        fields,
        options
      );
    } catch (error) {
      logger.error('Error getting rows with table data:', error);
      return [];
    }
  }

  /**
   * Bulk create multiple rows in a table
   */
  async bulkCreateRows(command: BulkCreateRowsCommand): Promise<TableApplicationServiceResult<Row[]>> {
    try {
      const { tableId, rows } = command;

      // Verify table exists
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // AIDEV-NOTE: Process auto-fields for all rows in bulk create
      // Use plain object with field IDs to prevent field name/ID conversion bugs
      const enrichedRows = rows.map(row => {
        const plainData = row.toPlainObject(table.fields);
        const enrichedPlainData = this.autoFieldProcessor.processAutoFields(table, plainData, 'create');
        return Row.fromPlainObject(enrichedPlainData, tableId.value, table.fields);
      });

      // Batch insert all rows in single call
      const createdRows = await this.dynamicTableRepository.insertRows(tableId, enrichedRows);

      return ResultHelpers.success(createdRows);

    } catch (error) {
      logger.error('Error bulk creating rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to bulk create rows');
    }
  }

  /**
   * Check if a table has any rows
   */
  async tableHasRows(tableId: TableId): Promise<boolean> {
    try {
      return await this.dynamicTableRepository.hasRows(tableId);
    } catch (error) {
      logger.error('Error checking if table has rows:', error);
      return false;
    }
  }

  /**
   * Get table statistics efficiently using Delta Lake metadata
   *
   * Reads only transaction log to get row count and size without loading data.
   * Much faster than loading all rows for large tables (10-1000x speedup).
   */
  async getTableStats(tableId: TableId): Promise<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }> {
    try {
      return await this.dynamicTableRepository.getTableStats(tableId);
    } catch (error) {
      logger.error('Error getting table stats:', error);
      throw error;
    }
  }

  /**
   * Search for rows in a table based on a query string
   * Uses the existing getRows method with text search filters
   */
  async searchTableRows(command: SearchTableRowsCommand): Promise<TableApplicationServiceResult<Row[]>> {
    try {
      const { tableId, query, limit = 20, organizationId } = command;

      // Verify table exists and user has access
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        return ResultHelpers.failure(`Table ${tableId.value} not found`);
      }

      // Verify organization access
      if (!table.organizationId.equals(organizationId)) {
        return ResultHelpers.failure('Access denied: Table belongs to different organization');
      }

      // Build text search filters using existing RowQueryOptions
      // AIDEV-NOTE: Use field.name (not getColumnName) to match Delta Lake schema
      // Delta Lake columns are created using human-readable names, not field_{id} format
      const textFields = table.fields
        .filter(field => field.type === 'text')
        .map(field => field.name);

      // Create filters for text search across all text fields
      const searchFilters = textFields.map(fieldName => ({
        field: fieldName,
        operator: 'ilike' as const, // case-insensitive LIKE
        value: `%${query}%`
      }));

      // Use existing getRows method with search filters
      const rows = await this.dynamicTableRepository.getRows(tableId, {
        limit,
        offset: 0,
        filters: searchFilters
      });

      return ResultHelpers.success(rows);

    } catch (error) {
      logger.error('Error searching table rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to search table rows');
    }
  }

  /**
   * Handle table triggers for DATABASE_EVENT schedules
   * Emits table change events and creates tasks for matching agent schedules
   *
   * AIDEV-NOTE: This method is called after successful row operations (create, update, delete)
   * to trigger any agents that are listening for table changes.
   */
  private async handleTableTriggers(event: TableChangeEvent): Promise<void> {
    // Skip if trigger matching service not available (backward compatibility)
    if (!this.triggerMatchingService || !this.taskRepository) {
      logger.debug('Trigger matching service not available, skipping table triggers');
      return;
    }

    try {
      // Find all agent automations that match this table change event
      const matches = await this.triggerMatchingService.findMatchingAutomations(event);

      if (matches.length === 0) {
        logger.debug('No matching automations found for table change', {
          tableId: event.tableId,
          operation: event.operation
        });
        return;
      }

      logger.debug(`Found ${matches.length} matching automation(s) for table trigger`, {
        tableId: event.tableId,
        operation: event.operation,
        agentCount: matches.length
      });

      // Create a task for each matching automation
      // AIDEV-TODO: Look up skill by match.automation.skillId to get instructions
      for (const match of matches) {
        try {
          const triggerContext: TriggerContext = {
            type: 'DATABASE_EVENT',
            scheduleName: match.automation.name,
            tableChange: event
          };

          // Build enhanced task instruction text with event context
          const eventDataPreview = JSON.stringify(event.rowData, null, 2);
          // AIDEV-NOTE: In new automation model, instructions come from the referenced skill.
          // For now, we create a placeholder task. Full implementation needs skill lookup.
          const baseInstruction = `Execute skill ID ${match.automation.skillId}`;

          const enhancedTask = `
DATABASE EVENT TRIGGER
Table: ${event.tableName} (ID: ${event.tableId})
Operation: ${event.operation}
Row ID: ${event.rowId}
Timestamp: ${event.timestamp.toISOString()}

Row Data:
${eventDataPreview}

${event.previousRowData ? `
Previous Data:
${JSON.stringify(event.previousRowData, null, 2)}
` : ''}

INSTRUCTIONS:
${baseInstruction}
          `.trim();

          const taskData: CreateTaskData = {
            agentId: match.agent.id.value,
            organizationId: event.organizationId.value,
            name: match.automation.name || `Table ${event.operation} trigger`,
            instructions: {
              task: enhancedTask,
              metadata: {
                triggeredBy: 'DATABASE_EVENT',
                tableName: event.tableName,
                tableId: event.tableId,
                operation: event.operation,
                rowId: event.rowId,
                skillId: match.automation.skillId
              }
            },
            triggerContext
          };

          const task = await this.taskRepository.create(taskData);

          logger.summary('Created task from table trigger', {
            taskId: task.id.value,
            agentId: match.agent.id.value,
            automationName: match.automation.name,
            tableId: event.tableId,
            operation: event.operation
          });
        } catch (taskError) {
          logger.error('Failed to create task for table trigger', {
            error: taskError,
            agentId: match.agent.id.value,
            automationName: match.automation.name
          });
          // Continue creating tasks for other matches even if one fails
        }
      }
    } catch (error) {
      logger.error('Error handling table triggers', {
        error,
        tableId: event.tableId,
        operation: event.operation
      });
      // Don't throw - table operation should succeed even if trigger handling fails
    }
  }

}