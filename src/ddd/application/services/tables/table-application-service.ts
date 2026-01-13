/**
 * Table Application Service
 *
 * Orchestrates dynamic table operations with business logic and validation.
 * Handles table creation, updates, deletion, and access control.
 *
 * AIDEV-NOTE: Refactored for SRP. This service now focuses on table/field operations.
 * Row operations are delegated to RowApplicationService.
 * Trigger handling is delegated to TableEventCoordinatorService.
 *
 * Backward compatibility: This service still exposes row methods by delegating
 * to RowApplicationService, so existing callers don't need to change.
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
import type { ITaskRepository } from '@/ddd/domain/tasks/repositories/task-repository';
import type { ISkillRepository } from '@/ddd/domain/skills/repositories/skill-repository';
import { RowApplicationService } from './row-application-service';
import { TableEventCoordinatorService } from './table-event-coordinator-service';

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

// Row operation commands are now defined in RowApplicationService
// and re-exported above for backward compatibility

// Use unified Result interface from domain shared types
export type TableApplicationServiceResult<T = any> = Result<T>;

// Re-export command types from RowApplicationService for backward compatibility
export type {
  CreateRowCommand,
  CreateRowsCommand,
  UpdateRowCommand,
  BulkCreateRowsCommand,
  BulkUpdateRowsCommand,
  SearchTableRowsCommand
} from './row-application-service';

export class TableApplicationService {
  private readonly rowService: RowApplicationService;
  private readonly eventCoordinator: TableEventCoordinatorService;

  constructor(
    private readonly dynamicTableService: DynamicTableService,
    private readonly databaseRepository: IDatabaseRepository,
    private readonly organizationRepository: IOrganizationRepository,
    private readonly dynamicTableRepository: IDynamicTableRepository,
    triggerMatchingService?: ITriggerMatchingService,
    taskRepository?: ITaskRepository,
    skillRepository?: ISkillRepository
  ) {
    // AIDEV-NOTE: Initialize internal services for SRP delegation
    this.eventCoordinator = new TableEventCoordinatorService(
      triggerMatchingService,
      taskRepository,
      skillRepository
    );
    this.rowService = new RowApplicationService(
      dynamicTableService,
      dynamicTableRepository,
      this.eventCoordinator
    );
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
  // Row Operations - Delegated to RowApplicationService
  // AIDEV-NOTE: These methods delegate to rowService for SRP compliance
  // while maintaining backward compatibility for existing callers.
  // ========================================

  /**
   * Create a new row in a table
   * @deprecated Use RowApplicationService directly for new code
   */
  async createRow(command: import('./row-application-service').CreateRowCommand): Promise<TableApplicationServiceResult<Row>> {
    return this.rowService.createRow(command);
  }

  /**
   * Create multiple rows in a table (batch operation)
   * @deprecated Use RowApplicationService directly for new code
   */
  async createRows(command: import('./row-application-service').CreateRowsCommand): Promise<TableApplicationServiceResult<Row[]>> {
    return this.rowService.createRows(command);
  }

  /**
   * Update an existing row in a table
   * @deprecated Use RowApplicationService directly for new code
   */
  async updateRow(command: import('./row-application-service').UpdateRowCommand): Promise<TableApplicationServiceResult<Row>> {
    return this.rowService.updateRow(command);
  }

  /**
   * Update multiple rows in a table (bulk update)
   * @deprecated Use RowApplicationService directly for new code
   */
  async updateRows(command: import('./row-application-service').BulkUpdateRowsCommand): Promise<TableApplicationServiceResult<Row[]>> {
    return this.rowService.updateRows(command);
  }

  /**
   * Delete a row from a table
   * @deprecated Use RowApplicationService directly for new code
   */
  async deleteRow(tableId: TableId, rowId: RowId): Promise<TableApplicationServiceResult<void>> {
    return this.rowService.deleteRow(tableId, rowId);
  }

  /**
   * Get a single row from a table
   * @deprecated Use RowApplicationService directly for new code
   */
  async getRow(tableId: TableId, rowId: RowId): Promise<Row | null> {
    return this.rowService.getRow(tableId, rowId);
  }

  /**
   * Get rows from a table with pagination
   * @deprecated Use RowApplicationService directly for new code
   */
  async getRows(tableId: TableId, options: RowQueryOptions): Promise<Row[]> {
    return this.rowService.getRows(tableId, options);
  }

  /**
   * Get rows using pre-fetched table data (bypasses findById)
   * @deprecated Use RowApplicationService directly for new code
   */
  async getRowsWithTableData(
    tableData: { tableId: number; s3Path: string; organizationId: number; databaseId: number },
    fields: TableField[],
    options: RowQueryOptions
  ): Promise<Row[]> {
    return this.rowService.getRowsWithTableData(tableData, fields, options);
  }

  /**
   * Bulk create multiple rows in a table
   * @deprecated Use RowApplicationService directly for new code
   */
  async bulkCreateRows(command: import('./row-application-service').BulkCreateRowsCommand): Promise<TableApplicationServiceResult<Row[]>> {
    return this.rowService.bulkCreateRows(command);
  }

  /**
   * Check if a table has any rows
   * @deprecated Use RowApplicationService directly for new code
   */
  async tableHasRows(tableId: TableId): Promise<boolean> {
    return this.rowService.tableHasRows(tableId);
  }

  /**
   * Get table statistics efficiently using Delta Lake metadata
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
   * @deprecated Use RowApplicationService directly for new code
   */
  async searchTableRows(command: import('./row-application-service').SearchTableRowsCommand): Promise<TableApplicationServiceResult<Row[]>> {
    return this.rowService.searchTableRows(command);
  }
}