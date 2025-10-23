/**
 * Dynamic Table Data Lake
 *
 * Infrastructure implementation for Delta Lake data storage via gRPC.
 * Handles JSON ↔ gRPC conversion for table data storage using domain entities.
 *
 * AIDEV-NOTE: Concrete implementation for gRPC + Delta Lake backend.
 * No interface needed - single implementation for data lake operations.
 */

import type { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import type { Result } from '@/ddd/domain/shared/result';
import { Row } from '@/ddd/domain/tables/value-objects/row';
import { GrpcTableClient } from '@/ddd/infrastructure/grpc/table-grpc-client';
import { TableGrpcMapper } from '@/ddd/infrastructure/grpc/table-grpc-mapper';
import { RowSerializer } from './row-serializer';
import { CreateTableRequest, DeleteTableRequest, UpdateTableRequest } from '@/lib/grpc/generated/table_service';

export class DynamicTableDataLake {
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
      console.log(`[DynamicTableDataLake] Storing ${rows.length} rows (mode: ${mode}) for table ${table.id}`);

      // Debug logging for table object
      console.log('[DynamicTableDataLake] Table object debug:');
      console.log(`  - table.id: ${table.id?.value}`);
      console.log(`  - table.organizationId: ${table.organizationId?.value}`);
      console.log(`  - table.storageLocation: ${table.storageLocation}`);
      console.log(`  - write mode: ${mode}`);

      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;
      console.log(`[DynamicTableDataLake] Using s3Path: ${s3Path}`);

      // 1. Serialize rows for Delta Lake storage (arrays → JSON strings)
      // AIDEV-NOTE: RowSerializer handles complex field type serialization
      // Create serialized plain objects for each row
      const serializedData = rows.map(row => ({
        id: row.id.value,
        data: RowSerializer.serializeForStorage(row, table.fields)
      }));

      // 2. Convert serialized data to protobuf request with mode
      const createRequest = TableGrpcMapper.toCreateRowsRequestFromData(
        table.id,
        serializedData,
        table.organizationId,
        s3Path,
        mode
      );

      // 3. Send to gRPC service
      const response = await this.grpcClient.createRows(createRequest);

      // 4. Handle response using TypeScript property access
      if (response && response.success) {
        console.log(`[DynamicTableDataLake] Successfully stored ${rows.length} rows (mode: ${mode})`);
        return {
          success: true,
          data: undefined
        };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[DynamicTableDataLake] Failed to store rows: ${message}`);
        return {
          success: false,
          error: message || 'Failed to store data via gRPC'
        };
      }

    } catch (error) {
      console.error('[DynamicTableDataLake] Error storing data:', error);
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
      console.log(`[DynamicTableDataLake.retrieveRows] === ENTRY ===`);
      console.log(`[DynamicTableDataLake.retrieveRows] Table ID: ${table.id.value}`);
      console.log(`[DynamicTableDataLake.retrieveRows] Table name: ${table.name}`);
      console.log(`[DynamicTableDataLake.retrieveRows] Storage location: ${table.storageLocation}`);
      console.log(`[DynamicTableDataLake.retrieveRows] Options:`, JSON.stringify(options, null, 2));

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

      console.log(`[DynamicTableDataLake.retrieveRows] Query request created:`, {
        tableId: table.id.value,
        s3Path: table.storageLocation || `s3://emery-tables/${table.id.value}`,
        limit,
        offset,
        orderBy,
        orderDirection,
        filterCount: Object.keys(filters).length
      });

      // 2. Send to gRPC service
      console.log(`[DynamicTableDataLake.retrieveRows] Calling grpcClient.queryRows...`);
      const response = await this.grpcClient.queryRows(queryRequest);
      console.log(`[DynamicTableDataLake.retrieveRows] gRPC response received:`, {
        success: response?.success,
        hasArrowData: !!(response?.arrowIpcStream),
        arrowDataLength: response?.arrowIpcStream?.length || 0,
        message: response?.message
      });

      // 3. Handle Arrow IPC response (zero-copy deserialization)
      if (response && response.success) {
        const arrowIpcBytes = response.arrowIpcStream;

        if (!arrowIpcBytes || arrowIpcBytes.length === 0) {
          console.log(`[DynamicTableDataLake.retrieveRows] No Arrow data returned - table is empty`);
          console.log(`[DynamicTableDataLake.retrieveRows] === EXIT === (empty result)`);
          return { success: true, data: [] };
        }

        console.log(`[DynamicTableDataLake.retrieveRows] Deserializing Arrow IPC bytes (${arrowIpcBytes.length} bytes)...`);

        // Deserialize Arrow IPC bytes to Arrow Table (zero-copy)
        const { tableFromIPC } = await import('apache-arrow');
        const arrowTable = tableFromIPC(arrowIpcBytes);

        console.log(`[DynamicTableDataLake.retrieveRows] Arrow table deserialized:`, {
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

          // Deserialize from Delta Lake storage (JSON strings → arrays/objects)
          // AIDEV-NOTE: RowSerializer handles complex field type deserialization
          const deserializedData = RowSerializer.deserializeFromStorage(rowData, table.fields);

          // Convert to domain Row entity with clean deserialized data
          const row = Row.fromPlainObject(deserializedData, table.id.value, table.fields as any);
          rows.push(row);
        }

        console.log(`[DynamicTableDataLake.retrieveRows] Converted ${rows.length} Arrow rows to domain Row entities`);
        console.log(`[DynamicTableDataLake.retrieveRows] Sample row:`, rows[0]?.toPlainObject());
        console.log(`[DynamicTableDataLake.retrieveRows] === EXIT === (success: ${rows.length} rows)`);
        return { success: true, data: rows };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[DynamicTableDataLake.retrieveRows] gRPC query failed: ${message}`);
        console.error(`[DynamicTableDataLake.retrieveRows] === EXIT === (error)`);
        return {
          success: false,
          error: message || 'Failed to retrieve data via gRPC'
        };
      }

    } catch (error) {
      console.error('[DynamicTableDataLake.retrieveRows] === EXCEPTION ===');
      console.error('[DynamicTableDataLake.retrieveRows] Error retrieving data:', error);
      console.error('[DynamicTableDataLake.retrieveRows] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[DynamicTableDataLake.retrieveRows] Error stack:', error instanceof Error ? error.stack : 'N/A');
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
      console.log(`[DynamicTableDataLake] Creating table ${table.name} with ${table.fields.length} fields`);

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

      console.log(`[DynamicTableDataLake] Creating table with schema:`, {
        name: table.name,
        fieldCount: protoFields.length,
        fields: protoFields.map(f => f.name)
      });

      // 5. Send to gRPC service
      const response = await this.grpcClient.createTable(createRequest);

      // 6. Handle response
      if (response && response.success) {
        const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;
        console.log(`[DynamicTableDataLake] Successfully created table ${table.name} at ${s3Path}`);
        return { success: true, data: s3Path };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[DynamicTableDataLake] Failed to create table: ${message}`);
        return {
          success: false,
          error: message || 'Failed to create table via gRPC'
        };
      }

    } catch (error) {
      console.error('[DynamicTableDataLake] Error creating table:', error);
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
      console.log(`[DynamicTableDataLake] Updating table ${table.id}`);

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
        console.log(`[DynamicTableDataLake] Successfully updated table ${table.id}`);
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[DynamicTableDataLake] Failed to update table: ${message}`);
        return {
          success: false,
          error: message || 'Failed to update table via gRPC'
        };
      }

    } catch (error) {
      console.error('[DynamicTableDataLake] Error updating table:', error);
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
    console.warn(`[DynamicTableDataLake] getTableStats not implemented for table ${table.id}, returning mock data`);
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
      console.log(`[DynamicTableDataLake] Deleting table storage for ${table.id}`);

      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;

      // Create delete table request
      const deleteRequest = DeleteTableRequest.create({
        tableId: table.id.value.toString(),
        organizationId: table.organizationId.value.toString(),
        softDelete: true
      });

      const response = await this.grpcClient.deleteTable(deleteRequest);

      if (response && response.success) {
        console.log(`[DynamicTableDataLake] Successfully deleted table storage for ${table.id}`);
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        console.error(`[DynamicTableDataLake] Failed to delete table storage: ${message}`);
        return {
          success: false,
          error: message || 'Failed to delete table storage via gRPC'
        };
      }
    } catch (error) {
      console.error('[DynamicTableDataLake] Error deleting table storage:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete table storage via gRPC'
      };
    }
  }
}
