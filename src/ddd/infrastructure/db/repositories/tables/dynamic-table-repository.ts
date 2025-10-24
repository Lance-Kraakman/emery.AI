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
import type { InferSelectModel } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { s3Client, BUCKET_NAME, ensureBucketExists } from '@/lib/s3/client';
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { TableId, DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects';
import type { 
  IDynamicTableRepository
} from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import type { CreateDynamicTableData } from '@/ddd/application/services/tables/table-application-service';
import {
  DynamicTable
} from '@/ddd/domain/tables/entities/dynamic-table';
import { Row } from '@/ddd/domain/tables/value-objects/row';
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence';
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path';
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata';
import { ResultHelpers } from '@/ddd/domain/shared/result';
import { DynamicTableDataLake } from './dynamic-table-datalake';

type TableRow = InferSelectModel<typeof tables>;
type FieldRow = InferSelectModel<typeof fields>;

export class DynamicTableRepository implements IDynamicTableRepository {
  constructor(
    private readonly db: DbClient,
    private readonly datalake: DynamicTableDataLake
  ) {}

  async create(data: CreateDynamicTableData): Promise<DynamicTable> {
    try {
      // 1. Create S3 path for the table
      const tableId = Date.now(); // Temporary - will get real ID after DB insert
      const s3Path = new S3TablePath(data.organizationId.value, data.databaseId.value, tableId);

      // 2. Create table record in PostgreSQL metadata  
      // RLS policies handle organization isolation automatically
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

      // 3. Create 'id' field - required by Delta Lake (at least one column must exist)
      // AIDEV-NOTE: This is an infrastructure requirement, not a domain concept.
      // The 'id' field stores Row.id (UUID) values for row identification.
      const [idFieldRecord] = await this.db.insert(fields).values({
        tableId: tableRecord.id,
        name: 'id',
        slug: 'id',
        type: 'text',
        orderIndex: 0,
        required: true,
        fieldConfig: {
          isSystemField: true,
          description: 'Row identifier (UUID)'
        }
      }).returning();

      // Create TableField domain object for the id field
      const idField = TableField.fromPersistence({
        id: idFieldRecord.id,
        tableId: idFieldRecord.tableId,
        name: idFieldRecord.name,
        type: idFieldRecord.type as FieldType,
        orderIndex: idFieldRecord.orderIndex,
        relatedTableId: null,
        required: idFieldRecord.required,
        metadata: idFieldRecord.fieldConfig || undefined,
        createdAt: idFieldRecord.createdAt
      });

      // 4. Create table entity with id field
      const tableEntity = DynamicTable.fromPersistence({
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: realS3Path.path,
        description: tableRecord.metadata?.description,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        fields: [idField],  // Include system id field
        createdBy: tableRecord.createdBy,
        createdAt: tableRecord.createdAt!,
        updatedAt: tableRecord.updatedAt!
      });

      // Create Delta Lake table via gRPC service (id field will be included in schema)
      const result = await this.datalake.createTable(tableEntity);
      if (!result.success) {
        throw new Error(`Failed to initialize Delta Lake table: ${result.error}`);
      }

      // 4. Return the created table entity
      console.log(`[TableService] Created table: ${tableEntity.name} (ID: ${tableEntity.id})`);

      return tableEntity;

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
      const tableFields = fieldRecords.map((fieldRecord: FieldRow) =>
        TableField.fromPersistence({
          id: fieldRecord.id,
          tableId: fieldRecord.tableId,
          name: fieldRecord.name,
          type: fieldRecord.type as FieldType,
          orderIndex: fieldRecord.orderIndex,
          relatedTableId: fieldRecord.fieldConfig?.targetTableId || null,
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
        description: tableRecord.metadata?.description,
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

      // Load all tables with their fields for complete functionality
      const tablesWithFields: DynamicTable[] = [];
      
      for (const tableRecord of tableRecords) {
        // Load fields for each table
        const fieldRecords = await this.db.query.fields.findMany({
          where: eq(fields.tableId, tableRecord.id),
          orderBy: [fields.orderIndex]
        });

        // Convert field persistence records to domain TableField objects
        const tableFields = fieldRecords.map((fieldRecord: FieldRow) =>
          TableField.fromPersistence({
            id: fieldRecord.id,
            tableId: fieldRecord.tableId,
            name: fieldRecord.name,
            type: fieldRecord.type as FieldType,
            orderIndex: fieldRecord.orderIndex,
            relatedTableId: fieldRecord.fieldConfig?.targetTableId || null,
            required: fieldRecord.required,
            metadata: fieldRecord.fieldConfig || undefined,
            createdAt: fieldRecord.createdAt
          })
        );

        const dynamicTable = DynamicTable.fromPersistence({
          id: tableRecord.id,
          databaseId: tableRecord.databaseId,
          organizationId: tableRecord.organizationId,
          name: tableRecord.name,
          storageLocation: tableRecord.s3Path,
          description: tableRecord.metadata?.description,
          metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
          createdBy: tableRecord.createdBy,
          createdAt: tableRecord.createdAt!,
          updatedAt: tableRecord.updatedAt!,
          fields: tableFields
        });

        tablesWithFields.push(dynamicTable);
      }

      return tablesWithFields;

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

      return tableRecords.map((record: TableRow) => DynamicTable.fromPersistence({
        id: record.id,
        databaseId: record.databaseId,
        organizationId: record.organizationId,
        name: record.name,
        storageLocation: record.s3Path,
        description: record.metadata?.description,
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
      const existingFieldNames = new Set(existingFields.map((f: FieldRow) => f.name));
      const fieldsToAdd = tableFields.filter(f => !existingFieldNames.has(f.name));

      // If no new fields, skip
      if (fieldsToAdd.length === 0) {
        return;
      }

      // Insert new fields into PostgreSQL
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
            ...(field.relatedTableId ? { targetTableId: field.relatedTableId.value } : {})
          } : null
        });
      }

      console.log(`[TableService] Synced ${fieldsToAdd.length} new fields to PostgreSQL for table ${tableId.value}`);

      // CRITICAL FIX: Sync schema changes to Delta Lake storage
      // This ensures fields are immediately available for sorting/filtering
      console.log(`[TableService] Now syncing ${fieldsToAdd.length} fields to Delta Lake...`);

      const fullTable = await this.findById(tableId);
      if (fullTable && this.datalake) {
        const deltaLakeResult = await this.datalake.updateTable(fullTable);
        if (!deltaLakeResult.success) {
          console.warn(`[TableService] Warning: Failed to sync fields to Delta Lake: ${deltaLakeResult.error}`);
        } else {
          console.log(`[TableService] Successfully synced ${fieldsToAdd.length} fields to Delta Lake`);
        }
      } else {
        console.warn(`[TableService] Could not sync to Delta Lake - table or datalake repository unavailable`);
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

  async insertRows(tableId: TableId, rows: Row[]): Promise<Row[]> {
    try {
      if (rows.length === 0) return [];

      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Create all rows in single gRPC call using Delta Lake append
      // AIDEV-NOTE: This is 4x faster than individual insertRow calls
      const result = await this.datalake.createRows(rows, table);
      if (!result.success) {
        throw new Error(`Failed to create rows: ${result.error}`);
      }

      // 3. Return all Row entities
      return rows;

    } catch (error) {
      console.error('[DynamicTableRepository] Error inserting rows:', error);
      throw error;
    }
  }

  async getRows(tableId: TableId, options: RowQueryOptions): Promise<Row[]> {
    try {
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // CRITICAL FIX: Pass options directly to datalake for server-side pagination
      // This enables true pagination via gRPC Delta Lake instead of loading all rows
      const result = await this.datalake.retrieveRows(table, options);

      if (!result.success) {
        throw new Error(result.error || 'Failed to retrieve rows');
      }

      return result.data?.rows || [];

    } catch (error) {
      console.error('[DynamicTableRepository] Error getting rows:', error);
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
      
      // Load all rows and find specific row
      const allRows = await this.loadTableData(s3Path);
      
      const foundRow = allRows.find(row => row.id.value === rowId);
      if (!foundRow) {
        return null;
      }
      
      // Return Row entity directly - no conversion needed
      return foundRow;

    } catch (error) {
      console.error('[TableService] Error getting row:', error);
      throw error;
    }
  }


  async updateRows(
    tableId: TableId,
    updates: Array<{rowId: string, row: Row}>
  ): Promise<Row[]> {
    // AIDEV-NOTE: Efficient update using Delta Lake merge operation
    // Only writes the updated rows, not the entire table
    try {
      if (updates.length === 0) return [];

      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Extract just the updated rows (no need to load all rows)
      const updatedRows = updates.map(u => u.row);

      // 3. Use Delta Lake merge to update only the changed rows
      // AIDEV-NOTE: This performs efficient row-level updates without rewriting entire table
      const result = await this.datalake.updateRows(updatedRows, table);

      if (!result.success) {
        throw new Error(`Failed to update rows: ${result.error}`);
      }

      console.log(`[DynamicTableRepository] Updated ${updates.length} rows in table ${table.name} using Delta Lake merge`);

      // 4. Return the updated Row entities
      return updatedRows;

    } catch (error) {
      console.error('[DynamicTableRepository] Error updating rows:', error);
      throw error;
    }
  }

  async deleteRows(tableId: TableId, rowIds: string[]): Promise<void> {
    // AIDEV-NOTE: Efficient delete using Delta Lake delete operation
    // Only deletes specified rows, not rewriting entire table
    try {
      if (rowIds.length === 0) return;

      // 1. Get table metadata
      const table = await this.findById(tableId);
      if (!table) {
        throw new Error('Table not found');
      }

      // 2. Delete rows using Delta Lake delete operation
      const result = await this.datalake.deleteRows(rowIds, table);
      if (!result.success) {
        throw new Error(`Failed to delete rows: ${result.error}`);
      }

      console.log(`[DynamicTableRepository] Deleted ${rowIds.length} rows using Delta Lake delete`);

    } catch (error) {
      console.error('[DynamicTableRepository] Error deleting rows:', error);
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

  /**
   * Get table statistics using efficient Delta Lake metadata
   *
   * This method uses gRPC to read only the Delta Lake transaction log
   * instead of loading all rows. Much faster for large tables.
   */
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

      // Use DataLake's efficient getTableStats that reads only transaction log metadata
      const result = await this.datalake.getTableStats(table);

      if (result.success && result.data) {
        return result.data;
      } else {
        // If gRPC stats fail, return empty stats (table might be empty or not yet created)
        console.warn(`[TableRepository] getTableStats failed for table ${tableId.value}, returning empty stats`);
        return {
          rowCount: 0,
          sizeBytes: 0,
          lastModified: table.createdAt || new Date()
        };
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

      return tableRecords.map((record: TableRow) => DynamicTable.fromPersistence({
        id: record.id,
        databaseId: record.databaseId,
        organizationId: record.organizationId,
        name: record.name,
        storageLocation: record.s3Path,
        description: record.metadata?.description,
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

  /**
   * Apply query options to resolved data (filters, sorting, pagination)
   */
  private applyQueryOptions(data: Row[], options?: RowQueryOptions): Row[] {
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
        const aVal = a.getFieldValue(field)?.value;
        const bVal = b.getFieldValue(field)?.value;
        
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
    // Create empty Arrow file with no rows
    const emptyRows: Row[] = [];
    
    // Create proper DynamicTable entity with real values
    const emptyTable = DynamicTable.fromPersistence({
      id: tableId.value,
      databaseId: databaseId.value,
      organizationId: organizationId.value,
      name: tableName,
      storageLocation: s3Path.path,
      description: undefined,
      metadata: undefined,
      fields: [], // Empty table has no fields initially
      createdBy: createdBy.value,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Create the table via gRPC service instead of storing empty data
    const result = await this.datalake.createTable(emptyTable);
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
  private async loadTableData(s3Path: S3TablePath): Promise<Row[]> {
    try {
      console.log('[DynamicTableRepository.loadTableData] === ENTRY ===');
      console.log(`[DynamicTableRepository.loadTableData] S3 path: ${s3Path.path}`);

      // Get table entity and fields for data storage service
      const tableId = this.extractTableIdFromPath(s3Path);
      console.log(`[DynamicTableRepository.loadTableData] Extracted table ID: ${tableId}`);

      const table = await this.findById(TableId.fromNumber(tableId));
      if (!table) {
        throw new Error(`Table not found: ${tableId}`);
      }

      console.log(`[DynamicTableRepository.loadTableData] Found table: ${table.name} (ID: ${table.id.value})`);
      console.log(`[DynamicTableRepository.loadTableData] Storage location: ${table.storageLocation}`);
      console.log(`[DynamicTableRepository.loadTableData] Field count: ${table.fields.length}`);

      // Query rows from Delta Lake via gRPC service (NEW implementation)
      // AIDEV-NOTE: Removed old S3 Arrow file read logic - now using Delta Lake
      console.log(`[DynamicTableRepository.loadTableData] Calling datalake.retrieveRows...`);
      const result = await this.datalake.retrieveRows(table);

      if (!result.success) {
        console.error(`[DynamicTableRepository.loadTableData] retrieveRows failed: ${result.error}`);
        throw new Error(`Failed to retrieve data: ${result.error}`);
      }

      console.log(`[DynamicTableRepository.loadTableData] Successfully retrieved ${result.data?.rows.length || 0} rows (total: ${result.data?.totalCount || 0})`);
      console.log(`[DynamicTableRepository.loadTableData] === EXIT ===`);

      return result.data?.rows || [];

    } catch (error) {
      console.error(`[DynamicTableRepository.loadTableData] === ERROR ===`);
      console.error(`[DynamicTableRepository.loadTableData] Error loading table data:`, error);
      console.error(`[DynamicTableRepository.loadTableData] Error type:`, error instanceof Error ? error.constructor.name : typeof error);

      // Return empty array for missing table data (not an error - table might be new)
      if (error instanceof Error && error.message.includes('Table not found')) {
        return [];
      }

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
}
