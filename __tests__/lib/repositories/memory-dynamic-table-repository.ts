// AIDEV-NOTE: In-memory implementation of IDynamicTableRepository for testing
// Provides real data structure operations without requiring external database

import type { 
  IDynamicTableRepository 
} from '@/lib/domain/repositories/dynamic-table-repository';
import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '@/lib/domain/entities/dynamic-table';
import { v4 as uuidv4 } from 'uuid';

export class MemoryDynamicTableRepository implements IDynamicTableRepository {
  private tables: Map<number, DynamicTable> = new Map();
  private rows: Map<number, Map<string, DynamicTableRow>> = new Map();
  private nextTableId = 1;

  // Table CRUD - just the basics
  async findById(id: number): Promise<DynamicTable | null> {
    return this.tables.get(id) || null;
  }

  async findByOrganization(organizationId: number): Promise<DynamicTable[]> {
    return Array.from(this.tables.values())
      .filter(table => table.organizationId === organizationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async create(data: CreateDynamicTableData): Promise<DynamicTable> {
    const now = new Date();
    const table: DynamicTable = {
      id: this.nextTableId++,
      databaseId: data.databaseId,
      organizationId: data.organizationId,
      name: data.name,
      dbName: data.dbName,
      metadata: data.metadata || null,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.tables.set(table.id, table);
    this.rows.set(table.id, new Map());

    return table;
  }

  async delete(id: number): Promise<void> {
    if (!this.tables.has(id)) {
      throw new Error(`Table with id ${id} not found`);
    }

    this.tables.delete(id);
    this.rows.delete(id);
  }

  // Row CRUD - what's actually used
  async insertRow(tableId: number, data: CreateRowData): Promise<DynamicTableRow> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const now = new Date();
    const rowId = uuidv4();
    
    const row: DynamicTableRow = {
      id: rowId,
      created_at: now,
      updated_at: now,
      ...data,
    };

    const tableRows = this.rows.get(tableId) || new Map();
    tableRows.set(rowId, row);
    this.rows.set(tableId, tableRows);

    return row;
  }

  async findRows(tableId: number, options: RowQueryOptions = {}): Promise<DynamicTableRow[]> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const tableRows = this.rows.get(tableId) || new Map();
    let rows = Array.from(tableRows.values());

    // Apply ordering
    const { orderBy = 'created_at', orderDirection = 'DESC' } = options;
    rows.sort((a, b) => {
      const aValue = (a as any)[orderBy];
      const bValue = (b as any)[orderBy];
      
      if (aValue < bValue) return orderDirection === 'ASC' ? -1 : 1;
      if (aValue > bValue) return orderDirection === 'ASC' ? 1 : -1;
      return 0;
    });

    // Apply pagination
    const { limit = 100, offset = 0 } = options;
    return rows.slice(offset, offset + limit);
  }

  async updateRow(tableId: number, rowId: string, data: UpdateRowData): Promise<DynamicTableRow> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const tableRows = this.rows.get(tableId);
    if (!tableRows || !tableRows.has(rowId)) {
      throw new Error(`Row with id ${rowId} not found in table ${table.dbName}`);
    }

    const existingRow = tableRows.get(rowId)!;
    const updatedRow = {
      ...existingRow,
      ...data,
      updated_at: new Date(),
    };

    tableRows.set(rowId, updatedRow);
    return updatedRow;
  }

  async deleteRow(tableId: number, rowId: string): Promise<void> {
    const table = await this.findById(tableId);
    if (!table) {
      throw new Error(`Table with id ${tableId} not found`);
    }

    const tableRows = this.rows.get(tableId);
    if (!tableRows || !tableRows.has(rowId)) {
      throw new Error(`Row with id ${rowId} not found in table ${table.dbName}`);
    }

    tableRows.delete(rowId);
  }

  // Test utilities
  clear(): void {
    this.tables.clear();
    this.rows.clear();
    this.nextTableId = 1;
  }

  getRowCount(tableId: number): number {
    const tableRows = this.rows.get(tableId);
    return tableRows ? tableRows.size : 0;
  }

  getAllTables(): DynamicTable[] {
    return Array.from(this.tables.values());
  }
}

// Test using the in-memory implementation
export function createTestRepository(): MemoryDynamicTableRepository {
  return new MemoryDynamicTableRepository();
}