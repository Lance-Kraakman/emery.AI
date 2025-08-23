/**
 * Table Application Service
 * 
 * Orchestrates dynamic table operations with business logic and validation.
 * Handles table creation, updates, deletion, and access control.
 * 
 * AIDEV-NOTE: Application service for table management - handles business
 * rules, validation, and coordination between repositories
 */

import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { DynamicTable, CreateDynamicTableData } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Result } from '@/ddd/domain/shared/result';
import { generateTableName } from '@/utils/slugify';

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

// Use unified Result interface from domain shared types
export type TableApplicationServiceResult<T = any> = Result<T>;

export class TableApplicationService {
  constructor(
    private readonly tableRepository: IDynamicTableRepository,
    private readonly fieldRepository: IFieldRepository,
    private readonly databaseRepository: IDatabaseRepository,
    private readonly organizationRepository: IOrganizationRepository
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

      // 3. Generate unique table name with user_table_ prefix
      const dbName = generateTableName(command.name);

      // 4. Create table data
      const tableData: CreateDynamicTableData = {
        name: command.name,
        dbName,
        databaseId: command.databaseId,
        organizationId: command.organizationId,
        createdBy: command.createdBy,
        metadata: {
          ...command.metadata,
          description: command.description
        }
      };

      // 5. Create table using repository (handles both metadata and physical table)
      const newTable = await this.tableRepository.create(tableData);

      console.log(`[TABLE-APP-SERVICE] Created table: ${newTable.name} (${newTable.dbName})`);

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
      const table = await this.tableRepository.findById(command.id);
      if (!table) {
        return {
          success: false,
          error: `Table ${command.id} not found`
        };
      }

      // 2. Update table properties
      const updates: Partial<DynamicTable> = {};
      
      if (command.name && command.name !== table.name) {
        updates.name = command.name;
      }

      if (command.description !== undefined) {
        updates.metadata = {
          ...table.metadata,
          description: command.description
        };
      } else if (command.metadata) {
        updates.metadata = {
          ...table.metadata,
          ...command.metadata
        };
      }

      // 3. Update table if there are changes
      if (Object.keys(updates).length > 0) {
        const updatedTable = await this.tableRepository.update(command.id, updates);
        
        console.log(`[TABLE-APP-SERVICE] Updated table: ${updatedTable.name}`);
        
        return {
          success: true,
          data: updatedTable
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
  async deleteTable(tableId: number): Promise<TableApplicationServiceResult<void>> {
    try {
      // 1. Verify table exists
      const table = await this.tableRepository.findById(tableId);
      if (!table) {
        return {
          success: false,
          error: `Table ${tableId} not found`
        };
      }

      // 2. Check if table has any fields with data
      const fields = await this.fieldRepository.findByTableId(tableId);
      
      // 3. Check if table has any rows (optional - could be expensive)
      const hasData = await this.tableRepository.hasRows(tableId);
      if (hasData) {
        console.warn(`[TABLE-APP-SERVICE] Deleting table ${table.name} with existing data`);
      }

      // 4. Delete all fields first (handles column removal)
      for (const field of fields) {
        await this.fieldRepository.delete(field.id);
      }

      // 5. Delete the table (handles both metadata and physical table)
      await this.tableRepository.delete(tableId);

      console.log(`[TABLE-APP-SERVICE] Deleted table: ${table.name} (${table.dbName})`);

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
  async getTable(tableId: number): Promise<DynamicTable | null> {
    return await this.tableRepository.findById(tableId);
  }

  /**
   * Get tables for an organization
   */
  async getTablesForOrganization(organizationId: number): Promise<DynamicTable[]> {
    return await this.tableRepository.findByOrganization(organizationId);
  }

  /**
   * Get tables for a database
   */
  async getTablesForDatabase(databaseId: number): Promise<DynamicTable[]> {
    return await this.tableRepository.findByDatabase(databaseId);
  }

  /**
   * Get tables with filters
   */
  async getTables(filters: TableFilters): Promise<DynamicTable[]> {
    if (filters.organizationId) {
      return await this.tableRepository.findByOrganization(filters.organizationId);
    }
    
    if (filters.databaseId) {
      return await this.tableRepository.findByDatabase(filters.databaseId);
    }

    if (filters.createdBy) {
      // TODO: Add findByCreator method to repository if needed
      const allTables = await this.tableRepository.findAll();
      return allTables.filter(t => t.createdBy === filters.createdBy);
    }

    return await this.tableRepository.findAll();
  }

  /**
   * Check if user has access to table
   */
  async hasAccessToTable(tableId: number, userId: string, organizationId: number): Promise<boolean> {
    const table = await this.tableRepository.findById(tableId);
    
    if (!table) {
      return false;
    }

    // Check if table belongs to user's organization
    if (table.organizationId !== organizationId) {
      return false;
    }

    // Additional permission checks could be added here
    // For example, checking role-based permissions

    return true;
  }

  /**
   * Clone a table structure (without data)
   */
  async cloneTableStructure(
    sourceTableId: number, 
    newName: string,
    targetDatabaseId: number,
    userId: string,
    organizationId: number
  ): Promise<TableApplicationServiceResult<DynamicTable>> {
    try {
      // 1. Get source table
      const sourceTable = await this.tableRepository.findById(sourceTableId);
      if (!sourceTable) {
        return {
          success: false,
          error: `Source table ${sourceTableId} not found`
        };
      }

      // 2. Verify access to source table
      if (sourceTable.organizationId !== organizationId) {
        return {
          success: false,
          error: 'Access denied: source table not in your organization'
        };
      }

      // 3. Create new table
      const createResult = await this.createTable({
        name: newName,
        databaseId: targetDatabaseId,
        organizationId,
        createdBy: userId,
        description: `Cloned from ${sourceTable.name}`,
        metadata: {
          ...sourceTable.metadata,
          clonedFrom: sourceTableId,
          clonedAt: new Date().toISOString()
        }
      });

      if (!createResult.success || !createResult.data) {
        return createResult;
      }

      const newTable = createResult.data;

      // 4. Clone fields structure
      const sourceFields = await this.fieldRepository.findByTableId(sourceTableId);
      
      for (const sourceField of sourceFields) {
        await this.fieldRepository.create({
          tableId: newTable.id,
          name: sourceField.name,
          slug: sourceField.slug,
          type: sourceField.type,
          required: sourceField.required ?? false,
          orderIndex: sourceField.orderIndex ?? undefined,
          relatedTableId: sourceField.relatedTableId ?? undefined,
          metadata: sourceField.metadata
        });
      }

      console.log(`[TABLE-APP-SERVICE] Cloned table structure from ${sourceTable.name} to ${newTable.name}`);

      return {
        success: true,
        data: newTable
      };

    } catch (error) {
      console.error('[TABLE-APP-SERVICE] Error cloning table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clone table'
      };
    }
  }
}