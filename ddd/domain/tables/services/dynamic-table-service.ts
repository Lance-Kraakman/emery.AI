/**
 * Dynamic Table Domain Service
 * 
 * Central domain service for table operations. This service orchestrates
 * business logic for dynamic table management, providing table CRUD and metadata operations.
 * Row operations are now handled by the DynamicTable aggregate root.
 * 
 * AIDEV-NOTE: Domain service focused on table operations only. 
 * Row operations moved to DynamicTable aggregate root.
 */

import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { Result } from '@/ddd/domain/shared/result';
import type { 
  DynamicTable, 
  CreateDynamicTableData
} from '@/ddd/domain/tables/entities/dynamic-table';
import { TableId, OrganizationId, DatabaseId, UserId } from '@/ddd/domain/shared/value-objects';


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


/**
 * Central domain service for dynamic table operations
 */
export class DynamicTableService {
  constructor(
    private readonly tableRepository: IDynamicTableRepository
  ) {}

  // ===== TABLE OPERATIONS =====

  /**
   * Create a new dynamic table
   */
  async createTable(command: CreateTableCommand): Promise<Result<DynamicTable>> {
    try {
      const tableData: CreateDynamicTableData = {
        name: command.name,
        databaseId: command.databaseId,
        organizationId: command.organizationId,
        createdBy: command.createdBy,
        description: command.description,
        metadata: command.metadata
      };

      const table = await this.tableRepository.create(tableData);

      return {
        success: true,
        data: table
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create table'
      };
    }
  }

  /**
   * Get a table by ID
   */
  async getTable(id: TableId): Promise<DynamicTable | null> {
    return await this.tableRepository.findById(id);
  }

  /**
   * Get tables by organization
   */
  async getTablesByOrganization(organizationId: OrganizationId): Promise<DynamicTable[]> {
    return await this.tableRepository.findByOrganization(organizationId);
  }

  /**
   * Get tables by database
   */
  async getTablesByDatabase(databaseId: DatabaseId): Promise<DynamicTable[]> {
    return await this.tableRepository.findByDatabase(databaseId);
  }

  /**
   * Update a table
   */
  async updateTable(command: UpdateTableCommand): Promise<Result<DynamicTable>> {
    try {
      const table = await this.tableRepository.update(command.id, {
        name: command.name,
        description: command.description,
        metadata: command.metadata
      });

      return {
        success: true,
        data: table
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update table'
      };
    }
  }

  /**
   * Delete a table
   */
  async deleteTable(id: TableId): Promise<Result<void>> {
    try {
      await this.tableRepository.delete(id);

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete table'
      };
    }
  }

  /**
   * Check if table exists
   */
  async tableExists(id: TableId): Promise<boolean> {
    return await this.tableRepository.tableExists(id);
  }

  /**
   * Get table statistics
   */
  async getTableStats(id: TableId): Promise<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }> {
    return await this.tableRepository.getTableStats(id);
  }

  /**
   * Check if table has any rows
   */
  async hasRows(tableId: TableId): Promise<boolean> {
    return await this.tableRepository.hasRows(tableId);
  }
}