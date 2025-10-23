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
   *
   * @param mode - "append" adds new rows, "overwrite" replaces entire table
   */
  async storeRows(
    rows: Row[],
    table: DynamicTable,
    mode: 'append' | 'overwrite'
  ): Promise<Result<void>> {
    try {
      console.log(`[GrpcDataStorageService] Storing ${rows.length} rows (mode: ${mode}) for table ${table.id}`);

      // Debug logging for table object
      console.log('[GrpcDataStorageService] Table object debug:');
      console.log(`  - table.id: ${table.id?.value}`);
      console.log(`  - table.organizationId: ${table.organizationId?.value}`);
      console.log(`  - table.storageLocation: ${table.storageLocation}`);
      console.log(`  - write mode: ${mode}`);

      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;
      console.log(`[GrpcDataStorageService] Using s3Path: ${s3Path}`);

      // 1. Convert domain rows to protobuf request with mode
      const createRequest = TableGrpcMapper.toCreateRowsRequest(
        table.id,
        rows,
        table.organizationId,
        s3Path,
        mode
      );

      // 3. Send to gRPC service
      const response = await this.grpcClient.createRows(createRequest);

      // 4. Handle response using TypeScript property access
      if (response && response.success) {
        console.log(`[GrpcDataStorageService] Successfully stored ${rows.length} rows (mode: ${mode})`);
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
   * Receives Arrow IPC bytes from Python service for zero-copy transfer
   * Deserializes to Arrow Table and converts to domain entities
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
      console.log(`[GrpcDataStorageService.retrieveRows] === ENTRY ===`);
      console.log(`[GrpcDataStorageService.retrieveRows] Table ID: ${table.id.value}`);
      console.log(`[GrpcDataStorageService.retrieveRows] Table name: ${table.name}`);
      console.log(`[GrpcDataStorageService.retrieveRows] Storage location: ${table.storageLocation}`);
      console.log(`[GrpcDataStorageService.retrieveRows] Options:`, JSON.stringify(options, null, 2));

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

      console.log(`[GrpcDataStorageService.retrieveRows] Query request created:`, {
        tableId: table.id.value,
        s3Path: table.storageLocation || `s3://emery-tables/${table.id.value}`,
        limit,
        offset,
        orderBy,
        orderDirection,
        filterCount: Object.keys(filters).length
      });

      // 2. Send to gRPC service
      console.log(`[GrpcDataStorageService.retrieveRows] Calling grpcClient.queryRows...`);
      const response = await this.grpcClient.queryRows(queryRequest);
      console.log(`[GrpcDataStorageService.retrieveRows] gRPC response received:`, {
        success: response?.success,
        hasArrowData: !!(response?.arrowIpcStream),
        arrowDataLength: response?.arrowIpcStream?.length || 0,
        message: response?.message
      });

      // 3. Handle Arrow IPC response (zero-copy deserialization)
      if (response && response.success) {
        const arrowIpcBytes = response.arrowIpcStream;

        if (!arrowIpcBytes || arrowIpcBytes.length === 0) {
          console.log(`[GrpcDataStorageService.retrieveRows] No Arrow data returned - table is empty`);
          console.log(`[GrpcDataStorageService.retrieveRows] === EXIT === (empty result)`);
          return { success: true, data: [] };
        }

        console.log(`[GrpcDataStorageService.retrieveRows] Deserializing Arrow IPC bytes (${arrowIpcBytes.length} bytes)...`);

        // Deserialize Arrow IPC bytes to Arrow Table (zero-copy)
        const { tableFromIPC } = await import('apache-arrow');
        const arrowTable = tableFromIPC(arrowIpcBytes);

        console.log(`[GrpcDataStorageService.retrieveRows] Arrow table deserialized:`, {
          numRows: arrowTable.numRows,
          numCols: arrowTable.numCols,
          schema: arrowTable.schema.fields.map(f => ({ name: f.name, type: f.type.toString() }))
        });

        // Convert Arrow Table to domain Row entities
        const rows: Row[] = [];
        for (let i = 0; i < arrowTable.numRows; i++) {
          const rowData: Record<string, any> = {};

          // Extract data from each column
          for (const field of arrowTable.schema.fields) {
            const column = arrowTable.getChild(field.name);
            rowData[field.name] = column?.get(i);
          }

          // Convert to domain Row entity
          const row = Row.fromPlainObject(rowData, table.id.value, table.fields as any);
          rows.push(row);
        }

        console.log(`[GrpcDataStorageService.retrieveRows] Converted ${rows.length} Arrow rows to domain Row entities`);
        console.log(`[GrpcDataStorageService.retrieveRows] Sample row:`, rows[0]?.toPlainObject());
        console.log(`[GrpcDataStorageService.retrieveRows] === EXIT === (success: ${rows.length} rows)`);
        return { success: true, data: rows };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[GrpcDataStorageService.retrieveRows] gRPC query failed: ${message}`);
        console.error(`[GrpcDataStorageService.retrieveRows] === EXIT === (error)`);
        return {
          success: false,
          error: message || 'Failed to retrieve data via gRPC'
        };
      }

    } catch (error) {
      console.error('[GrpcDataStorageService.retrieveRows] === EXCEPTION ===');
      console.error('[GrpcDataStorageService.retrieveRows] Error retrieving data:', error);
      console.error('[GrpcDataStorageService.retrieveRows] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[GrpcDataStorageService.retrieveRows] Error stack:', error instanceof Error ? error.stack : 'N/A');
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
      console.log(`[GrpcDataStorageService] Creating table ${table.name} with ${table.fields.length} fields`);

      // Convert domain fields to protobuf format
      // AIDEV-NOTE: table.fields includes system 'id' field (added by repository)
      // This ensures PostgreSQL and Delta Lake schemas match exactly
      const protoFields = table.fields.map(field => ({
        name: field.name,
        type: TableGrpcMapper.mapFieldTypeToProto(field.type),
        required: field.required || false,
        metadata: field.metadata || {}
      }));

      // Create request with complete field schema from domain entity
      const createRequest = CreateTableRequest.create({
        name: table.name,
        schema: {
          schemaId: `schema_${Date.now()}`,
          name: 'default',
          version: '1.0',
          fields: protoFields,
          metadata: {},
        },
        description: table.description || '',
        organizationId: table.organizationId.value.toString(),
        s3Path: table.storageLocation || `s3://emery-tables/${table.id.value}`
      });

      console.log(`[GrpcDataStorageService] Creating table with schema:`, {
        name: table.name,
        fieldCount: protoFields.length,
        fields: protoFields.map(f => f.name)
      });
      
      // 5. Send to gRPC service
      const response = await this.grpcClient.createTable(createRequest);
      
      // 6. Handle response
      if (response && response.success) {
        const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;
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

  // AIDEV-NOTE: updateRows() and deleteRows() removed from interface.
  // Repository layer handles updates/deletes via read-modify-write pattern:
  // - Load all rows via retrieveRows()
  // - Modify rows in memory
  // - Write back via storeRows(mode="overwrite")
  // This pattern works well with Delta Lake's append-only architecture.

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
