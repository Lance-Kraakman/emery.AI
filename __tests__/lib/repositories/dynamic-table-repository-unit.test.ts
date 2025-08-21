// AIDEV-NOTE: Isolated unit tests for Dynamic Table repository - tests core business logic without infrastructure
// Mocks database operations and field processors to focus on repository patterns

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrizzleDynamicTableRepository } from '@/lib/infrastructure/db/repositories/drizzle-dynamic-table-repository';
import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  UpdateDynamicTableData,
  DynamicTableRow,
  CreateRowData,
  UpdateRowData,
  RowQueryOptions
} from '@/lib/domain/entities/dynamic-table';

// Mock the field processor module
vi.mock('@/lib/db/field-processors', () => ({
  processRowData: vi.fn().mockImplementation((tableId, data) => Promise.resolve(data)),
  processPartialRowData: vi.fn().mockImplementation((tableId, data) => Promise.resolve(data)),
}));

// Mock database responses
const mockTable: DynamicTable = {
  id: 1,
  databaseId: 10,
  organizationId: 100,
  name: 'Test Table',
  dbName: 'test_table_123',
  metadata: { description: 'Test table for unit testing' },
  createdBy: 'user-123',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
};

const mockRow: DynamicTableRow = {
  id: 'row-uuid-123',
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-01T00:00:00Z'),
  field_1: 'Test Value',
  field_2: 42,
  field_3: true,
};

describe('DrizzleDynamicTableRepository - Unit Tests', () => {
  let tableRepository: DrizzleDynamicTableRepository;
  let mockDbClient: any;
  let mockRawClient: any;

  beforeEach(() => {
    // Mock Drizzle DB client
    mockDbClient = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    };

    // Mock raw postgres client
    mockRawClient = vi.fn().mockImplementation(() => ({
      then: vi.fn().mockResolvedValue([mockRow])
    }));
    mockRawClient.unsafe = vi.fn().mockResolvedValue([mockRow]);

    tableRepository = new DrizzleDynamicTableRepository(mockDbClient, mockRawClient);
  });

  describe('Table Metadata Operations', () => {
    it('should find table by ID', async () => {
      mockDbClient.returning.mockResolvedValue([mockTable]);

      const result = await tableRepository.findById(1);

      expect(result).toEqual(mockTable);
      expect(mockDbClient.select).toHaveBeenCalled();
      expect(mockDbClient.where).toHaveBeenCalled();
      expect(mockDbClient.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when table not found', async () => {
      mockDbClient.returning.mockResolvedValue([]);

      const result = await tableRepository.findById(999);

      expect(result).toBeNull();
    });

    it('should find table by database name', async () => {
      mockDbClient.returning.mockResolvedValue([mockTable]);

      const result = await tableRepository.findByDbName('test_table_123');

      expect(result).toEqual(mockTable);
      expect(mockDbClient.where).toHaveBeenCalled();
    });

    it('should find tables by organization', async () => {
      const mockTables = [
        { ...mockTable, id: 1, name: 'Table 1' },
        { ...mockTable, id: 2, name: 'Table 2' },
      ];
      mockDbClient.returning.mockResolvedValue(mockTables);

      const result = await tableRepository.findByOrganization(100);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Table 1');
      expect(result[1].name).toBe('Table 2');
      expect(mockDbClient.orderBy).toHaveBeenCalled();
    });

    it('should find tables by database', async () => {
      const mockTables = [
        { ...mockTable, id: 1, name: 'DB Table 1' },
        { ...mockTable, id: 2, name: 'DB Table 2' },
      ];
      mockDbClient.returning.mockResolvedValue(mockTables);

      const result = await tableRepository.findByDatabase(10);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('DB Table 1');
      expect(result[1].name).toBe('DB Table 2');
    });

    it('should create table with physical table', async () => {
      const tableData: CreateDynamicTableData = {
        databaseId: 10,
        organizationId: 100,
        name: 'New Table',
        dbName: 'new_table_456',
        metadata: { description: 'Newly created table' },
        createdBy: 'user-456',
      };

      const createdTable = { ...mockTable, ...tableData, id: 3 };
      mockDbClient.returning.mockResolvedValue([createdTable]);

      const result = await tableRepository.create(tableData);

      expect(result).toEqual(createdTable);
      expect(mockDbClient.insert).toHaveBeenCalled();
      expect(mockDbClient.values).toHaveBeenCalled();
      expect(mockRawClient).toHaveBeenCalled(); // Physical table creation
    });

    it('should update table metadata', async () => {
      const updateData: UpdateDynamicTableData = {
        name: 'Updated Table Name',
        metadata: { description: 'Updated description', version: '2.0' },
      };

      const updatedTable = { ...mockTable, ...updateData };
      mockDbClient.returning.mockResolvedValue([updatedTable]);

      const result = await tableRepository.update(1, updateData);

      expect(result).toEqual(updatedTable);
      expect(mockDbClient.update).toHaveBeenCalled();
      expect(mockDbClient.set).toHaveBeenCalled();
    });

    it('should delete table and drop physical table', async () => {
      // Mock canDeleteTable check
      mockDbClient.returning.mockResolvedValueOnce([mockTable]); // findById
      mockRawClient.unsafe.mockResolvedValueOnce([{ count: '0' }]); // countRows
      mockDbClient.returning.mockResolvedValueOnce([mockTable]); // findById again

      await tableRepository.delete(1);

      expect(mockDbClient.delete).toHaveBeenCalled();
      expect(mockRawClient).toHaveBeenCalled(); // Physical table drop
    });

    it('should throw error when deleting table with data', async () => {
      // Mock table with data
      mockDbClient.returning.mockResolvedValue([mockTable]);
      mockRawClient.unsafe.mockResolvedValue([{ count: '5' }]); // Non-zero count

      await expect(tableRepository.delete(1))
        .rejects.toThrow('Cannot delete table');
    });
  });

  describe('Row Operations', () => {
    beforeEach(() => {
      // Mock table lookup for row operations
      mockDbClient.returning.mockResolvedValue([mockTable]);
    });

    it('should insert row with processed data', async () => {
      const rowData: CreateRowData = {
        name: 'Test Value', // Field slug
        count: 42,
      };

      mockRawClient.mockResolvedValue([mockRow]);

      const result = await tableRepository.insertRow(1, rowData);

      expect(result).toEqual(mockRow);
      expect(mockRawClient).toHaveBeenCalled();
    });

    it('should insert row with empty data (default values)', async () => {
      mockRawClient.mockResolvedValue([{ 
        id: 'empty-row-uuid', 
        created_at: new Date(), 
        updated_at: new Date() 
      }]);

      const result = await tableRepository.insertRow(1, {});

      expect(result.id).toBe('empty-row-uuid');
      expect(mockRawClient).toHaveBeenCalled();
    });

    it('should find row by ID', async () => {
      mockRawClient.mockResolvedValue([mockRow]);

      const result = await tableRepository.findRowById(1, 'row-uuid-123');

      expect(result).toEqual(mockRow);
      expect(mockRawClient).toHaveBeenCalled();
    });

    it('should return null for non-existent row', async () => {
      mockRawClient.mockResolvedValue([]);

      const result = await tableRepository.findRowById(1, 'non-existent-uuid');

      expect(result).toBeNull();
    });

    it('should find rows with pagination and filtering', async () => {
      const mockRows = [
        { ...mockRow, id: 'row-1', field_1: 'Value 1' },
        { ...mockRow, id: 'row-2', field_1: 'Value 2' },
      ];
      mockRawClient.unsafe.mockResolvedValue(mockRows);

      const options: RowQueryOptions = {
        limit: 10,
        offset: 0,
        orderBy: 'created_at',
        orderDirection: 'DESC',
        filters: [
          { field: 'field_1', operator: 'like', value: '%Value%' }
        ]
      };

      const result = await tableRepository.findRows(1, options);

      expect(result).toHaveLength(2);
      expect(result[0].field_1).toBe('Value 1');
      expect(mockRawClient.unsafe).toHaveBeenCalled();
    });

    it('should update row with processed data', async () => {
      const updateData: UpdateRowData = {
        name: 'Updated Value',
        count: 100,
      };

      const updatedRow = { ...mockRow, field_1: 'Updated Value', field_2: 100 };
      mockRawClient.unsafe.mockResolvedValue([updatedRow]);

      const result = await tableRepository.updateRow(1, 'row-uuid-123', updateData);

      expect(result).toEqual(updatedRow);
      expect(mockRawClient.unsafe).toHaveBeenCalled();
    });

    it('should delete row', async () => {
      mockRawClient.mockResolvedValue([]);

      await tableRepository.deleteRow(1, 'row-uuid-123');

      expect(mockRawClient).toHaveBeenCalled();
    });
  });

  describe('Bulk Row Operations', () => {
    beforeEach(() => {
      mockDbClient.returning.mockResolvedValue([mockTable]);
    });

    it('should bulk insert rows', async () => {
      const rowsData: CreateRowData[] = [
        { field_1: 'Bulk Row 1' },
        { field_1: 'Bulk Row 2' },
      ];

      const insertedRows = [
        { ...mockRow, id: 'bulk-1', field_1: 'Bulk Row 1' },
        { ...mockRow, id: 'bulk-2', field_1: 'Bulk Row 2' },
      ];

      mockRawClient
        .mockResolvedValueOnce([insertedRows[0]])
        .mockResolvedValueOnce([insertedRows[1]]);

      const result = await tableRepository.bulkInsertRows(1, rowsData);

      expect(result).toHaveLength(2);
      expect(result[0].field_1).toBe('Bulk Row 1');
      expect(result[1].field_1).toBe('Bulk Row 2');
    });

    it('should bulk update rows', async () => {
      const updates = [
        { id: 'row-1', data: { field_1: 'Updated 1' } },
        { id: 'row-2', data: { field_1: 'Updated 2' } },
      ];

      const updatedRows = [
        { ...mockRow, id: 'row-1', field_1: 'Updated 1' },
        { ...mockRow, id: 'row-2', field_1: 'Updated 2' },
      ];

      mockRawClient.unsafe
        .mockResolvedValueOnce([updatedRows[0]])
        .mockResolvedValueOnce([updatedRows[1]]);

      const result = await tableRepository.bulkUpdateRows(1, updates);

      expect(result).toHaveLength(2);
      expect(result[0].field_1).toBe('Updated 1');
      expect(result[1].field_1).toBe('Updated 2');
    });

    it('should bulk delete rows', async () => {
      const rowIds = ['row-1', 'row-2'];

      mockRawClient.mockResolvedValue([]);

      await tableRepository.bulkDeleteRows(1, rowIds);

      expect(mockRawClient).toHaveBeenCalled();
    });

    it('should execute bulk operation - INSERT', async () => {
      const bulkOp = {
        type: 'INSERT' as const,
        rows: [
          { data: { field_1: 'Bulk Op Row' } },
        ],
      };

      mockRawClient.mockResolvedValue([{ ...mockRow, field_1: 'Bulk Op Row' }]);

      const result = await tableRepository.bulkOperation(1, bulkOp);

      expect(result).toHaveLength(1);
      expect(result[0].field_1).toBe('Bulk Op Row');
    });

    it('should execute bulk operation - DELETE', async () => {
      const bulkOp = {
        type: 'DELETE' as const,
        rows: [
          { id: 'delete-me' },
        ],
      };

      mockRawClient.mockResolvedValue([]);

      const result = await tableRepository.bulkOperation(1, bulkOp);

      expect(result).toHaveLength(0); // DELETE returns empty array
    });
  });

  describe('Query Operations', () => {
    beforeEach(() => {
      mockDbClient.returning.mockResolvedValue([mockTable]);
    });

    it('should count rows', async () => {
      mockRawClient.unsafe.mockResolvedValue([{ count: '15' }]);

      const count = await tableRepository.countRows(1);

      expect(count).toBe(15);
      expect(mockRawClient.unsafe).toHaveBeenCalled();
    });

    it('should count rows with filters', async () => {
      mockRawClient.unsafe.mockResolvedValue([{ count: '5' }]);

      const options = {
        filters: [
          { field: 'field_1', operator: 'eq' as const, value: 'Test Value' }
        ]
      };

      const count = await tableRepository.countRows(1, options);

      expect(count).toBe(5);
    });

    it('should search rows', async () => {
      const searchResults = [
        { ...mockRow, field_1: 'Search Result 1' },
        { ...mockRow, field_1: 'Search Result 2' },
      ];
      mockRawClient.unsafe.mockResolvedValue(searchResults);

      const result = await tableRepository.searchRows(1, 'Search');

      expect(result).toHaveLength(2);
      expect(result[0].field_1).toBe('Search Result 1');
    });

    it('should get distinct values', async () => {
      mockRawClient.mockResolvedValue([
        { value: 'Value A' },
        { value: 'Value B' },
        { value: 'Value C' },
      ]);

      const result = await tableRepository.getDistinctValues(1, 'field_1');

      expect(result).toEqual(['Value A', 'Value B', 'Value C']);
    });
  });

  describe('Table Management', () => {
    it('should get table statistics', async () => {
      mockDbClient.returning.mockResolvedValue([mockTable]);
      mockRawClient.mockResolvedValue([{ count: '25' }]);
      mockDbClient.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ count: 5 }])
      });

      const stats = await tableRepository.getTableStats(1);

      expect(stats.table).toEqual(mockTable);
      expect(stats.rowCount).toBe(25);
      expect(stats.fieldCount).toBe(5);
      expect(stats.lastUpdated).toBeInstanceOf(Date);
    });

    it('should validate table operation - CREATE_TABLE', async () => {
      const operation = {
        type: 'CREATE_TABLE' as const,
        tableName: 'valid_table',
        parameters: {},
      };

      const result = await tableRepository.validateTableOperation(operation);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate table operation - invalid', async () => {
      const operation = {
        type: 'CREATE_TABLE' as const,
        tableName: '', // Invalid: empty name
        parameters: {},
      };

      const result = await tableRepository.validateTableOperation(operation);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Table name is required for CREATE_TABLE operation');
    });

    it('should execute table operation - CREATE_TABLE', async () => {
      const operation = {
        type: 'CREATE_TABLE' as const,
        tableName: 'new_operation_table',
        parameters: {},
      };

      mockRawClient.mockResolvedValue([]);

      await tableRepository.executeTableOperation(operation);

      expect(mockRawClient).toHaveBeenCalled(); // Physical table creation
    });

    it('should determine if table can be deleted - empty table', async () => {
      mockDbClient.returning.mockResolvedValue([mockTable]);
      mockRawClient.unsafe.mockResolvedValue([{ count: '0' }]); // No rows

      const canDelete = await tableRepository.canDeleteTable(1);

      expect(canDelete).toBe(true);
    });

    it('should determine if table can be deleted - table with data', async () => {
      mockDbClient.returning.mockResolvedValue([mockTable]);
      mockRawClient.unsafe.mockResolvedValue([{ count: '10' }]); // Has rows

      const canDelete = await tableRepository.canDeleteTable(1);

      expect(canDelete).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle table creation failure', async () => {
      mockDbClient.returning.mockResolvedValue([mockTable]);
      mockRawClient.mockRejectedValue(new Error('Physical table creation failed'));

      const tableData: CreateDynamicTableData = {
        databaseId: 10,
        organizationId: 100,
        name: 'Failed Table',
        dbName: 'failed_table',
        createdBy: 'user-123',
      };

      await expect(tableRepository.create(tableData))
        .rejects.toThrow('Failed to create physical table');

      // Verify rollback was called
      expect(mockDbClient.delete).toHaveBeenCalled();
    });

    it('should handle operations on non-existent table', async () => {
      mockDbClient.returning.mockResolvedValue([]); // Table not found

      await expect(tableRepository.insertRow(999, { field_1: 'Test' }))
        .rejects.toThrow('Table with id 999 not found');

      await expect(tableRepository.findRows(999))
        .rejects.toThrow('Table with id 999 not found');

      await expect(tableRepository.countRows(999))
        .rejects.toThrow('Table with id 999 not found');
    });

    it('should handle empty bulk operations gracefully', async () => {
      mockDbClient.returning.mockResolvedValue([mockTable]);

      const emptyInsert = await tableRepository.bulkInsertRows(1, []);
      expect(emptyInsert).toEqual([]);

      const emptyUpdate = await tableRepository.bulkUpdateRows(1, []);
      expect(emptyUpdate).toEqual([]);

      await expect(tableRepository.bulkDeleteRows(1, [])).resolves.toBeUndefined();
    });
  });
});