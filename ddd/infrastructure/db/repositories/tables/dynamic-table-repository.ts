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
import { s3Client, BUCKET_NAME, ensureBucketExists } from '@/lib/s3/client';
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

import type { Result } from '@/ddd/domain/shared/result';
import { TableId, DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { 
  IDynamicTableRepository
} from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { CreateDynamicTableData } from '@/ddd/application/services/tables/table-application-service';
import {
  DynamicTable
} from '@/ddd/domain/tables/entities/dynamic-table';
import type { ColumnData, RowData } from '@/ddd/domain/tables/value-objects/field-values';
import type { DynamicTableRow, RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence';
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path';
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import type { DataStorageService } from '@/ddd/domain/tables/services/data-storage-service';
import type { TableQueryService } from '@/ddd/domain/tables/services/table-query-service';

export class DynamicTableRepository implements IDynamicTableRepository {
  constructor(
    private readonly db: DbClient,
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
      await this.initializeEmptyTable(realS3Path, data.organizationId, data.databaseId, TableId.fromNumber(tableRecord.id), data.name, data.createdBy);

      // 4. Return domain entity with empty fields (no fields created yet)
      const dynamicTable = DynamicTable.fromPersistence({
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: realS3Path.path,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        fields: [], // No fields created yet - handled separately
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

      // Load fields for this table
      const fieldRecords = await this.db.query.fields.findMany({
        where: eq(fields.tableId, id.value),
        orderBy: [fields.orderIndex]
      });

      // Convert field persistence records to domain TableField objects
      const tableFields = fieldRecords.map(fieldRecord => 
        TableField.fromPersistence({
          id: fieldRecord.id,
          tableId: fieldRecord.tableId,
          name: fieldRecord.name,
          type: fieldRecord.type as FieldType,
          orderIndex: fieldRecord.orderIndex,
          relatedTableId: fieldRecord.fieldConfig?.relatedTableId || null,
          required: fieldRecord.required,
          metadata: fieldRecord.fieldConfig || undefined,
          createdAt: fieldRecord.createdAt
        })
      );

      // Convert to domain entity with fields included
      const dynamicTable = DynamicTable.fromPersistence({
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: tableRecord.s3Path,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        createdBy: tableRecord.createdBy,
        createdAt: tableRecord.createdAt!,
        updatedAt: tableRecord.updatedAt!,
        fields: tableFields
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

      // For bulk operations, create tables without fields for efficiency
      // Individual table access via findById will load fields
      return tableRecords.map(record => DynamicTable.fromPersistence({
        id: record.id,
        databaseId: record.databaseId,
        organizationId: record.organizationId,
        name: record.name,
        storageLocation: record.s3Path,
        metadata: record.metadata ? TableMetadata.fromDatabase(record.metadata).data : undefined,
        createdBy: record.createdBy,
        createdAt: record.createdAt!,
        updatedAt: record.updatedAt!,
        fields: [] // Not loaded for bulk operations - use findById for full entity
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
        updatedAt: record.updatedAt!,
        fields: [] // Not loaded for bulk operations - use findById for full entity
      }));

    } catch (error) {
      console.error('[TableService] Error finding tables by database:', error);
      throw error;
    }
  }

  async update(id: TableId, data: Partial<DynamicTable>): Promise<DynamicTable> {
    try {
      // Update table metadata
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

      // If fields are provided in the data, sync them to the database
      // This handles the case where table.addField() was called and fields need to be persisted
      if (data.fields) {
        await this.syncTableFields(id, data.fields);
      }

      // Reload the table with its fields to return the complete entity
      const reloadedTable = await this.findById(id);
      if (!reloadedTable) {
        throw new Error(`Failed to reload table ${id.value} after update`);
      }

      return reloadedTable;

    } catch (error) {
      console.error('[TableService] Error updating table:', error);
      throw error;
    }
  }

  /**
   * Sync table fields to the database
   * Handles adding new fields that were created via table.addField()
   */
  private async syncTableFields(tableId: TableId, tableFields: TableField[]): Promise<void> {
    try {
      // Get existing fields from database
      const existingFields = await this.db.select()
        .from(fields)
        .where(eq(fields.tableId, tableId.value));

      // Find fields that need to be added (exist in memory but not in DB)
      const existingFieldNames = new Set(existingFields.map(f => f.name));
      const fieldsToAdd = tableFields.filter(f => !existingFieldNames.has(f.name));

      // Insert new fields
      for (const field of fieldsToAdd) {
        await this.db.insert(fields).values({
          tableId: tableId.value,
          name: field.name,
          slug: field.name.toLowerCase().replace(/\s+/g, '_'), // Generate slug from name
          type: field.type,
          orderIndex: field.orderIndex,
          required: field.required,
          fieldConfig: field.relatedTableId || field.metadata ? {
            ...(field.metadata || {}),
            ...(field.relatedTableId ? { relatedTableId: field.relatedTableId.value } : {})
          } : null
        });
      }

      // Note: We're not handling field updates or deletions here
      // This is specifically for the addField use case
    } catch (error) {
      console.error('[TableService] Error syncing table fields:', error);
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

  async insertRow(tableId: TableId, data: ColumnData): Promise<RowData> {
    // AIDEV-NOTE: Simple atomic approach - load all data, add row, save all data
    try {
      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Data has already been validated by the domain service layer
      // The 'data' parameter is already in column format (field_1, field_2, etc.)
      // No need to validate or process again

      const columnData = data; // Already processed by domain service

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
      await this.saveTableData(s3Path, existingData, table);

      // 8. Convert DynamicTableRow to RowData using entity's method
      const rowData = table.processRowFromStorage(rowWithId);
      
      // Add row ID to RowData for tests and consumer code
      return { id: rowWithId.id, ...rowData };

    } catch (error) {
      console.error('[TableService] Error inserting row:', error);
      throw error;
    }
  }

  async findRows(tableId: TableId, options?: RowQueryOptions): Promise<RowData[]> {
    return await this.getRows(tableId, options);
  }

  async getRows(tableId: TableId, options?: RowQueryOptions): Promise<RowData[]> {
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
      
      // Convert DynamicTableRow[] to RowData[] using entity's method
      return filteredData.map(row => {
        const rowData = table.processRowFromStorage(row);
        return { id: row.id, ...rowData };
      });

    } catch (error) {
      console.error('[TableService] Error finding rows:', error);
      throw error;
    }
  }

  async getRow(tableId: TableId, rowId: string): Promise<RowData | null> {
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
      
      // Convert DynamicTableRow to RowData using entity's method
      const rowData = table.processRowFromStorage(foundRow);
      
      // Add row ID to RowData (now properly preserved through Arrow serialization)
      return { id: foundRow.id, ...rowData };

    } catch (error) {
      console.error('[TableService] Error getting row:', error);
      throw error;
    }
  }

  async updateRow(tableId: TableId, rowId: string, data: ColumnData): Promise<RowData> {
    // AIDEV-NOTE: Simple atomic approach - load all data, update row, save all data
    try {
      // 1. Get table metadata and schema
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Data has already been validated by the domain service layer  
      // The 'data' parameter is already in column format (field_1, field_2, etc.)
      // No need to validate or process again
      
      const columnData = data; // Already processed by domain service

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
      await this.saveTableData(s3Path, allData, table);

      console.log(`[TableService] Updated row ${rowId} in table ${table.name} using atomic approach`);

      // 6. Convert DynamicTableRow to RowData using entity's method
      const rowData = table.processRowFromStorage(updatedRow);
      
      // Add row ID to RowData
      return { id: updatedRow.id, ...rowData };

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

      // 2. Fields are available from table object (loaded in findById)

      // 3. Load all existing data
      const s3Path = S3TablePath.fromPath(table.storageLocation);
      const allData = await this.loadTableData(s3Path);

      // 4. Filter out the row to delete
      const filteredData = allData.filter(row => row.id !== rowId);
      
      if (filteredData.length === allData.length) {
        throw new Error(`Row ${rowId} not found`);
      }

      // 5. Save filtered data back to S3
      await this.saveTableData(s3Path, filteredData, table);

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
        updatedAt: record.updatedAt!,
        fields: [] // Not loaded for bulk operations - use findById for full entity
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
    tableName: string,
    createdBy: UserId
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
      fields: [], // Empty table has no fields initially
      createdBy: createdBy.value,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Empty fields array - no fields for empty table
    const result = await this.dataStorageService.storeData(emptyData, emptyTable);
    if (!result.success) {
      throw new Error(`Failed to initialize empty table: ${result.error}`);
    }
    
    // Ensure S3 bucket exists before storing data
    await ensureBucketExists();
    
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
      const s3Key = s3Path.getDataPath();
      
      const response = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
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
      
      // Fields are available from table object (loaded in findById)
      const result = await this.dataStorageService.retrieveData(buffer, table);
      if (!result.success) {
        throw new Error(`Failed to retrieve data: ${result.error}`);
      }
      
      return result.data || [];

    } catch (error) {
      if ((error as any).name === 'NoSuchKey') {
        return [];
      }
      console.error(`[DynamicTableRepository] Error loading table data from S3:`, error);
      throw error;
    }
  }

  private async saveTableData(s3Path: S3TablePath, data: any[], table: DynamicTable): Promise<void> {
    const s3Key = s3Path.getDataPath();
    
    const storageBuffer = await this.dataStorageService.storeData(data, table);
    
    if (!storageBuffer.success) {
      throw new Error(`Failed to store data: ${storageBuffer.error}`);
    }
    
    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: storageBuffer.data,
        ContentType: 'application/vnd.apache.arrow.file'
      }));
    } catch (error) {
      console.error(`[DynamicTableRepository] Error saving to S3:`, error);
      throw error;
    }
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



  // AIDEV-NOTE: Field validation now handled by TableField value object
  // No separate field mapper needed with table-owns-fields approach
}