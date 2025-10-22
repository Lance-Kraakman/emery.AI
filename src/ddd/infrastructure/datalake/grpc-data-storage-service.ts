/**
 * gRPC Data Storage Service
 * 
 * Infrastructure implementation for gRPC data conversion.
 * Handles JSON ↔ gRPC conversion for table data storage using domain entities.
 * Follows the same pattern as ArrowDataStorageService but uses gRPC + Delta Lake backend.
 * 
 * AIDEV-NOTE: Replaces Arrow/IPC with gRPC calls to Python table service
 */

import type { ITableDataStorageService } from '@/ddd/domain/tables/services/table-data-storage-service.interface';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Result } from '@/ddd/domain/shared/result';
import { Row } from '@/ddd/domain/tables/value-objects/row';
import { GrpcTableClient } from '@/ddd/infrastructure/grpc/table-grpc-client';
import { TableGrpcMapper } from '../grpc/table-grpc-mapper';
import { CreateTableRequest, DeleteTableRequest, UpdateTableRequest } from '@/lib/grpc/generated/table_service';

export class GrpcDataStorageService implements ITableDataStorageService {
  constructor(
    private readonly grpcClient: GrpcTableClient,
  ) {}

  /**
   * Store rows in a table using gRPC service
   * Converts domain entities to protobuf and sends to Python service
   */
  async storeRows(
    rows: Row[],
    table: DynamicTable
  ): Promise<Result<void>> {
    try {
      console.log(`[GrpcDataStorageService] Storing ${rows.length} rows for table ${table.id}`);
      
      // Debug logging for table object
      console.log('[GrpcDataStorageService] Table object debug:');
      console.log(`  - table.id: ${table.id?.value}`);
      console.log(`  - table.organizationId: ${table.organizationId?.value}`);
      console.log(`  - table.storageLocation: ${table.storageLocation}`);

      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;
      console.log(`[GrpcDataStorageService] Using s3Path: ${s3Path}`);

      // 1. Convert domain rows to protobuf request
      const createRequest = TableGrpcMapper.toCreateRowsRequest(
        table.id, 
        rows, 
        table.organizationId,
        s3Path
      );
      
      // 3. Send to gRPC service
      const response = await this.grpcClient.createRows(createRequest);
      
      // 4. Handle response using TypeScript property access
      if (response && response.success) {
        console.log(`[GrpcDataStorageService] Successfully stored ${rows.length} rows`);
        return { 
          success: true, 
          data: undefined
        };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[GrpcDataStorageService] Failed to store rows: ${message}`);
        return {
          success: false,
          error: message || 'Failed to store data via gRPC'
        };
      }
      
    } catch (error) {
      console.error('[GrpcDataStorageService] Error storing data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store data via gRPC'
      };
    }
  }

  /**
   * Retrieve rows from a table using gRPC service
   * Queries the Python service and converts protobuf back to domain entities
   */
  async retrieveRows(
    table: DynamicTable,
    options: {
      limit?: number;
      offset?: number;
      filters?: Record<string, any>;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<Result<Row[]>> {
    try {
      console.log(`[GrpcDataStorageService] Retrieving data for table ${table.id}`);

      const { limit = 1000, offset = 0, filters = {}, orderBy = '', orderDirection = 'ASC' } = options;
      
      // 1. Create query request
      const queryOptions = {
        orderBy,
        orderDirection,
        limit,
        offset,
        filters
      };
      
      const queryRequest = TableGrpcMapper.toQueryRowsRequest(
        table.id,
        table.storageLocation || `s3://emery-tables/${table.id.value}`,
        queryOptions,
        table.organizationId
      );
      
      // 2. Send to gRPC service
      const response = await this.grpcClient.queryRows(queryRequest);
      
      // 3. Handle response using TypeScript property access
      if (response && response.success) {
        const protoRowsData = response.rows || [];
        // Convert protobuf rows to domain entities
        const rows = protoRowsData.map((protoRowData: any) => 
          TableGrpcMapper.fromProtoRowData(protoRowData, table.fields)
        );
        
        console.log(`[GrpcDataStorageService] Successfully retrieved ${rows.length} rows`);
        return { success: true, data: rows };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[GrpcDataStorageService] Failed to retrieve rows: ${message}`);
        return {
          success: false,
          error: message || 'Failed to retrieve data via gRPC'
        };
      }
      
    } catch (error) {
      console.error('[GrpcDataStorageService] Error retrieving data:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve data via gRPC'
      };
    }
  }

  /**
   * Create table using gRPC service
   */
  async createTable(table: DynamicTable): Promise<Result<string>> {
    try {
      console.log(`[GrpcDataStorageService] Creating table ${table.name}`);

      // 1. Convert domain table to protobuf
      const protoTable = TableGrpcMapper.toProtoTable(table);
      
      // 2. Create request
      const createRequest = CreateTableRequest.create(
        {
          name: protoTable.name,
          schema: protoTable.schema,
          description: protoTable.description,
          organizationId: protoTable.organizationId,
          s3Path: protoTable.s3Path
        }
      );
      
      // 3. Send to gRPC service
      const response = await this.grpcClient.createTable(createRequest);
      
      // 4. Handle response using TypeScript property access
      if (response && response.success) {
        const s3Path = protoTable.s3Path || `s3://emery-tables/${table.id.value}`;
        console.log(`[GrpcDataStorageService] Successfully created table ${table.name} at ${s3Path}`);
        return { success: true, data: s3Path };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[GrpcDataStorageService] Failed to create table: ${message}`);
        return {
          success: false,
          error: message || 'Failed to create table via gRPC'
        };
      }
      
    } catch (error) {
      console.error('[GrpcDataStorageService] Error creating table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create table via gRPC'
      };
    }
  }

  /**
   * Update table using gRPC service
   */
  async updateTable(table: DynamicTable): Promise<Result<void>> {
    try {
      console.log(`[GrpcDataStorageService] Updating table ${table.id}`);

      // 1. Convert domain table to protobuf
      const protoTable = TableGrpcMapper.toProtoTable(table);
      
      // 2. Create update request
      const updateRequest = UpdateTableRequest.create(
        {
          tableId: protoTable.tableId,
          name: protoTable.name,
          schema: protoTable.schema,
          description: protoTable.description,
          organizationId: protoTable.organizationId,
        }
      );

      // 3. Send to gRPC service
      const response = await this.grpcClient.updateTable(updateRequest);
      
      // 4. Handle response using TypeScript property access
      if (response && response.success) {
        console.log(`[GrpcDataStorageService] Successfully updated table ${table.id}`);
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[GrpcDataStorageService] Failed to update table: ${message}`);
        return {
          success: false,
          error: message || 'Failed to update table via gRPC'
        };
      }
      
    } catch (error) {
      console.error('[GrpcDataStorageService] Error updating table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update table via gRPC'
      };
    }
  }

  /**
   * Update existing rows in a table using gRPC service
   * Note: This is a mock implementation since the gRPC client doesn't support updateRows yet
   */
  async updateRows(rows: Row[], table: DynamicTable): Promise<Result<void>> {
    // For now, this is not implemented in the gRPC service
    // We would need to implement this by deleting and re-inserting rows
    console.warn(`[GrpcDataStorageService] updateRows not implemented for table ${table.id}`);
    return {
      success: false,
      error: 'updateRows is not yet implemented in the gRPC service'
    };
  }

  /**
   * Delete rows from a table using gRPC service
   * Note: This is a mock implementation since the gRPC client doesn't support deleteRows yet
   */
  async deleteRows(rowIds: string[], table: DynamicTable): Promise<Result<void>> {
    // For now, this is not implemented in the gRPC service
    console.warn(`[GrpcDataStorageService] deleteRows not implemented for table ${table.id}`);
    return {
      success: false,
      error: 'deleteRows is not yet implemented in the gRPC service'
    };
  }

  /**
   * Get table statistics from gRPC service
   * Note: This is a mock implementation since the gRPC client doesn't support getTableStats yet
   */
  async getTableStats(table: DynamicTable): Promise<Result<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }>> {
    // For now, return mock data
    console.warn(`[GrpcDataStorageService] getTableStats not implemented for table ${table.id}, returning mock data`);
    return {
      success: true,
      data: {
        rowCount: 0,
        sizeBytes: 0,
        lastModified: new Date()
      }
    };
  }

  /**
   * Check if table has any rows using gRPC service
   * Note: This uses queryRows with limit 1 to check if table has rows
   */
  async hasRows(table: DynamicTable): Promise<Result<boolean>> {
    // For now, use queryRows with limit 1 to check if table has rows
    try {
      const result = await this.retrieveRows(table, { limit: 1 });
      if (result.success && result.data) {
        return { success: true, data: result.data.length > 0 };
      } else if (!result.success) {
        return {
          success: false,
          error: result.error
        };
      } else {
        return { success: true, data: false };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check if table has rows'
      };
    }
  }

  /**
   * Delete the entire table storage using gRPC service
   */
  async deleteTable(table: DynamicTable): Promise<Result<void>> {
    try {
      console.log(`[GrpcDataStorageService] Deleting table storage for ${table.id}`);

      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;

      // Create delete table request
      const deleteRequest = DeleteTableRequest.create({
        tableId: table.id.value.toString(),
        organizationId: table.organizationId.value.toString(),
        softDelete: true
      });

      const response = await this.grpcClient.deleteTable(deleteRequest);

      if (response && response.success) {
        console.log(`[GrpcDataStorageService] Successfully deleted table storage for ${table.id}`);
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[GrpcDataStorageService] Failed to delete table storage: ${message}`);
        return {
          success: false,
          error: message || 'Failed to delete table storage via gRPC'
        };
      }
    } catch (error) {
      console.error('[GrpcDataStorageService] Error deleting table storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete table storage via gRPC'
      };
    }
  }
}
