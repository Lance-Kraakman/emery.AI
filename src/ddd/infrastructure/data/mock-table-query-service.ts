/**
 * Mock Table Query Service
 * 
 * Temporary implementation of ITableQueryService for testing.
 * This will be replaced with a proper implementation later.
 */

import type { ITableQueryService } from '@/ddd/domain/tables/services/table-query-service.interface';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { TableId, OrganizationId, DatabaseId } from '@/ddd/domain/shared/value-objects';
import type { Result } from '@/ddd/domain/shared/result';

export class MockTableQueryService implements ITableQueryService {
  
  async findTableById(tableId: TableId): Promise<Result<DynamicTable | null>> {
    // Mock implementation - returns null for now
    return {
      success: true,
      data: null
    };
  }

  async findTablesByOrganization(organizationId: OrganizationId): Promise<Result<DynamicTable[]>> {
    // Mock implementation - returns empty array for now
    return {
      success: true,
      data: []
    };
  }

  async findTablesByDatabase(databaseId: DatabaseId): Promise<Result<DynamicTable[]>> {
    // Mock implementation - returns empty array for now
    return {
      success: true,
      data: []
    };
  }

  async searchTables(query: string, organizationId: OrganizationId): Promise<Result<DynamicTable[]>> {
    // Mock implementation - returns empty array for now
    return {
      success: true,
      data: []
    };
  }

  async tableExists(tableId: TableId): Promise<Result<boolean>> {
    // Mock implementation - always returns false for now
    return {
      success: true,
      data: false
    };
  }

  async isTableNameAvailable(
    name: string, 
    organizationId: OrganizationId, 
    excludeTableId?: TableId
  ): Promise<Result<boolean>> {
    // Mock implementation - always returns true for now
    return {
      success: true,
      data: true
    };
  }

  async getTableCount(organizationId: OrganizationId): Promise<Result<number>> {
    // Mock implementation - returns 0 for now
    return {
      success: true,
      data: 0
    };
  }

  async getTableCountForDatabase(databaseId: DatabaseId): Promise<Result<number>> {
    // Mock implementation - returns 0 for now
    return {
      success: true,
      data: 0
    };
  }
}
