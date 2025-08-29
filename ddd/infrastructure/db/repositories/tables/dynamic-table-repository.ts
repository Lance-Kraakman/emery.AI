/**
 * Dynamic Table Repository
 * 
 * Infrastructure repository implementation coordinating:
 * - PostgreSQL metadata (tables table) via Drizzle
 * - S3 Arrow data storage
 * - Pure data access layer - no business logic
 * 
 * AIDEV-NOTE: Hybrid repository implementation using both Drizzle and S3,
 * focused on data access only. Business logic handled by DynamicTableService.
 */

import type { DbClient } from '@/lib/db/client';
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
import { Row } from '@/ddd/domain/tables/value-objects/row';
import type { IFieldRepository } from '@/ddd/domain/fields/repositories/field-repository';
import type { FieldType } from '@/ddd/domain/fields/entities/field';
import { FieldProcessor } from '@/ddd/domain/fields/services/field-processor';
import { FieldMapper } from '@/ddd/infrastructure/fields/field-mapper';
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path';
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import type { DataStorageService } from '@/ddd/domain/tables/services/data-storage-service';
import type { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';

export class DynamicTableRepository implements IDynamicTableRepository {
  private readonly fieldProcessor = new FieldProcessor();
  private readonly fieldMapper = new FieldMapper();

  constructor(
    private readonly db: DbClient,
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
      const [tableRecord] = await this.db.insert(tables).values({
        name: data.name,
        databaseId: data.databaseId.value,
        organizationId: data.organizationId.value,
        s3Path: s3Path.path,
        metadata: data.metadata || null,
        createdBy: data.createdBy.value
      }).returning();

      // Update S3 path with real table ID
      const realS3Path = new S3TablePath(data.organizationId.value, data.databaseId.value, tableRecord.id);
      await this.db.update(tables)
        .set({ s3Path: realS3Path.path })
        .where(eq(tables.id, tableRecord.id));

      // 3. Initialize empty table in S3 (no fields created here - handled separately)
      await this.initializeEmptyTable(realS3Path, data.organizationId, data.databaseId, TableId.fromNumber(tableRecord.id), data.name);

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
      const tableRecord = await this.db.query.tables.findFirst({
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
      const tableRecords = await this.db.query.tables.findMany({
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
      const tableRecords = await this.db.query.tables.findMany({
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
      const [updatedRecord] = await this.db.update(tables)
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
      const tableRecord = await this.db.query.tables.findFirst({
        where: eq(tables.id, id.value)
      });

      if (!tableRecord) {
        throw new Error('Table not found');
      }

      // 2. Delete all S3 objects for this table
      const s3Path = S3TablePath.fromPath(tableRecord.s3Path);
      await this.deleteS3Directory(s3Path.path);

      // 3. Delete fields from PostgreSQL
      await this.db.delete(fields).where(eq(fields.tableId, id.value));

      // 4. Delete table from PostgreSQL
      await this.db.delete(tables).where(eq(tables.id, id.value));

      console.log(`[TableService] Deleted table: ${tableRecord.name} (ID: ${id})`);

    } catch (error) {
      console.error('[TableService] Error deleting table:', error);
      throw error;
    }
  }

  async existsByStorageLocation(organizationId: OrganizationId, storageLocation: string): Promise<boolean> {
    try {
      const tableRecord = await this.db.query.tables.findFirst({
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

  async insertRow(tableId: TableId, data: CreateRowData): Promise<Row> {
    // AIDEV-NOTE: Simple atomic approach - load all data, add row, save all data
    try {
      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Get fields for processing
      const fields = await this.fieldRepository.findByTableId(tableId);

      // 3. Process row data using domain service (converts slug → column format)
      const processedData = this.fieldProcessor.processRowForStorage(fields, data);
      const columnData = this.fieldMapper.convertRowToColumnFormat(fields, processedData);

      // 4. Add system fields
      const rowWithId: DynamicTableRow = {
        id: nanoid(),
        ...columnData,
        created_at: new Date(),
        updated_at: new Date()
      };

      // 5. Get existing data from S3
      const s3Path = S3TablePath.fromPath(table.storageLocation);
      const existingData = await this.loadTableData(s3Path);

      // 6. Add new row
      existingData.push(rowWithId);

      // 7. Save back to S3
      await this.saveTableData(s3Path, existingData, table, fields);

      // 8. Convert DynamicTableRow to Row domain object before returning
      const fieldSlugs = fields.map(f => f.slug);
      const fieldTypes = fields.reduce((acc, f) => ({ ...acc, [f.slug]: f.type }), {});
      const storageData = this.fieldProcessor.processRowFromStorage(fields, rowWithId);
      
      return Row.fromPlainObject(storageData, tableId.value, fieldSlugs, fieldTypes);

    } catch (error) {
      console.error('[TableService] Error inserting row:', error);
      throw error;
    }
  }

  async findRows(tableId: TableId, options?: RowQueryOptions): Promise<Row[]> {
    return await this.getRows(tableId, options);
  }

  async getRows(tableId: TableId, options?: RowQueryOptions): Promise<Row[]> {
    try {
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      const s3Path = S3TablePath.fromPath(table.storageLocation);
      
      // Simple atomic approach - load all data from Arrow file
      const allData = await this.loadTableData(s3Path);
      
      // Apply query options (filters, sorting, pagination)
      const filteredData = this.applyQueryOptions(allData, options);
      
      // Convert DynamicTableRow[] to Row[] before returning
      const fields = await this.fieldRepository.findByTableId(tableId);
      const fieldSlugs = fields.map(f => f.slug);
      const fieldTypes = fields.reduce((acc, f) => ({ ...acc, [f.slug]: f.type }), {});
      
      return filteredData.map(rowData => {
        const processedData = this.fieldProcessor.processRowFromStorage(fields, rowData);
        return Row.fromPlainObject(processedData, tableId.value, fieldSlugs, fieldTypes);
      });

    } catch (error) {
      console.error('[TableService] Error finding rows:', error);
      throw error;
    }
  }

  async getRow(tableId: TableId, rowId: string): Promise<Row | null> {
    try {
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      const s3Path = S3TablePath.fromPath(table.storageLocation);
      
      // Simple atomic approach - load all data and find row
      const allData = await this.loadTableData(s3Path);
      
      const foundRow = allData.find(row => row.id === rowId);
      if (!foundRow) {
        return null;
      }
      
      // Convert DynamicTableRow to Row domain object before returning
      const fields = await this.fieldRepository.findByTableId(tableId);
      const fieldSlugs = fields.map(f => f.slug);
      const fieldTypes = fields.reduce((acc, f) => ({ ...acc, [f.slug]: f.type }), {});
      const processedData = this.fieldProcessor.processRowFromStorage(fields, foundRow);
      
      return Row.fromPlainObject(processedData, tableId.value, fieldSlugs, fieldTypes);

    } catch (error) {
      console.error('[TableService] Error getting row:', error);
      throw error;
    }
  }

  async updateRow(tableId: TableId, rowId: string, data: UpdateRowData): Promise<Row> {
    // AIDEV-NOTE: Simple atomic approach - load all data, update row, save all data
    try {
      // 1. Get table metadata and schema
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Get fields and process update data
      const fields = await this.fieldRepository.findByTableId(tableId);
      const processedData = this.fieldProcessor.processRowForStorage(fields, data);
      const columnData = this.fieldMapper.convertRowToColumnFormat(fields, processedData);

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
        ...columnData,
        updated_at: new Date()
      };
      
      allData[rowIndex] = updatedRow;

      // 5. Save all data back to S3
      await this.saveTableData(s3Path, allData, table, fields);

      console.log(`[TableService] Updated row ${rowId} in table ${table.name} using atomic approach`);

      // 6. Convert DynamicTableRow to Row domain object before returning
      const fieldSlugs = fields.map(f => f.slug);
      const fieldTypes = fields.reduce((acc, f) => ({ ...acc, [f.slug]: f.type }), {});
      const processedRowData = this.fieldProcessor.processRowFromStorage(fields, updatedRow);
      
      return Row.fromPlainObject(processedRowData, tableId.value, fieldSlugs, fieldTypes);

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

      // 2. Get fields for saving data
      const fields = await this.fieldRepository.findByTableId(tableId);

      // 3. Load all existing data
      const s3Path = S3TablePath.fromPath(table.storageLocation);
      const allData = await this.loadTableData(s3Path);

      // 4. Filter out the row to delete
      const filteredData = allData.filter(row => row.id !== rowId);
      
      if (filteredData.length === allData.length) {
        throw new Error(`Row ${rowId} not found`);
      }

      // 5. Save filtered data back to S3
      await this.saveTableData(s3Path, filteredData, table, fields);

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
      const tableRecords = await this.db.query.tables.findMany();

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


  // Helper method to get S3 path (used internally)
  private async getS3Path(tableId: number): Promise<S3TablePath> {
    const tableRecord = await this.db.query.tables.findFirst({
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

  private async initializeEmptyTable(
    s3Path: S3TablePath, 
    organizationId: OrganizationId, 
    databaseId: DatabaseId, 
    tableId: TableId, 
    tableName: string
  ): Promise<void> {
    // Create empty Arrow file with minimal structure
    const emptyData: any[] = [];
    
    // Create proper DynamicTable entity with real values
    const emptyTable = DynamicTable.fromPersistence({
      id: tableId.value,
      databaseId: databaseId.value,
      organizationId: organizationId.value,
      name: tableName,
      storageLocation: s3Path.path,
      metadata: undefined,
      createdBy: 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Empty fields array - no fields for empty table
    const emptyFields: any[] = [];

    const result = await this.dataStorageService.storeData(emptyData, emptyTable, emptyFields);
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
      
      // Get table entity and fields for data storage service
      const tableId = this.extractTableIdFromPath(s3Path);
      const table = await this.findById(TableId.fromNumber(tableId));
      if (!table) {
        throw new Error(`Table not found: ${tableId}`);
      }
      
      const fields = await this.fieldRepository.findByTableId(TableId.fromNumber(tableId));
      
      const result = await this.dataStorageService.retrieveData(buffer, table, fields);
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

  private async saveTableData(s3Path: S3TablePath, data: any[], table: DynamicTable, fields: any[]): Promise<void> {
    const storageBuffer = await this.dataStorageService.storeData(data, table, fields);
    
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
    return this.fieldMapper.validateFieldType(fieldType);
  }
}