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
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { CreateDynamicTableData } from '@/ddd/application/services/tables/table-application-service';
import { TableId, OrganizationId, DatabaseId, UserId } from '@/ddd/domain/shared/value-objects';
import { TableMetadata } from '../value-objects/table-metadata';


export interface CreateTableCommand {
  name: string;
  databaseId: DatabaseId;
  organizationId: OrganizationId;
  createdBy: UserId;
  description?: string;
  metadata?: TableMetadata;
}

export interface UpdateTableCommand {
  id: TableId;
  name?: string;
  description?: string;
  metadata?: TableMetadata;
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
        storageLocation: 'temp', // Repository will overwrite with proper S3 path
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
   * Save a table with all its fields
   * Used when fields have been modified and need to be persisted
   */
  async saveTable(table: DynamicTable): Promise<Result<DynamicTable>> {
    try {
      const savedTable = await this.tableRepository.update(table.id, {
        name: table.name,
        metadata: table.metadata,
        fields: table.fields // Include fields for synchronization
      });

      return {
        success: true,
        data: savedTable
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save table'
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