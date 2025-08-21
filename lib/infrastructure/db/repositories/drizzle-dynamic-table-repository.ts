// AIDEV-NOTE: Simplified Drizzle implementation of IDynamicTableRepository
// Only implements the methods actually used in the application

import { eq, sql } from 'drizzle-orm';
import type postgres from 'postgres';

import { tables } from '@/lib/db/schema';
import { generateTableName } from '@/utils/slugify';
import type { DbClient } from '@/lib/db/client';
import type { IDynamicTableRepository } from '@/lib/domain/repositories/dynamic-table-repository';

import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '@/lib/domain/entities/dynamic-table';

export class DrizzleDynamicTableRepository implements IDynamicTableRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql
  ) {}

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
      let result: any[];
      
      if (fields.length === 0) {
        // Insert with default values - raw SQL required for dynamic table
        result = await this.rawClient`
          INSERT INTO ${this.rawClient(table.dbName)} DEFAULT VALUES RETURNING *
        `;
      } else {
        // Use proper parameterization for dynamic row insertion
        const columnNames = fields.map(field => `"${field}"`).join(', ');
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `
          INSERT INTO "${table.dbName}" (${columnNames}) 
          VALUES (${placeholders}) 
          RETURNING *
        `;
        
        result = await this.rawClient.unsafe(query, values);
      }

      return result[0] as any as DynamicTableRow;
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
      let query = `SELECT * FROM "${table.dbName}"`;
      const params: any[] = [];

      // Add ORDER BY
      query += ` ORDER BY "${orderBy}" ${orderDirection}`;

      // Add LIMIT and OFFSET
      query += ` LIMIT $1 OFFSET $2`;
      params.push(limit, offset);

      const result = await this.rawClient.unsafe(query, params);
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
      // Use proper parameterization for dynamic row update
      const setClause = fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');
      const query = `
        UPDATE "${table.dbName}" 
        SET ${setClause}, updated_at = now() 
        WHERE id = $${fields.length + 1} 
        RETURNING *
      `;

      const result = await this.rawClient.unsafe(query, [...values, rowId]);
      
      if (result.length === 0) {
        throw new Error(`Row with id ${rowId} not found in table ${table.dbName}`);
      }

      return result[0] as any as DynamicTableRow;
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
      await this.rawClient`
        DELETE FROM ${this.rawClient(table.dbName)} WHERE id = ${rowId}
      `;
    } catch (error) {
      console.error(`Error deleting row ${rowId} from ${table.dbName}:`, error);
      throw error;
    }
  }

  // Helper methods for physical table operations
  private async createPhysicalTable(dbName: string): Promise<void> {
    await this.rawClient`
      CREATE TABLE ${this.rawClient(dbName)} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `;
  }

  private async dropPhysicalTable(dbName: string): Promise<void> {
    await this.rawClient`DROP TABLE IF EXISTS ${this.rawClient(dbName)};`;
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