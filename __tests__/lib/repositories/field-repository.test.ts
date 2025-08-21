// AIDEV-NOTE: Comprehensive Field repository tests - covers field management with JSON types
// Tests Baserow-style field operations including relation and file JSON structures
// Uses PGlite in-memory database with real schema for realistic testing

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DrizzleFieldRepository } from '@/lib/infrastructure/db/repositories/drizzle-field-repository';
import { DrizzleDynamicTableRepository } from '@/lib/infrastructure/db/repositories/drizzle-dynamic-table-repository';
import { DrizzleOrganizationRepository } from '@/lib/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleUserRepository } from '@/lib/infrastructure/db/repositories/drizzle-user-repository';
import { databases } from '@/lib/db/schema';
import { createTestDb } from '@/lib/db/test-client';
import type { 
  Field, 
  CreateFieldData, 
  UpdateFieldData,
  FieldType,
  RelationFieldValue,
  FileFieldValue,
  BulkFieldOperation
} from '@/lib/domain/entities/field';
import type { CreateDynamicTableData } from '@/lib/domain/entities/dynamic-table';
import type { CreateOrganizationData } from '@/lib/domain/entities/organization';
import type { CreateUserData } from '@/lib/domain/entities/user';

describe('DrizzleFieldRepository', () => {
  let testDb: Awaited<ReturnType<typeof createTestDb>>;
  let fieldRepository: DrizzleFieldRepository;
  let tableRepository: DrizzleDynamicTableRepository;
  let orgRepository: DrizzleOrganizationRepository;
  let userRepository: DrizzleUserRepository;
  let testOrganizationId: number;
  let testDatabaseId: number;
  let testTableId: number;
  let testUserId: string;
  let relatedTableId: number;

  beforeEach(async () => {
    testDb = await createTestDb();
    
    // Create a simple postgres client adapter for PGlite testing
    const mockRawClient = {
      // Template string handler
      apply: (template: TemplateStringsArray, ...values: any[]) => {
        let query = template[0];
        const params: any[] = [];
        
        for (let i = 0; i < values.length; i++) {
          query += `$${params.length + 1}${template[i + 1] || ''}`;
          params.push(values[i]);
        }
        
        return testDb.client.query(query, params);
      },
      // Regular function call for unsafe queries
      unsafe: (query: string, params?: any[]) => {
        return testDb.client.query(query, params || []);
      },
      // Identity function for identifier escaping (PGlite handles this)
      escapeIdentifier: (name: string) => `"${name}"`
    };
    
    // Create proxy that handles both function calls and template strings
    const rawClient = new Proxy(mockRawClient.apply, {
      apply: (target, thisArg, args) => {
        return mockRawClient.apply(args[0], ...args.slice(1));
      },
      get: (target, prop) => {
        if (prop === 'unsafe') return mockRawClient.unsafe;
        // For identifier functions, return the escaping function
        return mockRawClient.escapeIdentifier;
      }
    });
    
    fieldRepository = new DrizzleFieldRepository(testDb.db, rawClient as any);
    tableRepository = new DrizzleDynamicTableRepository(testDb.db, rawClient as any);
    orgRepository = new DrizzleOrganizationRepository(testDb.db, testDb.client);
    userRepository = new DrizzleUserRepository(testDb.db, testDb.client);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // Setup helpers
  const createTestOrganization = async () => {
    const orgData: CreateOrganizationData = {
      name: 'Field Test Organization',
      mission: 'Testing field repository functionality',
    };
    return await orgRepository.create(orgData);
  };

  const createTestUser = async (): Promise<string> => {
    const userData: CreateUserData = {
      email: `field-user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}@example.com`,
      name: 'Field Test User',
      jobTitle: 'Developer',
    };
    const user = await userRepository.create(userData);
    return user.id;
  };

  const createTestDatabase = async (): Promise<number> => {
    const [database] = await testDb.db
      .insert(databases)
      .values({
        organizationId: testOrganizationId,
        name: 'Field Test Database',
        slug: `field_test_db_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        metadata: { description: 'Database for field testing' },
        createdBy: testUserId,
      })
      .returning();
    return database.id;
  };

  const createTestTable = async (name = 'Field Test Table'): Promise<number> => {
    const tableData: CreateDynamicTableData = {
      databaseId: testDatabaseId,
      organizationId: testOrganizationId,
      name,
      dbName: `field_test_table_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      metadata: { description: 'Table for field testing' },
      createdBy: testUserId,
    };
    const table = await tableRepository.create(tableData);
    return table.id;
  };

  const createTestField = async (
    tableId: number,
    name: string = 'Test Field',
    type: FieldType = 'text',
    options: Partial<CreateFieldData> = {}
  ): Promise<Field> => {
    const fieldData: CreateFieldData = {
      tableId,
      name,
      slug: name.toLowerCase().replace(/\s+/g, '_'),
      type,
      orderIndex: 0,
      ...options,
    };
    return await fieldRepository.create(fieldData);
  };

  describe('Basic Field CRUD Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testUserId = await createTestUser();
      testDatabaseId = await createTestDatabase();
      testTableId = await createTestTable();
    });

    it('should create a text field with physical column', async () => {
      const fieldData: CreateFieldData = {
        tableId: testTableId,
        name: 'Customer Name',
        slug: 'customer_name',
        type: 'text',
        orderIndex: 1,
        required: true,
      };

      const field = await fieldRepository.create(fieldData);

      expect(field.id).toBeDefined();
      expect(field.name).toBe('Customer Name');
      expect(field.slug).toBe('customer_name');
      expect(field.type).toBe('text');
      expect(field.tableId).toBe(testTableId);
      expect(field.orderIndex).toBe(1);
      expect(field.required).toBe(true);
      expect(field.createdAt).toBeDefined();

      // Verify physical column was created
      const table = await tableRepository.findById(testTableId);
      const columnExists = await testDb.client`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = ${table!.dbName} 
        AND column_name = ${'field_' + field.id}
      `;
      expect(columnExists).toHaveLength(1);
      expect(columnExists[0].data_type).toBe('text');
      expect(columnExists[0].is_nullable).toBe('NO'); // Required field
    });

    it('should create a relation field with JSONB column and GIN index', async () => {
      // Create related table first
      relatedTableId = await createTestTable('Related Table');

      const fieldData: CreateFieldData = {
        tableId: testTableId,
        name: 'Related Records',
        slug: 'related_records',
        type: 'relation',
        orderIndex: 2,
        relatedTableId: relatedTableId,
        required: false,
      };

      const field = await fieldRepository.create(fieldData);

      expect(field.type).toBe('relation');
      expect(field.relatedTableId).toBe(relatedTableId);

      // Verify JSONB column was created
      const table = await tableRepository.findById(testTableId);
      const columnExists = await testDb.client`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = ${table!.dbName} 
        AND column_name = ${'field_' + field.id}
      `;
      expect(columnExists).toHaveLength(1);
      expect(columnExists[0].data_type).toBe('jsonb');
      expect(columnExists[0].is_nullable).toBe('YES');

      // Verify GIN index was created
      const indexExists = await testDb.client`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = ${table!.dbName} 
        AND indexname = ${'idx_' + table!.dbName + '_field_' + field.id + '_gin'}
      `;
      expect(indexExists).toHaveLength(1);
    });

    it('should create a file field with JSONB column and GIN index', async () => {
      const fieldData: CreateFieldData = {
        tableId: testTableId,
        name: 'Attachments',
        slug: 'attachments',
        type: 'file',
        orderIndex: 3,
        required: false,
      };

      const field = await fieldRepository.create(fieldData);

      expect(field.type).toBe('file');

      // Verify JSONB column and GIN index
      const table = await tableRepository.findById(testTableId);
      const columnExists = await testDb.client`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = ${table!.dbName} 
        AND column_name = ${'field_' + field.id}
      `;
      expect(columnExists).toHaveLength(1);
      expect(columnExists[0].data_type).toBe('jsonb');

      const indexExists = await testDb.client`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = ${table!.dbName} 
        AND indexname LIKE ${`%field_${field.id}_gin%`}
      `;
      expect(indexExists).toHaveLength(1);
    });

    it('should find field by ID', async () => {
      const createdField = await createTestField(testTableId, 'Find by ID Field', 'number');

      const foundField = await fieldRepository.findById(createdField.id);

      expect(foundField).toBeDefined();
      expect(foundField!.id).toBe(createdField.id);
      expect(foundField!.name).toBe('Find by ID Field');
      expect(foundField!.type).toBe('number');
    });

    it('should return null for non-existent field ID', async () => {
      const foundField = await fieldRepository.findById(99999);

      expect(foundField).toBeNull();
    });

    it('should find fields by table ID', async () => {
      const field1 = await createTestField(testTableId, 'Field 1', 'text');
      const field2 = await createTestField(testTableId, 'Field 2', 'number');
      const field3 = await createTestField(testTableId, 'Field 3', 'boolean');

      const fields = await fieldRepository.findByTableId(testTableId);

      expect(fields).toHaveLength(3);
      const fieldNames = fields.map(f => f.name);
      expect(fieldNames).toContain('Field 1');
      expect(fieldNames).toContain('Field 2');
      expect(fieldNames).toContain('Field 3');
    });

    it('should find field by slug', async () => {
      const createdField = await createTestField(testTableId, 'Unique Field', 'email', {
        slug: 'unique_field_slug',
      });

      const foundField = await fieldRepository.findBySlug(testTableId, 'unique_field_slug');

      expect(foundField).toBeDefined();
      expect(foundField!.id).toBe(createdField.id);
      expect(foundField!.slug).toBe('unique_field_slug');
    });

    it('should update field metadata and physical column', async () => {
      const field = await createTestField(testTableId, 'Update Test Field', 'text', {
        required: false,
      });

      const updateData: UpdateFieldData = {
        name: 'Updated Field Name',
        type: 'number', // Type change should modify physical column
        required: true,
      };

      const updatedField = await fieldRepository.update(field.id, updateData);

      expect(updatedField.name).toBe('Updated Field Name');
      expect(updatedField.type).toBe('number');
      expect(updatedField.required).toBe(true);

      // Verify physical column type was changed
      const table = await tableRepository.findById(testTableId);
      const columnInfo = await testDb.client`
        SELECT data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = ${table!.dbName} 
        AND column_name = ${'field_' + field.id}
      `;
      expect(columnInfo).toHaveLength(1);
      expect(columnInfo[0].data_type).toBe('integer'); // number -> INTEGER
      expect(columnInfo[0].is_nullable).toBe('NO'); // required: true
    });

    it('should delete field and remove physical column', async () => {
      const field = await createTestField(testTableId, 'Delete Test Field', 'text');

      // Verify column exists before deletion
      const table = await tableRepository.findById(testTableId);
      const columnBefore = await testDb.client`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${table!.dbName} 
        AND column_name = ${'field_' + field.id}
      `;
      expect(columnBefore).toHaveLength(1);

      await fieldRepository.delete(field.id);

      // Verify field metadata is deleted
      const foundField = await fieldRepository.findById(field.id);
      expect(foundField).toBeNull();

      // Verify physical column is removed
      const columnAfter = await testDb.client`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = ${table!.dbName} 
        AND column_name = ${'field_' + field.id}
      `;
      expect(columnAfter).toHaveLength(0);
    });
  });

  describe('Field Type Specific Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testUserId = await createTestUser();
      testDatabaseId = await createTestDatabase();
      testTableId = await createTestTable();
      relatedTableId = await createTestTable('Related Table');
    });

    it('should find fields by type', async () => {
      await createTestField(testTableId, 'Text Field 1', 'text');
      await createTestField(testTableId, 'Text Field 2', 'text');
      await createTestField(testTableId, 'Number Field', 'number');
      await createTestField(testTableId, 'Relation Field', 'relation', {
        relatedTableId,
      });

      const textFields = await fieldRepository.findFieldsByType(testTableId, 'text');
      const relationFields = await fieldRepository.findFieldsByType(testTableId, 'relation');

      expect(textFields).toHaveLength(2);
      expect(relationFields).toHaveLength(1);
      expect(relationFields[0].type).toBe('relation');
    });

    it('should find required fields', async () => {
      await createTestField(testTableId, 'Required Field 1', 'text', { required: true });
      await createTestField(testTableId, 'Required Field 2', 'number', { required: true });
      await createTestField(testTableId, 'Optional Field', 'text', { required: false });

      const requiredFields = await fieldRepository.findRequiredFields(testTableId);

      expect(requiredFields).toHaveLength(2);
      expect(requiredFields.every(f => f.required)).toBe(true);
    });

    it('should find relation fields', async () => {
      await createTestField(testTableId, 'Text Field', 'text');
      await createTestField(testTableId, 'Relation Field 1', 'relation', {
        relatedTableId,
      });
      await createTestField(testTableId, 'Relation Field 2', 'relation', {
        relatedTableId,
      });

      const relationFields = await fieldRepository.findRelationFields(testTableId);

      expect(relationFields).toHaveLength(2);
      expect(relationFields.every(f => f.type === 'relation')).toBe(true);
    });

    it('should validate relation field values', async () => {
      const relationField = await createTestField(testTableId, 'Test Relations', 'relation', {
        relatedTableId,
      });

      // Valid relation value (array)
      const validRelations: RelationFieldValue[] = [
        { id: 'uuid-1', value: 'Related Record 1', tableId: relatedTableId },
        { id: 'uuid-2', value: 'Related Record 2', tableId: relatedTableId },
      ];

      const validResult = await fieldRepository.validateFieldData(relationField.id, validRelations);
      expect(validResult.valid).toBe(true);

      // Invalid relation value (not array)
      const invalidResult = await fieldRepository.validateFieldData(relationField.id, 'not-an-array');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('array of relation objects');
    });

    it('should validate file field values', async () => {
      const fileField = await createTestField(testTableId, 'Test Files', 'file');

      // Valid file value (array)
      const validFiles: FileFieldValue[] = [
        {
          url: 'https://example.com/file1.pdf',
          name: 'document.pdf',
          size: 1024,
          mimeType: 'application/pdf',
        },
        {
          url: 'https://example.com/image.jpg',
          name: 'photo.jpg',
          size: 2048,
          mimeType: 'image/jpeg',
          thumbnails: [
            { size: 'small', url: 'https://example.com/image-small.jpg' },
          ],
        },
      ];

      const validResult = await fieldRepository.validateFieldData(fileField.id, validFiles);
      expect(validResult.valid).toBe(true);

      // Invalid file value (not array)
      const invalidResult = await fieldRepository.validateFieldData(fileField.id, 'not-an-array');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('array of file objects');
    });
  });

  describe('Field Validation and Constraints', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testUserId = await createTestUser();
      testDatabaseId = await createTestDatabase();
      testTableId = await createTestTable();
      relatedTableId = await createTestTable('Related Table');
    });

    it('should validate field creation data', async () => {
      // Valid field data
      const validFieldData: CreateFieldData = {
        tableId: testTableId,
        name: 'Valid Field',
        slug: 'valid_field',
        type: 'text',
        required: true,
      };

      const validResult = await fieldRepository.validateField(validFieldData);
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid field data - missing name
      const invalidFieldData: CreateFieldData = {
        tableId: testTableId,
        name: '',
        slug: 'invalid_field',
        type: 'text',
      };

      const invalidResult = await fieldRepository.validateField(invalidFieldData);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0].type).toBe('INVALID_NAME');
    });

    it('should validate relation field has related table', async () => {
      const relationFieldData: CreateFieldData = {
        tableId: testTableId,
        name: 'Relation Without Table',
        slug: 'relation_field',
        type: 'relation',
        // Missing relatedTableId
      };

      const result = await fieldRepository.validateField(relationFieldData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('MISSING_RELATED_TABLE');
    });

    it('should check slug uniqueness within table', async () => {
      // Create first field
      await createTestField(testTableId, 'First Field', 'text', {
        slug: 'duplicate_slug',
      });

      // Try to create second field with same slug
      const duplicateFieldData: CreateFieldData = {
        tableId: testTableId,
        name: 'Second Field',
        slug: 'duplicate_slug', // Duplicate slug
        type: 'text',
      };

      const result = await fieldRepository.validateField(duplicateFieldData);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe('DUPLICATE_SLUG');
    });

    it('should validate required fields', async () => {
      const requiredField = await createTestField(testTableId, 'Required Field', 'text', {
        required: true,
      });

      // Valid non-empty value
      const validResult = await fieldRepository.validateFieldData(requiredField.id, 'Some value');
      expect(validResult.valid).toBe(true);

      // Invalid empty value
      const invalidResult = await fieldRepository.validateFieldData(requiredField.id, '');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('required');
    });

    it('should validate email field format', async () => {
      const emailField = await createTestField(testTableId, 'Email Field', 'email');

      // Valid email
      const validResult = await fieldRepository.validateFieldData(emailField.id, 'user@example.com');
      expect(validResult.valid).toBe(true);

      // Invalid email
      const invalidResult = await fieldRepository.validateFieldData(emailField.id, 'not-an-email');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('valid email');
    });

    it('should validate URL field format', async () => {
      const urlField = await createTestField(testTableId, 'URL Field', 'url');

      // Valid URL
      const validResult = await fieldRepository.validateFieldData(urlField.id, 'https://example.com');
      expect(validResult.valid).toBe(true);

      // Invalid URL
      const invalidResult = await fieldRepository.validateFieldData(urlField.id, 'not-a-url');
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.error).toContain('valid URL');
    });
  });

  describe('Field Statistics and Analysis', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testUserId = await createTestUser();
      testDatabaseId = await createTestDatabase();
      testTableId = await createTestTable();
    });

    it('should get field statistics', async () => {
      const field = await createTestField(testTableId, 'Stats Field', 'text');

      // Insert some test data
      const table = await tableRepository.findById(testTableId);
      await testDb.client`
        INSERT INTO ${testDb.client(table!.dbName)} (${testDb.client('field_' + field.id)})
        VALUES ('value1'), ('value2'), ('value1'), (null)
      `;

      const stats = await fieldRepository.getFieldStats(field.id);

      expect(stats.field.id).toBe(field.id);
      expect(stats.valueCount).toBe(3); // Non-null values
      expect(stats.uniqueCount).toBe(2); // 'value1', 'value2'
      expect(stats.lastUpdated).toBeDefined();
    });
  });

  describe('Bulk Field Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testUserId = await createTestUser();
      testDatabaseId = await createTestDatabase();
      testTableId = await createTestTable();
    });

    it('should create multiple fields', async () => {
      const fieldsData: CreateFieldData[] = [
        {
          tableId: testTableId,
          name: 'Bulk Field 1',
          slug: 'bulk_field_1',
          type: 'text',
        },
        {
          tableId: testTableId,
          name: 'Bulk Field 2',
          slug: 'bulk_field_2',
          type: 'number',
        },
        {
          tableId: testTableId,
          name: 'Bulk Field 3',
          slug: 'bulk_field_3',
          type: 'boolean',
        },
      ];

      const createdFields = await fieldRepository.createMultipleFields(fieldsData);

      expect(createdFields).toHaveLength(3);
      expect(createdFields[0].name).toBe('Bulk Field 1');
      expect(createdFields[1].type).toBe('number');
      expect(createdFields[2].type).toBe('boolean');

      // Verify physical columns were created
      const allFields = await fieldRepository.findByTableId(testTableId);
      expect(allFields).toHaveLength(3);
    });

    it('should execute bulk field operation - ADD_FIELD', async () => {
      const bulkOp: BulkFieldOperation = {
        tableId: testTableId,
        operations: [
          {
            type: 'ADD_FIELD',
            newField: {
              tableId: testTableId,
              name: 'Bulk Added Field',
              slug: 'bulk_added_field',
              type: 'text',
            },
          },
        ],
      };

      const results = await fieldRepository.executeBulkOperation(bulkOp);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bulk Added Field');
    });

    it('should reorder fields', async () => {
      const field1 = await createTestField(testTableId, 'Field 1', 'text', { orderIndex: 1 });
      const field2 = await createTestField(testTableId, 'Field 2', 'text', { orderIndex: 2 });
      const field3 = await createTestField(testTableId, 'Field 3', 'text', { orderIndex: 3 });

      const reorderData = [
        { fieldId: field3.id, orderIndex: 1 }, // Move field 3 to first
        { fieldId: field1.id, orderIndex: 2 }, // Move field 1 to second
        { fieldId: field2.id, orderIndex: 3 }, // Move field 2 to third
      ];

      const reorderedFields = await fieldRepository.reorderFields(testTableId, reorderData);

      expect(reorderedFields).toHaveLength(3);
      
      // Verify new order
      const fieldsInOrder = await fieldRepository.getFieldsByOrder(testTableId);
      expect(fieldsInOrder[0].id).toBe(field3.id); // Field 3 now first
      expect(fieldsInOrder[1].id).toBe(field1.id); // Field 1 now second
      expect(fieldsInOrder[2].id).toBe(field2.id); // Field 2 now third
    });

    it('should swap field positions', async () => {
      const field1 = await createTestField(testTableId, 'Field 1', 'text', { orderIndex: 1 });
      const field2 = await createTestField(testTableId, 'Field 2', 'text', { orderIndex: 2 });

      const swappedFields = await fieldRepository.swapFieldPositions(field1.id, field2.id);

      expect(swappedFields).toHaveLength(2);
      
      // Verify positions were swapped
      const updatedField1 = await fieldRepository.findById(field1.id);
      const updatedField2 = await fieldRepository.findById(field2.id);
      
      expect(updatedField1!.orderIndex).toBe(2); // Was 1, now 2
      expect(updatedField2!.orderIndex).toBe(1); // Was 2, now 1
    });
  });

  describe('Business Logic Operations', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testUserId = await createTestUser();
      testDatabaseId = await createTestDatabase();
      testTableId = await createTestTable();
    });

    it('should determine if field can be deleted', async () => {
      // Field without data should be deletable
      const emptyField = await createTestField(testTableId, 'Empty Field', 'text');
      const canDeleteEmpty = await fieldRepository.canDeleteField(emptyField.id);
      expect(canDeleteEmpty).toBe(true);

      // Required field with data should not be deletable
      const requiredField = await createTestField(testTableId, 'Required Field', 'text', {
        required: true,
      });

      // Add data to the field
      const table = await tableRepository.findById(testTableId);
      await testDb.client`
        INSERT INTO ${testDb.client(table!.dbName)} (${testDb.client('field_' + requiredField.id)})
        VALUES ('some data')
      `;

      const canDeleteRequired = await fieldRepository.canDeleteField(requiredField.id);
      expect(canDeleteRequired).toBe(false);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const org = await createTestOrganization();
      testOrganizationId = org.id;
      testUserId = await createTestUser();
      testDatabaseId = await createTestDatabase();
      testTableId = await createTestTable();
    });

    it('should handle field creation failure gracefully', async () => {
      const fieldData: CreateFieldData = {
        tableId: 99999, // Non-existent table
        name: 'Invalid Field',
        slug: 'invalid_field',
        type: 'text',
      };

      await expect(fieldRepository.create(fieldData))
        .rejects.toThrow();
    });

    it('should throw error when updating non-existent field', async () => {
      const updateData: UpdateFieldData = {
        name: 'New Name',
      };

      await expect(fieldRepository.update(99999, updateData))
        .rejects.toThrow('Field with id 99999 not found');
    });

    it('should handle empty bulk operations', async () => {
      const emptyCreate = await fieldRepository.createMultipleFields([]);
      expect(emptyCreate).toEqual([]);

      const emptyUpdate = await fieldRepository.updateMultipleFields([]);
      expect(emptyUpdate).toEqual([]);

      await expect(fieldRepository.deleteMultipleFields([])).resolves.toBeUndefined();
    });
  });
});