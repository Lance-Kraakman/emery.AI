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
import type { DbClient } from '@/ddd/infrastructure/db/client';
import { createDebugLogger } from '@/lib/utils/debug-logger';

const logger = createDebugLogger('TableRepo');
import { tables, fields } from '@/ddd/infrastructure/db/schema';
import { eq, and } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { s3Client, BUCKET_NAME, ensureBucketExists } from '@/lib/s3/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
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
        metadata: data.metadata?.toDatabaseJson() || null,
        ownerId: data.ownerId.value
      }).returning();
      
      // Update S3 path with real table ID
      const realS3Path = new S3TablePath(data.organizationId.value, data.databaseId.value, tableRecord.id);
      await this.db.update(tables)
        .set({ s3Path: realS3Path.path })
        .where(eq(tables.id, tableRecord.id));

      // 3. Create table entity WITHOUT default 'id' field
      // AIDEV-NOTE: System 'id' column is automatically created by Delta Lake for row identification (UUID).
      // No need to create a PostgreSQL field record for it - it's a system column, not a user field.
      // User can add their own fields through the UI after table creation.
      const tableEntity = DynamicTable.fromPersistence({
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: realS3Path.path,
        description: tableRecord.metadata?.description,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        fields: [],  // Empty fields - system 'id' column exists at Delta Lake level
        ownerId: tableRecord.ownerId,
        createdAt: tableRecord.createdAt!,
        updatedAt: tableRecord.updatedAt!
      });

      // 4. Create Delta Lake table via gRPC service (system 'id' column created automatically)
      const result = await this.datalake.createTable(tableEntity);
      if (!result.success) {
        throw new Error(`Failed to initialize Delta Lake table: ${result.error}`);
      }

      // 5. Return the created table entity
      logger.debug('Created table', { name: tableEntity.name, id: tableEntity.id });

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
      const tableFields = fieldRecords.map((fieldRecord: FieldRow) => {
        return TableField.fromPersistence({
          id: fieldRecord.id,
          tableId: fieldRecord.tableId,
          name: fieldRecord.name,
          type: fieldRecord.type as FieldType,
          orderIndex: fieldRecord.orderIndex,
          relatedTableId: fieldRecord.fieldConfig?.targetTableId || null,
          required: fieldRecord.required,
          metadata: fieldRecord.fieldConfig || undefined,
          createdAt: fieldRecord.createdAt
        });
      });

      // Convert to domain entity with fields included
      const dynamicTable = DynamicTable.fromPersistence({
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: tableRecord.s3Path,
        description: tableRecord.metadata?.description,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        ownerId: tableRecord.ownerId,
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
        const tableFields = fieldRecords.map((fieldRecord: FieldRow) => {
          // Debug logging for select fields
          if (fieldRecord.type === 'single-select' || fieldRecord.type === 'multi-select') {
            logger.debug('Reading select field', {
              fieldName: fieldRecord.name,
              fieldType: fieldRecord.type,
              optionsCount: Array.isArray(fieldRecord.fieldConfig?.options) ? fieldRecord.fieldConfig.options.length : 0
            });
          }

          return TableField.fromPersistence({
            id: fieldRecord.id,
            tableId: fieldRecord.tableId,
            name: fieldRecord.name,
            type: fieldRecord.type as FieldType,
            orderIndex: fieldRecord.orderIndex,
            relatedTableId: fieldRecord.fieldConfig?.targetTableId || null,
            required: fieldRecord.required,
            metadata: fieldRecord.fieldConfig || undefined,
            createdAt: fieldRecord.createdAt
          });
        });

        const dynamicTable = DynamicTable.fromPersistence({
          id: tableRecord.id,
          databaseId: tableRecord.databaseId,
          organizationId: tableRecord.organizationId,
          name: tableRecord.name,
          storageLocation: tableRecord.s3Path,
          description: tableRecord.metadata?.description,
          metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
          ownerId: tableRecord.ownerId,
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

      const tablesWithFields: DynamicTable[] = [];

      for (const tableRecord of tableRecords) {
        // Load fields for each table
        const fieldRecords = await this.db.query.fields.findMany({
          where: eq(fields.tableId, tableRecord.id),
          orderBy: [fields.orderIndex]
        });

        const tableFields = fieldRecords.map((fieldRecord: FieldRow) => {
          return TableField.fromPersistence({
            id: fieldRecord.id,
            tableId: fieldRecord.tableId,
            name: fieldRecord.name,
            type: fieldRecord.type as FieldType,
            orderIndex: fieldRecord.orderIndex,
            relatedTableId: fieldRecord.fieldConfig?.targetTableId || null,
            required: fieldRecord.required,
            metadata: fieldRecord.fieldConfig || undefined,
            createdAt: fieldRecord.createdAt
          });
        });

        tablesWithFields.push(DynamicTable.fromPersistence({
          id: tableRecord.id,
          databaseId: tableRecord.databaseId,
          organizationId: tableRecord.organizationId,
          name: tableRecord.name,
          storageLocation: tableRecord.s3Path,
          description: tableRecord.metadata?.description,
          metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
          ownerId: tableRecord.ownerId,
          createdAt: tableRecord.createdAt!,
          updatedAt: tableRecord.updatedAt!,
          fields: tableFields
        }));
      }

      return tablesWithFields;

    } catch (error) {
      console.error('[TableService] Error finding tables by database:', error);
      throw error;
    }
  }

  async update(id: TableId, data: Partial<DynamicTable>): Promise<DynamicTable> {
    try {
      logger.debug('Updating table', {
        tableId: id.value,
        hasFields: !!data.fields,
        fieldCount: data.fields?.length
      });

      // Update table metadata
      const [updatedRecord] = await this.db.update(tables)
        .set({
          name: data.name,
          metadata: data.metadata?.toDatabaseJson() || null,
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
        logger.debug('Syncing fields', { count: data.fields.length });
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
   * Batch update field order indices - optimized for reordering operations
   * Updates multiple field orders using individual updates
   * Following the existing Drizzle patterns used throughout the codebase
   */
  async updateFieldOrders(tableId: TableId, fieldOrders: Array<{ fieldName: string; orderIndex: number }>): Promise<void> {
    try {
      // Update each field individually using Drizzle query builder
      // This follows the existing patterns in the codebase and ensures type safety
      for (const { fieldName, orderIndex } of fieldOrders) {
        await this.db.update(fields)
          .set({ 
            orderIndex,
            updatedAt: new Date()
          })
          .where(and(
            eq(fields.tableId, tableId.value),
            eq(fields.name, fieldName)
          ));
      }

      logger.debug('Updated field orders', { count: fieldOrders.length });

    } catch (error) {
      logger.error('Error updating field orders', error);
      throw error;
    }
  }

  /**
    * Sync table fields to database
    * Handles adding new fields, updating existing fields, and deleting removed fields
    */
  private async syncTableFields(tableId: TableId, tableFields: TableField[]): Promise<void> {
    try {
      // Get existing fields from database
      const existingFields = await this.db.select()
        .from(fields)
        .where(eq(fields.tableId, tableId.value));

      // Create map for quick lookup by ID (not name) for stable matching
      const existingFieldMap = new Map<number, FieldRow>(
        existingFields.map((f: FieldRow) => [f.id, f])
      );

      // Create name map for display/validation purposes
      const existingFieldNameMap = new Map<string, FieldRow>(
        existingFields.map((f: FieldRow) => [f.name, f])
      );
      
      // Separate fields by ID for stable matching
      const fieldsToAdd = tableFields.filter(f => !existingFieldMap.has(f.id.value));
      const fieldsToUpdate = tableFields.filter(f => existingFieldMap.has(f.id.value));
      const fieldsToDelete = existingFields.filter((f: FieldRow) =>
        !tableFields.some(tf => tf.id.value === f.id)
      );

      logger.debug('Field changes', {
        add: fieldsToAdd.length,
        update: fieldsToUpdate.length,
        delete: fieldsToDelete.length
      });

      // Insert new fields into PostgreSQL and get real IDs
      const insertedFields: Array<{id: number}> = [];
      for (let i = 0; i < fieldsToAdd.length; i++) {
        const field = fieldsToAdd[i];
        
        // Build fieldConfig - only if there's ACTUAL content (not empty object)
        let fieldConfig: Record<string, any> | null = null;
        const hasMetadataContent = field.metadata && Object.keys(field.metadata).length > 0;

        if (hasMetadataContent || field.relatedTableId) {
          fieldConfig = {
            ...(hasMetadataContent ? field.metadata : {}),
            ...(field.relatedTableId ? { targetTableId: field.relatedTableId.value } : {})
          };
        }

        // CRITICAL FIX: Use .returning() to get PostgreSQL auto-increment ID
        const insertedField = await this.db.insert(fields).values({
          tableId: tableId.value,
          name: field.name,
          slug: field.name.toLowerCase().replace(/\s+/g, '_'), // Generate slug from name
          type: field.type,
          orderIndex: field.orderIndex,
          required: field.required,
          fieldConfig
        }).returning({ id: fields.id });

        insertedFields.push(insertedField[0]);
        
        // CRITICAL FIX: Create new TableField with real PostgreSQL ID
        // This ensures domain ID = PostgreSQL ID = Delta Lake column name
        const updatedField = TableField.fromPersistence({
          id: insertedField[0].id, // Real PostgreSQL ID
          tableId: tableId.value,
          name: field.name,
          type: field.type,
          orderIndex: field.orderIndex,
          relatedTableId: field.relatedTableId?.value || null,
          required: field.required,
          metadata: field.metadata || null,
          createdAt: new Date()
        });
        
        // Replace the field in the original array with updated field containing real ID
        fieldsToAdd[i] = updatedField;
        
        logger.debug('Created field', { name: field.name, id: insertedField[0].id });
      }

      // CRITICAL FIX: Update existing fields with new metadata/config
      // This ensures select field options and other metadata changes are persisted
      for (const field of fieldsToUpdate) {
        const existingField = existingFieldMap.get(field.id.value)!;

        // Build fieldConfig - only if there's ACTUAL content (not empty object)
        let fieldConfig: Record<string, any> | null = null;

        // Check if metadata has any keys
        const hasMetadataContent = field.metadata && Object.keys(field.metadata).length > 0;

        if (hasMetadataContent || field.relatedTableId) {
          fieldConfig = {
            ...(hasMetadataContent ? field.metadata : {}),
            ...(field.relatedTableId ? { targetTableId: field.relatedTableId.value } : {})
          };
        }

        logger.debug('Updating field', { name: field.name, type: field.type });

        await this.db.update(fields)
          .set({
            name: field.name,
            slug: field.name.toLowerCase().replace(/\s+/g, '_'),
            type: field.type,
            orderIndex: field.orderIndex,
            required: field.required,
            fieldConfig
          })
          .where(eq(fields.id, existingField.id));
      }

      // Delete removed fields from PostgreSQL
      for (const fieldToDelete of fieldsToDelete) {
        await this.db.delete(fields)
          .where(eq(fields.id, fieldToDelete.id));
      }

      // Sync schema changes to Delta Lake storage
      const fullTable = await this.findById(tableId);
      if (fullTable && this.datalake) {
        // Add new fields to Delta Lake
        for (const field of fieldsToAdd) {
          const addResult = await this.datalake.addField(fullTable, field);
          if (!addResult.success) {
            console.warn(`[TableRepo] Failed to add field ${field.name} to Delta Lake: ${addResult.error}`);
          }
        }

        // Update existing fields in Delta Lake
        for (const field of fieldsToUpdate) {
          const updateResult = await this.datalake.updateField(fullTable, field);
          if (!updateResult.success) {
            console.warn(`[TableRepo] Failed to update field ${field.name} in Delta Lake: ${updateResult.error}`);
          }
        }

        // Delete removed fields from Delta Lake
        for (const fieldToDelete of fieldsToDelete) {
          const deleteResult = await this.datalake.deleteField(fullTable, fieldToDelete.id.value);
          if (!deleteResult.success) {
            console.warn(`[TableRepo] Failed to delete field ${fieldToDelete.name} from Delta Lake: ${deleteResult.error}`);
          }
        }
      }
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

      logger.debug('Deleted table', { name: tableRecord.name, id: id.value });

    } catch (error) {
      logger.error('Error deleting table', error);
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

      return this.getRowsWithParams(
        {
          tableId: table.id.value,
          s3Path: table.storageLocation || `s3://emery-tables/${table.id.value}`,
          organizationId: table.organizationId.value,
        },
        table.fields,
        options
      );

    } catch (error) {
      console.error('[DynamicTableRepository] Error getting rows:', error);
      throw error;
    }
  }

  /**
   * Get rows using raw table parameters
   * Bypasses findById - used when table metadata is already available (e.g., public views)
   */
  async getRowsWithParams(
    params: { tableId: number; s3Path: string; organizationId: number },
    fields: readonly TableField[],
    options: RowQueryOptions
  ): Promise<Row[]> {
    try {
      const result = await this.datalake.retrieveRowsWithParams(
        { ...params, fields },
        options
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to retrieve rows');
      }

      return result.data?.rows || [];

    } catch (error) {
      console.error('[DynamicTableRepository] Error getting rows with params:', error);
      throw error;
    }
  }

  async getRow(tableId: TableId, rowId: string): Promise<Row | null> {
    try {
      // OPTIMIZED: Use server-side filtering instead of loading all rows
      // This queries Delta Lake with WHERE id = 'rowId' instead of loading 1000+ rows
      const rows = await this.getRows(tableId, {
        filters: [{ field: 'id', operator: 'eq', value: rowId }],
        limit: 1
      });

      return rows.length > 0 ? rows[0] : null;

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

      logger.debug('Updated rows', { count: updates.length, tableId: table.id });

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

      logger.debug('Deleted rows', { count: rowIds.length });

    } catch (error) {
      logger.error('Error deleting rows', error);
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
        ownerId: record.ownerId,
        createdAt: record.createdAt!,
        updatedAt: record.updatedAt!,
        fields: [] // Not loaded for bulk operations - use findById for full entity
      }));

    } catch (error) {
      console.error('[TableService] Error finding all tables:', error);
      throw error;
    }
  }




  // Private helper methods

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
