/**
 * DuckDB Dynamic Table Repository
 *
 * Infrastructure implementation using DuckDB for analytical queries on Arrow files.
 * Designed for big data analytics with complex operations.
 *
 * Architecture:
 * - PostgreSQL: Table metadata (id, name, fields, s3Path)
 * - S3: Arrow IPC files (actual row data)
 * - DuckDB: Virtual tables (1:1 mapping with domain tables) for analytics
 *
 * AIDEV-NOTE: DuckDB repository for analytical workloads
 * Follows DDD principles - infrastructure layer, implements domain repository interface
 */

import type { DbClient } from '@/lib/db/client'
import * as duckdb from 'duckdb'
import { tables, fields } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import { s3Client, BUCKET_NAME, ensureBucketExists } from '@/lib/s3/client'
import { GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

import { TableId, DatabaseId, OrganizationId, UserId } from '@/ddd/domain/shared/value-objects'
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository'
import type { CreateDynamicTableData } from '@/ddd/application/services/tables/table-application-service'
import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table'
import { Row } from '@/ddd/domain/tables/value-objects/row'
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence'
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field'
import { S3TablePath } from '@/ddd/domain/tables/value-objects/s3-table-path'
import { TableMetadata } from '@/ddd/domain/tables/value-objects/table-metadata'
import type { DataStorageService } from '@/ddd/domain/tables/services/data-storage-service'

import { DuckDBSqlTemplates, DuckDBSqlExecutor } from './duckdb-sql-templates'

type TableRow = InferSelectModel<typeof tables>
type FieldRow = InferSelectModel<typeof fields>

/**
 * DuckDB-powered repository for analytical queries on dynamic tables
 * Uses SQL templates for type-safe query building
 */
export class DuckDBDynamicTableRepository implements IDynamicTableRepository {
  private executor: DuckDBSqlExecutor
  private isInitialized: boolean = false

  constructor(
    private readonly db: DbClient,
    private readonly duckdb: duckdb.Database,
    private readonly dataStorageService: DataStorageService
  ) {
    this.executor = new DuckDBSqlExecutor(duckdb)
    this.initialize()
  }

  /**
   * Initialize DuckDB with S3 configuration using stable API
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return

    return new Promise((resolve, reject) => {
      // Install and load extensions using stable callback-based API
      this.duckdb.exec("INSTALL arrow; LOAD arrow; INSTALL httpfs; LOAD httpfs;", (err) => {
        if (err) {
          console.error('[DuckDBDynamicTableRepository] Extension installation failed:', err)
          reject(err)
          return
        }

        // Configure S3 if credentials are available
        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
          const s3Config = [
            `SET s3_region='${process.env.AWS_REGION || 'ap-southeast-2'}';`,
            `SET s3_access_key_id='${process.env.AWS_ACCESS_KEY_ID}';`,
            `SET s3_secret_access_key='${process.env.AWS_SECRET_ACCESS_KEY}';`
          ]

          if (process.env.S3_ENDPOINT_URL) {
            s3Config.push(`SET s3_endpoint='${process.env.S3_ENDPOINT_URL}';`)
            s3Config.push(`SET s3_use_ssl='${!process.env.S3_ENDPOINT_URL.startsWith('http://')}';`)
          }

          this.duckdb.exec(s3Config.join(' '), (s3Err) => {
            if (s3Err) {
              console.error('[DuckDBDynamicTableRepository] S3 configuration failed:', s3Err)
              reject(s3Err)
              return
            }

            this.isInitialized = true
            console.log('[DuckDBDynamicTableRepository] Initialized successfully with S3')
            resolve()
          })
        } else {
          this.isInitialized = true
          console.log('[DuckDBDynamicTableRepository] Initialized successfully (no S3 credentials)')
          resolve()
        }
      })
    })
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

      // 3. Initialize empty Arrow file in S3
      await this.initializeEmptyTable(realS3Path, data.organizationId, data.databaseId, TableId.fromNumber(tableRecord.id), data.name, data.createdBy)

      // 4. Create DuckDB virtual table
      const s3Url = `s3://${BUCKET_NAME}/${realS3Path.getDataPath()}`
      const createTableSql = DuckDBSqlTemplates.createVirtualTable({
        tableId: tableRecord.id,
        s3Path: s3Url,
        fields: []
      })
      await this.executor.executeNonQuery('CREATE_VIRTUAL_TABLE', createTableSql)

      // 5. Return domain entity
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

      console.log(`[DuckDBDynamicTableRepository] Created table: ${dynamicTable.name} with virtual table_${tableRecord.id}`)
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

      // Ensure virtual table exists for this table (important for existing tables!)
      await this.ensureVirtualTableExists(dynamicTable)

      return dynamicTable

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error finding table:', error)
      throw error
    }
  }

  async findByOrganization(organizationId: OrganizationId): Promise<DynamicTable[]> {
    // Implementation similar to findById but for multiple tables
    // Omitted for brevity - same pattern as existing repository
    return []
  }

  async findByDatabase(databaseId: DatabaseId): Promise<DynamicTable[]> {
    // Implementation similar to findById
    return []
  }

  async update(id: TableId, data: Partial<DynamicTable>): Promise<DynamicTable> {
    // Update PostgreSQL metadata
    // Refresh DuckDB virtual table if needed
    throw new Error('Not implemented yet')
  }

  async delete(id: TableId): Promise<void> {
    try {
      const table = await this.findById(id)
      if (!table) throw new Error('Table not found')

      // 1. Drop DuckDB virtual table
      const dropSql = DuckDBSqlTemplates.dropVirtualTable(id.value)
      await this.executor.executeNonQuery('DROP_VIRTUAL_TABLE', dropSql)

      // 2. Delete S3 files
      const s3Path = S3TablePath.fromPath(table.storageLocation)
      await this.deleteS3Directory(s3Path.path)

      // 3. Delete PostgreSQL metadata
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

      // Use SQL template for INSERT
      const insertSql = DuckDBSqlTemplates.insertRow({
        tableId: tableId.value,
        rowData: row.toPlainObject()
      })

      await this.executor.executeNonQuery('INSERT_ROW', insertSql)

      // Refresh virtual table to see new data
      await this.refreshVirtualTable(tableId, table.storageLocation)

      return row
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

      const rows = await this.executor.execute('SELECT_ROWS', selectSql)

      // Convert to Row entities
      return rows.map(rowData =>
        Row.fromPlainObject(rowData, tableId.value, table.fields)
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

      const selectSql = DuckDBSqlTemplates.selectRowById({
        tableId: tableId.value,
        rowId
      })

      const rows = await this.executor.execute('SELECT_ROW_BY_ID', selectSql)

      if (rows.length === 0) return null

      return Row.fromPlainObject(rows[0], tableId.value, table.fields)

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error getting row:', error)
      return null
    }
  }

  async updateRow(tableId: TableId, rowId: string, row: Row): Promise<Row> {
    try {
      const table = await this.findById(tableId)
      if (!table) throw new Error('Table not found')

      const updateSql = DuckDBSqlTemplates.updateRow({
        tableId: tableId.value,
        rowId,
        rowData: row.toPlainObject()
      })

      await this.executor.executeNonQuery('UPDATE_ROW', updateSql)

      // Refresh virtual table
      await this.refreshVirtualTable(tableId, table.storageLocation)

      return row
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error updating row:', error)
      throw error
    }
  }

  async deleteRow(tableId: TableId, rowId: string): Promise<void> {
    try {
      const table = await this.findById(tableId)
      if (!table) throw new Error('Table not found')

      const deleteSql = DuckDBSqlTemplates.deleteRow({
        tableId: tableId.value,
        rowId
      })

      await this.executor.executeNonQuery('DELETE_ROW', deleteSql)

      // Refresh virtual table
      await this.refreshVirtualTable(tableId, table.storageLocation)

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
      const statsSql = DuckDBSqlTemplates.getTableStats(tableId.value)
      const statsRows = await this.executor.execute('GET_TABLE_STATS', statsSql)

      const stats = statsRows[0]

      // Get S3 file size
      const s3Path = S3TablePath.fromPath(table.storageLocation)
      let sizeBytes = 0
      try {
        const response = await s3Client.send(new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Path.getDataPath()
        }))
        sizeBytes = (response as any).ContentLength || 0
      } catch (error) {
        // File doesn't exist yet
      }

      return {
        rowCount: stats.row_count || 0,
        sizeBytes,
        lastModified: stats.last_updated ? new Date(stats.last_updated) : table.updatedAt || new Date()
      }

    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error getting table stats:', error)
      throw error
    }
  }

  async hasRows(tableId: TableId): Promise<boolean> {
    try {
      const hasSql = DuckDBSqlTemplates.hasRows(tableId.value)
      const rows = await this.executor.execute('HAS_ROWS', hasSql)
      return rows[0]?.has_rows || false
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
   * Ensure virtual table exists for a domain table
   * Critical for existing tables that were created before DuckDB was enabled
   */
  private async ensureVirtualTableExists(table: DynamicTable): Promise<void> {
    try {
      // Check if virtual table exists by querying information_schema
      const checkSql = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_name = 'table_${table.id.value}'
      `.trim()

      const existingTables = await this.executor.execute('CHECK_VIRTUAL_TABLE', checkSql)

      // If virtual table doesn't exist, create it
      if (existingTables.length === 0) {
        console.log(`[DuckDBDynamicTableRepository] Creating virtual table for existing table_${table.id.value}`)
        await this.refreshVirtualTable(table.id, table.storageLocation)
      }
    } catch (error) {
      // If check fails, try to create the virtual table anyway
      // This handles cases where S3 file might not exist yet for new empty tables
      console.warn(`[DuckDBDynamicTableRepository] Error checking virtual table existence for table_${table.id.value}, attempting to create:`, error)
      try {
        await this.refreshVirtualTable(table.id, table.storageLocation)
      } catch (createError) {
        // S3 file might not exist yet for brand new empty tables - this is ok
        console.warn(`[DuckDBDynamicTableRepository] Could not create virtual table for table_${table.id.value} - S3 file may not exist yet`)
      }
    }
  }

  /**
   * Refresh DuckDB virtual table with latest S3 data
   * Called after writes to ensure DuckDB sees updated data
   */
  private async refreshVirtualTable(tableId: TableId, storageLocation: string): Promise<void> {
    try {
      const s3Path = S3TablePath.fromPath(storageLocation)
      const s3Url = `s3://${BUCKET_NAME}/${s3Path.getDataPath()}`

      const refreshSql = DuckDBSqlTemplates.refreshVirtualTable({
        tableId: tableId.value,
        s3Path: s3Url
      })

      await this.executor.executeNonQuery('REFRESH_VIRTUAL_TABLE', refreshSql)
    } catch (error) {
      console.error('[DuckDBDynamicTableRepository] Error refreshing virtual table:', error)
      throw error
    }
  }

  private async initializeEmptyTable(
    s3Path: S3TablePath,
    organizationId: OrganizationId,
    databaseId: DatabaseId,
    tableId: TableId,
    tableName: string,
    createdBy: UserId
  ): Promise<void> {
    const emptyRows: Row[] = []

    const emptyTable = DynamicTable.fromPersistence({
      id: tableId.value,
      databaseId: databaseId.value,
      organizationId: organizationId.value,
      name: tableName,
      storageLocation: s3Path.path,
      description: undefined,
      metadata: undefined,
      fields: [],
      createdBy: createdBy.value,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const result = await this.dataStorageService.storeData(emptyRows, emptyTable)
    if (!result.success) {
      throw new Error(`Failed to initialize empty table: ${result.error}`)
    }

    await ensureBucketExists()

    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Path.getDataPath(),
      Body: result.data,
      ContentType: 'application/vnd.apache.arrow.file'
    }))
  }

  private async deleteS3Directory(prefix: string): Promise<void> {
    // TODO: Implement S3 directory deletion
    console.warn('[DuckDBDynamicTableRepository] S3 directory deletion not yet implemented for:', prefix)
  }
}
