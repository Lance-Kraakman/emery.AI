/**
 * S3 Table Repository Implementation
 * 
 * Infrastructure implementation for S3-based table operations using Apache Arrow files.
 * Replaces PostgreSQL dynamic tables with S3 storage for better scalability.
 * Uses simple atomic operations for small datasets (<100MB).
 * 
 * AIDEV-NOTE: Infrastructure implementation for S3 table storage with Apache Arrow files
 */

import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { db } from '@/lib/db/client';
import { tables, fields } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import type { Result } from '@/ddd/domain/shared/result';
import type { 
  IDynamicTableRepository,
  CreateDynamicTableData
} from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type {
  DynamicTable,
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '@/ddd/domain/tables/entities/dynamic-table';
import type { FieldType } from '@/ddd/domain/fields/entities/field';
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path';
import type { TableSchema, TableManifest, FieldSchema } from '@/ddd/domain/tables/value-objects/table-schema';
import { TableSchemaValidator } from '@/ddd/domain/tables/value-objects/table-schema';
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata';
import { FieldConfiguration } from '@/ddd/domain/tables/value-objects/field-configuration';
// AIDEV-NOTE: Removed S3Error - using proper Result pattern instead
import { ResultHelpers } from '@/ddd/domain/shared/result';
import type { DataStorageService } from '@/ddd/domain/tables/services/data-storage-service';
import type { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';

export class S3TableRepository implements IDynamicTableRepository {
  constructor(
    private readonly dataStorageService: DataStorageService,
    private readonly queryService: TableQueryService
  ) {}

  async create(data: CreateDynamicTableData): Promise<DynamicTable> {
    try {
      // 1. Create S3 path for the table
      const tableId = Date.now(); // Temporary - will get real ID after DB insert
      const s3Path = new S3TablePath(data.organizationId, data.databaseId, tableId);

      // 2. Create table record in PostgreSQL metadata
      const [tableRecord] = await db.insert(tables).values({
        name: data.name,
        databaseId: data.databaseId,
        organizationId: data.organizationId,
        s3Path: s3Path.path,
        metadata: data.metadata || null,
        createdBy: data.createdBy
      }).returning();

      // Update S3 path with real table ID
      const realS3Path = new S3TablePath(data.organizationId, data.databaseId, tableRecord.id);
      await db.update(tables)
        .set({ s3Path: realS3Path.path })
        .where(eq(tables.id, tableRecord.id));

      // 3. Initialize empty table in S3 (no fields created here - handled separately)
      await this.initializeEmptyTable(realS3Path);

      // 4. Return domain entity
      const dynamicTable: DynamicTable = {
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: realS3Path.path,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        createdBy: tableRecord.createdBy,
        createdAt: tableRecord.createdAt!,
        updatedAt: tableRecord.updatedAt!
      };

      console.log(`[S3TableRepository] Created table: ${dynamicTable.name} (ID: ${dynamicTable.id})`);

      return dynamicTable;

    } catch (error) {
      console.error('[S3TableRepository] Error creating table:', error);
      throw error;
    }
  }

  async findById(id: number): Promise<DynamicTable | null> {
    try {
      // Get table metadata from PostgreSQL
      const tableRecord = await db.query.tables.findFirst({
        where: eq(tables.id, id)
      });

      if (!tableRecord) {
        return null;
      }

      // Convert to domain entity
      const dynamicTable: DynamicTable = {
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: tableRecord.s3Path,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        createdBy: tableRecord.createdBy,
        createdAt: tableRecord.createdAt!,
        updatedAt: tableRecord.updatedAt!
      };

      return dynamicTable;

    } catch (error) {
      console.error('[S3TableRepository] Error getting table:', error);
      throw error;
    }
  }

  async findByOrganization(organizationId: number): Promise<DynamicTable[]> {
    try {
      const tableRecords = await db.query.tables.findMany({
        where: eq(tables.organizationId, organizationId)
      });

      return tableRecords.map(record => ({
        id: record.id,
        databaseId: record.databaseId,
        organizationId: record.organizationId,
        name: record.name,
        storageLocation: record.s3Path,
        metadata: record.metadata ? TableMetadata.fromDatabase(record.metadata).data : undefined,
        createdBy: record.createdBy,
        createdAt: record.createdAt!,
        updatedAt: record.updatedAt!
      }));

    } catch (error) {
      console.error('[S3TableRepository] Error finding tables by organization:', error);
      throw error;
    }
  }

  async findByDatabase(databaseId: number): Promise<DynamicTable[]> {
    try {
      const tableRecords = await db.query.tables.findMany({
        where: eq(tables.databaseId, databaseId)
      });

      return tableRecords.map(record => ({
        id: record.id,
        databaseId: record.databaseId,
        organizationId: record.organizationId,
        name: record.name,
        storageLocation: record.s3Path,
        metadata: record.metadata ? TableMetadata.fromDatabase(record.metadata).data : undefined,
        createdBy: record.createdBy,
        createdAt: record.createdAt!,
        updatedAt: record.updatedAt!
      }));

    } catch (error) {
      console.error('[S3TableRepository] Error finding tables by database:', error);
      throw error;
    }
  }

  async update(id: number, data: Partial<DynamicTable>): Promise<DynamicTable> {
    try {
      const [updatedRecord] = await db.update(tables)
        .set({
          name: data.name,
          metadata: data.metadata || null,
          updatedAt: new Date()
        })
        .where(eq(tables.id, id))
        .returning();

      if (!updatedRecord) {
        throw new Error(`Table ${id} not found`);
      }

      return {
        id: updatedRecord.id,
        databaseId: updatedRecord.databaseId,
        organizationId: updatedRecord.organizationId,
        name: updatedRecord.name,
        storageLocation: updatedRecord.s3Path,
        metadata: updatedRecord.metadata ? TableMetadata.fromDatabase(updatedRecord.metadata).data : undefined,
        createdBy: updatedRecord.createdBy,
        createdAt: updatedRecord.createdAt!,
        updatedAt: updatedRecord.updatedAt!
      };

    } catch (error) {
      console.error('[S3TableRepository] Error updating table:', error);
      throw error;
    }
  }

  async delete(id: number): Promise<void> {
    try {
      // 1. Get table to find S3 path
      const tableRecord = await db.query.tables.findFirst({
        where: eq(tables.id, id)
      });

      if (!tableRecord) {
        throw new Error('Table not found');
      }

      // 2. Delete all S3 objects for this table
      const s3Path = S3TablePath.fromPath(tableRecord.s3Path);
      await this.deleteS3Directory(s3Path.path);

      // 3. Delete fields from PostgreSQL
      await db.delete(fields).where(eq(fields.tableId, id));

      // 4. Delete table from PostgreSQL
      await db.delete(tables).where(eq(tables.id, id));

      console.log(`[S3TableRepository] Deleted table: ${tableRecord.name} (ID: ${id})`);

    } catch (error) {
      console.error('[S3TableRepository] Error deleting table:', error);
      throw error;
    }
  }

  async existsByStorageLocation(organizationId: number, storageLocation: string): Promise<boolean> {
    try {
      const tableRecord = await db.query.tables.findFirst({
        where: and(
          eq(tables.organizationId, organizationId),
          eq(tables.s3Path, storageLocation)
        )
      });

      return !!tableRecord;

    } catch (error) {
      console.error('[S3TableRepository] Error checking storage location existence:', error);
      throw error;
    }
  }

  async insertRow(tableId: number, data: CreateRowData): Promise<DynamicTableRow> {
    // AIDEV-NOTE: Simple atomic approach - load all data, add row, save all data
    try {
      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Get table schema for validation
      const schemaResult = await this.getTableSchema(tableId);
      if (!schemaResult.success || !schemaResult.data) {
        throw new Error(`Table schema error: ${schemaResult.error}`);
      }
      const schema = schemaResult.data;

      // 3. Validate row data
      const validation = TableSchemaValidator.validateRow(schema, data);
      if (!validation.success) {
        throw new Error(validation.errors?.join(', ') || 'Validation failed');
      }

      // 4. Add system fields
      const rowWithId: DynamicTableRow = {
        id: nanoid(),
        ...validation.data,
        created_at: new Date(),
        updated_at: new Date()
      };

      // 5. Get existing data from S3
      const s3Path = S3TablePath.fromPath(table.storageLocation);
      const existingData = await this.loadTableData(s3Path);

      // 6. Add new row
      existingData.push(rowWithId);

      // 7. Save back to S3
      await this.saveTableData(s3Path, existingData, schema);

      return rowWithId;

    } catch (error) {
      console.error('[S3TableRepository] Error inserting row:', error);
      throw error;
    }
  }

  async findRows(tableId: number, options?: RowQueryOptions): Promise<DynamicTableRow[]> {
    try {
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      const s3Path = S3TablePath.fromPath(table.storageLocation);
      
      // Simple atomic approach - load all data from Arrow file
      const allData = await this.loadTableData(s3Path);
      
      // Apply query options (filters, sorting, pagination)
      return this.applyQueryOptions(allData, options);

    } catch (error) {
      console.error('[S3TableRepository] Error finding rows:', error);
      throw error;
    }
  }

  async getRow(tableId: number, rowId: string): Promise<DynamicTableRow | null> {
    try {
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      const s3Path = S3TablePath.fromPath(table.storageLocation);
      
      // Simple atomic approach - load all data and find row
      const allData = await this.loadTableData(s3Path);
      
      return allData.find(row => row.id === rowId) || null;

    } catch (error) {
      console.error('[S3TableRepository] Error getting row:', error);
      throw error;
    }
  }

  async getRows(tableId: number, options?: RowQueryOptions): Promise<DynamicTableRow[]> {
    return this.findRows(tableId, options);
  }

  async updateRow(tableId: number, rowId: string, data: UpdateRowData): Promise<DynamicTableRow> {
    // AIDEV-NOTE: Simple atomic approach - load all data, update row, save all data
    try {
      // 1. Get table metadata and schema
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      const schemaResult = await this.getTableSchema(tableId);
      if (!schemaResult.success || !schemaResult.data) {
        throw new Error(`Table schema error: ${schemaResult.error}`);
      }
      const schema = schemaResult.data;

      // 2. Validate row data
      const validation = TableSchemaValidator.validateRow(schema, data);
      if (!validation.success) {
        throw new Error(validation.errors?.join(', ') || 'Validation failed');
      }

      // 3. Load all existing data
      const s3Path = S3TablePath.fromPath(table.storageLocation);
      const allData = await this.loadTableData(s3Path);

      // 4. Find and update the row
      const rowIndex = allData.findIndex(row => row.id === rowId);
      if (rowIndex === -1) {
        throw new Error(`Row ${rowId} not found`);
      }

      const updatedRow: DynamicTableRow = {
        ...allData[rowIndex],
        ...validation.data,
        updated_at: new Date()
      };
      
      allData[rowIndex] = updatedRow;

      // 5. Save all data back to S3
      await this.saveTableData(s3Path, allData, schema);

      console.log(`[S3TableRepository] Updated row ${rowId} in table ${table.name} using atomic approach`);

      return updatedRow;

    } catch (error) {
      console.error('[S3TableRepository] Error updating row:', error);
      throw error;
    }
  }

  async deleteRow(tableId: number, rowId: string): Promise<void> {
    // AIDEV-NOTE: Simple atomic approach - load all data, remove row, save all data
    try {
      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Get schema for saving data
      const schemaResult = await this.getTableSchema(tableId);
      if (!schemaResult.success || !schemaResult.data) {
        throw new Error(`Table schema error: ${schemaResult.error}`);
      }
      const schema = schemaResult.data;

      // 3. Load all existing data
      const s3Path = S3TablePath.fromPath(table.storageLocation);
      const allData = await this.loadTableData(s3Path);

      // 4. Filter out the row to delete
      const filteredData = allData.filter(row => row.id !== rowId);
      
      if (filteredData.length === allData.length) {
        throw new Error(`Row ${rowId} not found`);
      }

      // 5. Save filtered data back to S3
      await this.saveTableData(s3Path, filteredData, schema);

      console.log(`[S3TableRepository] Deleted row ${rowId} in table ${table.name} using atomic approach`);

    } catch (error) {
      console.error('[S3TableRepository] Error deleting row:', error);
      throw error;
    }
  }

  async tableExists(tableId: number): Promise<boolean> {
    try {
      const table = await this.findById(tableId);
      return !!table;

    } catch (error) {
      console.error('[S3TableRepository] Error checking table existence:', error);
      throw error;
    }
  }

  async getTableStats(tableId: number): Promise<{
    rowCount: number;
    sizeBytes: number;
    lastModified: Date;
  }> {
    try {
      // Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      const s3Path = S3TablePath.fromPath(table.storageLocation);
      
      try {
        // Get S3 object metadata
        const response = await s3Client.send(new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Path.getDataPath()
        }));

        // Load data to count rows (expensive - TODO: optimize with manifest)
        const data = await this.loadTableData(s3Path);

        return {
          rowCount: data.length,
          sizeBytes: response.ContentLength || 0,
          lastModified: response.LastModified || table.updatedAt || new Date()
        };

      } catch (error) {
        if ((error as any).name === 'NoSuchKey') {
          // Table exists but no data file yet
          return {
            rowCount: 0,
            sizeBytes: 0,
            lastModified: table.createdAt || new Date()
          };
        }
        throw error;
      }

    } catch (error) {
      console.error('[S3TableRepository] Error getting table stats:', error);
      throw error;
    }
  }

  async hasRows(tableId: number): Promise<boolean> {
    try {
      const stats = await this.getTableStats(tableId);
      return stats.rowCount > 0;

    } catch (error) {
      console.error('[S3TableRepository] Error checking if table has rows:', error);
      throw error;
    }
  }

  async findAll(): Promise<DynamicTable[]> {
    try {
      const tableRecords = await db.query.tables.findMany();

      return tableRecords.map(record => ({
        id: record.id,
        databaseId: record.databaseId,
        organizationId: record.organizationId,
        name: record.name,
        storageLocation: record.s3Path,
        metadata: record.metadata ? TableMetadata.fromDatabase(record.metadata).data : undefined,
        createdBy: record.createdBy,
        createdAt: record.createdAt!,
        updatedAt: record.updatedAt!
      }));

    } catch (error) {
      console.error('[S3TableRepository] Error finding all tables:', error);
      throw error;
    }
  }

  // Helper method to get table schema (used internally)
  private async getTableSchema(tableId: number): Promise<Result<TableSchema>> {
    try {
      // Get table record
      const tableRecord = await db.query.tables.findFirst({
        where: eq(tables.id, tableId)
      });

      if (!tableRecord) {
        return ResultHelpers.failure(`Table not found: ${tableId}`);
      }

      // Get field definitions
      const fieldRecords = await db.query.fields.findMany({
        where: eq(fields.tableId, tableId)
      });

      // Parse table metadata using value object
      const tableMetadataResult = TableMetadata.fromDatabase(tableRecord.metadata);
      if (!tableMetadataResult.success) {
        return ResultHelpers.failure(`Invalid table metadata: ${tableMetadataResult.error}`);
      }

      // Process field configurations using value objects
      const fieldSchemas: FieldSchema[] = [];
      for (const field of fieldRecords) {
        const fieldConfigResult = FieldConfiguration.fromDatabase(field.fieldConfig);
        if (!fieldConfigResult.success) {
          return ResultHelpers.failure(`Invalid field configuration for field ${field.name}: ${fieldConfigResult.error}`);
        }

        fieldSchemas.push({
          id: field.id,
          name: field.name,
          slug: field.slug,
          type: this.validateFieldType(field.type),
          required: field.required || false,
          orderIndex: field.orderIndex || 0,
          fileConfig: fieldConfigResult.data?.fileConfig,
          relationConfig: fieldConfigResult.data?.relationConfig as any,
          metadata: (field as any).metadata || {}
        });
      }

      const tableSchema: TableSchema = {
        id: tableRecord.id,
        organizationId: tableRecord.organizationId,
        databaseId: tableRecord.databaseId,
        name: tableRecord.name,
        s3Path: tableRecord.s3Path,
        fields: fieldSchemas,
        createdAt: tableRecord.createdAt || new Date(),
        updatedAt: tableRecord.updatedAt || new Date(),
        description: tableMetadataResult.data!.description,
        tags: tableMetadataResult.data!.tags as string[],
        metadata: tableMetadataResult.data!.getAllExtra()
      };

      return ResultHelpers.success(tableSchema);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[S3TableRepository] Error getting table schema:', error);
      return ResultHelpers.failure(`Failed to get table schema: ${errorMessage}`);
    }
  }

  // Helper method to get S3 path (used internally)
  private async getS3Path(tableId: number): Promise<S3TablePath> {
    const tableRecord = await db.query.tables.findFirst({
      where: eq(tables.id, tableId)
    });

    if (!tableRecord) {
      throw new Error('Table not found');
    }

    return S3TablePath.fromPath(tableRecord.s3Path);
  }


  // Delta Lake helper methods

  // Delta Lake query-time resolution methods

  /**
   * Resolves final dataset by applying Delta Lake pattern:
   * 1. Load all data files (main + additional inserts)
   * 2. Load tombstones and updates
   * 3. Apply tombstones to filter deleted rows
   * 4. Apply updates to supersede old versions
   * 5. Return resolved dataset
   * 
   * AIDEV-NOTE: Core Delta Lake resolution logic for query-time data consistency
   */
  private async resolveData(s3Path: S3TablePath, tableId: number): Promise<DynamicTableRow[]> {
    try {
      // 1. Get table schema for data loading
      const schemaResult = await this.getTableSchema(tableId);
      if (!schemaResult.success) {
        throw new Error(`Table schema error: ${schemaResult.error}`);
      }
      const schema = schemaResult.data;

      // 2. Load all data files (main table data)
      const baseData = await this.loadTableData(s3Path);
      
      // 3. Load update files
      const updateData = await this.loadUpdateFiles(s3Path, schema!);
      
      // 4. Load tombstones
      const tombstonesResult = await this.loadTombstones(s3Path);
      if (!tombstonesResult.success) {
        throw new Error(`Failed to load tombstones: ${tombstonesResult.error}`);
      }
      const tombstones = tombstonesResult.data;
      
      // 5. Create lookup maps for efficiency
      const deletedRowIds = new Set<string>();
      const updatedRowData = new Map<string, DynamicTableRow>();
      
      if (tombstones) {
        for (const entry of tombstones.entries) {
          if (entry.operation === 'DELETE') {
            deletedRowIds.add(entry.rowId);
          } else if (entry.operation === 'UPDATE' && entry.updateFile) {
            // Updated row data is in update files, will be added separately
            deletedRowIds.add(entry.rowId); // Mark old version as deleted
          }
        }
      }
      
      // 6. Add update data to the map
      for (const row of updateData) {
        updatedRowData.set(row.id, row);
      }
      
      // 7. Filter base data (remove deleted rows)
      const activeBaseData = baseData.filter(row => !deletedRowIds.has(row.id));
      
      // 8. Combine base data with updates
      const resolvedData = [...activeBaseData, ...Array.from(updatedRowData.values())];
      
      console.log(`[S3TableRepository] Resolved ${resolvedData.length} rows (${baseData.length} base, ${updateData.length} updates, ${deletedRowIds.size} tombstoned)`);
      
      return resolvedData;
      
    } catch (error) {
      console.error('[S3TableRepository] Error resolving data:', error);
      throw error;
    }
  }

  /**
   * Load all update files for a table
   */
  private async loadUpdateFiles(s3Path: S3TablePath, schema: TableSchema): Promise<DynamicTableRow[]> {
    try {
      // List all update files in the updates/ subdirectory
      const updatePrefix = s3Path.path + 'updates/';
      
      const listResponse = await s3Client.send(new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: updatePrefix
      }));
      
      const updateData: DynamicTableRow[] = [];
      
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        // Load each update file
        for (const object of listResponse.Contents) {
          if (object.Key && object.Key.endsWith('.parquet')) {
            try {
              const response = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: object.Key
              }));
              
              if (response.Body) {
                const buffer = await this.streamToBuffer(response.Body as any);
                const result = await this.dataStorageService.retrieveData(buffer, schema!);
                
                if (result.success && result.data) {
                  updateData.push(...(result.data as DynamicTableRow[]));
                }
              }
            } catch (error) {
              console.warn(`[S3TableRepository] Failed to load update file ${object.Key}:`, error);
              // Continue with other files
            }
          }
        }
      }
      
      return updateData;
      
    } catch (error) {
      console.error('[S3TableRepository] Error loading update files:', error);
      return []; // Return empty array on error, don't fail entire query
    }
  }

  /**
   * Apply query options to resolved data (filters, sorting, pagination)
   */
  private applyQueryOptions(data: DynamicTableRow[], options?: RowQueryOptions): DynamicTableRow[] {
    let result = [...data];
    
    // TODO: Apply filters when implemented
    // if (options?.filters) {
    //   result = this.applyFilters(result, options.filters);
    // }
    
    // Apply sorting
    if (options?.orderBy) {
      const field = options.orderBy;
      const direction = options.orderDirection || 'ASC';
      
      result.sort((a, b) => {
        const aVal = a[field];
        const bVal = b[field];
        
        if (aVal === bVal) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else if (aVal instanceof Date && bVal instanceof Date) {
          comparison = aVal.getTime() - bVal.getTime();
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return direction === 'ASC' ? comparison : -comparison;
      });
    }
    
    // Apply pagination
    const offset = options?.offset || 0;
    const limit = options?.limit;
    
    if (offset > 0 || limit !== undefined) {
      const endIndex = limit !== undefined ? offset + limit : undefined;
      result = result.slice(offset, endIndex);
    }
    
    return result;
  }


  // Private helper methods

  private async initializeEmptyTable(s3Path: S3TablePath): Promise<void> {
    // Create empty Arrow file with minimal structure
    const emptyData: any[] = [];
    
    // Create a minimal table schema for empty initialization
    const emptySchema: TableSchema = {
      id: 0,
      organizationId: 0,
      databaseId: 0,
      name: 'empty',
      s3Path: s3Path.path,
      fields: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      description: '',
      tags: [],
      metadata: {}
    };

    const result = await this.dataStorageService.storeData(emptyData, emptySchema);
    if (!result.success) {
      throw new Error(`Failed to initialize empty table: ${result.error}`);
    }
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Path.getDataPath(),
      Body: result.data,
      ContentType: 'application/vnd.apache.arrow.file'
    }));
  }

  // AIDEV-NOTE: initializeEmptyTableWithSchema removed - was unused
  // Empty table initialization is handled by initializeEmptyTable instead
  private async loadTableData(s3Path: S3TablePath): Promise<any[]> {
    try {
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Path.getDataPath()
      }));

      if (!response.Body) {
        return [];
      }

      const buffer = Buffer.from(await response.Body.transformToByteArray());
      
      // Get the table schema to pass to data storage service
      const tableId = this.extractTableIdFromPath(s3Path);
      const schemaResult = await this.getTableSchema(tableId);
      if (!schemaResult.success) {
        throw new Error(`Table schema error for table ID ${tableId}: ${schemaResult.error}`);
      }
      const schema = schemaResult.data;
      
      const result = await this.dataStorageService.retrieveData(buffer, schema!);
      if (!result.success) {
        throw new Error(`Failed to retrieve data: ${result.error}`);
      }
      
      return result.data || [];

    } catch (error) {
      if ((error as any).name === 'NoSuchKey') {
        return [];
      }
      throw error;
    }
  }

  private async saveTableData(s3Path: S3TablePath, data: any[], schema: TableSchema): Promise<void> {
    const storageBuffer = await this.dataStorageService.storeData(data, schema);
    
    if (!storageBuffer.success) {
      throw new Error(`Failed to store data: ${storageBuffer.error}`);
    }

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Path.getDataPath(),
      Body: storageBuffer.data,
      ContentType: 'application/vnd.apache.arrow.file'
    }));
  }

  // Helper method to extract table ID from S3 path
  private extractTableIdFromPath(s3Path: S3TablePath): number {
    try {
      // Use the S3TablePath's built-in tableId property for reliable extraction
      return s3Path.tableId;
    } catch (error) {
      console.error('[S3TableRepository] Error extracting table ID from path:', error);
      return 0;
    }
  }

  private async deleteS3Directory(prefix: string): Promise<void> {
    // TODO: Implement S3 directory deletion
    // Need to list all objects with prefix and delete them
    console.warn('S3 directory deletion not yet implemented for:', prefix);
  }

  /**
   * Convert AWS S3 stream to Buffer
   * Helper method for reading S3 object data
   */
  private async streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  /**
   * Validate field type and return proper FieldType
   * Ensures field types conform to domain specifications
   */
  private validateFieldType(fieldType: string): FieldType {
    const validTypes: FieldType[] = ['text', 'number', 'boolean', 'email', 'url', 'date', 'relation', 'file'];
    
    if (validTypes.includes(fieldType as FieldType)) {
      return fieldType as FieldType;
    }
    
    console.warn(`[S3TableRepository] Invalid field type: ${fieldType}, defaulting to 'text'`);
    return 'text';
  }
}