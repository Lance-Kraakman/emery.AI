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
  createdBy: UserId;
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
  createdBy: UserId;
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

export interface SearchTableRowsCommand {
  tableId: TableId;
  query: string;
  limit?: number;
  organizationId: OrganizationId;
}

// Use unified Result interface from domain shared types
export type TableApplicationServiceResult<T = any> = Result<T>;

export class TableApplicationService {
  constructor(
    private readonly dynamicTableService: DynamicTableService,
    private readonly databaseRepository: IDatabaseRepository,
    private readonly organizationRepository: IOrganizationRepository,
    private readonly dynamicTableRepository: IDynamicTableRepository
  ) {}

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
        createdBy: command.createdBy,
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

      // 3. Calculate order index based on existing fields
      const orderIndex = table.fields.length;

      // 4. Validate field name uniqueness (business logic moved from entity)
      if (table.hasField(command.name)) {
        return ResultHelpers.failure(`Field name '${command.name}' already exists`);
      }

      // 5. Create field using domain factory
      const field = TableField.create({
        name: command.name,
        type: command.type,
        orderIndex,
        relatedTableId: command.relatedTableId,
        required: command.required || false,
        metadata: command.metadata
      });

      // 6. Add field to table using internal method
      table.addField(field);

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
      // Note: required and metadata updates would need additional domain methods

      // 6. Update field in table using internal method  
      table.updateField(existingField.id, updatedField);

      // 5. Save the updated table
      const saveResult = await this.dynamicTableService.updateTable(table);
      if (!saveResult.success) {
        return ResultHelpers.failure(saveResult.error || 'Failed to save table with updated field');
      }

      // 6. Get the updated field (name might have changed)
      const fieldName = command.name || command.fieldName;
      const finalField = table.getField(fieldName);
      if (!finalField) {
        return ResultHelpers.failure('Field was updated but could not be retrieved');
      }

      console.log(`[TABLE-APP-SERVICE] Updated field: ${finalField.name}`);
      return ResultHelpers.success(finalField);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error updating field:', error);
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
        console.warn(`[TABLE-APP-SERVICE] Deleting field '${fieldName}' from table with existing data`);
      }

      // 4. Remove field from table using internal method
      table.removeField(field.id);

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
  async getFieldsForTable(tableId: TableId): Promise<TableField[]> {
    try {
      console.log('[TABLE-APP-SERVICE-DEBUG] getFieldsForTable called for tableId:', tableId.value);
      
      const table = await this.dynamicTableService.getTable(tableId);
      if (!table) {
        console.log('[TABLE-APP-SERVICE-DEBUG] Table not found for id:', tableId.value);
        return [];
      }

      console.log('[TABLE-APP-SERVICE-DEBUG] Table found:', {
        id: table.id.value,
        name: table.name,
        fieldsCount: table.fields.length,
        fields: table.fields.map(f => ({
          id: f.id?.value,
          name: f.name,
          type: f.type,
          orderIndex: f.orderIndex
        }))
      });

      // Return fields sorted by order index (handle nullable orderIndex)
      const sortedFields = [...table.fields].sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      
      console.log('[TABLE-APP-SERVICE-DEBUG] Sorted fields:', sortedFields.map(f => ({
        id: f.id?.value,
        name: f.name,
        type: f.type,
        orderIndex: f.orderIndex
      })));
      
      return sortedFields;
    } catch (error) {
      console.error('[TABLE-APP-SERVICE-DEBUG] Error getting fields for table:', error);
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
        console.log(`[TABLE-APP-SERVICE] No tables found for organization ${organizationId.value}`);
        return [];
      }

      console.log(`[TABLE-APP-SERVICE] Found ${tables.length} tables for organization ${organizationId.value}`);

      const allFiles: FileWithTableContext[] = [];

      // 2. Process each table
      for (const table of tables) {
        try {
          // Find file fields in this table
          const fileFields = table.fields.filter(field => field.type === 'file');
          
          if (fileFields.length === 0) {
            continue;
          }

          console.log(`[TABLE-APP-SERVICE] Found ${fileFields.length} file fields in table ${table.name}`);

          // Get all rows from the table
          const rows = await this.dynamicTableRepository.findRows(table.id);
          
          // Extract file values from each row
          for (const row of rows) {
            for (const field of fileFields) {
              const fieldValue = row.getFieldValue(field.name);
              
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
          console.error(`[TABLE-APP-SERVICE] Error processing table ${table.name}:`, error);
          // Continue with other tables
        }
      }

      console.log(`[TABLE-APP-SERVICE] Found ${allFiles.length} files across ${tables.length} tables`);
      return allFiles;

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error getting files for organization:', error);
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
      
      console.log(`[TABLE-APP-SERVICE] Found ${tables.length} tables with fields for organization ${organizationId.value}`);
      
      return tables;
    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error getting tables with fields for organization:', error);
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

      const fieldValue = data.getFieldValue(field.getColumnName());
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

      // Validate relation fields
      const relationValidation = await this.validateRelationFields(table, data);
      if (!relationValidation.valid) {
        return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
      }

      // Insert single row using batch method
      const rows = await this.dynamicTableRepository.insertRows(tableId, [data]);

      return ResultHelpers.success(rows[0]);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error creating row:', error);
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

      // Validate relation fields for all rows
      for (const row of rows) {
        const relationValidation = await this.validateRelationFields(table, row);
        if (!relationValidation.valid) {
          return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
        }
      }

      // Batch insert all rows in single gRPC call
      const createdRows = await this.dynamicTableRepository.insertRows(tableId, rows);

      return ResultHelpers.success(createdRows);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error creating rows:', error);
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

      // Validate relation fields
      const relationValidation = await this.validateRelationFields(table, data);
      if (!relationValidation.valid) {
        return ResultHelpers.failure(relationValidation.error || 'Relation validation failed');
      }

      // Update single row using batch method
      const updatedRows = await this.dynamicTableRepository.updateRows(tableId, [{
        rowId: rowId.value,
        row: data
      }]);

      return ResultHelpers.success(updatedRows[0]);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error updating row:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to update row');
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

      // Delete row using repository (pass as single-element array)
      await this.dynamicTableRepository.deleteRows(tableId, [rowId.value]);

      return ResultHelpers.success(undefined);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error deleting row:', error);
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
      console.error('[TABLE-APP-SERVICE] Error getting row:', error);
      return null;
    }
  }

  /**
   * Get rows from a table with optional filters
   */
  async getRows(tableId: TableId, options?: RowQueryOptions): Promise<Row[]> {
    try {
      return await this.dynamicTableRepository.findRows(tableId, options);
    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error getting rows:', error);
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

      // Batch insert all rows in single call
      const createdRows = await this.dynamicTableRepository.insertRows(tableId, rows);

      return ResultHelpers.success(createdRows);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error bulk creating rows:', error);
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
      console.error('[TABLE-APP-SERVICE] Error checking if table has rows:', error);
      return false;
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
      const textFields = table.fields
        .filter(field => field.type === 'text')
        .map(field => field.getColumnName());

      // Create filters for text search across all text fields
      const searchFilters = textFields.map(fieldName => ({
        field: fieldName,
        operator: 'ilike' as const, // case-insensitive LIKE
        value: `%${query}%`
      }));

      // Use existing findRows method with search filters
      const rows = await this.dynamicTableRepository.findRows(tableId, {
        limit,
        offset: 0,
        filters: searchFilters
      });

      return ResultHelpers.success(rows);

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error searching table rows:', error);
      return ResultHelpers.failure(error instanceof Error ? error.message : 'Failed to search table rows');
    }
  }

}