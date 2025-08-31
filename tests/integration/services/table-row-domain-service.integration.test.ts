import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { 
  getDynamicTableRepository, 
  getContextAwareDb, 
  initializeDI,
  getDatabaseApplicationService,
  getDynamicTableService
} from '@/ddd/application/di/container';
import { testClient } from '../shared/integration-helpers';
import { OrganizationId, UserId, DatabaseId, TableId } from '@/ddd/domain/shared/value-objects';
import { TableRowDomainService } from '@/ddd/domain/tables/services/table-row-domain-service';
import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import type { TestCase } from '../../shared/types';
import { createTestOrganization, type TestContext } from '../shared/test-setup';
// AIDEV-NOTE: TableRowDomainService integration tests focusing on domain row operations
// Built on top of ArrowDataStorageService with proper file and relation field validation

// Test case factory functions to eliminate placeholder data issues
function createAddRowTestCases(): TestCase<AddRowInput, AddRowOutput>[] {
  return [
    {
      name: 'should create row with all basic field types',
      input: {
        tableSetup: {
          name: 'Customer Data',
          fields: [
            { name: 'Name', type: 'text', required: true },
            { name: 'Age', type: 'number', required: false },
            { name: 'Active', type: 'boolean', required: false },
            { name: 'Website', type: 'text', required: false },
            { name: 'Birth Date', type: 'date', required: false }
          ]
        },
        rowData: {
          'Name': 'John Doe',
          'Age': 30,
          'Active': true,
          'Website': 'https://johndoe.com',
          'Birth Date': '1994-01-15T00:00:00.000Z'
        }
      },
      expected: { success: true }
    },
    {
      name: 'should create row with relation fields',
      input: {
        tableSetup: {
          name: 'Projects',
          fields: [
            { name: 'Title', type: 'text', required: true },
            { name: 'Assigned Users', type: 'relation', required: false }
          ]
        },
        rowData: {
          'Title': 'New Website Project',
          'Assigned Users': [
            { id: '123', value: 'John Doe' },
            { id: '456', value: 'Jane Smith' }
          ]
        }
      },
      expected: { success: true }
    },
    {
      name: 'should create row with file fields',
      input: {
        tableSetup: {
          name: 'Documents',
          fields: [
            { name: 'Name', type: 'text', required: true },
            { name: 'Attachments', type: 'file', required: false }
          ]
        },
        rowData: {
          'Name': 'Project Proposal',
          'Attachments': [
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
            { name: 'Name', type: 'text', required: true },
            { name: 'Email', type: 'text', required: true }
          ]
        },
        rowData: {
          'Name': 'John Doe'
          // Missing required Email field
        }
      },
      expected: { success: false, error: 'Email is required' }
    },
    {
      name: 'should reject row with invalid file structures',
      input: {
        tableSetup: {
          name: 'Projects',
          fields: [
            { name: 'Title', type: 'text', required: true },
            { name: 'Files', type: 'file', required: false }
          ]
        },
        rowData: {
          'Title': 'Test Project',
          'Files': [
            {
              id: 'file-1',
              name: 'test.pdf'
              // Missing required fields: size, mimeType, s3Key, uploadedAt
            }
          ]
        }
      },
      expected: { success: false, error: 'Files[0] missing required field: size' }
    }
  ];
}

function createGetRowTestCases(createdRowId: string): TestCase<GetRowInput, GetRowOutput>[] {
  return [
    {
      name: 'should retrieve existing row with processed data',
      input: { tableId: TableId.fromNumber(1), rowId: createdRowId },
      expected: { success: true, rowExists: true }
    },
    {
      name: 'should return null for non-existent row',
      input: { tableId: TableId.fromNumber(1), rowId: 'non-existent-id' },
      expected: { success: true, rowExists: false }
    },
    {
      name: 'should handle complex relation field retrieval correctly',
      input: { tableId: TableId.fromNumber(1), rowId: createdRowId },
      expected: { success: true, rowExists: true }
    }
  ];
}

function createUpdateRowTestCases(createdRowId: string): TestCase<UpdateRowInput, UpdateRowOutput>[] {
  return [
    {
      name: 'should update row with valid data',
      input: {
        tableId: TableId.fromNumber(1),
        rowId: createdRowId,
        updateData: { 'Name': 'Updated Name', 'Age': 26 }
      },
      expected: { success: true }
    },
    {
      name: 'should update file fields correctly',
      input: {
        tableId: TableId.fromNumber(1),
        rowId: createdRowId,
        updateData: {
          'Files': [
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
        tableId: TableId.fromNumber(1),
        rowId: createdRowId,
        updateData: { 'Age': 'not-a-number' }
      },
      expected: { success: false, error: 'Age must be a number' }
    }
  ];
}

function createDeleteRowTestCases(createdRowIds: string[]): TestCase<DeleteRowInput, DeleteRowOutput>[] {
  return [
    {
      name: 'should delete existing row',
      input: { tableId: TableId.fromNumber(1), rowId: createdRowIds[0] || 'test-row-1' },
      expected: { success: true }
    },
    {
      name: 'should handle deletion of non-existent row',
      input: { tableId: TableId.fromNumber(1), rowId: 'non-existent-id' },
      expected: { success: false, error: 'Row not found' }
    }
  ];
}

function createGetRowsTestCases(): TestCase<GetRowsInput, GetRowsOutput>[] {
  return [
    {
      name: 'should retrieve all rows without filters',
      input: { tableId: TableId.fromNumber(1) },
      expected: { success: true, hasRows: true, rowCount: 5 }
    },
    {
      name: 'should retrieve rows with pagination',
      input: { 
        tableId: TableId.fromNumber(1),
        filters: { limit: 3, offset: 0 }
      },
      expected: { success: true, hasRows: true, rowCount: 3 }
    },
    {
      name: 'should retrieve rows with ordering',
      input: { 
        tableId: TableId.fromNumber(1),
        filters: { orderBy: 'Name', orderDirection: 'asc' }
      },
      expected: { success: true, hasRows: true }
    }
  ];
}

function createBulkAddRowsTestCases(): TestCase<BulkAddRowsInput, BulkAddRowsOutput>[] {
  return [
    {
      name: 'should create multiple rows in single operation',
      input: {
        tableId: TableId.fromNumber(1),
        rows: [
          { 'Name': 'User 1', 'Department': 'Engineering' },
          { 'Name': 'User 2', 'Department': 'Marketing' },
          { 'Name': 'User 3', 'Department': 'Sales' }
        ]
      },
      expected: { success: true, createdCount: 3 }
    },
    {
      name: 'should validate all rows in bulk operation',
      input: {
        tableId: TableId.fromNumber(1),
        rows: [
          { 'Name': 'Valid User', 'Department': 'Engineering' },
          { 'Name': '', 'Department': 'Sales' } // Missing required field - empty Name
        ]
      },
      expected: { success: false, error: 'Name is required' }
    }
  ];
}

interface AddRowInput {
  tableSetup: {
    name: string;
    fields: Array<{ name: string; type: FieldType; required: boolean }>;
  };
  rowData: Record<string, any>;
}

interface AddRowOutput {
  success: boolean;
  error?: string;
  rowId?: string;
}

interface GetRowInput {
  tableId: TableId;
  rowId: string;
}

interface GetRowOutput {
  success: boolean;
  error?: string;
  rowExists?: boolean;
}

interface UpdateRowInput {
  tableId: TableId;
  rowId: string;
  updateData: Record<string, any>;
}

interface UpdateRowOutput {
  success: boolean;
  error?: string;
  updatedFields?: string[];
}

interface DeleteRowInput {
  tableId: TableId;
  rowId: string;
}

interface DeleteRowOutput {
  success: boolean;
  error?: string;
}

interface GetRowsInput {
  tableId: TableId;
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
  tableId: TableId;
  rows: Array<Record<string, any>>;
}

interface BulkAddRowsOutput {
  success: boolean;
  error?: string;
  createdCount?: number;
}

describe('TableRowDomainService Integration Tests', () => {
  let tableRowService: TableRowDomainService;
  let testContext: TestContext;

  beforeAll(() => {
    // Initialize DI container with test database clients
    initializeDI(testClient.db as any, testClient.db as any);
    
    const tableRepository = getDynamicTableRepository();
    tableRowService = new TableRowDomainService(tableRepository);
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // Create test organization and context
    testContext = await createTestOrganization('TableRow Test Organization');
    
    // Set RLS context for testing
    const contextDb = getContextAwareDb();
    contextDb.setContext(testContext.ownerUserId, testContext.organizationId);
  });

  afterEach(async () => {
    // Clean test data and clear context
    const contextDb = getContextAwareDb();
    contextDb.clearContext();
    await testClient.cleanTestData();
  });


  describe('Row Creation Tests', () => {
    
    test('should run all add row test cases', async () => {
      const testCases = createAddRowTestCases();
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const { table } = await createTestTableWithFields(
          testCase.input.tableSetup.name,
          testCase.input.tableSetup.fields
        );

        // Test row creation
        const result = await tableRowService.addRow({
          table,
          data: testCase.input.rowData,
          createdBy: testContext.ownerUserId
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
      }
    });
  });

  describe('Row Retrieval Tests', () => {
    let createdRowId: string;
    let retrievalTestTable: DynamicTable;
    // retrievalTestFields no longer needed - fields are now part of table entity

    beforeEach(async () => {
      // Create a test table for retrieval tests
      const { table } = await createTestTableWithFields('Retrieval Test Table', [
        { name: 'Name', type: 'text', required: true },
        { name: 'Description', type: 'text', required: false },
        { name: 'Relations', type: 'relation', required: false }
      ]);
      
      retrievalTestTable = table;
      // fields are now part of the table entity

      // Verify table has fields before creating row
      expect(table.fields.length).toBeGreaterThan(0);
      
      // Create a test row
      const createResult = await tableRowService.addRow({
        table,
        data: {
          Name: 'Test Row',
          Description: 'A row for retrieval testing',
          'Relations': [
            { id: '123', value: 'Related Item' }
          ]
        },
        createdBy: testContext.ownerUserId
      });
      
      if (createResult.success && createResult.data) {
        createdRowId = createResult.data.id!;
        // Verify the row was created with an ID
        expect(createdRowId).toBeDefined();
        expect(typeof createdRowId).toBe('string');
      } else {
        throw new Error(`Failed to create test row: ${createResult.error}`);
      }
    });

    test('should run all get row test cases', async () => {
      const testCases = createGetRowTestCases(createdRowId);
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const result = await tableRowService.getRow(retrievalTestTable, testCase.input.rowId);
        
        if (testCase.expected.rowExists) {
          expect(result).not.toBeNull();
          expect(result?.id).toBe(testCase.input.rowId);
          expect(result).toBeDefined();
          
          // Verify relation fields are properly deserialized
          if (testCase.name.includes('complex relation')) {
            const relationField = result?.Relations;
            expect(relationField).toBeDefined();
            expect(Array.isArray(relationField)).toBe(true);
          }
        } else {
          expect(result).toBeNull();
        }
      }
    });
  });

  describe('Row Update Tests', () => {
    let updateTestTable: DynamicTable;
    let updateTestRowId: string;

    beforeEach(async () => {
      // Create test table and row for update tests
      const { table } = await createTestTableWithFields('Update Test Table', [
        { name: 'Name', type: 'text', required: true },
        { name: 'Age', type: 'number', required: false },
        { name: 'Files', type: 'file', required: false }
      ]);
      
      updateTestTable = table;

      // Create initial row
      const createResult = await tableRowService.addRow({
        table,
        data: {
          'Name': 'Original Name',
          'Age': 25,
          'Files': []
        },
        createdBy: testContext.ownerUserId
      });
      
      if (createResult.success && createResult.data) {
        updateTestRowId = createResult.data.id!;
      }
    });

    test('should run all update row test cases', async () => {
      const testCases = createUpdateRowTestCases(updateTestRowId);
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const result = await tableRowService.updateRow({
          table: updateTestTable,
          rowId: testCase.input.rowId,
          data: testCase.input.updateData,
          updatedBy: testContext.ownerUserId
        });

        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          expect(result.data).toBeDefined();
          
          // Verify the update actually applied
          const updatedRow = await tableRowService.getRow(updateTestTable, testCase.input.rowId);
          expect(updatedRow).not.toBeNull();
          
          // Check specific updated fields
          Object.keys(testCase.input.updateData).forEach(key => {
            const fieldValue = updatedRow?.[key];
            expect(fieldValue).toEqual(testCase.input.updateData[key]);
          });
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            expect(result.error).toContain(testCase.expected.error);
          }
        }
      }
    });
  });

  describe('Row Deletion & Collection Tests', () => {
    let collectionTestTable: DynamicTable;
    let createdRowIds: string[] = [];

    beforeEach(async () => {
      // Create test table for collection tests
      const { table } = await createTestTableWithFields('Collection Test Table', [
        { name: 'Name', type: 'text', required: true },
        { name: 'Category', type: 'text', required: false },
        { name: 'Priority', type: 'number', required: false }
      ]);
      
      collectionTestTable = table;

      // Create multiple test rows for collection operations
      const testRows = [
        { Name: 'Item A', Category: 'Category 1', Priority: 1 },
        { Name: 'Item B', Category: 'Category 2', Priority: 2 },
        { Name: 'Item C', Category: 'Category 1', Priority: 3 },
        { Name: 'Item D', Category: 'Category 3', Priority: 1 },
        { Name: 'Item E', Category: 'Category 2', Priority: 2 }
      ];

      for (const rowData of testRows) {
        const createResult = await tableRowService.addRow({
          table,
          data: rowData,
          createdBy: testContext.ownerUserId
        });
        
        if (createResult.success && createResult.data) {
          createdRowIds.push(createResult.data.id!);
        }
      }
    });

    test('should run all delete row test cases', async () => {
      const testCases = createDeleteRowTestCases(createdRowIds);
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const result = await tableRowService.deleteRow(collectionTestTable, testCase.input.rowId);

        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          // Verify row was actually deleted
          const deletedRow = await tableRowService.getRow(collectionTestTable, testCase.input.rowId);
          expect(deletedRow).toBeNull();
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            expect(result.error).toContain(testCase.expected.error);
          }
        }
      }
    });

    test('should run all get rows test cases', async () => {
      const testCases = createGetRowsTestCases();
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const result = await tableRowService.getRows(collectionTestTable, testCase.input.filters);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        if (testCase.expected.rowCount) {
          expect(result.length).toBe(testCase.expected.rowCount);
        }

        if (testCase.expected.hasRows) {
          expect(result.length).toBeGreaterThan(0);
          
          // Verify each row has proper structure
          result.forEach(row => {
            expect(row.id).toBeDefined();
            expect(row).toBeDefined();
            const nameField = row['Name'];
            expect(nameField).toBeDefined();
          });
        }
      }
    });
  });

  describe('Bulk Operations Tests', () => {
    let bulkTestTable: DynamicTable;

    beforeEach(async () => {
      // Create test table for bulk operations
      const { table } = await createTestTableWithFields('Bulk Operations Table', [
        { name: 'Name', type: 'text', required: true },
        { name: 'Department', type: 'text', required: false }
      ]);
      
      bulkTestTable = table;
    });

    test('should run all bulk add rows test cases', async () => {
      const testCases = createBulkAddRowsTestCases();
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const result = await tableRowService.bulkAddRows({
          table: bulkTestTable,
          rows: testCase.input.rows,
          createdBy: testContext.ownerUserId
        });

        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          expect(result.data).toBeDefined();
          expect(result.data?.length).toBe(testCase.expected.createdCount);
          
          // Verify all rows were created
          const allRows = await tableRowService.getRows(bulkTestTable);
          expect(allRows.length).toBeGreaterThanOrEqual(testCase.expected.createdCount || 0);
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            // Check if the error is in the main message or in validationErrors
            const hasExpectedError = result.error?.includes(testCase.expected.error) ||
              (result.validationErrors && result.validationErrors.some((ve: any) => 
                ve.error && ve.error.includes(testCase.expected.error)
              ));
            expect(hasExpectedError).toBe(true);
          }
        }
      }
    });
  });

  // Test that table has rows functionality
  describe('Table State Tests', () => {
    test('should check if table has rows', async () => {
      const { table } = await createTestTableWithFields('Empty Table', [
        { name: 'Name', type: 'text', required: true }
      ]);

      // Initially empty
      const hasRowsInitially = await tableRowService.hasRows(table);
      expect(hasRowsInitially).toBe(false);

      // Add a row
      await tableRowService.addRow({
        table,
        data: { 'Name': 'Test Row' },
        createdBy: testContext.ownerUserId
      });

      // Now should have rows
      const hasRowsAfterAdd = await tableRowService.hasRows(table);
      expect(hasRowsAfterAdd).toBe(true);
    });
  });

  // Helper function to create test table with fields
  async function createTestTableWithFields(
    tableName: string, 
    fieldDefs: Array<{ name: string; type: FieldType; required: boolean }>
  ): Promise<{ table: DynamicTable }> {
    // Create a unique test database for this table
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 5);
    const databaseApplicationService = getDatabaseApplicationService();
    const createDbResult = await databaseApplicationService.createDatabase({
      name: `Test Database ${timestamp}-${random}`,
      organizationId: testContext.organizationId,
      createdBy: testContext.ownerUserId
    });
    
    if (!createDbResult.success || !createDbResult.data) {
      throw new Error(`Failed to create test database: ${createDbResult.error}`);
    }
    
    const testDbId = createDbResult.data.id;
    
    const dynamicTableService = getDynamicTableService();
    
    // Create table
    const createTableResult = await dynamicTableService.createTable({
      name: tableName,
      databaseId: testDbId,
      organizationId: testContext.organizationId,
      createdBy: testContext.ownerUserId
    });
    
    if (!createTableResult.success || !createTableResult.data) {
      throw new Error(`Failed to create test table: ${createTableResult.error}`);
    }
    
    const table = createTableResult.data;
    
    // Add fields to table using table's domain methods
    for (let i = 0; i < fieldDefs.length; i++) {
      const fieldDef = fieldDefs[i];
      
      // AIDEV-NOTE: Create and add field using internal method for test setup
      const field = TableField.create({
        name: fieldDef.name,
        type: fieldDef.type,
        orderIndex: i,
        relatedTableId: fieldDef.type === 'relation' ? TableId.fromNumber(2) : undefined,
        required: fieldDef.required,
        metadata: undefined
      });
      
      table.addField(field);
    }
    
    // Save the table with its fields using the service's saveTable method
    // This properly handles field synchronization to the database
    const saveResult = await dynamicTableService.saveTable(table);
    if (!saveResult.success || !saveResult.data) {
      throw new Error(`Failed to save table with fields: ${saveResult.error}`);
    }
    
    return { table: saveResult.data };
  }
});