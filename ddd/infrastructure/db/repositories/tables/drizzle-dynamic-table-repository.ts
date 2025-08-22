// AIDEV-NOTE: Simplified Drizzle implementation of IDynamicTableRepository
// Uses SQL templates for clear, testable SQL generation

import { eq, sql } from 'drizzle-orm';
import type postgres from 'postgres';

import { tables } from '@/lib/db/schema';
import type { DbClient } from '@/lib/db/client';
import type { IDynamicTableRepository } from '@/ddd/domain/tables/repositories/dynamic-table-repository';
import { 
  DynamicTableSqlTemplates, 
  SqlExecutor,
} from '@/ddd/infrastructure/db/sql-templates';

import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '@/ddd/domain/tables/entities/dynamic-table';

export class DrizzleDynamicTableRepository implements IDynamicTableRepository {
  private sqlExecutor: SqlExecutor;

  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql
  ) {
    this.sqlExecutor = new SqlExecutor(rawClient);
  }

  // Table CRUD - just the basics
  async findById(id: number): Promise<DynamicTable | null> {
    const result = await this.db
      .select()
      .from(tables)
      .where(eq(tables.id, id))
      .limit(1);

    const table = result[0];
    if (!table) return null;

    return this.mapToDomainEntity(table);
  }

  async findByOrganization(organizationId: number): Promise<DynamicTable[]> {
    const result = await this.db
      .select()
      .from(tables)
      .where(eq(tables.organizationId, organizationId))
      .orderBy(tables.createdAt);

    return result.map(table => this.mapToDomainEntity(table));
  }

  async create(data: CreateDynamicTableData): Promise<DynamicTable> {
    // First create the metadata record
    const [newTable] = await this.db
      .insert(tables)
      .values({
        databaseId: data.databaseId,
        organizationId: data.organizationId,
        name: data.name,
        dbName: data.dbName,
        metadata: data.metadata || null,
        createdBy: data.createdBy,
      })
      .returning();

    if (!newTable) {
      throw new Error('Failed to create table metadata');
    }

    // Then create the actual PostgreSQL table
    try {
      await this.createPhysicalTable(data.dbName);
    } catch (error) {
      // Rollback metadata creation if physical table creation fails
      await this.db.delete(tables).where(eq(tables.id, newTable.id));
      throw new Error(`Failed to create physical table: ${error}`);
    }

    return this.mapToDomainEntity(newTable);
  }

  async delete(id: number): Promise<void> {
    // Get table info before deletion
    const table = await this.findById(id);
    if (!table) {
      throw new Error(`Table with id ${id} not found`);
    }

    // Drop the physical table first
    await this.dropPhysicalTable(table.dbName);

    // Then delete the metadata
    await this.db.delete(tables).where(eq(tables.id, id));
  }

  // Row CRUD - what's actually used
  async insertRow(tableId: number, data: CreateRowData): Promise<DynamicTableRow> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const fields = Object.keys(data);
    const values = Object.values(data);

    try {
      const template = DynamicTableSqlTemplates.insertRow({
        tableName: table.dbName,
        fields,
        values
      });
      
      const result = await this.sqlExecutor.executeTemplate('INSERT_ROW', template);
      return result[0] as DynamicTableRow;
    } catch (error) {
      console.error(`Error inserting row into ${table.dbName}:`, error);
      throw error;
    }
  }

  async findRows(tableId: number, options: RowQueryOptions = {}): Promise<DynamicTableRow[]> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const {
      limit = 100,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'DESC'
    } = options;

    try {
      const template = DynamicTableSqlTemplates.selectRows({
        tableName: table.dbName,
        orderBy,
        orderDirection,
        limit,
        offset
      });

      const result = await this.sqlExecutor.executeTemplate('SELECT_ROWS', template);
      return result.map(row => row as any) as DynamicTableRow[];
    } catch (error) {
      console.error(`Error finding rows in ${table.dbName}:`, error);
      throw error;
    }
  }

  async updateRow(tableId: number, rowId: string, data: UpdateRowData): Promise<DynamicTableRow> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const fields = Object.keys(data);
    const values = Object.values(data);

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    try {
      const template = DynamicTableSqlTemplates.updateRow({
        tableName: table.dbName,
        fields,
        values,
        rowId
      });

      const result = await this.sqlExecutor.executeTemplate('UPDATE_ROW', template);
      
      if (result.length === 0) {
        throw new Error(`Row with id ${rowId} not found in table ${table.dbName}`);
      }

      return result[0] as DynamicTableRow;
    } catch (error) {
      console.error(`Error updating row ${rowId} in ${table.dbName}:`, error);
      throw error;
    }
  }

  async deleteRow(tableId: number, rowId: string): Promise<void> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    try {
      const template = DynamicTableSqlTemplates.deleteRow({
        tableName: table.dbName,
        rowId
      });

      await this.sqlExecutor.executeTemplate('DELETE_ROW', template);
    } catch (error) {
      console.error(`Error deleting row ${rowId} from ${table.dbName}:`, error);
      throw error;
    }
  }

  // Helper methods for physical table operations
  private async createPhysicalTable(dbName: string): Promise<void> {
    const template = DynamicTableSqlTemplates.createTable({ tableName: dbName });
    await this.sqlExecutor.executeTemplate('CREATE_TABLE', template);
  }

  private async dropPhysicalTable(dbName: string): Promise<void> {
    const template = DynamicTableSqlTemplates.dropTable({ tableName: dbName });
    await this.sqlExecutor.executeTemplate('DROP_TABLE', template);
  }

  // Helper method to convert from database to domain entity
  private mapToDomainEntity(table: any): DynamicTable {
    return {
      id: table.id,
      databaseId: table.databaseId,
      organizationId: table.organizationId,
      name: table.name,
      dbName: table.dbName,
      metadata: table.metadata,
      createdBy: table.createdBy,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    };
  }
}