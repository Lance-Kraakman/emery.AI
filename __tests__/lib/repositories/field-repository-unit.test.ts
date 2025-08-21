// AIDEV-NOTE: Isolated unit tests for Field repository - tests core business logic without complex infrastructure
// Mocks database operations to focus on repository patterns and validation logic

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrizzleFieldRepository } from '@/lib/infrastructure/db/repositories/drizzle-field-repository';
import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  FieldType,
  RelationFieldValue,
  FileFieldValue
} from '@/lib/domain/entities/field';

// Mock database responses
const mockField: Field = {
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

const mockTable = {
  id: 10,
  dbName: 'test_table_123',
  organizationId: 1,
  databaseId: 1,
};

describe('DrizzleFieldRepository - Unit Tests', () => {
  let fieldRepository: DrizzleFieldRepository;
  let mockDbClient: any;
  let mockRawClient: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create a flexible mock that can be configured per test
    const mockQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      then: vi.fn().mockResolvedValue([]),
    };

    // Mock Drizzle DB client
    mockDbClient = {
      select: vi.fn().mockReturnValue(mockQueryBuilder),
      insert: vi.fn().mockReturnValue(mockQueryBuilder),
      update: vi.fn().mockReturnValue(mockQueryBuilder),
      delete: vi.fn().mockReturnValue(mockQueryBuilder),
    };

    // Mock raw postgres client
    mockRawClient = vi.fn().mockResolvedValue([{ count: '5', value_count: '3', unique_count: '2' }]);
    mockRawClient.unsafe = vi.fn().mockResolvedValue([]);

    fieldRepository = new DrizzleFieldRepository(mockDbClient, mockRawClient);
  });

  describe('Field Metadata Operations', () => {
    it('should find field by ID', async () => {
      // Configure the mock query builder for this specific test
      const queryBuilder = mockDbClient.select();
      queryBuilder.limit.mockResolvedValue([mockField]);

      const result = await fieldRepository.findById(1);

      expect(result).toEqual(mockField);
      expect(mockDbClient.select).toHaveBeenCalled();
    });

    it('should return null when field not found', async () => {
      // Configure the mock query builder to return empty array
      const queryBuilder = mockDbClient.select();
      queryBuilder.limit.mockResolvedValue([]);

      const result = await fieldRepository.findById(999);

      expect(result).toBeNull();
    });

    it('should find fields by table ID', async () => {
      const mockFields = [
        { ...mockField, id: 1, name: 'Field 1' },
        { ...mockField, id: 2, name: 'Field 2' },
      ];
      
      // Configure the mock query builder to return multiple fields
      const queryBuilder = mockDbClient.select();
      queryBuilder.orderBy.mockResolvedValue(mockFields);

      const result = await fieldRepository.findByTableId(10);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Field 1');
      expect(result[1].name).toBe('Field 2');
    });

    it('should find field by slug', async () => {
      // Mock the select query to return the field
      mockDbClient.select.mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockField]),
      }));

      const result = await fieldRepository.findBySlug(10, 'test_field');

      expect(result).toEqual(mockField);
    });

    it('should create field with physical column', async () => {
      const createdField = { ...mockField };
      
      // Mock slug uniqueness check (should return true for new slug)
      mockDbClient.select.mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue([]), // Empty result = slug is unique
      }));

      // Mock the insert query
      mockDbClient.insert.mockImplementation(() => ({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([createdField]),
      }));

      // Mock table lookup for physical column creation
      const mockTableLookup = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTable]),
      };

      const fieldData: CreateFieldData = {
        tableId: 10,
        name: 'New Field',
        slug: 'new_field',
        type: 'text',
        required: true,
      };

      const result = await fieldRepository.create(fieldData);

      expect(result).toEqual(createdField);
      expect(mockDbClient.insert).toHaveBeenCalled();
    });

    it('should update field metadata and trigger column modification', async () => {
      const updatedField = { ...mockField, name: 'Updated Field', type: 'number' as FieldType };
      
      // Mock existing field lookup
      mockDbClient.returning.mockResolvedValueOnce([mockField]); // findById call
      mockDbClient.returning.mockResolvedValueOnce([updatedField]); // update call
      mockDbClient.select.mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTable]),
      }));

      const updateData: UpdateFieldData = {
        name: 'Updated Field',
        type: 'number',
      };

      const result = await fieldRepository.update(1, updateData);

      expect(result).toEqual(updatedField);
      expect(mockDbClient.update).toHaveBeenCalled();
      expect(mockDbClient.set).toHaveBeenCalled();
      expect(mockRawClient).toHaveBeenCalled(); // Physical column modification
    });

    it('should delete field and remove physical column', async () => {
      // Mock field lookup and dependency check
      mockDbClient.returning.mockResolvedValue([mockField]);
      mockDbClient.select.mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTable]),
      }));

      await fieldRepository.delete(1);

      expect(mockDbClient.delete).toHaveBeenCalled();
      expect(mockRawClient).toHaveBeenCalled(); // Physical column removal
    });
  });

  describe('Field Type Specific Operations', () => {
    it('should find fields by type', async () => {
      const textFields = [
        { ...mockField, id: 1, type: 'text' },
        { ...mockField, id: 2, type: 'text' },
      ];
      mockDbClient.returning.mockResolvedValue(textFields);

      const result = await fieldRepository.findFieldsByType(10, 'text');

      expect(result).toHaveLength(2);
      expect(result.every(f => f.type === 'text')).toBe(true);
    });

    it('should find required fields', async () => {
      const requiredFields = [
        { ...mockField, id: 1, required: true },
        { ...mockField, id: 2, required: true },
      ];
      mockDbClient.returning.mockResolvedValue(requiredFields);

      const result = await fieldRepository.findRequiredFields(10);

      expect(result).toHaveLength(2);
      expect(result.every(f => f.required)).toBe(true);
    });

    it('should find relation fields', async () => {
      const relationFields = [
        { ...mockField, id: 1, type: 'relation', relatedTableId: 20 },
      ];
      mockDbClient.returning.mockResolvedValue(relationFields);

      const result = await fieldRepository.findRelationFields(10);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('relation');
    });
  });

  describe('Field Validation', () => {
    it('should validate field creation data - valid field', async () => {
      // Mock slug uniqueness check
      mockDbClient.returning.mockResolvedValue([]); // No duplicate slug

      const fieldData: CreateFieldData = {
        tableId: 10,
        name: 'Valid Field',
        slug: 'valid_field',
        type: 'text',
        required: true,
      };

      const result = await fieldRepository.validateField(fieldData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate field creation data - invalid field', async () => {
      const fieldData: CreateFieldData = {
        tableId: 10,
        name: '', // Invalid: empty name
        slug: 'invalid_field',
        type: 'text',
      };

      const result = await fieldRepository.validateField(fieldData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('INVALID_NAME');
    });

    it('should validate relation field requires related table', async () => {
      const fieldData: CreateFieldData = {
        tableId: 10,
        name: 'Relation Field',
        slug: 'relation_field',
        type: 'relation',
        // Missing relatedTableId
      };

      const result = await fieldRepository.validateField(fieldData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.type === 'MISSING_RELATED_TABLE')).toBe(true);
    });

    it('should check slug uniqueness', async () => {
      // Mock existing field with same slug
      mockDbClient.returning.mockResolvedValue([mockField]);

      const isUnique = await fieldRepository.checkSlugUniqueness(10, 'test_field');

      expect(isUnique).toBe(false);
    });

    it('should validate relation field values', async () => {
      // Mock field lookup
      mockDbClient.returning.mockResolvedValue([{ ...mockField, type: 'relation' }]);

      const validRelations: RelationFieldValue[] = [
        { id: 'uuid-1', value: 'Related Record 1' },
        { id: 'uuid-2', value: 'Related Record 2' },
      ];

      const result = await fieldRepository.validateFieldData(1, validRelations);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid relation field values', async () => {
      mockDbClient.returning.mockResolvedValue([{ ...mockField, type: 'relation' }]);

      const result = await fieldRepository.validateFieldData(1, 'not-an-array');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('array of relation objects');
    });

    it('should validate file field values', async () => {
      mockDbClient.returning.mockResolvedValue([{ ...mockField, type: 'file' }]);

      const validFiles: FileFieldValue[] = [
        {
          url: 'https://example.com/file.pdf',
          name: 'document.pdf',
          size: 1024,
          mimeType: 'application/pdf',
        },
      ];

      const result = await fieldRepository.validateFieldData(1, validFiles);

      expect(result.valid).toBe(true);
    });

    it('should validate email field format', async () => {
      mockDbClient.returning.mockResolvedValue([{ ...mockField, type: 'email' }]);

      const validResult = await fieldRepository.validateFieldData(1, 'user@example.com');
      expect(validResult.valid).toBe(true);

      const invalidResult = await fieldRepository.validateFieldData(1, 'not-an-email');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('valid email');
    });

    it('should validate URL field format', async () => {
      mockDbClient.returning.mockResolvedValue([{ ...mockField, type: 'url' }]);

      const validResult = await fieldRepository.validateFieldData(1, 'https://example.com');
      expect(validResult.valid).toBe(true);

      const invalidResult = await fieldRepository.validateFieldData(1, 'not-a-url');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('valid URL');
    });

    it('should validate required fields', async () => {
      mockDbClient.returning.mockResolvedValue([{ ...mockField, required: true }]);

      const validResult = await fieldRepository.validateFieldData(1, 'some value');
      expect(validResult.valid).toBe(true);

      const invalidResult = await fieldRepository.validateFieldData(1, '');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('required');
    });
  });

  describe('Field Statistics', () => {
    it('should get field statistics', async () => {
      mockDbClient.returning.mockResolvedValue([mockField]); // Field lookup
      mockDbClient.select.mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTable]),
      }));

      const result = await fieldRepository.getFieldStats(1);

      expect(result.field.id).toBe(1);
      expect(result.valueCount).toBe(3);
      expect(result.uniqueCount).toBe(2);
      expect(result.lastUpdated).toBeInstanceOf(Date);
      expect(mockRawClient).toHaveBeenCalled();
    });
  });

  describe('Bulk Operations', () => {
    it('should create multiple fields', async () => {
      const fieldsData: CreateFieldData[] = [
        { tableId: 10, name: 'Field 1', slug: 'field_1', type: 'text' },
        { tableId: 10, name: 'Field 2', slug: 'field_2', type: 'number' },
      ];

      const createdFields = [
        { ...mockField, id: 1, name: 'Field 1' },
        { ...mockField, id: 2, name: 'Field 2' },
      ];

      // Mock each create call
      mockDbClient.returning
        .mockResolvedValueOnce([createdFields[0]])
        .mockResolvedValueOnce([createdFields[1]]);
      mockDbClient.select.mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTable]),
      }));

      const result = await fieldRepository.createMultipleFields(fieldsData);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Field 1');
      expect(result[1].name).toBe('Field 2');
    });

    it('should reorder fields', async () => {
      const reorderData = [
        { fieldId: 1, orderIndex: 3 },
        { fieldId: 2, orderIndex: 1 },
      ];

      const updatedFields = [
        { ...mockField, id: 1, orderIndex: 3 },
        { ...mockField, id: 2, orderIndex: 1 },
      ];

      mockDbClient.returning
        .mockResolvedValueOnce([updatedFields[0]])
        .mockResolvedValueOnce([updatedFields[1]]);

      const result = await fieldRepository.reorderFields(10, reorderData);

      expect(result).toHaveLength(2);
      expect(result[0].orderIndex).toBe(3);
      expect(result[1].orderIndex).toBe(1);
    });
  });

  describe('Business Logic', () => {
    it('should determine if field can be deleted - empty field', async () => {
      mockDbClient.returning.mockResolvedValue([mockField]);
      mockDbClient.select.mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTable]),
      }));
      // Mock zero value count
      mockRawClient.mockResolvedValue([{ count: '0', value_count: '0', unique_count: '0' }]);

      const canDelete = await fieldRepository.canDeleteField(1);

      expect(canDelete).toBe(true);
    });

    it('should determine if field can be deleted - required field with data', async () => {
      const requiredField = { ...mockField, required: true };
      mockDbClient.returning.mockResolvedValue([requiredField]);
      mockDbClient.select.mockImplementation(() => ({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockTable]),
      }));
      // Mock non-zero value count
      mockRawClient.mockResolvedValue([{ count: '10', value_count: '8', unique_count: '5' }]);

      const canDelete = await fieldRepository.canDeleteField(1);

      expect(canDelete).toBe(false);
    });
  });
});