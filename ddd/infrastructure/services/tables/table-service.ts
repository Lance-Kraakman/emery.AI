/**
 * Table Service Implementation
 * 
 * Infrastructure service coordinating table operations across:
 * - PostgreSQL metadata (tables table)
 * - Field metadata (via IFieldRepository) 
 * - S3 file storage (via IFileStorageRepository)
 * - Arrow data conversion (via DataStorageService)
 * - Query operations (via TableQueryService)
 * 
 * AIDEV-NOTE: Renamed from S3TableRepository → TableRepository → TableService
 * This is a service coordinating multiple storage layers, not just a repository
 */

import { db } from '@/lib/db/client';
import { tables, fields } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { s3Client, BUCKET_NAME } from '@/lib/s3/client';
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

import type { Result } from '@/ddd/domain/shared/result';
import { TableId, DatabaseId, OrganizationId } from '@/ddd/domain/shared/value-objects';
import type { 
  IDynamicTableRepository,
  CreateDynamicTableData
} from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import {
  DynamicTable,
  type DynamicTableRow,
  type CreateRowData,
  type UpdateRowData,
  type RowQueryOptions
} from '@/ddd/domain/tables/entities/dynamic-table';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { FieldType } from '@/ddd/domain/fields/entities/field';
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path';
import type { TableSchema, TableManifest, FieldSchema } from '@/ddd/domain/tables/value-objects/table-schema';
import { TableSchemaValidator } from '@/ddd/domain/tables/value-objects/table-schema';
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata';
import { FieldConfiguration } from '@/ddd/domain/tables/value-objects/field-configuration';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import type { DataStorageService } from '@/ddd/domain/tables/services/data-storage-service';
import type { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';

export class TableService implements IDynamicTableRepository {
  constructor(
    private readonly fieldRepository: IFieldRepository,
    private readonly dataStorageService: DataStorageService,
    private readonly queryService: TableQueryService
  ) {}

  async create(data: CreateDynamicTableData): Promise<DynamicTable> {
    try {
      // 1. Create S3 path for the table
      const tableId = Date.now(); // Temporary - will get real ID after DB insert
      const s3Path = new S3TablePath(data.organizationId.value, data.databaseId.value, tableId);

      // 2. Create table record in PostgreSQL metadata
      const [tableRecord] = await db.insert(tables).values({
        name: data.name,
        databaseId: data.databaseId.value,
        organizationId: data.organizationId.value,
        s3Path: s3Path.path,
        metadata: data.metadata || null,
        createdBy: data.createdBy.value
      }).returning();

      // Update S3 path with real table ID
      const realS3Path = new S3TablePath(data.organizationId.value, data.databaseId.value, tableRecord.id);
      await db.update(tables)
        .set({ s3Path: realS3Path.path })
        .where(eq(tables.id, tableRecord.id));

      // 3. Initialize empty table in S3 (no fields created here - handled separately)
      await this.initializeEmptyTable(realS3Path);

      // 4. Return domain entity
      const dynamicTable = DynamicTable.fromPersistence({
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: realS3Path.path,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        createdBy: tableRecord.createdBy,
        createdAt: tableRecord.createdAt!,
        updatedAt: tableRecord.updatedAt!
      });

      console.log(`[TableService] Created table: ${dynamicTable.name} (ID: ${dynamicTable.id})`);

      return dynamicTable;

    } catch (error) {
      console.error('[TableService] Error creating table:', error);
      throw error;
    }
  }

  async findById(id: TableId): Promise<DynamicTable | null> {
    try {
      // Get table metadata from PostgreSQL
      const tableRecord = await db.query.tables.findFirst({
        where: eq(tables.id, id.value)
      });

      if (!tableRecord) {
        return null;
      }

      // Convert to domain entity
      const dynamicTable = DynamicTable.fromPersistence({
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: tableRecord.s3Path,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        createdBy: tableRecord.createdBy,
        createdAt: tableRecord.createdAt!,
        updatedAt: tableRecord.updatedAt!
      });

      return dynamicTable;

    } catch (error) {
      console.error('[TableService] Error getting table:', error);
      throw error;
    }
  }

  async findByOrganization(organizationId: OrganizationId): Promise<DynamicTable[]> {
    try {
      const tableRecords = await db.query.tables.findMany({
        where: eq(tables.organizationId, organizationId.value)
      });

      return tableRecords.map(record => DynamicTable.fromPersistence({
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
      console.error('[TableService] Error finding tables by organization:', error);
      throw error;
    }
  }

  async findByDatabase(databaseId: DatabaseId): Promise<DynamicTable[]> {
    try {
      const tableRecords = await db.query.tables.findMany({
        where: eq(tables.databaseId, databaseId.value)
      });

      return tableRecords.map(record => DynamicTable.fromPersistence({
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
      console.error('[TableService] Error finding tables by database:', error);
      throw error;
    }
  }

  async update(id: TableId, data: Partial<DynamicTable>): Promise<DynamicTable> {
    try {
      const [updatedRecord] = await db.update(tables)
        .set({
          name: data.name,
          metadata: data.metadata || null,
          updatedAt: new Date()
        })
        .where(eq(tables.id, id.value))
        .returning();

      if (!updatedRecord) {
        throw new Error(`Table ${id.value} not found`);
      }

      return DynamicTable.fromPersistence({
        id: updatedRecord.id,
        databaseId: updatedRecord.databaseId,
        organizationId: updatedRecord.organizationId,
        name: updatedRecord.name,
        storageLocation: updatedRecord.s3Path,
        metadata: updatedRecord.metadata ? TableMetadata.fromDatabase(updatedRecord.metadata).data : undefined,
        createdBy: updatedRecord.createdBy,
        createdAt: updatedRecord.createdAt!,
        updatedAt: updatedRecord.updatedAt!
      });

    } catch (error) {
      console.error('[TableService] Error updating table:', error);
      throw error;
    }
  }

  async delete(id: TableId): Promise<void> {
    try {
      // 1. Get table to find S3 path
      const tableRecord = await db.query.tables.findFirst({
        where: eq(tables.id, id.value)
      });

      if (!tableRecord) {
        throw new Error('Table not found');
      }

      // 2. Delete all S3 objects for this table
      const s3Path = S3TablePath.fromPath(tableRecord.s3Path);
      await this.deleteS3Directory(s3Path.path);

      // 3. Delete fields from PostgreSQL
      await db.delete(fields).where(eq(fields.tableId, id.value));

      // 4. Delete table from PostgreSQL
      await db.delete(tables).where(eq(tables.id, id.value));

      console.log(`[TableService] Deleted table: ${tableRecord.name} (ID: ${id})`);

    } catch (error) {
      console.error('[TableService] Error deleting table:', error);
      throw error;
    }
  }

  async existsByStorageLocation(organizationId: OrganizationId, storageLocation: string): Promise<boolean> {
    try {
      const tableRecord = await db.query.tables.findFirst({
        where: and(
          eq(tables.organizationId, organizationId.value),
          eq(tables.s3Path, storageLocation)
        )
      });

      return !!tableRecord;

    } catch (error) {
      console.error('[TableService] Error checking storage location existence:', error);
      throw error;
    }
  }

  async insertRow(tableId: TableId, data: CreateRowData): Promise<DynamicTableRow> {
    // AIDEV-NOTE: Simple atomic approach - load all data, add row, save all data
    try {
      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Get table schema for validation
      const schemaResult = await this.getTableSchema(tableId.value);
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
      console.error('[TableService] Error inserting row:', error);
      throw error;
    }
  }

  async findRows(tableId: TableId, options?: RowQueryOptions): Promise<DynamicTableRow[]> {
    return await this.getRows(tableId, options);
  }

  async getRows(tableId: TableId, options?: RowQueryOptions): Promise<DynamicTableRow[]> {
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
      console.error('[TableService] Error finding rows:', error);
      throw error;
    }
  }

  async getRow(tableId: TableId, rowId: string): Promise<DynamicTableRow | null> {
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
      console.error('[TableService] Error getting row:', error);
      throw error;
    }
  }

  async updateRow(tableId: TableId, rowId: string, data: UpdateRowData): Promise<DynamicTableRow> {
    // AIDEV-NOTE: Simple atomic approach - load all data, update row, save all data
    try {
      // 1. Get table metadata and schema
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      const schemaResult = await this.getTableSchema(tableId.value);
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

      console.log(`[TableService] Updated row ${rowId} in table ${table.name} using atomic approach`);

      return updatedRow;

    } catch (error) {
      console.error('[TableService] Error updating row:', error);
      throw error;
    }
  }

  async deleteRow(tableId: TableId, rowId: string): Promise<void> {
    // AIDEV-NOTE: Simple atomic approach - load all data, remove row, save all data
    try {
      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Get schema for saving data
      const schemaResult = await this.getTableSchema(tableId.value);
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

      console.log(`[TableService] Deleted row ${rowId} in table ${table.name} using atomic approach`);

    } catch (error) {
      console.error('[TableService] Error deleting row:', error);
      throw error;
    }
  }

  async tableExists(tableId: TableId): Promise<boolean> {
    try {
      const table = await this.findById(tableId);
      return !!table;

    } catch (error) {
      console.error('[TableService] Error checking table existence:', error);
      throw error;
    }
  }

  async getTableStats(tableId: TableId): Promise<{
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
          sizeBytes: (response as any).ContentLength || 0,
          lastModified: (response as any).LastModified || table.updatedAt || new Date()
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
      console.error('[TableService] Error getting table stats:', error);
      throw error;
    }
  }

  async hasRows(tableId: TableId): Promise<boolean> {
    try {
      const stats = await this.getTableStats(tableId);
      return stats.rowCount > 0;

    } catch (error) {
      console.error('[TableService] Error checking if table has rows:', error);
      throw error;
    }
  }

  async findAll(): Promise<DynamicTable[]> {
    try {
      const tableRecords = await db.query.tables.findMany();

      return tableRecords.map(record => DynamicTable.fromPersistence({
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
      console.error('[TableService] Error finding all tables:', error);
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
      console.error('[TableService] Error getting table schema:', error);
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
    
    // Store Arrow file directly to S3 (consistent with other table data operations)
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
      console.error('[TableService] Error extracting table ID from path:', error);
      return 0;
    }
  }

  private async deleteS3Directory(prefix: string): Promise<void> {
    // TODO: Implement S3 directory deletion
    // Need to list all objects with prefix and delete them
    console.warn('S3 directory deletion not yet implemented for:', prefix);
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
    
    console.warn(`[TableService] Invalid field type: ${fieldType}, defaulting to 'text'`);
    return 'text';
  }
}