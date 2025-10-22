/**
 * gRPC Data Storage Service
 * 
 * Infrastructure implementation for gRPC data conversion.
 * Handles JSON ↔ gRPC conversion for table data storage using domain entities.
 * Follows the same pattern as ArrowDataStorageService but uses gRPC + Delta Lake backend.
 * 
 * AIDEV-NOTE: Replaces Arrow/IPC with gRPC calls to Python table service
 */

import type { DataStorageService, StorageMetadata } from '@/ddd/domain/tables/services/data-storage-service';
import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Result } from '@/ddd/domain/shared/result';
import { Row } from '@/ddd/domain/tables/value-objects/row';
import { GrpcTableClient } from '@/ddd/infrastructure/grpc/table-grpc-client';
import { TableGrpcMapper } from '../grpc/table-grpc-mapper';
import { CreateTableRequest, DeleteTableRequest, UpdateTableRequest } from '@/lib/grpc/generated/table_service';

export class GrpcDataStorageService implements DataStorageService {
  constructor(
    private readonly grpcClient: GrpcTableClient,
  ) {}

  /**
   * Store Row objects using gRPC service
   * Converts domain entities to protobuf and sends to Python service
   */
  async storeData(
    rows: Row[],
    table: DynamicTable
  ): Promise<Result<Buffer>> {
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
        // Return a mock buffer for compatibility with existing interface
        return { 
          success: true, 
          data: Buffer.from(JSON.stringify({ 
            rowsStored: rows.length,
            tableId: table.id.value,
            timestamp: Date.now()
          }))
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
   * Retrieve Row objects using gRPC service
   * Queries the Python service and converts protobuf back to domain entities
   */
  async retrieveData(
    buffer: Buffer,
    table: DynamicTable
  ): Promise<Result<Row[]>> {
    try {
      console.log(`[GrpcDataStorageService] Retrieving data for table ${table.id}`);

      // 1. Parse the buffer to get query parameters
      const queryParams = JSON.parse(buffer.toString());
      const { limit = 1000, offset = 0, filters = {} } = queryParams;
      
      // 2. Create query request
      const queryOptions = {
        orderBy: '',
        orderDirection: 'ASC',
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
      
      // 3. Send to gRPC service
      const response = await this.grpcClient.queryRows(queryRequest);
      
      // 4. Handle response using TypeScript property access
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
   * Read metadata using gRPC service
   * Returns storage metadata for the table
   */
  async readMetadata(
    buffer: Buffer, 
    table: DynamicTable
  ): Promise<Result<StorageMetadata>> {
    try {
      console.log(`[GrpcDataStorageService] Reading metadata for table ${table.id}`);

      // 1. Parse buffer for query parameters if needed
      let queryParams = {};
      try {
        queryParams = JSON.parse(buffer.toString());
      } catch {
        // Use empty params if buffer is not valid JSON
      }

      // 2. Create query request to get row count
      const countQueryOptions = {
        orderBy: '',
        orderDirection: 'ASC',
        limit: 0,
        offset: 0,
        filters: (queryParams as any).filters || {}
      };
      
      const queryRequest = TableGrpcMapper.toQueryRowsRequest(
        table.id,
        table.storageLocation || `s3://emery-tables/${table.id.value}`,
        countQueryOptions,
        table.organizationId
      );
      
      // 3. Send to gRPC service
      const response = await this.grpcClient.queryRows(queryRequest);
      
      // 4. Handle response using TypeScript property access
      if (response && response.success) {
        const totalRows = response.totalCount || 0;
        
        return {
          success: true,
          data: {
            format: 'gRPC + Delta Lake',
            totalRows,
            totalBytes: buffer.length,
            lastModified: new Date(),
            tableId: table.id,
            databaseId: table.databaseId,
            organizationId: table.organizationId
          }
        };
      } else {
        const message = response?.message || 'Unknown response error';
        return {
          success: false,
          error: message || 'Failed to read metadata via gRPC'
        };
      }
      
    } catch (error) {
      console.error('[GrpcDataStorageService] Error reading metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read metadata via gRPC'
      };
    }
  }

  /**
   * Create table using gRPC service
   */
  async createTable(table: DynamicTable): Promise<Result<void>> {
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
        console.log(`[GrpcDataStorageService] Successfully created table ${table.name}`);
        return { success: true, data: undefined };
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
   * Delete table using gRPC service
   */
  async deleteTable(table: DynamicTable): Promise<Result<void>> {
    try {
      console.log(`[GrpcDataStorageService] Deleting table ${table.id}`);

      // 1. Create delete request
      const deleteRequest = DeleteTableRequest.create(
        {
          tableId: table.id.value.toString(), 
          organizationId: table.organizationId.value.toString(),
          softDelete: true
        }
      );

      
      // 2. Send to gRPC service
      const response = await this.grpcClient.deleteTable(deleteRequest);
      
      // 3. Handle response using TypeScript property access
      if (response && response.success) {
        console.log(`[GrpcDataStorageService] Successfully deleted table ${table.id}`);
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[GrpcDataStorageService] Failed to delete table: ${message}`);
        return {
          success: false,
          error: message || 'Failed to delete table via gRPC'
        };
      }
      
    } catch (error) {
      console.error('[GrpcDataStorageService] Error deleting table:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete table via gRPC'
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
}