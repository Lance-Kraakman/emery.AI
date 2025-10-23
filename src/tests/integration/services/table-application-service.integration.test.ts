import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { 
  getTableApplicationService,
  getDatabaseApplicationService
} from '@/ddd/application/di/container';
import { testClient } from '../shared/integration-helpers';
import { OrganizationId, UserId, DatabaseId, TableId } from '@/ddd/domain/shared/value-objects';
import type { TableApplicationService } from '@/ddd/application/services/tables/table-application-service';
import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import type { TestCase } from '../../shared/types';
import { createTestOrganization, type TestContext, initializeTestDI } from '../shared/test-setup';
import { Row, RowId } from '@/ddd/domain/tables/value-objects/row';
import type { RowQueryOptions } from '@/ddd/infrastructure/db/types/table-persistence';

// AIDEV-NOTE: TableApplicationService integration tests
// Tests the application service layer for proper business logic and orchestration

// Test case factory functions to eliminate placeholder data issues
function createRowTestCases(): TestCase<CreateRowInput, CreateRowOutput>[] {
  return [
    {
      name: 'should insert row with all basic field types',
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
      name: 'should insert row with relation fields',
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
      name: 'should insert row with file fields',
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
      name: 'should throw error for non-existent row',
      input: { tableId: TableId.fromNumber(1), rowId: 'non-existent-id' },
      expected: { success: false, error: 'Row non-existent-id not found' }
    }
  ];
}

function createFindRowsTestCases(): TestCase<FindRowsInput, FindRowsOutput>[] {
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
        options: { limit: 3, offset: 0 }
      },
      expected: { success: true, hasRows: true, rowCount: 3 }
    },
    {
      name: 'should retrieve rows with ordering',
      input: { 
        tableId: TableId.fromNumber(1),
        options: { orderBy: 'Name', orderDirection: 'ASC' }
      },
      expected: { success: true, hasRows: true }
    }
  ];
}

// Type definitions for test inputs/outputs
interface CreateRowInput {
  tableSetup: {
    name: string;
    fields: Array<{ name: string; type: FieldType; required: boolean }>;
  };
  rowData: Record<string, any>;
}

interface CreateRowOutput {
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
}

interface DeleteRowInput {
  tableId: TableId;
  rowId: string;
}

interface DeleteRowOutput {
  success: boolean;
  error?: string;
}

interface FindRowsInput {
  tableId: TableId;
  options?: RowQueryOptions;
}

interface FindRowsOutput {
  success: boolean;
  error?: string;
  hasRows?: boolean;
  rowCount?: number;
}

describe('TableApplicationService Integration Tests', () => {
  let tableAppService: TableApplicationService;
  let testContext: TestContext;

  beforeAll(() => {
    // Initialize DI container with test database clients
    initializeTestDI();
    
    tableAppService = getTableApplicationService();
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // Create test organization and context
    testContext = await createTestOrganization('TableApp Service Test Organization');
    
    // RLS policies work automatically with database defaults - no context setting needed
  });

  afterEach(async () => {
    // Clean test data
    await testClient.cleanTestData();
  });

  describe('createRow', () => {
    test('should run all create row test cases', async () => {
      const testCases = createRowTestCases();
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const { table } = await createTestTableWithFields(
          testCase.input.tableSetup.name,
          testCase.input.tableSetup.fields
        );

        // Test row creation via application service
        let result: any;
        try {
          // Convert plain data to Row entity with validation
          const rowEntity = Row.fromPlainObject(testCase.input.rowData, table.id.value, table.fields);

          // Test application service creation
          const createResult = await tableAppService.createRow({
            tableId: table.id,
            data: rowEntity,
            createdBy: testContext.ownerUserId
          });
          
          result = createResult;
        } catch (error: any) {
          result = {
            success: false,
            error: error.message || 'Failed to create row'
          };
        }

        expect(result.success).toBe(testCase.expected.success);
        
        if (testCase.expected.success) {
          expect(result.data).toBeDefined();
          expect(result.data?.id.value).toBeDefined();
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            expect(result.error).toContain(testCase.expected.error);
          }
        }
      }
    });
  });

  describe('getRow', () => {
    let createdRowId: RowId;
    let retrievalTestTable: DynamicTable;

    beforeEach(async () => {
      // Create a test table for retrieval tests
      const { table } = await createTestTableWithFields('Retrieval Test Table', [
        { name: 'Name', type: 'text', required: true },
        { name: 'Description', type: 'text', required: false },
        { name: 'Relations', type: 'relation', required: false }
      ]);
      
      retrievalTestTable = table;

      // Create a test row
      const testRowData = {
        Name: 'Test Row',
        Description: 'A row for retrieval testing',
        'Relations': [
          { id: '123', value: 'Related Item' }
        ]
      };
      
      const testRowEntity = Row.fromPlainObject(testRowData, table.id.value, table.fields);
      
      const createResult = await tableAppService.createRow({
        tableId: table.id,
        data: testRowEntity,
        createdBy: testContext.ownerUserId
      });
      
      expect(createResult.success).toBe(true);
      createdRowId = createResult.data!.id;
      
      expect(createdRowId).toBeDefined();
      expect(typeof createdRowId.value).toBe('string');
    });

    test('should run all get row test cases', async () => {
      const testCases = createGetRowTestCases(createdRowId.value);
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const result = await tableAppService.getRow(retrievalTestTable.id, RowId.fromString(testCase.input.rowId));
        
        if (testCase.expected.rowExists) {
          expect(result).not.toBeNull();
          expect(result?.id.value).toBe(testCase.input.rowId);
          
          // Verify relation fields are properly deserialized
          const relationField = result?.getFieldValue('Relations')?.value;
          if (relationField) {
            expect(Array.isArray(relationField)).toBe(true);
          }
        } else {
          expect(result).toBeNull();
        }
      }
    });
  });

  describe('updateRow', () => {
    let updateTestTable: DynamicTable;
    let updateTestRowId: RowId;

    beforeEach(async () => {
      // Create test table and row for update tests
      const { table } = await createTestTableWithFields('Update Test Table', [
        { name: 'Name', type: 'text', required: true },
        { name: 'Age', type: 'number', required: false },
        { name: 'Files', type: 'file', required: false }
      ]);
      
      updateTestTable = table;

      // Create initial row
      const initialRowData = {
        'Name': 'Original Name',
        'Age': 25,
        'Files': []
      };
      
      const initialRowEntity = Row.fromPlainObject(initialRowData, table.id.value, table.fields);
      
      const createResult = await tableAppService.createRow({
        tableId: table.id,
        data: initialRowEntity,
        createdBy: testContext.ownerUserId
      });
      
      expect(createResult.success).toBe(true);
      updateTestRowId = createResult.data!.id;
    });

    test('should run all update row test cases', async () => {
      const testCases = createUpdateRowTestCases(updateTestRowId.value);
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        // Test row update
        let result: any;
        try {
          // Get existing row data to merge with update data
          const existingRow = await tableAppService.getRow(updateTestTable.id, RowId.fromString(testCase.input.rowId));
          if (!existingRow) {
            throw new Error(`Row ${testCase.input.rowId} not found for update`);
          }

          // Merge existing data with update data
          const existingData = existingRow.toPlainObject();
          const mergedData = {
            ...existingData,
            ...testCase.input.updateData,
            id: testCase.input.rowId
          };

          // Convert merged data to Row entity
          const updateRowEntity = Row.fromPlainObject(
            mergedData,
            updateTestTable.id.value, 
            updateTestTable.fields
          );
          
          const updateResult = await tableAppService.updateRow({
            tableId: updateTestTable.id,
            rowId: RowId.fromString(testCase.input.rowId),
            data: updateRowEntity,
            updatedBy: testContext.ownerUserId
          });
          
          result = updateResult;
        } catch (error: any) {
          result = {
            success: false,
            error: error.message || 'Failed to update row'
          };
        }
        
        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          expect(result.data).toBeDefined();
          
          // Verify the update actually applied
          const updatedRow = await tableAppService.getRow(updateTestTable.id, RowId.fromString(testCase.input.rowId));
          expect(updatedRow).not.toBeNull();
          
          // Check specific updated fields
          Object.keys(testCase.input.updateData).forEach(key => {
            const fieldValue = updatedRow?.getFieldValue(key)?.value;
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

  describe('deleteRow', () => {
    let deleteTestTable: DynamicTable;
    let createdRowIds: string[] = [];

    beforeEach(async () => {
      // Create test table for deletion tests
      const { table } = await createTestTableWithFields('Delete Test Table', [
        { name: 'Name', type: 'text', required: true },
        { name: 'Category', type: 'text', required: false }
      ]);
      
      deleteTestTable = table;

      // Create test rows for deletion
      const testRows = [
        { Name: 'Item A', Category: 'Category 1' },
        { Name: 'Item B', Category: 'Category 2' }
      ];

      for (const rowData of testRows) {
        const rowEntity = Row.fromPlainObject(rowData, table.id.value, table.fields);
        const createResult = await tableAppService.createRow({
          tableId: table.id,
          data: rowEntity,
          createdBy: testContext.ownerUserId
        });
        expect(createResult.success).toBe(true);
        createdRowIds.push(createResult.data!.id.value);
      }
    });

    test('should run all delete row test cases', async () => {
      const testCases = createDeleteRowTestCases(createdRowIds);
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        let result: any;
        try {
          const deleteResult = await tableAppService.deleteRow(deleteTestTable.id, RowId.fromString(testCase.input.rowId));
          if (!deleteResult.success) throw new Error(deleteResult.error);
          result = { success: true };
        } catch (error: any) {
          result = {
            success: false,
            error: error.message
          };
        }

        expect(result.success).toBe(testCase.expected.success);

        if (testCase.expected.success) {
          // Verify row was actually deleted
          const deletedRow = await tableAppService.getRow(deleteTestTable.id, RowId.fromString(testCase.input.rowId));
          expect(deletedRow).toBeNull();
        } else {
          expect(result.error).toBeDefined();
          if (testCase.expected.error) {
            expect(result.error).toContain(testCase.expected.error);
          }
        }
      }
    });
  });

  describe('findRows', () => {
    let collectionTestTable: DynamicTable;

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
        const rowEntity = Row.fromPlainObject(rowData, table.id.value, table.fields);
        const createResult = await tableAppService.createRow({
          tableId: table.id,
          data: rowEntity,
          createdBy: testContext.ownerUserId
        });
        expect(createResult.success).toBe(true);
      }
    });

    test('should run all find rows test cases', async () => {
      const testCases = createFindRowsTestCases();
      
      for (const testCase of testCases) {
        console.log(`🧪 Running test: ${testCase.name}`);
        
        const result = await tableAppService.getRows(collectionTestTable.id, testCase.input.options);

        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);

        if (testCase.expected.rowCount) {
          expect(result.length).toBe(testCase.expected.rowCount);
        }

        if (testCase.expected.hasRows) {
          expect(result.length).toBeGreaterThan(0);
          
          // Verify each row has proper structure
          result.forEach(row => {
            expect(row.id.value).toBeDefined();
            expect(row).toBeDefined();
            const nameField = row.getFieldValue('Name')?.value;
            expect(nameField).toBeDefined();
          });
        }
      }
    });
  });

  describe('hasRows', () => {
    test('should check if table has rows', async () => {
      const { table } = await createTestTableWithFields('Empty Table', [
        { name: 'Name', type: 'text', required: true }
      ]);

      // Initially empty
      const hasRowsInitially = await tableAppService.tableHasRows(table.id);
      expect(hasRowsInitially).toBe(false);

      // Add a row
      const testRowEntity = Row.fromPlainObject({ 'Name': 'Test Row' }, table.id.value, table.fields);
      const createResult = await tableAppService.createRow({
        tableId: table.id,
        data: testRowEntity,
        createdBy: testContext.ownerUserId
      });
      expect(createResult.success).toBe(true);

      // Now should have rows
      const hasRowsAfterAdd = await tableAppService.tableHasRows(table.id);
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
      organizationId: testContext.organizationId.value,
      createdBy: testContext.ownerUserId.value
    });

    if (!createDbResult.success || !createDbResult.data) {
      throw new Error(`Failed to create test database: ${createDbResult.error}`);
    }

    const testDbId = createDbResult.data.id;

    // Create table using TableApplicationService
    const appService = getTableApplicationService();
    const createTableResult = await appService.createTable({
      name: tableName,
      databaseId: DatabaseId.fromNumber(testDbId),
      organizationId: testContext.organizationId,
      createdBy: testContext.ownerUserId
    });
    
    if (!createTableResult.success || !createTableResult.data) {
      throw new Error(`Failed to create test table: ${createTableResult.error}`);
    }
    
    const table = createTableResult.data;
    
    // Add fields to table using TableApplicationService
    
    for (let i = 0; i < fieldDefs.length; i++) {
      const fieldDef = fieldDefs[i];
      
      const createFieldResult = await appService.createField({
        tableId: table.id,
        name: fieldDef.name,
        type: fieldDef.type,
        required: fieldDef.required,
        relatedTableId: fieldDef.type === 'relation' ? table.id : undefined
      });
      
      if (!createFieldResult.success || !createFieldResult.data) {
        throw new Error(`Failed to add field ${fieldDef.name}: ${createFieldResult.error}`);
      }
    }
    
    // Get the updated table with its fields
    const updatedTable = await appService.getTable(table.id);
    if (!updatedTable) {
      throw new Error('Failed to get updated table with fields');
    }
    
    return { table: updatedTable };
  }
});