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
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { IDatabaseRepository } from '@/ddd/domain/databases/repositories/database-repository';
import type { IOrganizationRepository } from '@/ddd/domain/organizations/repositories/organization-repository';
import type { DynamicTable, CreateDynamicTableData } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Result } from '@/ddd/domain/shared/result';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { generateTableName } from '@/utils/slugify';
import { OrganizationId, DatabaseId, UserId, TableId } from '@/ddd/domain/shared/value-objects';
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata';

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
    private readonly dynamicTableService: DynamicTableService,
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

      // 2. Check if table has any fields with data
      const fields = await this.fieldRepository.findByTableId(tableId);
      
      // 3. Check if table has any rows (optional - could be expensive)
      const hasData = await this.dynamicTableService.hasRows(tableId);
      if (hasData) {
        console.warn(`[TABLE-APP-SERVICE] Deleting table ${table.name} with existing data`);
      }

      // 4. Delete all fields first (handles column removal)
      for (const field of fields) {
        await this.fieldRepository.delete(field.id);
      }

      // 5. Delete the table (handles both metadata and physical table)
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
  
}