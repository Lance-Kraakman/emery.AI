// AIDEV-NOTE: Drizzle implementation of IDynamicTableRepository - handles runtime table management
// Manages both table metadata and actual PostgreSQL table operations for Baserow-style dynamic tables

import { eq, and, sql, desc, asc, like, ilike, inArray } from 'drizzle-orm';
import type postgres from 'postgres';

import { tables } from '@/lib/db/schema';
import { generateTableName } from '@/utils/slugify';
import type { DbClient } from '@/lib/db/client';
import type { IDynamicTableRepository } from '@/lib/domain/repositories/dynamic-table-repository';
import { processRowData, processPartialRowData } from '@/lib/db/field-processors';
import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  UpdateDynamicTableData,
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions,
  DynamicTableStats,
  BulkRowOperation,
  TableOperation,
  FilterOperator
} from '@/lib/domain/entities/dynamic-table';

export class DrizzleDynamicTableRepository implements IDynamicTableRepository {
  constructor(
    private db: DbClient,
    private rawClient: postgres.Sql
  ) {}

  // Basic Table CRUD operations
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

  async findByDbName(dbName: string): Promise<DynamicTable | null> {
    const result = await this.db
      .select()
      .from(tables)
      .where(eq(tables.dbName, dbName))
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

  async findByDatabase(databaseId: number): Promise<DynamicTable[]> {
    const result = await this.db
      .select()
      .from(tables)
      .where(eq(tables.databaseId, databaseId))
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

  async update(id: number, data: UpdateDynamicTableData): Promise<DynamicTable> {
    const [updatedTable] = await this.db
      .update(tables)
      .set({
        databaseId: data.databaseId,
        name: data.name,
        metadata: data.metadata,
        updatedAt: sql`now()`,
      })
      .where(eq(tables.id, id))
      .returning();

    if (!updatedTable) {
      throw new Error(`Table with id ${id} not found or could not be updated`);
    }

    return this.mapToDomainEntity(updatedTable);
  }

  async delete(id: number): Promise<void> {
    // First check if table can be deleted
    const canDelete = await this.canDeleteTable(id);
    if (!canDelete) {
      throw new Error(`Cannot delete table ${id} - it has dependencies or data`);
    }

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

  // Table Schema Operations (PostgreSQL DDL)
  async createPhysicalTable(dbName: string): Promise<void> {
    await this.rawClient`
      CREATE TABLE ${this.rawClient(dbName)} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `;
  }

  async dropPhysicalTable(dbName: string): Promise<void> {
    await this.rawClient`DROP TABLE IF EXISTS ${this.rawClient(dbName)};`;
  }

  async renamePhysicalTable(oldDbName: string, newDbName: string): Promise<void> {
    await this.rawClient`ALTER TABLE ${this.rawClient(oldDbName)} RENAME TO ${this.rawClient(newDbName)};`;
  }

  // Row CRUD Operations (Dynamic Data)
  async insertRow(tableId: number, data: CreateRowData): Promise<DynamicTableRow> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    // Process data through field processor to handle JSON fields and field mapping
    const processedData = await processRowData(tableId, data, { validateRequired: true, debug: false });
    const fields = Object.keys(processedData);
    const values = Object.values(processedData);

    try {
      let result: any[];
      
      if (fields.length === 0) {
        // Insert with default values
        result = await this.rawClient`
          INSERT INTO ${this.rawClient(table.dbName)} DEFAULT VALUES RETURNING *
        `;
      } else {
        const fieldNames = fields.map(field => this.rawClient(field));
        const query = this.rawClient`
          INSERT INTO ${this.rawClient(table.dbName)} (${this.rawClient.unsafe(fieldNames.map(f => `"${f}"`).join(', '))}) 
          VALUES (${values}) 
          RETURNING *
        `;
        result = await query;
      }

      return result[0] as any as DynamicTableRow;
    } catch (error) {
      console.error(`Error inserting row into ${table.dbName}:`, error);
      throw error;
    }
  }

  async findRowById(tableId: number, rowId: string): Promise<DynamicTableRow | null> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    try {
      const result = await this.rawClient`
        SELECT * FROM ${this.rawClient(table.dbName)} WHERE id = ${rowId}
      `;

      return (result[0] as any as DynamicTableRow) || null;
    } catch (error) {
      console.error(`Error finding row ${rowId} in ${table.dbName}:`, error);
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
      orderDirection = 'DESC',
      filters = []
    } = options;

    try {
      let query = `SELECT * FROM "${table.dbName}"`;
      const params: any[] = [];
      let paramIndex = 1;

      // Add WHERE clause for filters
      if (filters.length > 0) {
        const whereConditions = filters.map(filter => {
          return this.buildFilterCondition(filter, params, paramIndex++);
        }).filter(Boolean);

        if (whereConditions.length > 0) {
          query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
      }

      // Add ORDER BY
      query += ` ORDER BY "${orderBy}" ${orderDirection}`;

      // Add LIMIT and OFFSET
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
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

    // Process partial data through field processor for JSON handling and field mapping
    const processedData = await processPartialRowData(tableId, data, { debug: false });
    const fields = Object.keys(processedData);
    const values = Object.values(processedData);

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    try {
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
      const result = await this.rawClient`
        DELETE FROM ${this.rawClient(table.dbName)} WHERE id = ${rowId}
      `;

      // Note: postgres doesn't return affected count directly, 
      // but we could check result.count if needed
    } catch (error) {
      console.error(`Error deleting row ${rowId} from ${table.dbName}:`, error);
      throw error;
    }
  }

  // Advanced Row Operations
  async bulkInsertRows(tableId: number, rows: CreateRowData[]): Promise<DynamicTableRow[]> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    if (rows.length === 0) {
      return [];
    }

    try {
      const results: DynamicTableRow[] = [];
      
      // Process each row through field processor, then insert
      // TODO: Could be optimized with single bulk INSERT query
      for (const rowData of rows) {
        const result = await this.insertRow(tableId, rowData);
        results.push(result);
      }

      return results;
    } catch (error) {
      console.error(`Error bulk inserting rows into ${table.dbName}:`, error);
      throw error;
    }
  }

  async bulkUpdateRows(tableId: number, updates: Array<{id: string; data: UpdateRowData}>): Promise<DynamicTableRow[]> {
    const results: DynamicTableRow[] = [];
    
    for (const update of updates) {
      const result = await this.updateRow(tableId, update.id, update.data);
      results.push(result);
    }

    return results;
  }

  async bulkDeleteRows(tableId: number, rowIds: string[]): Promise<void> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    if (rowIds.length === 0) {
      return;
    }

    try {
      await this.rawClient`
        DELETE FROM ${this.rawClient(table.dbName)} 
        WHERE id = ANY(${rowIds})
      `;
    } catch (error) {
      console.error(`Error bulk deleting rows from ${table.dbName}:`, error);
      throw error;
    }
  }

  async bulkOperation(tableId: number, operation: BulkRowOperation): Promise<DynamicTableRow[]> {
    switch (operation.type) {
      case 'INSERT':
        const insertData = operation.rows.map(row => row.data!);
        return await this.bulkInsertRows(tableId, insertData);
      
      case 'UPDATE':
        const updates = operation.rows.map(row => ({ id: row.id!, data: row.data! }));
        return await this.bulkUpdateRows(tableId, updates);
      
      case 'DELETE':
        const rowIds = operation.rows.map(row => row.id!);
        await this.bulkDeleteRows(tableId, rowIds);
        return [];
      
      default:
        throw new Error(`Unsupported bulk operation type: ${operation.type}`);
    }
  }

  // Row Queries and Filtering
  async countRows(tableId: number, options: Omit<RowQueryOptions, 'limit' | 'offset'> = {}): Promise<number> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const { filters = [] } = options;

    try {
      let query = `SELECT COUNT(*) as count FROM "${table.dbName}"`;
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.length > 0) {
        const whereConditions = filters.map(filter => {
          return this.buildFilterCondition(filter, params, paramIndex++);
        }).filter(Boolean);

        if (whereConditions.length > 0) {
          query += ` WHERE ${whereConditions.join(' AND ')}`;
        }
      }

      const result = await this.rawClient.unsafe(query, params);
      return parseInt(result[0].count);
    } catch (error) {
      console.error(`Error counting rows in ${table.dbName}:`, error);
      throw error;
    }
  }

  async searchRows(tableId: number, searchTerm: string, searchFields?: string[]): Promise<DynamicTableRow[]> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    try {
      let query = `SELECT * FROM "${table.dbName}"`;
      const params = [`%${searchTerm}%`];

      if (searchFields && searchFields.length > 0) {
        const searchConditions = searchFields.map(field => `"${field}"::text ILIKE $1`);
        query += ` WHERE ${searchConditions.join(' OR ')}`;
      } else {
        // Search in all text-like columns (simplified approach)
        query += ` WHERE EXISTS (
          SELECT 1 FROM unnest(ARRAY[${table.dbName}.*]::text[]) AS field_value 
          WHERE field_value ILIKE $1
        )`;
      }

      query += ` ORDER BY created_at DESC LIMIT 100`;

      const result = await this.rawClient.unsafe(query, params);
      return result.map(row => row as any) as DynamicTableRow[];
    } catch (error) {
      console.error(`Error searching rows in ${table.dbName}:`, error);
      throw error;
    }
  }

  async getDistinctValues(tableId: number, fieldKey: string): Promise<any[]> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    try {
      const result = await this.rawClient`
        SELECT DISTINCT ${this.rawClient(fieldKey)} as value 
        FROM ${this.rawClient(table.dbName)} 
        WHERE ${this.rawClient(fieldKey)} IS NOT NULL 
        ORDER BY value 
        LIMIT 1000
      `;

      return result.map(row => row.value);
    } catch (error) {
      console.error(`Error getting distinct values for ${fieldKey} in ${table.dbName}:`, error);
      throw error;
    }
  }

  // Table Management
  async getTableStats(tableId: number): Promise<DynamicTableStats> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    try {
      const rowCountResult = await this.rawClient`
        SELECT COUNT(*) as count FROM ${this.rawClient(table.dbName)}
      `;

      const fieldCountResult = await this.db
        .select({ count: sql`COUNT(*)` })
        .from(tables)
        .where(eq(tables.id, tableId));

      return {
        table,
        rowCount: parseInt(rowCountResult[0].count),
        fieldCount: parseInt(fieldCountResult[0].count as string) || 0,
        lastUpdated: new Date(),
      };
    } catch (error) {
      console.error(`Error getting stats for table ${table.dbName}:`, error);
      throw error;
    }
  }

  async validateTableOperation(operation: TableOperation): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    switch (operation.type) {
      case 'CREATE_TABLE':
        if (!operation.tableName) {
          errors.push('Table name is required for CREATE_TABLE operation');
        }
        break;
      
      case 'DROP_TABLE':
        const canDelete = await this.canDeleteTable(parseInt(operation.parameters?.tableId || '0'));
        if (!canDelete) {
          errors.push('Table cannot be deleted due to dependencies');
        }
        break;
      
      case 'RENAME_TABLE':
        if (!operation.parameters?.newName) {
          errors.push('New name is required for RENAME_TABLE operation');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async executeTableOperation(operation: TableOperation): Promise<void> {
    const validation = await this.validateTableOperation(operation);
    if (!validation.valid) {
      throw new Error(`Invalid table operation: ${validation.errors.join(', ')}`);
    }

    switch (operation.type) {
      case 'CREATE_TABLE':
        await this.createPhysicalTable(operation.tableName);
        break;
      
      case 'DROP_TABLE':
        await this.dropPhysicalTable(operation.tableName);
        break;
      
      case 'RENAME_TABLE':
        await this.renamePhysicalTable(operation.tableName, operation.parameters!.newName);
        break;
      
      default:
        throw new Error(`Unsupported table operation: ${operation.type}`);
    }
  }

  // Business Logic Operations
  async canDeleteTable(tableId: number): Promise<boolean> {
    try {
      const table = await this.findById(tableId);
      if (!table) return false;

      // Check if table has any rows
      const rowCount = await this.countRows(tableId);
      if (rowCount > 0) {
        return false; // Table has data
      }

      // Could add more checks here (e.g., foreign key references)
      return true;
    } catch (error) {
      return false;
    }
  }

  // Placeholder implementations for remaining methods
  async getRelatedTables(tableId: number): Promise<DynamicTable[]> {
    // TODO: Implement based on relation fields
    return [];
  }

  async getTableDependencies(tableId: number): Promise<{dependsOn: DynamicTable[]; dependedBy: DynamicTable[]}> {
    // TODO: Implement dependency analysis
    return { dependsOn: [], dependedBy: [] };
  }

  async exportTableData(tableId: number, format: 'json' | 'csv' | 'sql'): Promise<string> {
    // TODO: Implement data export
    throw new Error('Export functionality not yet implemented');
  }

  async importTableData(tableId: number, data: any[], format: 'json' | 'csv'): Promise<DynamicTableRow[]> {
    // TODO: Implement data import
    throw new Error('Import functionality not yet implemented');
  }

  async createTableMigration(fromTableId: number, toTableId: number): Promise<any> {
    // TODO: Implement migration functionality
    throw new Error('Migration functionality not yet implemented');
  }

  async analyzeTable(tableId: number): Promise<any> {
    // TODO: Implement table analysis
    throw new Error('Analysis functionality not yet implemented');
  }

  async optimizeTable(tableId: number): Promise<void> {
    // TODO: Implement table optimization
    throw new Error('Optimization functionality not yet implemented');
  }

  async rebuildIndexes(tableId: number): Promise<void> {
    // TODO: Implement index rebuilding
    throw new Error('Index rebuilding not yet implemented');
  }

  async getTableUsageInfo(tableId: number): Promise<any> {
    // TODO: Implement usage tracking
    return {
      lastAccessed: new Date(),
      accessCount: 0,
      relatedRecords: 0,
      linkedTables: 0
    };
  }

  async createTableBackup(tableId: number): Promise<any> {
    // TODO: Implement backup functionality
    throw new Error('Backup functionality not yet implemented');
  }

  async restoreTableFromBackup(tableId: number, backupId: string): Promise<void> {
    // TODO: Implement restore functionality
    throw new Error('Restore functionality not yet implemented');
  }

  async executeRawQuery(tableId: number, query: string, params?: any[]): Promise<DynamicTableRow[]> {
    // TODO: Implement raw query execution with safety checks
    throw new Error('Raw query execution not yet implemented');
  }

  async executeAggregateQuery(tableId: number, aggregations: any[]): Promise<Record<string, any>> {
    // TODO: Implement aggregate queries
    throw new Error('Aggregate queries not yet implemented');
  }

  async validateTableIntegrity(tableId: number): Promise<any> {
    // TODO: Implement integrity validation
    return { valid: true, issues: [] };
  }

  async watchTableChanges(tableId: number, callback: any): Promise<() => void> {
    // TODO: Implement real-time change watching
    throw new Error('Table watching not yet implemented');
  }

  // Helper methods
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

  private buildFilterCondition(filter: any, params: any[], paramIndex: number): string {
    const { field, operator, value } = filter;
    
    switch (operator as FilterOperator) {
      case 'eq':
        params.push(value);
        return `"${field}" = $${paramIndex}`;
      case 'ne':
        params.push(value);
        return `"${field}" != $${paramIndex}`;
      case 'gt':
        params.push(value);
        return `"${field}" > $${paramIndex}`;
      case 'gte':
        params.push(value);
        return `"${field}" >= $${paramIndex}`;
      case 'lt':
        params.push(value);
        return `"${field}" < $${paramIndex}`;
      case 'lte':
        params.push(value);
        return `"${field}" <= $${paramIndex}`;
      case 'like':
        params.push(value);
        return `"${field}"::text LIKE $${paramIndex}`;
      case 'ilike':
        params.push(value);
        return `"${field}"::text ILIKE $${paramIndex}`;
      case 'in':
        params.push(value);
        return `"${field}" = ANY($${paramIndex})`;
      case 'not_in':
        params.push(value);
        return `"${field}" != ALL($${paramIndex})`;
      case 'is_null':
        return `"${field}" IS NULL`;
      case 'is_not_null':
        return `"${field}" IS NOT NULL`;
      case 'contains':
        params.push(JSON.stringify(value));
        return `"${field}" @> $${paramIndex}::jsonb`;
      case 'contained_by':
        params.push(JSON.stringify(value));
        return `"${field}" <@ $${paramIndex}::jsonb`;
      case 'has_key':
        params.push(value);
        return `"${field}" ? $${paramIndex}`;
      default:
        return '';
    }
  }
}