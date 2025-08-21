// AIDEV-NOTE: Fixed unit tests for Field repository with proper mocking
// Comprehensive mock setup that handles all repository method complexities

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrizzleFieldRepository } from '@/lib/infrastructure/db/repositories/drizzle-field-repository';
import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  FieldType,
} from '@/lib/domain/entities/field';

// Mock the field processor module
vi.mock('@/lib/db/field-processors', () => ({
  processRowData: vi.fn().mockImplementation((tableId, data) => Promise.resolve(data)),
  processPartialRowData: vi.fn().mockImplementation((tableId, data) => Promise.resolve(data)),
}));

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

describe('DrizzleFieldRepository - Fixed Unit Tests', () => {
  let fieldRepository: DrizzleFieldRepository;
  let mockDbClient: any;
  let mockRawClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a more sophisticated mock that tracks call sequences
    const mockQueryResult = {
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

    // Mock Drizzle DB client that returns the mock query result
    mockDbClient = {
      select: vi.fn().mockReturnValue(mockQueryResult),
      insert: vi.fn().mockReturnValue(mockQueryResult),
      update: vi.fn().mockReturnValue(mockQueryResult),
      delete: vi.fn().mockReturnValue(mockQueryResult),
    };

    // Mock raw postgres client
    mockRawClient = vi.fn().mockResolvedValue([{ count: '0', value_count: '0', unique_count: '0' }]);
    mockRawClient.unsafe = vi.fn().mockResolvedValue([]);

    fieldRepository = new DrizzleFieldRepository(mockDbClient, mockRawClient);
  });

  describe('Basic CRUD Operations', () => {
    it('should find field by ID', async () => {
      // Configure the mock to return the field
      mockDbClient.select().limit.mockResolvedValue([mockField]);

      const result = await fieldRepository.findById(1);

      expect(result).toEqual(mockField);
      expect(mockDbClient.select).toHaveBeenCalled();
    });

    it('should return null when field not found', async () => {
      // Configure the mock to return empty array
      mockDbClient.select().limit.mockResolvedValue([]);

      const result = await fieldRepository.findById(999);

      expect(result).toBeNull();
    });

    it('should find fields by table ID', async () => {
      const mockFields = [
        { ...mockField, id: 1, name: 'Field 1' },
        { ...mockField, id: 2, name: 'Field 2' },
      ];

      mockDbClient.select().orderBy.mockResolvedValue(mockFields);

      const result = await fieldRepository.findByTableId(10);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Field 1');
      expect(result[1].name).toBe('Field 2');
    });

    it('should find field by slug', async () => {
      mockDbClient.select().limit.mockResolvedValue([mockField]);

      const result = await fieldRepository.findBySlug(10, 'test_field');

      expect(result).toEqual(mockField);
    });

    it('should create field with validation', async () => {
      const fieldData: CreateFieldData = {
        tableId: 10,
        name: 'New Field',
        slug: 'new_field',
        type: 'text',
        required: true,
      };

      // Mock slug uniqueness check (empty array = unique)
      mockDbClient.select().then.mockResolvedValue([]);
      
      // Mock the insert operation
      mockDbClient.insert().returning.mockResolvedValue([{ ...mockField, ...fieldData }]);

      // Mock table lookup for physical column creation
      mockDbClient.select().limit.mockResolvedValue([mockTable]);

      const result = await fieldRepository.create(fieldData);

      expect(result.name).toBe('New Field');
      expect(result.type).toBe('text');
      expect(mockDbClient.insert).toHaveBeenCalled();
    });
  });

  describe('Field Type Operations', () => {
    it('should find fields by type', async () => {
      const textFields = [
        { ...mockField, id: 1, type: 'text' },
        { ...mockField, id: 2, type: 'text' },
      ];

      mockDbClient.select().orderBy.mockResolvedValue(textFields);

      const result = await fieldRepository.findFieldsByType(10, 'text');

      expect(result).toHaveLength(2);
      expect(result.every(f => f.type === 'text')).toBe(true);
    });

    it('should find required fields', async () => {
      const requiredFields = [
        { ...mockField, id: 1, required: true },
        { ...mockField, id: 2, required: true },
      ];

      mockDbClient.select().orderBy.mockResolvedValue(requiredFields);

      const result = await fieldRepository.findRequiredFields(10);

      expect(result).toHaveLength(2);
      expect(result.every(f => f.required)).toBe(true);
    });

    it('should find relation fields', async () => {
      const relationFields = [
        { ...mockField, id: 1, type: 'relation', relatedTableId: 20 },
      ];

      mockDbClient.select().orderBy.mockResolvedValue(relationFields);

      const result = await fieldRepository.findRelationFields(10);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('relation');
    });
  });

  describe('Field Validation', () => {
    it('should validate field creation data', async () => {
      const fieldData: CreateFieldData = {
        tableId: 10,
        name: 'Valid Field',
        slug: 'valid_field',
        type: 'text',
        required: true,
      };

      // Mock slug uniqueness check
      mockDbClient.select().then.mockResolvedValue([]);

      const result = await fieldRepository.validateField(fieldData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should invalidate field with missing name', async () => {
      const fieldData: CreateFieldData = {
        tableId: 10,
        name: '', // Invalid
        slug: 'invalid_field',
        type: 'text',
      };

      const result = await fieldRepository.validateField(fieldData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('INVALID_NAME');
    });

    it('should invalidate relation field without related table', async () => {
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
      mockDbClient.select().then.mockResolvedValue([mockField]);

      const isUnique = await fieldRepository.checkSlugUniqueness(10, 'test_field');

      expect(isUnique).toBe(false);
    });
  });

  describe('Field Data Validation', () => {
    it('should validate Link to Table field values', async () => {
      const relationField = { ...mockField, type: 'relation' as FieldType };
      
      // Mock field lookup
      mockDbClient.select().limit.mockResolvedValue([relationField]);

      const validLinks = [
        { id: '00000000-0000-0000-0000-000000000001', value: 'Related Record 1' },
        { id: '00000000-0000-0000-0000-000000000002', value: 'Related Record 2' },
      ];

      const result = await fieldRepository.validateFieldData(1, validLinks);

      expect(result.valid).toBe(true);
    });

    it('should validate S3-integrated file field values', async () => {
      const fileField = { ...mockField, type: 'file' as FieldType };
      
      mockDbClient.select().limit.mockResolvedValue([fileField]);

      const validFiles = [
        {
          id: 'file-uuid-1',
          name: 'document.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          s3Key: 'files/org-1/table-10/field-1/file-uuid-1/document.pdf',
          uploadedAt: '2025-01-01T00:00:00Z',
        },
      ];

      const result = await fieldRepository.validateFieldData(1, validFiles);

      expect(result.valid).toBe(true);
    });

    it('should validate email field format', async () => {
      const emailField = { ...mockField, type: 'email' as FieldType };
      
      mockDbClient.select().limit.mockResolvedValue([emailField]);

      const validResult = await fieldRepository.validateFieldData(1, 'user@example.com');
      expect(validResult.valid).toBe(true);

      const invalidResult = await fieldRepository.validateFieldData(1, 'not-an-email');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('valid email');
    });

    it('should validate required fields', async () => {
      const requiredField = { ...mockField, required: true };
      
      mockDbClient.select().limit.mockResolvedValue([requiredField]);

      const validResult = await fieldRepository.validateFieldData(1, 'some value');
      expect(validResult.valid).toBe(true);

      const invalidResult = await fieldRepository.validateFieldData(1, '');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('required');
    });
  });

  describe('Field Statistics', () => {
    it('should get field statistics', async () => {
      mockDbClient.select().limit.mockResolvedValue([mockField]);
      mockDbClient.select().limit.mockResolvedValue([mockTable]);

      const result = await fieldRepository.getFieldStats(1);

      expect(result.field.id).toBe(1);
      expect(result.valueCount).toBe(0); // From mock raw client
      expect(result.uniqueCount).toBe(0);
      expect(result.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe('Business Logic Operations', () => {
    it('should determine if field can be deleted', async () => {
      mockDbClient.select().limit.mockResolvedValue([mockField]);
      mockDbClient.select().limit.mockResolvedValue([mockTable]);

      const canDelete = await fieldRepository.canDeleteField(1);

      expect(canDelete).toBe(true); // No data, not required
    });

    it('should prevent deletion of required field with data', async () => {
      const requiredField = { ...mockField, required: true };
      mockDbClient.select().limit.mockResolvedValue([requiredField]);
      mockDbClient.select().limit.mockResolvedValue([mockTable]);
      
      // Mock field stats to show it has data
      mockRawClient.mockResolvedValue([{ count: '10', value_count: '8', unique_count: '5' }]);

      const canDelete = await fieldRepository.canDeleteField(1);

      expect(canDelete).toBe(false);
    });
  });
});