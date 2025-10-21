/**
 * DuckDB Dynamic Table Repository
 *
 * Infrastructure implementation using DuckDB for CRUD operations and analytical queries.
 * Designed for big data analytics with complex operations and random writes.
 *
 * Architecture:
 * - PostgreSQL: Table metadata (id, name, fields, s3Path)
 * - S3: DuckDB database files (.duckdb) - one file per domain Database
 * - DuckDB: Real tables with full CRUD support via DuckDBDatabaseManager
 * - Distributed locking: PostgreSQL advisory locks for S3 sync coordination
 *
 * AIDEV-NOTE: DuckDB repository for analytical workloads with CRUD operations
 * Uses database-level .duckdb files (not per-table) for cross-table JOINs
 * Follows DDD principles - infrastructure layer, implements domain repository interface
 */

import type { DbClient } from '@/lib/db/client'
import { tables, fields } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import { s3Client, BUCKET_NAME } from '@/lib/s3/client'
import { HeadObjectCommand } from '@aws-sdk/client-s3'

import { TableId, DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects'
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository'
import type { CreateDynamicTableData } from '@/ddd/application/services/tables/table-application-service'
import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table'
import { Row } from '@/ddd/domain/tables/value-objects/row'
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence'
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field'
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path'
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata'

import { DuckDBSqlTemplates } from './duckdb-sql-templates'
import type { DuckDBConnection } from '@duckdb/node-api'
import { DuckDBDatabaseManager } from './duckdb-database-manager'

type TableRow = InferSelectModel<typeof tables>
type FieldRow = InferSelectModel<typeof fields>

/**
 * DuckDB-powered repository for dynamic tables
 * Uses .duckdb files stored in S3 (one file per database)
 * Direct SQL operations via DuckDBDatabaseManager
 */
export class DuckDBDynamicTableRepository implements IDynamicTableRepository {
  private dbManager: DuckDBDatabaseManager

  constructor(
    private readonly db: DbClient
  ) {
    this.dbManager = new DuckDBDatabaseManager(db)
    console.log('[DuckDB Repository] ✅ Repository created with database manager')
  }

  // ==========================================
  // METADATA OPERATIONS (PostgreSQL)
  // ==========================================

  async create(data: CreateDynamicTableData): Promise<DynamicTable> {
    try {
      // 1. Create table record in PostgreSQL
      const tableId = Date.now()
      const s3Path = new S3TablePath(data.organizationId.value, data.databaseId.value, tableId)

      const [tableRecord] = await this.db.insert(tables).values({
        name: data.name,
        databaseId: data.databaseId.value,
        organizationId: data.organizationId.value,
        s3Path: s3Path.path,
        metadata: data.metadata || null,
        createdBy: data.createdBy.value
      }).returning()

      // 2. Update with real ID
      const realS3Path = new S3TablePath(data.organizationId.value, data.databaseId.value, tableRecord.id)
      await this.db.update(tables)
        .set({ s3Path: realS3Path.path })
        .where(eq(tables.id, tableRecord.id))

      // 3. Create real table in .duckdb file
      await this.dbManager.withDatabaseLock(
        data.organizationId,
        data.databaseId,
        async (conn) => {
          // Create table with system columns only (no user fields yet)
          const createTableSql = `
            CREATE TABLE IF NOT EXISTS table_${tableRecord.id} (
              id VARCHAR PRIMARY KEY,
              created_at TIMESTAMP,
              updated_at TIMESTAMP
            )
          `
          await conn.run(createTableSql)
          console.log(`[DuckDB Repository] Created table_${tableRecord.id} in .duckdb file`)
        }
      )

      // 4. Return domain entity
      const dynamicTable = DynamicTable.fromPersistence({
        id: tableRecord.id,
        databaseId: tableRecord.databaseId,
        organizationId: tableRecord.organizationId,
        name: tableRecord.name,
        storageLocation: realS3Path.path,
        description: tableRecord.metadata?.description,
        metadata: tableRecord.metadata ? TableMetadata.fromDatabase(tableRecord.metadata).data : undefined,
        fields: [],
        createdBy: tableRecord.createdBy,
        createdAt: tableRecord.createdAt!,
        updatedAt: tableRecord.updatedAt!
      })

      console.log(`[DuckDBDynamicTableRepository] Created table: ${dynamicTable.name} (table_${tableRecord.id})`)
      return dynamicTable

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error creating table:', error)
      throw error
    }
  }

  async findById(id: TableId): Promise<DynamicTable | null> {
    try {
      const tableRecord = await this.db.query.tables.findFirst({
        where: eq(tables.id, id.value)
      })

      if (!tableRecord) return null

      const fieldRecords = await this.db.query.fields.findMany({
        where: eq(fields.tableId, id.value),
        orderBy: [fields.orderIndex]
      })

      const tableFields = fieldRecords.map((fieldRecord: FieldRow) =>
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
      )

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
      })

      return dynamicTable

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error finding table:', error)
      throw error
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
            relatedTableId: fieldRecord.fieldConfig?.relatedTableId || null,
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
      console.error('[DuckDBDynamicTableRepository] Error finding tables by organization:', error);
      throw error;
    }
  }

  async findByDatabase(databaseId: DatabaseId): Promise<DynamicTable[]> {
    try {
      const tableRecords = await this.db.query.tables.findMany({
        where: eq(tables.databaseId, databaseId.value)
      })

      if (tableRecords.length === 0) return []

      // Get all fields for all tables
      const fieldsByTable = new Map<number, FieldRow[]>()
      for (const tableRecord of tableRecords) {
        const tableFieldRecords = await this.db.query.fields.findMany({
          where: eq(fields.tableId, tableRecord.id),
          orderBy: [fields.orderIndex]
        })
        fieldsByTable.set(tableRecord.id, tableFieldRecords)
      }

      // Convert to domain entities
      return tableRecords.map((tableRecord: TableRow) => {
        const fieldRecords = fieldsByTable.get(tableRecord.id) || []
        const tableFields = fieldRecords.map((fieldRecord: FieldRow) =>
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
        )

        return DynamicTable.fromPersistence({
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
        })
      })
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error finding tables by database:', error)
      throw error
    }
  }

  async update(id: TableId, data: Partial<DynamicTable>): Promise<DynamicTable> {
    try {
      // 1. Update table metadata in PostgreSQL
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

      // 2. If fields are provided, sync them to PostgreSQL and DuckDB
      if (data.fields) {
        const newFields = await this.syncTableFields(id, data.fields);

        // 3. Add columns to DuckDB table for new fields
        if (newFields.length > 0) {
          const table = await this.findById(id);
          if (table) {
            await this.dbManager.withDatabaseLock(
              OrganizationId.fromNumber(table.organizationId.value),
              DatabaseId.fromNumber(table.databaseId.value),
              async (conn) => {
                for (const field of newFields) {
                  const alterSql = `ALTER TABLE table_${id.value} ADD COLUMN ${field.name} ${this.getDuckDBType(field.type)}`
                  await conn.run(alterSql)
                  console.log(`[DuckDB Repository] Added column ${field.name} to table_${id.value}`)
                }
              }
            );
          }
        }
      }

      // 4. Reload table with complete fields
      const reloadedTable = await this.findById(id);
      if (!reloadedTable) {
        throw new Error(`Failed to reload table ${id.value} after update`);
      }

      console.log(`[DuckDBDynamicTableRepository] Updated table ${id.value}`);
      return reloadedTable;

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error updating table:', error);
      throw error;
    }
  }

  async delete(id: TableId): Promise<void> {
    try {
      const table = await this.findById(id)
      if (!table) throw new Error('Table not found')

      // 1. Drop DuckDB table from .duckdb file
      await this.dbManager.withDatabaseLock(
        OrganizationId.fromNumber(table.organizationId.value),
        DatabaseId.fromNumber(table.databaseId.value),
        async (conn) => {
          const dropSql = `DROP TABLE IF EXISTS table_${id.value}`
          await conn.run(dropSql)
          console.log(`[DuckDB Repository] Dropped table_${id.value} from .duckdb file`)
        }
      )

      // 2. Delete PostgreSQL metadata
      await this.db.delete(fields).where(eq(fields.tableId, id.value))
      await this.db.delete(tables).where(eq(tables.id, id.value))

      console.log(`[DuckDBDynamicTableRepository] Deleted table_${id.value}`)
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error deleting table:', error)
      throw error
    }
  }

  async existsByStorageLocation(organizationId: OrganizationId, storageLocation: string): Promise<boolean> {
    try {
      const tableRecord = await this.db.query.tables.findFirst({
        where: and(
          eq(tables.organizationId, organizationId.value),
          eq(tables.s3Path, storageLocation)
        )
      })
      return !!tableRecord
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error checking storage location:', error)
      throw error
    }
  }

  // ==========================================
  // ROW OPERATIONS (DuckDB SQL)
  // ==========================================

  async insertRow(tableId: TableId, row: Row): Promise<Row> {
    try {
      const table = await this.findById(tableId)
      if (!table) throw new Error('Table not found')

      return await this.dbManager.withDatabaseLock(
        OrganizationId.fromNumber(table.organizationId.value),
        DatabaseId.fromNumber(table.databaseId.value),
        async (conn) => {
          // Direct SQL INSERT
          const insertSql = DuckDBSqlTemplates.insertRow({
            tableId: tableId.value,
            rowData: row.toPlainObject()
          })

          await conn.run(insertSql)
          console.log(`[DuckDB Repository] Inserted row ${row.id.value} into table_${tableId.value}`)
          return row
        }
      )
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error inserting row:', error)
      throw error
    }
  }

  async findRows(tableId: TableId, options?: RowQueryOptions): Promise<Row[]> {
    return await this.getRows(tableId, options)
  }

  async getRows(tableId: TableId, options?: RowQueryOptions): Promise<Row[]> {
    try {
      const table = await this.findById(tableId)
      if (!table) return []

      return await this.dbManager.withDatabaseLock(
        OrganizationId.fromNumber(table.organizationId.value),
        DatabaseId.fromNumber(table.databaseId.value),
        async (conn) => {
          // Build query using SQL templates
          const selectSql = DuckDBSqlTemplates.selectRows({
            tableId: tableId.value,
            filters: options?.filters?.map(f => ({
              field: f.field,
              operator: f.operator || '=',
              value: f.value
            })),
            orderBy: options?.orderBy,
            orderDirection: options?.orderDirection,
            limit: options?.limit,
            offset: options?.offset
          })

          const result = await conn.run(selectSql)
          const rows = await result.getRows()

          // Convert to Row entities
          return rows.map(rowData =>
            Row.fromPlainObject(rowData, tableId.value, table.fields)
          )
        }
      )

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error getting rows:', error)
      return []
    }
  }

  async getRow(tableId: TableId, rowId: string): Promise<Row | null> {
    try {
      const table = await this.findById(tableId)
      if (!table) return null

      return await this.dbManager.withDatabaseLock(
        OrganizationId.fromNumber(table.organizationId.value),
        DatabaseId.fromNumber(table.databaseId.value),
        async (conn) => {
          const selectSql = DuckDBSqlTemplates.selectRowById({
            tableId: tableId.value,
            rowId
          })

          const result = await conn.run(selectSql)
          const rows = await result.getRows()

          if (rows.length === 0) return null

          return Row.fromPlainObject(rows[0], tableId.value, table.fields)
        }
      )

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error getting row:', error)
      return null
    }
  }

  async updateRow(tableId: TableId, rowId: string, row: Row): Promise<Row> {
    try {
      const table = await this.findById(tableId)
      if (!table) throw new Error('Table not found')

      return await this.dbManager.withDatabaseLock(
        OrganizationId.fromNumber(table.organizationId.value),
        DatabaseId.fromNumber(table.databaseId.value),
        async (conn) => {
          const updateSql = DuckDBSqlTemplates.updateRow({
            tableId: tableId.value,
            rowId,
            rowData: row.toPlainObject()
          })

          await conn.run(updateSql)
          console.log(`[DuckDB Repository] Updated row ${rowId} in table_${tableId.value}`)
          return row
        }
      )
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error updating row:', error)
      throw error
    }
  }

  async deleteRow(tableId: TableId, rowId: string): Promise<void> {
    try {
      const table = await this.findById(tableId)
      if (!table) throw new Error('Table not found')

      await this.dbManager.withDatabaseLock(
        OrganizationId.fromNumber(table.organizationId.value),
        DatabaseId.fromNumber(table.databaseId.value),
        async (conn) => {
          const deleteSql = DuckDBSqlTemplates.deleteRow({
            tableId: tableId.value,
            rowId
          })

          await conn.run(deleteSql)
          console.log(`[DuckDB Repository] Deleted row ${rowId} from table_${tableId.value}`)
        }
      )

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error deleting row:', error)
      throw error
    }
  }

  async tableExists(tableId: TableId): Promise<boolean> {
    const table = await this.findById(tableId)
    return !!table
  }

  async getTableStats(tableId: TableId): Promise<{
    rowCount: number
    sizeBytes: number
    lastModified: Date
  }> {
    try {
      const table = await this.findById(tableId)
      if (!table) throw new Error('Table not found')

      // Use DuckDB for row count (fast)
      const rowCount = await this.dbManager.withDatabaseLock(
        OrganizationId.fromNumber(table.organizationId.value),
        DatabaseId.fromNumber(table.databaseId.value),
        async (conn) => {
          const statsSql = `SELECT COUNT(*) as row_count FROM table_${tableId.value}`
          const result = await conn.run(statsSql)
          const rows = await result.getRows()
          const firstRow = rows[0] as any
          return firstRow?.row_count || 0
        }
      )

      // Get S3 .duckdb file size
      const s3Key = `org_${table.organizationId.value}/db_${table.databaseId.value}/data.duckdb`
      let sizeBytes = 0
      try {
        const response = await s3Client.send(new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key
        }))
        sizeBytes = (response as any).ContentLength || 0
      } catch (error) {
        // File doesn't exist yet
      }

      return {
        rowCount,
        sizeBytes,
        lastModified: table.updatedAt || new Date()
      }

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error getting table stats:', error)
      throw error
    }
  }

  async hasRows(tableId: TableId): Promise<boolean> {
    try {
      const table = await this.findById(tableId)
      if (!table) return false

      return await this.dbManager.withDatabaseLock(
        OrganizationId.fromNumber(table.organizationId.value),
        DatabaseId.fromNumber(table.databaseId.value),
        async (conn) => {
          const hasSql = `SELECT COUNT(*) > 0 as has_rows FROM table_${tableId.value}`
          const result = await conn.run(hasSql)
          const rows = await result.getRows()
          const firstRow = rows[0] as any
          return firstRow?.has_rows || false
        }
      )
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error checking has rows:', error)
      return false
    }
  }

  async findAll(): Promise<DynamicTable[]> {
    try {
      const tableRecords = await this.db.query.tables.findMany()
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
        fields: []
      }))
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error finding all tables:', error)
      throw error
    }
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================


  /**
   * Sync table fields to PostgreSQL
   * Handles adding new fields that were created via table.addField()
   * Returns the list of newly added fields
   */
  private async syncTableFields(tableId: TableId, tableFields: readonly TableField[]): Promise<TableField[]> {
    try {
      // Get existing fields from database
      const existingFields = await this.db.select()
        .from(fields)
        .where(eq(fields.tableId, tableId.value))

      // Find fields that need to be added (exist in memory but not in DB)
      const existingFieldNames = new Set(existingFields.map((f: FieldRow) => f.name))
      const fieldsToAdd = Array.from(tableFields).filter(f => !existingFieldNames.has(f.name))

      // Insert new fields
      for (const field of fieldsToAdd) {
        await this.db.insert(fields).values({
          tableId: tableId.value,
          name: field.name,
          slug: field.name.toLowerCase().replace(/\s+/g, '_'),
          type: field.type,
          orderIndex: field.orderIndex,
          required: field.required,
          fieldConfig: field.relatedTableId || field.metadata ? {
            ...(field.metadata || {}),
            ...(field.relatedTableId ? { relatedTableId: field.relatedTableId.value } : {})
          } : null
        })
      }

      console.log(`[DuckDBDynamicTableRepository] Synced ${fieldsToAdd.length} new fields for table ${tableId.value}`)

      return fieldsToAdd

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error syncing table fields:', error)
      throw error
    }
  }

  /**
   * Map domain field types to DuckDB types
   */
  private getDuckDBType(fieldType: FieldType): string {
    const typeMap: Record<FieldType, string> = {
      'text': 'VARCHAR',
      'number': 'DOUBLE',
      'boolean': 'BOOLEAN',
      'date': 'TIMESTAMP',
      'relation': 'JSON', // Store as JSON string
      'file': 'JSON',     // Store as JSON string
      'document': 'JSON'  // Store as JSON string
    };

    return typeMap[fieldType] || 'VARCHAR';
  }
}
