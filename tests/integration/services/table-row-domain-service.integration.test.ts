import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { 
  getDynamicTableRepository, 
  getFieldRepository, 
  getContextAwareDb, 
  initializeDI,
  getDynamicTableService,
  getDatabaseApplicationService
} from '@/ddd/application/di/container';
import { testClient } from '../shared/integration-helpers';
import { OrganizationId, UserId, DatabaseId, TableId, FieldId } from '@/ddd/domain/shared/value-objects';
import { TableRowDomainService } from '@/ddd/domain/tables/services/table-row-domain-service';
import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { Field, type FieldType } from '@/ddd/domain/fields/entities/field';
import { testClient } from '../shared/integration-helpers';
import type { TestCase } from '../../shared/types';
import { createExampleRelationData, createExampleFileData } from '@/ddd/domain/fields/services/jsonb-validation-helpers';

// AIDEV-NOTE: TableRowDomainService integration tests focusing on domain row operations
// Built on top of ArrowDataStorageService with proper Baserow JSONB validation

interface AddRowInput {
  tableSetup: {
    name: string;
    fields: Array<{ name: string; type: FieldType; slug: string; required: boolean }>;
  };
  rowData: Record<string, any>;
}

interface AddRowOutput {
  success: boolean;
  error?: string;
  rowId?: string;
}

interface GetRowInput {
  tableId: number;
  rowId: string;
}

interface GetRowOutput {
  success: boolean;
  error?: string;
  rowExists?: boolean;
}

interface UpdateRowInput {
  tableId: number;
  rowId: string;
  updateData: Record<string, any>;
}

interface UpdateRowOutput {
  success: boolean;
  error?: string;
  updatedFields?: string[];
}

interface DeleteRowInput {
  tableId: number;
  rowId: string;
}

interface DeleteRowOutput {
  success: boolean;
  error?: string;
}

interface GetRowsInput {
  tableId: number;
  filters?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    filters?: Record<string, any>;
  };
}

interface GetRowsOutput {
  success: boolean;
  error?: string;
  hasRows?: boolean;
  rowCount?: number;
}

interface BulkAddRowsInput {
  tableId: number;
  rows: Array<Record<string, any>>;
}

interface BulkAddRowsOutput {
  success: boolean;
  error?: string;
  createdCount?: number;
}

describe('TableRowDomainService Integration Tests', () => {
  let tableRowService: TableRowDomainService;
  let testOrgId: number;
  let testUserId: string;
  let testTable: DynamicTable;
  let testFields: Field[];

  beforeAll(() => {
    // Initialize DI container with test database clients
    initializeDI(testClient.db as any, testClient.db as any);
    
    const tableRepository = getDynamicTableRepository();
    const fieldRepository = getFieldRepository();
    tableRowService = new TableRowDomainService(tableRepository, fieldRepository);
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // Create test organization and context
    const { createTestOrganization } = await import('../shared/test-setup');
    const context = await createTestOrganization('TableRow Test Organization');
    
    testOrgId = context.organizationId;
    testUserId = context.ownerUserId;
    
    // Set RLS context for testing
    const contextDb = getContextAwareDb();
    contextDb.setContext(testUserId, testOrgId);
  });

  afterEach(async () => {
    // Clean test data and clear context
    const contextDb = getContextAwareDb();
    contextDb.clearContext();
    await testClient.cleanTestData();
  });


  describe('Row Creation Tests', () => {
    const addRowTestCases: TestCase<AddRowInput, AddRowOutput>[] = [
      {
        name: 'should create row with all basic field types',
        input: {
          tableSetup: {
            name: 'Customer Data',
            fields: [
              { name: 'Name', type: 'text', slug: 'name', required: true },
              { name: 'Age', type: 'number', slug: 'age', required: false },
              { name: 'Active', type: 'boolean', slug: 'active', required: false },
              { name: 'Email', type: 'email', slug: 'email', required: true },
              { name: 'Website', type: 'url', slug: 'website', required: false },
              { name: 'Birth Date', type: 'date', slug: 'birth_date', required: false }
            ]
          },
          rowData: {
            name: 'John Doe',
            age: 30,
            active: true,
            email: 'john@example.com',
            website: 'https://johndoe.com',
            birth_date: '1994-01-15T00:00:00.000Z'
          }
        },
        expected: { success: true }
      },
      {
        name: 'should create row with Baserow JSONB relation fields',
        input: {
          tableSetup: {
            name: 'Projects',
            fields: [
              { name: 'Title', type: 'text', slug: 'title', required: true },
              { name: 'Assigned Users', type: 'relation', slug: 'assigned_users', required: false }
            ]
          },
          rowData: {
            title: 'New Website Project',
            assigned_users: [
              { id: '123', displayValue: 'John Doe', tableId: 2 },
              { id: '456', displayValue: 'Jane Smith', tableId: 2 }
            ]
          }
        },
        expected: { success: true }
      },
      {
        name: 'should create row with Baserow JSONB file fields',
        input: {
          tableSetup: {
            name: 'Documents',
            fields: [
              { name: 'Name', type: 'text', slug: 'name', required: true },
              { name: 'Attachments', type: 'file', slug: 'attachments', required: false }
            ]
          },
          rowData: {
            name: 'Project Proposal',
            attachments: [
              {
                id: 'file-uuid-1',
                name: 'proposal.pdf',
                size: 2048,
                mimeType: 'application/pdf',
                s3Key: 'org_1/files/proposal.pdf',
                uploadedAt: '2024-01-15T10:30:00.000Z'
              }
            ]
          }
        },
        expected: { success: true }
      },
      {
        name: 'should reject row with missing required fields',
        input: {
          tableSetup: {
            name: 'Customers',
            fields: [
              { name: 'Name', type: 'text', slug: 'name', required: true },
              { name: 'Email', type: 'email', slug: 'email', required: true }
            ]
          },
          rowData: {
            name: 'John Doe'
            // Missing required email field
          }
        },
        expected: { success: false, error: 'Field is required' }
      },
      {
        name: 'should reject row with invalid JSONB structures',
        input: {
          tableSetup: {
            name: 'Projects',
            fields: [
              { name: 'Title', type: 'text', slug: 'title', required: true },
              { name: 'Files', type: 'file', slug: 'files', required: false }
            ]
          },
          rowData: {
            title: 'Test Project',
            files: [
              {
                id: 'file-1',
                name: 'test.pdf'
                // Missing required fields: size, mimeType, s3Key, uploadedAt
              }
            ]
          }
        },
        expected: { success: false, error: 'File object missing required field' }
      }
    ];

    addRowTestCases.forEach((testCase) => {
      test(testCase.name, async () => {
        // Create test table and fields
        const { table, fields } = await createTestTableWithFields(
          testCase.input.tableSetup.name,
          testCase.input.tableSetup.fields
        );

        // Test row creation
        const result = await tableRowService.addRow({
          table,
          data: testCase.input.rowData,
          createdBy: UserId.fromString(testUserId)
        });

        expect(result.success).toBe(testCase.expected.success);
        
        if (testCase.expected.success) {
          expect(result.data).toBeDefined();
          expect(result.data?.id).toBeDefined();
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            expect(result.error).toContain(testCase.expected.error);
          }
        }
      });
    });
  });

  describe('Row Retrieval Tests', () => {
    let createdRowId: string;
    let retrievalTestTable: DynamicTable;
    let retrievalTestFields: Field[];

    beforeEach(async () => {
      // Create a test table for retrieval tests
      const { table, fields } = await createTestTableWithFields('Retrieval Test Table', [
        { name: 'Name', type: 'text', slug: 'name', required: true },
        { name: 'Description', type: 'text', slug: 'description', required: false },
        { name: 'Relations', type: 'relation', slug: 'relations', required: false }
      ]);
      
      retrievalTestTable = table;
      retrievalTestFields = fields;

      // Create a test row
      const createResult = await tableRowService.addRow({
        table,
        data: {
          name: 'Test Row',
          description: 'A row for retrieval testing',
          relations: [
            { id: '123', displayValue: 'Related Item', tableId: 2 }
          ]
        },
        createdBy: UserId.fromString(testUserId)
      });
      
      if (createResult.success && createResult.data) {
        createdRowId = createResult.data.id.value;
      }
    });

    const getRowTestCases: TestCase<GetRowInput, GetRowOutput>[] = [
      {
        name: 'should retrieve existing row with processed data',
        input: { tableId: 0, rowId: '' }, // Will be set dynamically
        expected: { success: true, rowExists: true }
      },
      {
        name: 'should return null for non-existent row',
        input: { tableId: 0, rowId: 'non-existent-id' },
        expected: { success: true, rowExists: false }
      },
      {
        name: 'should handle complex JSONB field retrieval correctly',
        input: { tableId: 0, rowId: '' }, // Will be set dynamically
        expected: { success: true, rowExists: true }
      }
    ];

    getRowTestCases.forEach((testCase) => {
      test(testCase.name, async () => {
        // Set dynamic row ID for existing row tests
        const rowId = testCase.input.rowId === '' ? createdRowId : testCase.input.rowId;
        
        const result = await tableRowService.getRow(retrievalTestTable, rowId);
        
        if (testCase.expected.rowExists) {
          expect(result).not.toBeNull();
          expect(result?.id.value).toBe(rowId);
          expect(result?.data).toBeDefined();
          
          // Verify JSONB fields are properly deserialized
          if (testCase.name.includes('complex JSONB')) {
            expect(result?.data.relations).toBeDefined();
            expect(Array.isArray(result?.data.relations)).toBe(true);
          }
        } else {
          expect(result).toBeNull();
        }
      });
    });
  });

  describe('Row Update Tests', () => {
    let updateTestTable: DynamicTable;
    let updateTestRowId: string;

    beforeEach(async () => {
      // Create test table and row for update tests
      const { table, fields } = await createTestTableWithFields('Update Test Table', [
        { name: 'Name', type: 'text', slug: 'name', required: true },
        { name: 'Email', type: 'email', slug: 'email', required: true },
        { name: 'Age', type: 'number', slug: 'age', required: false },
        { name: 'Files', type: 'file', slug: 'files', required: false }
      ]);
      
      updateTestTable = table;

      // Create initial row
      const createResult = await tableRowService.addRow({
        table,
        data: {
          name: 'Original Name',
          email: 'original@example.com',
          age: 25,
          files: []
        },
        createdBy: UserId.fromString(testUserId)
      });
      
      if (createResult.success && createResult.data) {
        updateTestRowId = createResult.data.id.value;
      }
    });

    const updateRowTestCases: TestCase<UpdateRowInput, UpdateRowOutput>[] = [
      {
        name: 'should update row with valid data',
        input: {
          tableId: 0, // Will be set dynamically
          rowId: '',  // Will be set dynamically
          updateData: { name: 'Updated Name', age: 26 }
        },
        expected: { success: true }
      },
      {
        name: 'should update JSONB fields correctly',
        input: {
          tableId: 0, // Will be set dynamically
          rowId: '',  // Will be set dynamically
          updateData: {
            files: [
              {
                id: 'updated-file-1',
                name: 'updated-document.pdf',
                size: 3072,
                mimeType: 'application/pdf',
                s3Key: 'org_1/files/updated-document.pdf',
                uploadedAt: '2024-01-16T12:00:00.000Z'
              }
            ]
          }
        },
        expected: { success: true }
      },
      {
        name: 'should reject update with validation errors',
        input: {
          tableId: 0, // Will be set dynamically
          rowId: '',  // Will be set dynamically
          updateData: { email: 'invalid-email-format' }
        },
        expected: { success: false, error: 'Must be a valid email address' }
      }
    ];

    updateRowTestCases.forEach((testCase) => {
      test(testCase.name, async () => {
        const result = await tableRowService.updateRow({
          table: updateTestTable,
          rowId: updateTestRowId,
          data: testCase.input.updateData,
          updatedBy: UserId.fromString(testUserId)
        });

        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          expect(result.data).toBeDefined();
          
          // Verify the update actually applied
          const updatedRow = await tableRowService.getRow(updateTestTable, updateTestRowId);
          expect(updatedRow).not.toBeNull();
          
          // Check specific updated fields
          Object.keys(testCase.input.updateData).forEach(key => {
            expect(updatedRow?.data[key]).toEqual(testCase.input.updateData[key]);
          });
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            expect(result.error).toContain(testCase.expected.error);
          }
        }
      });
    });
  });

  describe('Row Deletion & Collection Tests', () => {
    let collectionTestTable: DynamicTable;
    let createdRowIds: string[] = [];

    beforeEach(async () => {
      // Create test table for collection tests
      const { table, fields } = await createTestTableWithFields('Collection Test Table', [
        { name: 'Name', type: 'text', slug: 'name', required: true },
        { name: 'Category', type: 'text', slug: 'category', required: false },
        { name: 'Priority', type: 'number', slug: 'priority', required: false }
      ]);
      
      collectionTestTable = table;

      // Create multiple test rows for collection operations
      const testRows = [
        { name: 'Item A', category: 'Category 1', priority: 1 },
        { name: 'Item B', category: 'Category 2', priority: 2 },
        { name: 'Item C', category: 'Category 1', priority: 3 },
        { name: 'Item D', category: 'Category 3', priority: 1 },
        { name: 'Item E', category: 'Category 2', priority: 2 }
      ];

      for (const rowData of testRows) {
        const createResult = await tableRowService.addRow({
          table,
          data: rowData,
          createdBy: UserId.fromString(testUserId)
        });
        
        if (createResult.success && createResult.data) {
          createdRowIds.push(createResult.data.id.value);
        }
      }
    });

    const deleteRowTestCases: TestCase<DeleteRowInput, DeleteRowOutput>[] = [
      {
        name: 'should delete existing row',
        input: { tableId: 0, rowId: '' }, // Will be set dynamically
        expected: { success: true }
      },
      {
        name: 'should handle deletion of non-existent row',
        input: { tableId: 0, rowId: 'non-existent-id' },
        expected: { success: false, error: 'Row not found' }
      }
    ];

    deleteRowTestCases.forEach((testCase) => {
      test(testCase.name, async () => {
        const rowId = testCase.input.rowId === '' ? createdRowIds[0] : testCase.input.rowId;
        
        const result = await tableRowService.deleteRow(collectionTestTable, rowId);

        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          // Verify row was actually deleted
          const deletedRow = await tableRowService.getRow(collectionTestTable, rowId);
          expect(deletedRow).toBeNull();
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            expect(result.error).toContain(testCase.expected.error);
          }
        }
      });
    });

    const getRowsTestCases: TestCase<GetRowsInput, GetRowsOutput>[] = [
      {
        name: 'should retrieve all rows without filters',
        input: { tableId: 0 },
        expected: { success: true, hasRows: true, rowCount: 5 }
      },
      {
        name: 'should retrieve rows with pagination',
        input: { 
          tableId: 0,
          filters: { limit: 3, offset: 0 }
        },
        expected: { success: true, hasRows: true, rowCount: 3 }
      },
      {
        name: 'should retrieve rows with ordering',
        input: { 
          tableId: 0,
          filters: { orderBy: 'name', orderDirection: 'asc' }
        },
        expected: { success: true, hasRows: true }
      }
    ];

    getRowsTestCases.forEach((testCase) => {
      test(testCase.name, async () => {
        const result = await tableRowService.getRows(collectionTestTable, testCase.input.filters);

        expect(result).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);

        if (testCase.expected.rowCount) {
          expect(result.rows.length).toBe(testCase.expected.rowCount);
        }

        if (testCase.expected.hasRows) {
          expect(result.rows.length).toBeGreaterThan(0);
          
          // Verify each row has proper structure
          result.rows.forEach(row => {
            expect(row.id).toBeDefined();
            expect(row.data).toBeDefined();
            expect(row.data.name).toBeDefined();
          });
        }
      });
    });
  });

  describe('Bulk Operations Tests', () => {
    let bulkTestTable: DynamicTable;

    beforeEach(async () => {
      // Create test table for bulk operations
      const { table, fields } = await createTestTableWithFields('Bulk Operations Table', [
        { name: 'Name', type: 'text', slug: 'name', required: true },
        { name: 'Email', type: 'email', slug: 'email', required: true },
        { name: 'Department', type: 'text', slug: 'department', required: false }
      ]);
      
      bulkTestTable = table;
    });

    const bulkAddRowsTestCases: TestCase<BulkAddRowsInput, BulkAddRowsOutput>[] = [
      {
        name: 'should create multiple rows in single operation',
        input: {
          tableId: 0, // Will be set dynamically
          rows: [
            { name: 'User 1', email: 'user1@example.com', department: 'Engineering' },
            { name: 'User 2', email: 'user2@example.com', department: 'Marketing' },
            { name: 'User 3', email: 'user3@example.com', department: 'Sales' }
          ]
        },
        expected: { success: true, createdCount: 3 }
      },
      {
        name: 'should validate all rows in bulk operation',
        input: {
          tableId: 0, // Will be set dynamically
          rows: [
            { name: 'Valid User', email: 'valid@example.com', department: 'Engineering' },
            { name: 'Invalid User', email: 'invalid-email-format' } // Should fail validation
          ]
        },
        expected: { success: false, error: 'Must be a valid email address' }
      }
    ];

    bulkAddRowsTestCases.forEach((testCase) => {
      test(testCase.name, async () => {
        const result = await tableRowService.bulkAddRows({
          table: bulkTestTable,
          rows: testCase.input.rows,
          createdBy: UserId.fromString(testUserId)
        });

        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          expect(result.data).toBeDefined();
          expect(result.data?.length).toBe(testCase.expected.createdCount);
          
          // Verify all rows were created
          const allRows = await tableRowService.getRows(bulkTestTable);
          expect(allRows.rows.length).toBeGreaterThanOrEqual(testCase.expected.createdCount || 0);
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            expect(result.error).toContain(testCase.expected.error);
          }
        }
      });
    });
  });

  // Test that table has rows functionality
  describe('Table State Tests', () => {
    test('should check if table has rows', async () => {
      const { table } = await createTestTableWithFields('Empty Table', [
        { name: 'Name', type: 'text', slug: 'name', required: true }
      ]);

      // Initially empty
      const hasRowsInitially = await tableRowService.hasRows(table);
      expect(hasRowsInitially).toBe(false);

      // Add a row
      await tableRowService.addRow({
        table,
        data: { name: 'Test Row' },
        createdBy: UserId.fromString(testUserId)
      });

      // Now should have rows
      const hasRowsAfterAdd = await tableRowService.hasRows(table);
      expect(hasRowsAfterAdd).toBe(true);
    });
  });

  // Helper function to create test table with fields
  async function createTestTableWithFields(
    tableName: string, 
    fieldDefs: Array<{ name: string; type: FieldType; slug: string; required: boolean }>
  ): Promise<{ table: DynamicTable; fields: Field[] }> {
    // Create a unique test database for this table
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    const databaseApplicationService = getDatabaseApplicationService();
    const createDbResult = await databaseApplicationService.createDatabase({
      name: `Test Database ${timestamp}-${random}`,
      organizationId: OrganizationId.fromNumber(testOrgId),
      createdBy: UserId.fromString(testUserId)
    });
    
    if (!createDbResult.success || !createDbResult.data) {
      throw new Error(`Failed to create test database: ${createDbResult.error}`);
    }
    
    const testDbId = createDbResult.data.id;
    console.log(`✅ Created database with ID: ${testDbId.value} for organization: ${testOrgId}`);
    
    // Wait to ensure database transaction is committed before creating table
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const dynamicTableService = getDynamicTableService();
    
    // Create table
    const createTableResult = await dynamicTableService.createTable({
      name: tableName,
      databaseId: testDbId, // testDbId is already a DatabaseId object
      organizationId: OrganizationId.fromNumber(testOrgId),
      createdBy: UserId.fromString(testUserId)
    });
    
    if (!createTableResult.success || !createTableResult.data) {
      throw new Error(`Failed to create test table: ${createTableResult.error}`);
    }
    
    const table = createTableResult.data;
    console.log(`✅ Created table with ID: ${table.id.value} in database: ${testDbId.value}`);
    
    // Create fields
    const fieldRepository = getFieldRepository();
    const fields: Field[] = [];
    
    for (let i = 0; i < fieldDefs.length; i++) {
      const fieldDef = fieldDefs[i];
      const field = Field.fromPersistence({
        id: 1000 + i + Math.floor(Math.random() * 1000), // Use unique field IDs
        tableId: table.id.value,
        name: fieldDef.name,
        slug: fieldDef.slug,
        type: fieldDef.type,
        orderIndex: i,
        relatedTableId: fieldDef.type === 'relation' ? 2 : null,
        required: fieldDef.required,
        metadata: undefined,
        createdAt: new Date()
      });
      
      // Save field to repository
      await fieldRepository.save(field);
      fields.push(field);
    }
    
    return { table, fields };
  }
});