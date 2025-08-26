/**
 * Row Application Service
 * 
 * Orchestrates row/data operations with business logic and validation.
 * Handles CRUD operations, field mapping, relation handling, and bulk operations.
 * 
 * AIDEV-NOTE: Application service for dynamic row data management - coordinates
 * between table, field, and file repositories for complete data operations
 */

import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { IFileStorageRepository } from '@/ddd/domain/files/repositories/file-storage-repository';
import type { Result } from '@/ddd/domain/shared/result';
import type { Field } from '@/ddd/domain/fields/entities/field';

export interface CreateRowCommand {
  tableId: number;
  data: Record<string, any>;
  createdBy?: string;
}

export interface UpdateRowCommand {
  tableId: number;
  rowId: string;
  data: Record<string, any>;
  updatedBy?: string;
}

export interface BulkCreateRowsCommand {
  tableId: number;
  rows: Array<Record<string, any>>;
  createdBy?: string;
}

export interface BulkUpdateRowsCommand {
  tableId: number;
  updates: Array<{
    rowId: string;
    data: Record<string, any>;
  }>;
  updatedBy?: string;
}

export interface RowFilters {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

// Use unified Result interface from domain shared types  
export type RowApplicationServiceResult<T = any> = Result<T>;

export class RowApplicationService {
  constructor(
    private readonly tableRepository: IDynamicTableRepository,
    private readonly fieldRepository: IFieldRepository,
    private readonly fileStorageRepository: IFileStorageRepository
  ) {}

  /**
   * Create a new row in a dynamic table
   */
  async createRow(command: CreateRowCommand): Promise<RowApplicationServiceResult<any>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Get field definitions and validate row data
      const fields = await this.fieldRepository.findByTableId(command.tableId);
      const validation = this.validateRowData(fields, command.data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 3. Process special field types
      const processedData = await this.processRowData(command.tableId, command.data);

      // 4. Create row using repository - pass processed field data directly
      const newRow = await this.tableRepository.insertRow(command.tableId, processedData);

      console.log(`[ROW-APP-SERVICE] Created row in table ${table.name}`);

      return {
        success: true,
        data: newRow
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error creating row:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create row'
      };
    }
  }

  /**
   * Update an existing row
   */
  async updateRow(command: UpdateRowCommand): Promise<RowApplicationServiceResult<any>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Verify row exists
      const existingRow = await this.tableRepository.getRow(command.tableId, command.rowId);
      if (!existingRow) {
        return {
          success: false,
          error: `Row ${command.rowId} not found in table ${command.tableId}`
        };
      }

      // 3. Get field definitions and validate update data
      const fields = await this.fieldRepository.findByTableId(command.tableId);
      const validation = this.validateRowData(fields, command.data);
      if (!validation.valid) {
        return {
          success: false,
          error: 'Validation failed',
          validationErrors: validation.errors
        };
      }

      // 4. Process special field types
      const processedData = await this.processRowData(command.tableId, command.data);

      // 5. Update row using repository
      const updatedRow = await this.tableRepository.updateRow(command.tableId, command.rowId, processedData);

      console.log(`[ROW-APP-SERVICE] Updated row ${command.rowId} in table ${table.name}`);

      return {
        success: true,
        data: updatedRow
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error updating row:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update row'
      };
    }
  }

  /**
   * Delete a row from a table
   */
  async deleteRow(tableId: number, rowId: string): Promise<RowApplicationServiceResult<void>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${tableId} not found`
        };
      }

      // 2. Verify row exists
      const existingRow = await this.tableRepository.getRow(tableId, rowId);
      if (!existingRow) {
        return {
          success: false,
          error: `Row ${rowId} not found in table ${tableId}`
        };
      }

      // 3. Handle file cleanup if there are file fields
      const fields = await this.fieldRepository.findByTableId(tableId);
      const fileFields = fields.filter(f => f.type === 'file');
      
      for (const fileField of fileFields) {
        const fileData = existingRow[`field_${fileField.id}`];
        if (fileData && typeof fileData === 'object' && fileData.key) {
          // Delete associated file from storage
          await this.fileStorageRepository.deleteFile(fileData.key);
          console.log(`[ROW-APP-SERVICE] Deleted file ${fileData.key} for field ${fileField.name}`);
        }
      }

      // 4. Delete row using repository
      await this.tableRepository.deleteRow(tableId, rowId);

      console.log(`[ROW-APP-SERVICE] Deleted row ${rowId} from table ${table.name}`);

      return {
        success: true
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error deleting row:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete row'
      };
    }
  }

  /**
   * Get a single row by ID
   */
  async getRow(tableId: number, rowId: string): Promise<Record<string, any> | null> {
    const row = await this.tableRepository.getRow(tableId, rowId);
    if (!row) {
      return null;
    }

    // Map field_X columns back to field slugs for frontend
    return await this.mapRowToFrontend(tableId, row);
  }

  /**
   * Get rows from a table with filters
   */
  async getRows(tableId: number, filters?: RowFilters): Promise<Record<string, any>[]> {
    const rows = await this.tableRepository.getRows(tableId, {
      limit: filters?.limit || 1000,
      offset: filters?.offset || 0,
      orderBy: filters?.orderBy,
      orderDirection: filters?.orderDirection?.toUpperCase() as 'ASC' | 'DESC'
    });

    // Map field_X columns back to field slugs for frontend
    const mappedRows = [];
    for (const row of rows) {
      mappedRows.push(await this.mapRowToFrontend(tableId, row));
    }

    return mappedRows;
  }

  /**
   * Bulk create multiple rows
   */
  async bulkCreateRows(command: BulkCreateRowsCommand): Promise<RowApplicationServiceResult<Record<string, any>[]>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Get field definitions and validate all rows
      const fields = await this.fieldRepository.findByTableId(command.tableId);
      const validationErrors: Array<{ row: number; errors: Array<{ field: string; error: string }> }> = [];
      
      for (let i = 0; i < command.rows.length; i++) {
        const validation = this.validateRowData(fields, command.rows[i]);
        if (!validation.valid) {
          validationErrors.push({ row: i, errors: validation.errors });
        }
      }

      if (validationErrors.length > 0) {
        return {
          success: false,
          error: `Validation failed for ${validationErrors.length} rows`,
          validationErrors: validationErrors.flatMap(ve => 
            ve.errors.map(e => ({ field: `Row ${ve.row}: ${e.field}`, error: e.error }))
          )
        };
      }

      // 3. Process and insert all rows
      const createdRows = [];
      for (const rowData of command.rows) {
        const processedData = await this.processRowData(command.tableId, rowData);
        const newRow = await this.tableRepository.insertRow(command.tableId, processedData);
        createdRows.push(newRow);
      }

      console.log(`[ROW-APP-SERVICE] Bulk created ${createdRows.length} rows in table ${table.name}`);

      return {
        success: true,
        data: createdRows
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error bulk creating rows:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk create rows'
      };
    }
  }

  /**
   * Bulk update multiple rows
   */
  async bulkUpdateRows(command: BulkUpdateRowsCommand): Promise<RowApplicationServiceResult<Record<string, any>[]>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(command.tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.tableId} not found`
        };
      }

      // 2. Process each update
      const updatedRows = [];
      const errors: Array<{ rowId: string; error: string }> = [];

      for (const update of command.updates) {
        try {
          // Validate update data
          const fields = await this.fieldRepository.findByTableId(command.tableId);
          const validation = this.validateRowData(fields, update.data);
          if (!validation.valid) {
            errors.push({
              rowId: update.rowId,
              error: validation.errors.map((e: { field: string; error: string }) => `${e.field}: ${e.error}`).join(', ')
            });
            continue;
          }

          // Process and update row
          const processedData = await this.processRowData(command.tableId, update.data);
          const updatedRow = await this.tableRepository.updateRow(command.tableId, update.rowId, processedData);
          updatedRows.push(updatedRow);

        } catch (error) {
          errors.push({
            rowId: update.rowId,
            error: error instanceof Error ? error.message : 'Update failed'
          });
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          error: `Failed to update ${errors.length} rows`,
          validationErrors: errors.map(e => ({ field: e.rowId, error: e.error }))
        };
      }

      console.log(`[ROW-APP-SERVICE] Bulk updated ${updatedRows.length} rows in table ${table.name}`);

      return {
        success: true,
        data: updatedRows
      };

    } catch (error) {
      console.error('[ROW-APP-SERVICE] Error bulk updating rows:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk update rows'
      };
    }
  }

  /**
   * Process row data to handle special field types
   */
  private async processRowData(tableId: number, data: Record<string, any>): Promise<Record<string, any>> {
    const fields = await this.fieldRepository.findByTableId(tableId);
    const processedData: Record<string, any> = {};

    for (const field of fields) {
      const value = data[field.slug];
      
      // Only skip if value is explicitly undefined - allow null, empty strings, 0, false, etc.
      // These are all legitimate field values that should be stored in the database
      if (value === undefined) {
        continue;
      }

      // Map from field slug to field_{id} column name
      const columnName = `field_${field.id}`;

      // Handle special field types
      switch (field.type) {
        case 'relation':
          // Ensure relation data is properly formatted as JSONB
          if (typeof value === 'string') {
            try {
              processedData[columnName] = JSON.parse(value);
            } catch {
              processedData[columnName] = value;
            }
          } else {
            processedData[columnName] = value;
          }
          break;

        case 'file':
          // Handle file field data
          if (typeof value === 'string') {
            try {
              processedData[columnName] = JSON.parse(value);
            } catch {
              processedData[columnName] = value;
            }
          } else {
            processedData[columnName] = value;
          }
          break;

        case 'date':
          // Ensure date is properly formatted
          if (value instanceof Date) {
            processedData[columnName] = value.toISOString();
          } else {
            processedData[columnName] = value;
          }
          break;

        default:
          processedData[columnName] = value;
      }
    }

    return processedData;
  }

  /**
   * Validate row data against field definitions
   */
  private validateRowData(fields: Field[], data: Record<string, any>): { valid: boolean; errors: Array<{ field: string; error: string }> } {
    const errors: Array<{ field: string; error: string }> = [];

    for (const field of fields) {
      const value = data[field.slug];
      
      // Check required fields
      if (field.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: field.name,
          error: 'Field is required'
        });
      }

      // Type validation
      if (value !== undefined && value !== null) {
        switch (field.type) {
          case 'number':
            if (isNaN(Number(value))) {
              errors.push({
                field: field.name,
                error: 'Must be a valid number'
              });
            }
            break;
          case 'boolean':
            if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
              errors.push({
                field: field.name,
                error: 'Must be a valid boolean'
              });
            }
            break;
          case 'date':
            if (!(value instanceof Date) && isNaN(Date.parse(value))) {
              errors.push({
                field: field.name,
                error: 'Must be a valid date'
              });
            }
            break;
          case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(String(value))) {
              errors.push({
                field: field.name,
                error: 'Must be a valid email address'
              });
            }
            break;
          case 'url':
            try {
              new URL(String(value));
            } catch {
              errors.push({
                field: field.name,
                error: 'Must be a valid URL'
              });
            }
            break;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Map row data from database format to frontend format
   */
  private async mapRowToFrontend(tableId: number, row: Record<string, any>): Promise<Record<string, any>> {
    const fields = await this.fieldRepository.findByTableId(tableId);
    const mappedRow: Record<string, any> = {
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at
    };

    for (const field of fields) {
      const dbColumn = `field_${field.id}`;
      const value = row[dbColumn];
      
      if (value !== undefined) {
        // Handle special field types - allow null values to be displayed as empty
        if (field.type === 'relation' || field.type === 'file') {
          // JSONB fields might need parsing
          if (typeof value === 'string') {
            try {
              mappedRow[field.slug] = JSON.parse(value);
            } catch {
              mappedRow[field.slug] = value;
            }
          } else {
            mappedRow[field.slug] = value;
          }
        } else {
          mappedRow[field.slug] = value;
        }
      }
    }

    return mappedRow;
  }
}