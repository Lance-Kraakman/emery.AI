// AIDEV-NOTE: Mock-based unit tests for DrizzleDynamicTableRepository
// Tests business logic without requiring actual database connections

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { DrizzleDynamicTableRepository } from '@/lib/infrastructure/db/repositories/drizzle-dynamic-table-repository';
import type { 
  DynamicTable, 
  CreateDynamicTableData, 
  DynamicTableRow,
  CreateRowData,
  UpdateRowData 
} from '@/lib/domain/entities/dynamic-table';

// Mock types for better TypeScript support
type MockDbClient = {
  insert: MockedFunction<any>;
  select: MockedFunction<any>;
  delete: MockedFunction<any>;
};

type MockRawClient = MockedFunction<any> & {
  unsafe: MockedFunction<any>;
};

describe('DrizzleDynamicTableRepository', () => {
  let repository: DrizzleDynamicTableRepository;
  let mockDb: MockDbClient;
  let mockRawClient: MockRawClient;

  // Test data
  const mockTable: DynamicTable = {
    id: 1,
    databaseId: 10,
    organizationId: 100,
    name: 'Test Table',
    dbName: 'test_table_123',
    metadata: { description: 'Test table' },
    createdBy: 'user-123',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockDbRecord = {
    id: 1,
    databaseId: 10,
    organizationId: 100,
    name: 'Test Table',
    dbName: 'test_table_123',
    metadata: { description: 'Test table' },
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
  };

  beforeEach(() => {
    // Create comprehensive mocks
    mockDb = {
      insert: vi.fn(),
      select: vi.fn(),
      delete: vi.fn(),
    };

    mockRawClient = vi.fn() as MockRawClient;
    mockRawClient.unsafe = vi.fn();

    // Set up fluent API chains for Drizzle operations
    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockDbRecord]),
    };

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockDbRecord]),
      orderBy: vi.fn().mockResolvedValue([mockDbRecord]),
    };

    const mockDeleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };

    mockDb.insert.mockReturnValue(mockInsertChain);
    mockDb.select.mockReturnValue(mockSelectChain);
    mockDb.delete.mockReturnValue(mockDeleteChain);

    repository = new DrizzleDynamicTableRepository(mockDb as any, mockRawClient as any);
  });

  describe('Table CRUD Operations', () => {
    describe('findById', () => {
      it('should return table when found', async () => {
        const result = await repository.findById(1);

        expect(result).toEqual(mockTable);
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return null when table not found', async () => {
        // Mock empty result
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]), // Empty array
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        const result = await repository.findById(999);

        expect(result).toBeNull();
      });
    });

    describe('findByOrganization', () => {
      it('should return tables for organization', async () => {
        const result = await repository.findByOrganization(100);

        expect(result).toEqual([mockTable]);
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return empty array when no tables found', async () => {
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        const result = await repository.findByOrganization(999);

        expect(result).toEqual([]);
      });
    });

    describe('create', () => {
      const createData: CreateDynamicTableData = {
        databaseId: 10,
        organizationId: 100,
        name: 'Test Table',
        dbName: 'test_table_123',
        createdBy: 'user-123',
      };

      it('should create table successfully', async () => {
        // Mock successful physical table creation
        mockRawClient.mockResolvedValue(undefined);

        const result = await repository.create(createData);

        expect(result).toEqual(mockTable);
        expect(mockDb.insert).toHaveBeenCalled();
        // Check that rawClient was called - postgres tagged template calls are complex
        expect(mockRawClient).toHaveBeenCalled();
        const calls = mockRawClient.mock.calls;
        const createTableCall = calls.find(call => 
          call[0] && call[0].some && call[0].some((part: string) => 
            part.includes('CREATE TABLE')
          )
        );
        expect(createTableCall).toBeDefined();
      });

      it('should rollback metadata creation if physical table creation fails', async () => {
        // Mock physical table creation failure
        mockRawClient.mockRejectedValue(new Error('Table creation failed'));

        await expect(repository.create(createData)).rejects.toThrow('Failed to create physical table');
        
        // Verify rollback occurred
        expect(mockDb.delete).toHaveBeenCalled();
      });
    });

    describe('delete', () => {
      it('should delete table successfully', async () => {
        // Mock successful physical table deletion
        mockRawClient.mockResolvedValue(undefined);

        await repository.delete(1);

        // Check that rawClient was called for table deletion
        expect(mockRawClient).toHaveBeenCalled();
        const calls = mockRawClient.mock.calls;
        const dropTableCall = calls.find(call => 
          call[0] && call[0].some && call[0].some((part: string) => 
            part.includes('DROP TABLE IF EXISTS')
          )
        );
        expect(dropTableCall).toBeDefined();
        expect(mockDb.delete).toHaveBeenCalled();
      });

      it('should throw error when table not found', async () => {
        // Mock table not found
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        await expect(repository.delete(999)).rejects.toThrow('Table with id 999 not found');
      });
    });
  });

  describe('Row CRUD Operations', () => {
    beforeEach(() => {
      // Mock findById to return the test table for row operations
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockDbRecord]),
      };
      mockDb.select.mockReturnValue(mockSelectChain);
    });

    describe('insertRow', () => {
      it('should insert row with data', async () => {
        const rowData: CreateRowData = {
          field_1: 'Test Value',
          field_2: 42,
        };

        mockRawClient.unsafe.mockResolvedValue([mockRow]);

        const result = await repository.insertRow(1, rowData);

        expect(result).toEqual(mockRow);
        expect(mockRawClient.unsafe).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO "test_table_123"'),
          expect.arrayContaining(['Test Value', 42])
        );
      });

      it('should insert row with default values when no data provided', async () => {
        mockRawClient.mockResolvedValue([mockRow]);

        const result = await repository.insertRow(1, {});

        expect(result).toEqual(mockRow);
        // Check that rawClient was called for default values insert
        expect(mockRawClient).toHaveBeenCalled();
        const calls = mockRawClient.mock.calls;
        const insertCall = calls.find(call => 
          call[0] && call[0].some && call[0].some((part: string) => 
            part.includes('DEFAULT VALUES')
          )
        );
        expect(insertCall).toBeDefined();
      });

      it('should throw error when table not found', async () => {
        // Mock table not found
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        await expect(repository.insertRow(999, {})).rejects.toThrow('Table with id 999 not found');
      });
    });

    describe('findRows', () => {
      it('should find rows with default options', async () => {
        mockRawClient.unsafe.mockResolvedValue([mockRow]);

        const result = await repository.findRows(1);

        expect(result).toEqual([mockRow]);
        expect(mockRawClient.unsafe).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM "test_table_123"'),
          expect.arrayContaining([100, 0]) // default limit and offset
        );
      });

      it('should find rows with custom options', async () => {
        mockRawClient.unsafe.mockResolvedValue([mockRow]);

        const result = await repository.findRows(1, {
          limit: 50,
          offset: 10,
          orderBy: 'field_1',
          orderDirection: 'ASC',
        });

        expect(result).toEqual([mockRow]);
        expect(mockRawClient.unsafe).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY "field_1" ASC'),
          expect.arrayContaining([50, 10])
        );
      });
    });

    describe('updateRow', () => {
      it('should update row successfully', async () => {
        const updateData: UpdateRowData = {
          field_1: 'Updated Value',
        };

        mockRawClient.unsafe.mockResolvedValue([{ ...mockRow, field_1: 'Updated Value' }]);

        const result = await repository.updateRow(1, 'row-uuid-123', updateData);

        expect(result.field_1).toBe('Updated Value');
        expect(mockRawClient.unsafe).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE "test_table_123"'),
          expect.arrayContaining(['Updated Value', 'row-uuid-123'])
        );
      });

      it('should throw error when no fields to update', async () => {
        await expect(repository.updateRow(1, 'row-uuid-123', {}))
          .rejects.toThrow('No fields to update');
      });

      it('should throw error when row not found', async () => {
        mockRawClient.unsafe.mockResolvedValue([]); // Empty result

        await expect(repository.updateRow(1, 'nonexistent', { field_1: 'test' }))
          .rejects.toThrow('Row with id nonexistent not found');
      });
    });

    describe('deleteRow', () => {
      it('should delete row successfully', async () => {
        mockRawClient.mockResolvedValue(undefined);

        await repository.deleteRow(1, 'row-uuid-123');

        // Check that rawClient was called for row deletion
        expect(mockRawClient).toHaveBeenCalled();
        const calls = mockRawClient.mock.calls;
        const deleteCall = calls.find(call => 
          call[0] && call[0].some && call[0].some((part: string) => 
            part.includes('DELETE FROM')
          )
        );
        expect(deleteCall).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      await expect(repository.findById(1)).rejects.toThrow('Database connection failed');
    });

    it('should handle raw client errors gracefully', async () => {
      // Mock findById to return table
      const mockSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockDbRecord]),
      };
      mockDb.select.mockReturnValue(mockSelectChain);

      mockRawClient.unsafe.mockRejectedValue(new Error('SQL execution failed'));

      await expect(repository.findRows(1)).rejects.toThrow('SQL execution failed');
    });
  });
});