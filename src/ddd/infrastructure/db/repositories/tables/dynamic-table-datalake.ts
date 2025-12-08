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
import type { TableField } from '@/ddd/domain/tables/value-objects/table-field';
import { GrpcTableClient } from '@/ddd/infrastructure/db/repositories/tables/table-grpc-client';
import { TableGrpcMapper } from '@/ddd/infrastructure/db/repositories/tables/table-grpc-mapper';
import { RowSerializer } from './row-serializer';
import { CreateTableRequest, DeleteTableRequest, UpdateTableRequest } from '@/lib/grpc/generated/table_service';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('DataLake');

/**
 * Convert field name to field ID for Delta Lake queries
 * Delta Lake columns use numeric field IDs (79, 80), not field names ('test', 'name')
 *
 * AIDEV-NOTE: System columns (id, created_at, updated_at) are special - they exist on all rows
 * and use their literal names in Delta Lake, not numeric field IDs.
 *
 * @param fieldName - Human-readable field name
 * @param fields - Table field definitions
 * @returns Numeric field ID as string for user fields, literal name for system columns, or null if not found
 */
function convertFieldNameToId(
  fieldName: string,
  fields: readonly TableField[]
): string | null {
  // AIDEV-NOTE: System columns don't need conversion - they use literal names in Delta Lake
  const systemColumns = ['id', 'created_at', 'updated_at'];
  if (systemColumns.includes(fieldName)) {
    logger.debug('System column - no conversion needed', { fieldName });
    return fieldName; // Return as-is for system columns
  }

  const field = fields.find(f => f.name === fieldName);

  if (field) {
    logger.debug('Converted field name to ID', {
      fieldName,
      fieldId: field.id.value.toString()
    });
    return field.id.value.toString();
  }

  logger.error('Field not found in table schema', {
    fieldName,
    availableFields: fields.map(f => f.name)
  });
  return null;
}

/**
 * Convert filter field names to field IDs for Delta Lake queries
 *
 * AIDEV-NOTE: System columns (id, created_at, updated_at) are passed through unchanged.
 *
 * @param filters - Array of filters using field names
 * @param fields - Table field definitions
 * @returns Filters with field names converted to field IDs
 */
function convertFiltersToFieldIds(
  filters: any[],
  fields: readonly TableField[]
): any[] {
  return filters.map(filter => {
    // System columns don't need ID conversion
    const systemColumns = ['id', 'created_at', 'updated_at'];
    if (systemColumns.includes(filter.field)) {
      logger.debug('System column filter - no conversion needed', { field: filter.field });
      return filter; // Keep system columns as-is
    }

    const fieldId = convertFieldNameToId(filter.field, fields);

    if (!fieldId) {
      // Field not found - return original filter (will likely fail, but preserves error context)
      return filter;
    }

    return {
      ...filter,
      field: fieldId
    };
  });
}

export class DynamicTableDataLake {
  constructor(
    private readonly grpcClient: GrpcTableClient,
  ) {}

  /**
   * Create new rows in a table using gRPC service
   * Converts domain entities to protobuf and appends to Delta Lake table
   */
  async createRows(
    rows: Row[],
    table: DynamicTable
  ): Promise<Result<void>> {
    try {
      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;

      logger.debug('Creating rows', {
        tableId: table.id.value,
        rowCount: rows.length,
        s3Path
      });

      // 1. Serialize rows for Delta Lake storage (arrays → JSON strings)
      // AIDEV-NOTE: RowSerializer handles complex field type serialization
      // Create serialized plain objects for each row
      const serializedData = rows.map(row => ({
        id: row.id.value,
        data: RowSerializer.serializeForStorage(row, table.fields)
      }));

      // 2. Convert serialized data to protobuf request (always append mode)
      const createRequest = TableGrpcMapper.toCreateRowsRequestFromData(
        table.id,
        serializedData,
        table.organizationId,
        table.fields,
        s3Path,
        'append'
      );

      // 3. Send to gRPC service
      const response = await this.grpcClient.createRows(createRequest);

      // 4. Handle response using TypeScript property access
      if (response && response.success) {
        logger.summary('Created rows', { tableId: table.id.value, count: rows.length });
        return {
          success: true,
          data: undefined
        };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to create rows', message);
        return {
          success: false,
          error: message || 'Failed to create rows via gRPC'
        };
      }

    } catch (error) {
      logger.error('Error creating rows', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create rows via gRPC'
      };
    }
  }

  /**
   * Update rows in a table using Delta Lake merge operation
   * Converts domain entities to protobuf and sends to Python service for efficient upsert
   * Only writes the updated rows, not the entire table
   */
  async updateRows(
    rows: Row[],
    table: DynamicTable
  ): Promise<Result<void>> {
    try {
      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;

      logger.debug('Updating rows via merge', {
        tableId: table.id.value,
        rowCount: rows.length
      });

      // 1. Serialize rows for Delta Lake storage (arrays → JSON strings)
      // AIDEV-NOTE: RowSerializer handles complex field type serialization
      const serializedData = rows.map(row => ({
        id: row.id.value,
        data: RowSerializer.serializeForStorage(row, table.fields)
      }));

      // 2. Convert serialized data to protobuf UpdateRowsRequest
      const updateRequest = TableGrpcMapper.toUpdateRowsRequestFromData(
        table.id,
        serializedData,
        table.organizationId,
        table.fields,
        s3Path
      );

      // 3. Send to gRPC service (will use Delta Lake merge)
      const response = await this.grpcClient.updateRows(updateRequest);

      // 4. Handle response
      if (response && response.success) {
        logger.summary('Updated rows', { tableId: table.id.value, count: rows.length });
        return {
          success: true,
          data: undefined
        };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to update rows', message);
        return {
          success: false,
          error: message || 'Failed to update rows via gRPC'
        };
      }

    } catch (error) {
      logger.error('Error updating rows', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update rows via gRPC'
      };
    }
  }

  /**
   * Delete rows from a table using Delta Lake delete operation
   * Performs efficient row-level deletes without rewriting entire table
   */
  async deleteRows(
    rowIds: string[],
    table: DynamicTable
  ): Promise<Result<void>> {
    try {
      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;

      logger.debug('Deleting rows', {
        tableId: table.id.value,
        rowCount: rowIds.length
      });

      // 1. Convert to protobuf DeleteRowsRequest
      const deleteRequest = TableGrpcMapper.toDeleteRowsRequest(
        table.id,
        rowIds,
        table.organizationId,
        s3Path
      );

      // 2. Send to gRPC service (will use Delta Lake delete)
      const response = await this.grpcClient.deleteRows(deleteRequest);

      // 3. Handle response
      if (response && response.success) {
        logger.summary('Deleted rows', { tableId: table.id.value, count: rowIds.length });
        return {
          success: true,
          data: undefined
        };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to delete rows', message);
        return {
          success: false,
          error: message || 'Failed to delete rows via gRPC'
        };
      }

    } catch (error) {
      logger.error('Error deleting rows', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete rows via gRPC'
      };
    }
  }

  /**
   * Retrieve rows from a table using gRPC service (DynamicTable overload)
   * Delegates to retrieveRows with raw params
   */
  async retrieveRows(
    table: DynamicTable,
    options: {
      limit?: number;
      offset?: number;
      filters?: Record<string, any>;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      aggregations?: Array<{
        fieldId: string;
        type: string;
        alias: string;
        formatType?: string;
      }>;
    } = {}
  ): Promise<Result<{ rows: Row[]; totalCount: number }>> {
    return this.retrieveRowsWithParams(
      {
        tableId: table.id.value,
        s3Path: table.storageLocation || `s3://emery-tables/${table.id.value}`,
        organizationId: table.organizationId.value,
        fields: table.fields,
      },
      options
    );
  }

  /**
   * Retrieve rows using raw table parameters
   * Receives Arrow IPC bytes from Python service for zero-copy transfer
   * Deserializes to Arrow Table and converts to domain entities
   * Returns rows and totalCount from gRPC response
   *
   * AIDEV-NOTE: This method accepts raw params instead of DynamicTable entity.
   * Used when full entity isn't available (e.g., public views with pre-fetched metadata).
   * Extended to support aggregations for metric/dashboard views.
   */
  async retrieveRowsWithParams(
    params: {
      tableId: number;
      s3Path: string;
      organizationId: number;
      fields: readonly TableField[];
    },
    options: {
      limit?: number;
      offset?: number;
      filters?: Record<string, any>;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
      aggregations?: Array<{
        fieldId: string;
        type: string;
        alias: string;
        formatType?: string;
      }>;
    } = {}
  ): Promise<Result<{ rows: Row[]; totalCount: number }>> {
    const startTime = Date.now();
    const { tableId, s3Path, organizationId, fields } = params;

    try {
      const { limit = 1000, offset = 0, filters = {}, orderBy = '', orderDirection = 'ASC', aggregations } = options;

      // Build query summary for logging
      const orderClause = orderBy ? `${orderBy} ${orderDirection}` : 'none';
      const filterCount = Object.keys(filters).length;
      const aggCount = aggregations?.length || 0;

      logger.debug('Query started', {
        tableId,
        limit,
        offset,
        orderBy: orderClause,
        filters: filterCount,
        aggregations: aggCount
      });

      // AIDEV-NOTE: Convert field names to field IDs for Delta Lake queries
      // Delta Lake columns use numeric field IDs (79, 80), not field names ('test', 'name')

      // Convert orderBy from field name to field ID
      const orderByFieldId = orderBy ? convertFieldNameToId(orderBy, fields) || '' : '';

      // Convert filter field names to field IDs
      const convertedFilters = Array.isArray(filters) && filters.length > 0
        ? convertFiltersToFieldIds(filters, fields)
        : filters;

      // Create query request (with converted field IDs)
      const queryOptions = {
        orderBy: orderByFieldId,
        orderDirection,
        limit,
        offset,
        filters: convertedFilters,
        aggregations
      };

      // Import value objects for gRPC mapper
      const { TableId } = await import('@/ddd/domain/shared/value-objects/table-id');
      const { OrganizationId } = await import('@/ddd/domain/shared/value-objects/organization-id');

      const queryRequest = TableGrpcMapper.toQueryRowsRequest(
        TableId.fromNumber(tableId),
        s3Path,
        queryOptions,
        OrganizationId.fromNumber(organizationId)
      );

      // 2. Send to gRPC service
      const response = await this.grpcClient.queryRows(queryRequest);

      // 3. Handle Arrow IPC response (zero-copy deserialization)
      if (response && response.success) {
        const arrowIpcBytes = response.arrowIpcStream;
        const totalCount = response.totalCount || 0;

        if (!arrowIpcBytes || arrowIpcBytes.length === 0) {
          logger.summary('Query completed (empty)', { tableId, totalCount: 0 });
          return { success: true, data: { rows: [], totalCount } };
        }

        // Deserialize Arrow IPC bytes to Arrow Table (zero-copy)
        const { tableFromIPC } = await import('apache-arrow');
        const arrowTable = tableFromIPC(arrowIpcBytes);

        logger.debug('Arrow deserialized', {
          rows: arrowTable.numRows,
          columns: arrowTable.numCols,
          bytes: arrowIpcBytes.length
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
          const deserializedData = RowSerializer.deserializeFromStorage(rowData, fields);

          // Convert to domain Row entity with clean deserialized data
          const row = Row.fromPlainObject(deserializedData, tableId, fields as any);
          rows.push(row);
        }

        const elapsed = Date.now() - startTime;
        logger.summary('Query completed', {
          tableId,
          retrieved: rows.length,
          total: totalCount,
          time: `${elapsed}ms`
        });

        // Log sample row in debug mode only
        logger.debug('Sample row', rows[0]?.toPlainObject(fields));

        return { success: true, data: { rows, totalCount } };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Query failed', message);
        return {
          success: false,
          error: message || 'Failed to retrieve data via gRPC'
        };
      }

    } catch (error) {
      logger.error('Query exception', error);
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
      logger.debug('Creating table', {
        name: table.name,
        fieldCount: table.fields.length
      });

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

      // Send to gRPC service
      const response = await this.grpcClient.createTable(createRequest);

      // Handle response
      if (response && response.success) {
        const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;
        logger.summary('Created table', {
          name: table.name,
          tableId: table.id.value,
          fields: table.fields.length
        });
        return { success: true, data: s3Path };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to create table', message);
        return {
          success: false,
          error: message || 'Failed to create table via gRPC'
        };
      }

    } catch (error) {
      logger.error('Error creating table', error);
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
      logger.debug('Updating table', { tableId: table.id.value, name: table.name });

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
          s3Path: protoTable.s3Path,  // Include S3 path for Delta Lake schema updates
        }
      );

      // 3. Send to gRPC service
      const response = await this.grpcClient.updateTable(updateRequest);

      // 4. Handle response using TypeScript property access
      if (response && response.success) {
        logger.summary('Updated table', { tableId: table.id.value });
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to update table', message);
        return {
          success: false,
          error: message || 'Failed to update table via gRPC'
        };
      }

    } catch (error) {
      logger.error('Error updating table', error);
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
   * Get table statistics from Delta Lake metadata via gRPC
   *
   * This reads only the transaction log (_delta_log/*.json) to get
   * row count and file sizes without loading actual data files.
   * Much faster than loading all rows, especially for large tables.
   */
  async getTableStats(table: DynamicTable): Promise<Result<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }>> {
    try {
      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;

      // Create getTableStats request
      const statsRequest = TableGrpcMapper.toGetTableStatsRequest(
        table.id,
        s3Path,
        table.organizationId
      );

      // Call gRPC service
      const response = await this.grpcClient.getTableStats(statsRequest);

      if (response && response.success) {
        logger.summary('Table stats retrieved', {
          tableId: table.id.value,
          rows: response.rowCount,
          bytes: response.sizeBytes
        });
        return {
          success: true,
          data: {
            rowCount: Number(response.rowCount),
            sizeBytes: Number(response.sizeBytes),
            lastModified: table.updatedAt || new Date()
          }
        };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to get table stats', message);
        return {
          success: false,
          error: message || 'Failed to get table stats via gRPC'
        };
      }
    } catch (error) {
      logger.error('Error getting table stats', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get table stats via gRPC'
      };
    }
  }

  /**
   * Check if table has any rows using gRPC service
   * Uses totalCount from queryRows response
   */
  async hasRows(table: DynamicTable): Promise<Result<boolean>> {
    try {
      const result = await this.retrieveRows(table, { limit: 1 });
      if (result.success && result.data) {
        // Use totalCount instead of loaded rows length
        return { success: true, data: result.data.totalCount > 0 };
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
    * Add a field to the table using gRPC service
    */
  async addField(table: DynamicTable, field: TableField): Promise<Result<void>> {
    try {
      logger.debug('Adding field', { 
        tableId: table.id.value, 
        fieldName: field.name, 
        fieldType: field.type 
      });

      // Create add field request - pass the domain field directly
      const addRequest = TableGrpcMapper.toAddFieldRequest(
        table.id,
        field,
        table.organizationId,
        table.storageLocation || `s3://emery-tables/${table.id.value}`
      );

      // Send to gRPC service
      const response = await this.grpcClient.addField(addRequest);

      if (response && response.success) {
        logger.summary('Added field', { 
          tableId: table.id.value, 
          fieldName: field.name 
        });
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to add field', message);
        return {
          success: false,
          error: message || 'Failed to add field via gRPC'
        };
      }
    } catch (error) {
      logger.error('Error adding field', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add field via gRPC'
      };
    }
  }

  /**
    * Update a field in the table using gRPC service
    */
  async updateField(table: DynamicTable, field: TableField): Promise<Result<void>> {
    try {
      logger.debug('Updating field', { 
        tableId: table.id.value, 
        fieldName: field.name, 
        fieldType: field.type 
      });

      // Create update field request - pass the domain field directly
      const updateRequest = TableGrpcMapper.toUpdateFieldRequest(
        table.id,
        field.name,  // Current field name for lookup
        field,       // Updated field definition
        table.organizationId,
        table.storageLocation || `s3://emery-tables/${table.id.value}`
      );

      logger.debug('Sending updateField gRPC request', {
        fieldId: field.id.value,
        fieldName: field.name,
        fieldType: field.type,
        hasMetadata: !!field.metadata,
        metadataKeys: field.metadata ? Object.keys(field.metadata) : []
      });

      // Send to gRPC service
      const response = await this.grpcClient.updateField(updateRequest);

      if (response && response.success) {
        logger.summary('Updated field', { 
          tableId: table.id.value, 
          fieldName: field.name 
        });
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to update field', message);
        return {
          success: false,
          error: message || 'Failed to update field via gRPC'
        };
      }
    } catch (error) {
      logger.error('Error updating field', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update field via gRPC'
      };
    }
  }

  /**
     * Delete a field from table using gRPC service
     */
  async deleteField(table: DynamicTable, fieldId: number): Promise<Result<void>> {
    try {
      logger.debug('Deleting field', { 
        tableId: table.id.value, 
        fieldId 
      });

      // Create delete field request
      const deleteRequest = TableGrpcMapper.toDeleteFieldRequest(
        table.id,
        fieldId,
        table.organizationId,
        table.storageLocation || `s3://emery-tables/${table.id.value}`
      );

      // Send to gRPC service
      const response = await this.grpcClient.deleteField(deleteRequest);

      if (response && response.success) {
        logger.summary('Deleted field', { 
          tableId: table.id.value, 
          fieldId 
        });
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to delete field', message);
        return {
          success: false,
          error: message || 'Failed to delete field via gRPC'
        };
      }
    } catch (error) {
      logger.error('Error deleting field', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete field via gRPC'
      };
    }
  }

  /**
    * Get fields from the table using gRPC service
    */
  async getFields(table: DynamicTable): Promise<Result<TableField[]>> {
    try {
      logger.debug('Getting fields', { tableId: table.id.value });

      // Create get fields request
      const getFieldsRequest = TableGrpcMapper.toGetFieldsRequest(
        table.id,
        table.organizationId,
        table.storageLocation || `s3://emery-tables/${table.id.value}`
      );

      // Send to gRPC service
      const response = await this.grpcClient.getFields(getFieldsRequest);

      if (response && response.success) {
        const fields = response.fields || [];
        logger.summary('Retrieved fields', { 
          tableId: table.id.value, 
          fieldCount: fields.length 
        });
        
        // Convert protobuf fields back to domain TableField objects
        const domainFields = fields.map(protoField => 
          TableGrpcMapper.fromProtoField(protoField)
        );

        return { success: true, data: domainFields };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to get fields', message);
        return {
          success: false,
          error: message || 'Failed to get fields via gRPC'
        };
      }
    } catch (error) {
      logger.error('Error getting fields', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get fields via gRPC'
      };
    }
  }

  /**
    * Delete the entire table storage using gRPC service
    */
  async deleteTable(table: DynamicTable): Promise<Result<void>> {
    try {
      const s3Path = table.storageLocation || `s3://emery-tables/${table.id.value}`;

      logger.debug('Deleting table storage', { tableId: table.id.value, s3Path });

      // Create delete table request
      const deleteRequest = DeleteTableRequest.create({
        tableId: table.id.value.toString(),
        organizationId: table.organizationId.value.toString(),
        softDelete: true
      });

      const response = await this.grpcClient.deleteTable(deleteRequest);

      if (response && response.success) {
        logger.summary('Deleted table storage', { tableId: table.id.value });
        return { success: true, data: undefined };
      } else {
        const message = response?.message || 'Unknown response error';
        logger.error('Failed to delete table storage', message);
        return {
          success: false,
          error: message || 'Failed to delete table storage via gRPC'
        };
      }
    } catch (error) {
      logger.error('Error deleting table storage', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete table storage via gRPC'
      };
    }
  }
}
