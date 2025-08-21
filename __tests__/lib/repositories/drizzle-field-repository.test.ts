// AIDEV-NOTE: Mock-based unit tests for DrizzleFieldRepository
// Tests business logic without requiring actual database connections

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { DrizzleFieldRepository } from '@/lib/infrastructure/db/repositories/drizzle-field-repository';
import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  FieldType
} from '@/lib/domain/entities/field';

// Mock types for better TypeScript support
type MockDbClient = {
  insert: MockedFunction<any>;
  select: MockedFunction<any>;
  update: MockedFunction<any>;
  delete: MockedFunction<any>;
};

type MockRawClient = MockedFunction<any> & {
  unsafe: MockedFunction<any>;
};

describe('DrizzleFieldRepository', () => {
  let repository: DrizzleFieldRepository;
  let mockDb: MockDbClient;
  let mockRawClient: MockRawClient;

  // Test data
  const mockField: Field = {
    id: 1,
    tableId: 10,
    name: 'Test Field',
    slug: 'test_field',
    type: 'text' as FieldType,
    orderIndex: 0,
    relatedTableId: null,
    required: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockDbFieldRecord = {
    id: 1,
    tableId: 10,
    name: 'Test Field',
    slug: 'test_field',
    type: 'text',
    orderIndex: 0,
    relatedTableId: null,
    required: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockTableRecord = {
    id: 10,
    dbName: 'test_table_123',
    organizationId: 100,
  };

  beforeEach(() => {
    // Create comprehensive mocks
    mockDb = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockRawClient = vi.fn() as MockRawClient;
    mockRawClient.unsafe = vi.fn();

    // Set up fluent API chains for Drizzle operations
    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockDbFieldRecord]),
    };

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([mockDbFieldRecord]),
    };

    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([mockDbFieldRecord]),
    };

    const mockDeleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };

    mockDb.insert.mockReturnValue(mockInsertChain);
    mockDb.select.mockReturnValue(mockSelectChain);
    mockDb.update.mockReturnValue(mockUpdateChain);
    mockDb.delete.mockReturnValue(mockDeleteChain);

    repository = new DrizzleFieldRepository(mockDb as any, mockRawClient as any);
  });

  describe('Basic CRUD Operations', () => {
    describe('findById', () => {
      it('should return field when found', async () => {
        const result = await repository.findById(1);

        expect(result).toEqual(mockField);
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return null when field not found', async () => {
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

    describe('findByTableId', () => {
      it('should return fields for table ordered correctly', async () => {
        const result = await repository.findByTableId(10);

        expect(result).toEqual([mockField]);
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return empty array when no fields found', async () => {
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        const result = await repository.findByTableId(999);

        expect(result).toEqual([]);
      });
    });

    describe('create', () => {
      const createData: CreateFieldData = {
        tableId: 10,
        name: 'Test Field',
        slug: 'test_field',
        type: 'text' as FieldType,
        orderIndex: 0,
        required: false,
      };

      beforeEach(() => {
        // Mock table lookup for physical field operations
        const mockTableSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockTableRecord]),
        };
        mockDb.select.mockReturnValue(mockTableSelectChain);
      });

      it('should create field successfully', async () => {
        // Mock successful physical field creation
        mockRawClient.mockResolvedValue(undefined);

        const result = await repository.create(createData);

        expect(result).toEqual(mockField);
        expect(mockDb.insert).toHaveBeenCalled();
        expect(mockRawClient).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('ALTER TABLE'),
            expect.stringContaining('ADD COLUMN'),
          ])
        );
      });

      it('should rollback metadata creation if physical field creation fails', async () => {
        // Mock physical field creation failure
        mockRawClient.mockRejectedValue(new Error('Column creation failed'));

        await expect(repository.create(createData)).rejects.toThrow('Failed to create physical field');
        
        // Verify rollback occurred
        expect(mockDb.delete).toHaveBeenCalled();
      });

      it('should create GIN index for JSONB fields', async () => {
        const relationFieldData: CreateFieldData = {
          ...createData,
          type: 'relation' as FieldType,
        };

        // Mock for relation field creation
        const mockRelationFieldRecord = { ...mockDbFieldRecord, type: 'relation' };
        const mockInsertChain = {
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockRelationFieldRecord]),
        };
        mockDb.insert.mockReturnValue(mockInsertChain);

        mockRawClient.mockResolvedValue(undefined);

        await repository.create(relationFieldData);

        // Should call ALTER TABLE for column and CREATE INDEX for GIN
        expect(mockRawClient).toHaveBeenCalledTimes(2);
        expect(mockRawClient).toHaveBeenNthCalledWith(1,
          expect.arrayContaining([
            expect.stringContaining('ALTER TABLE'),
            expect.stringContaining('ADD COLUMN'),
          ])
        );
        expect(mockRawClient).toHaveBeenNthCalledWith(2,
          expect.arrayContaining([
            expect.stringContaining('CREATE INDEX'),
            expect.stringContaining('USING GIN'),
          ])
        );
      });
    });

    describe('update', () => {
      const updateData: UpdateFieldData = {
        name: 'Updated Field',
        slug: 'updated_field',
      };

      it('should update field successfully', async () => {
        const updatedField = { ...mockField, ...updateData };
        const mockUpdateChain = {
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([{ ...mockDbFieldRecord, ...updateData }]),
        };
        mockDb.update.mockReturnValue(mockUpdateChain);

        const result = await repository.update(1, updateData);

        expect(result.name).toBe('Updated Field');
        expect(result.slug).toBe('updated_field');
        expect(mockDb.update).toHaveBeenCalled();
      });

      it('should throw error when field not found', async () => {
        const mockUpdateChain = {
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([]), // Empty result
        };
        mockDb.update.mockReturnValue(mockUpdateChain);

        await expect(repository.update(999, updateData))
          .rejects.toThrow('Field with id 999 not found or could not be updated');
      });
    });

    describe('delete', () => {
      beforeEach(() => {
        // Mock findById for delete operation
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockDbFieldRecord]),
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        // Mock table lookup for physical field operations
        const mockTableSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([mockTableRecord]),
        };
        // We need to handle multiple select calls
        mockDb.select
          .mockReturnValueOnce(mockSelectChain) // For findById
          .mockReturnValue(mockTableSelectChain); // For table lookup
      });

      it('should delete field successfully', async () => {
        // Mock successful physical field deletion
        mockRawClient.mockResolvedValue(undefined);

        await repository.delete(1);

        expect(mockRawClient).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining('ALTER TABLE'),
            expect.stringContaining('DROP COLUMN'),
          ])
        );
        expect(mockDb.delete).toHaveBeenCalled();
      });

      it('should throw error when field not found', async () => {
        // Mock field not found
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        await expect(repository.delete(999)).rejects.toThrow('Field with id 999 not found');
      });
    });
  });

  describe('Business Logic Operations', () => {
    describe('checkSlugUniqueness', () => {
      it('should return true when slug is unique', async () => {
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]), // No existing fields with slug
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        const result = await repository.checkSlugUniqueness(10, 'unique_slug');

        expect(result).toBe(true);
      });

      it('should return false when slug already exists', async () => {
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([mockDbFieldRecord]), // Existing field with slug
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        const result = await repository.checkSlugUniqueness(10, 'test_field');

        expect(result).toBe(false);
      });

      it('should exclude specified field ID from uniqueness check', async () => {
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([mockDbFieldRecord]), // Same field being updated
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        const result = await repository.checkSlugUniqueness(10, 'test_field', 1);

        expect(result).toBe(true); // Should be unique when excluding the field itself
      });
    });

    describe('canDeleteField', () => {
      it('should return true when field exists and can be deleted', async () => {
        const result = await repository.canDeleteField(1);

        expect(result).toBe(true);
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should return false when field does not exist', async () => {
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue([]),
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        const result = await repository.canDeleteField(999);

        expect(result).toBe(false);
      });

      it('should return false when database error occurs', async () => {
        const mockSelectChain = {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockRejectedValue(new Error('Database error')),
        };
        mockDb.select.mockReturnValue(mockSelectChain);

        const result = await repository.canDeleteField(1);

        expect(result).toBe(false);
      });
    });
  });

  describe('Physical Schema Operations', () => {
    beforeEach(() => {
      // Mock table lookup for all physical operations
      const mockTableSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTableRecord]),
      };
      mockDb.select.mockReturnValue(mockTableSelectChain);
    });

    it('should handle different field types correctly', async () => {
      const testCases = [
        { type: 'text', expectedSqlType: 'TEXT' },
        { type: 'number', expectedSqlType: 'INTEGER' },
        { type: 'boolean', expectedSqlType: 'BOOLEAN' },
        { type: 'date', expectedSqlType: 'DATE' },
        { type: 'relation', expectedSqlType: 'JSONB' },
        { type: 'file', expectedSqlType: 'JSONB' },
      ];

      for (const testCase of testCases) {
        mockRawClient.mockClear();
        
        const fieldData: CreateFieldData = {
          tableId: 10,
          name: `Test ${testCase.type} Field`,
          slug: `test_${testCase.type}_field`,
          type: testCase.type as FieldType,
        };

        const mockFieldRecord = { ...mockDbFieldRecord, type: testCase.type };
        const mockInsertChain = {
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockResolvedValue([mockFieldRecord]),
        };
        mockDb.insert.mockReturnValue(mockInsertChain);

        await repository.create(fieldData);

        expect(mockRawClient).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.stringContaining(testCase.expectedSqlType),
          ])
        );
      }
    });

    it('should handle required fields with NOT NULL constraint', async () => {
      const requiredFieldData: CreateFieldData = {
        tableId: 10,
        name: 'Required Field',
        slug: 'required_field',
        type: 'text' as FieldType,
        required: true,
      };

      const mockRequiredFieldRecord = { ...mockDbFieldRecord, required: true };
      const mockInsertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([mockRequiredFieldRecord]),
      };
      mockDb.insert.mockReturnValue(mockInsertChain);

      await repository.create(requiredFieldData);

      expect(mockRawClient).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining('NOT NULL'),
        ])
      );
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
      const createData: CreateFieldData = {
        tableId: 10,
        name: 'Test Field',
        slug: 'test_field',
        type: 'text' as FieldType,
      };

      // Mock table lookup success but DDL failure
      const mockTableSelectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTableRecord]),
      };
      mockDb.select.mockReturnValue(mockTableSelectChain);

      mockRawClient.mockRejectedValue(new Error('DDL execution failed'));

      await expect(repository.create(createData)).rejects.toThrow('Failed to create physical field');
    });
  });
});