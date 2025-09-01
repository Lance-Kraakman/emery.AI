import { describe, test, expect, beforeAll } from 'vitest';
import { ArrowDataStorageService } from '@/ddd/infrastructure/arrow/arrow-data-storage-service';
import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import { Row } from '@/ddd/domain/tables/value-objects/row';
import type { TestCase } from '../../shared/types';

interface ArrowStorageTestInput {
  data: Array<Record<string, any>>;
  table: DynamicTable;
}

interface ArrowStorageTestOutput {
  success: boolean;
  error?: string;
  bufferSize?: number;
  retrievedDataMatches?: boolean;
}

// Helper function to convert test data to Row objects
function createRowsFromData(data: Array<Record<string, any>>, table: DynamicTable): Row[] {
  return data.map(item => 
    Row.fromPlainObject(item, table.id.value, table.fields)
  );
}

// Helper function to extract just the field data from Row objects (excluding row ID)
// Also ensures all table fields are present in the result, even if missing from Row
function extractFieldDataFromRows(rows: Row[], table: DynamicTable, originalData?: Array<Record<string, any>>): Array<Record<string, any>> {
  return rows.map((row, index) => {
    const plainObject = row.toPlainObject();
    // Remove the 'id' field which is added by Row.toPlainObject()
    const { id, ...fieldData } = plainObject;
    
    // Ensure all table fields are present in the result
    const completeFieldData: Record<string, any> = {};
    for (const field of table.fields) {
      if (fieldData.hasOwnProperty(field.name)) {
        completeFieldData[field.name] = fieldData[field.name];
      } else {
        // If original data had explicit null, use null; otherwise use undefined
        const originalValue = originalData?.[index]?.[field.name];
        completeFieldData[field.name] = originalValue === null ? null : undefined;
      }
    }
    
    return completeFieldData;
  });
}

describe('ArrowDataStorageService Integration Tests', () => {
  let arrowService: ArrowDataStorageService;

  beforeAll(() => {
    arrowService = new ArrowDataStorageService();
  });

  // No need for beforeEach/afterEach since tables are created per test with fields
  // This ensures proper field setup for each test case

  describe('Basic Type Mapping', () => {
    const basicTypeTests: TestCase<ArrowStorageTestInput, ArrowStorageTestOutput>[] = [
      {
        name: 'should store and retrieve text fields',
        input: {
          data: [
            { Name: 'John Doe', Email: 'john@example.com', Website: 'https://example.com' },
            { Name: 'Jane Smith', Email: 'jane@example.com', Website: 'https://jane.dev' }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Name', type: 'text', required: false },
            { name: 'Email', type: 'text', required: false },
            { name: 'Website', type: 'text', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should store and retrieve numeric fields',
        input: {
          data: [
            { Age: 30, Score: 95.5, Count: 0 },
            { Age: 25, Score: 87.2, Count: 10 }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Age', type: 'number', required: false },
            { name: 'Score', type: 'number', required: false },
            { name: 'Count', type: 'number', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should store and retrieve boolean fields',
        input: {
          data: [
            { Active: true, Verified: false },
            { Active: false, Verified: true }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Active', type: 'boolean', required: false },
            { name: 'Verified', type: 'boolean', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      }
    ];

    basicTypeTests.forEach((testCase) => {
      test(testCase.name, async () => {
        const { data, table } = testCase.input;
        
        // Convert test data to Row objects
        const rows = createRowsFromData(data, table);
        
        // Store data using Arrow service (now expects Row objects)
        const storeResult = await arrowService.storeData(rows, table);
        expect(storeResult.success).toBe(true);
        expect(storeResult.data).toBeDefined();
        expect(Buffer.isBuffer(storeResult.data)).toBe(true);
        
        if (testCase.expected.bufferSize) {
          expect((storeResult.data as Buffer).length).toBeGreaterThan(0);
        }
        
        // Retrieve data using Arrow service (returns Row objects)
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table);
        expect(retrieveResult.success).toBe(true);
        expect(retrieveResult.data).toBeDefined();
        
        if (testCase.expected.retrievedDataMatches) {
          // Extract field data from retrieved Row objects for comparison
          const retrievedFieldData = extractFieldDataFromRows(retrieveResult.data || [], table, data);
          expect(retrievedFieldData).toEqual(data);
        }
        
        expect(testCase.expected.success).toBe(true);
      });
    });
  });

  describe('Date Conversion Pipeline', () => {
    const dateConversionTests: TestCase<ArrowStorageTestInput, ArrowStorageTestOutput>[] = [
      {
        name: 'should handle ISO date strings from FieldProcessor',
        input: {
          data: [
            { 
              'Created At': new Date('2024-01-15T10:30:00.000Z'), 
              'Updated At': new Date('2024-01-16T15:45:30.000Z') 
            },
            { 
              'Created At': new Date('2023-12-25T00:00:00.000Z'), 
              'Updated At': new Date('2023-12-25T23:59:59.999Z') 
            }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Created At', type: 'date', required: false },
            { name: 'Updated At', type: 'date', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should handle null date values',
        input: {
          data: [
            { 'Start Date': null, 'End Date': null },
            { 'Start Date': new Date('2024-01-01T00:00:00.000Z'), 'End Date': null }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Start Date', type: 'date', required: false },
            { name: 'End Date', type: 'date', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      }
    ];

    dateConversionTests.forEach((testCase) => {
      test(testCase.name, async () => {
        const { data, table } = testCase.input;
        
        // Convert test data to Row objects
        const rows = createRowsFromData(data, table);
        
        // Store data
        const storeResult = await arrowService.storeData(rows, table);
        expect(storeResult.success).toBe(true);
        
        // Retrieve data
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table);
        expect(retrieveResult.success).toBe(true);
        
        // Verify date conversion pipeline works correctly
        if (testCase.expected.retrievedDataMatches) {
          // Extract field data from retrieved Row objects for comparison
          const retrievedFieldData = extractFieldDataFromRows(retrieveResult.data || [], table, data);
          expect(retrievedFieldData).toEqual(data);
        }
      });
    });
  });

  describe('Buffer and Metadata Operations', () => {
    test('should create valid Arrow IPC buffer', async () => {
      const testData = [
        { Id: 1, Name: 'test1', Active: true },
        { Id: 2, Name: 'test2', Active: false }
      ];
      
      const testTable = createMockTableWithFields('Buffer Test Table', [
        { name: 'Id', type: 'number', required: false },
        { name: 'Name', type: 'text', required: false },
        { name: 'Active', type: 'boolean', required: false }
      ]);
      
      // Convert test data to Row objects
      const rows = createRowsFromData(testData, testTable);
      
      const result = await arrowService.storeData(rows, testTable);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect((result.data as Buffer).length).toBeGreaterThan(0);
    });

    test('should read metadata with domain context', async () => {
      const testData = [{ Name: 'test', Count: 5 }];
      
      const testTable = createMockTableWithFields('Metadata Test Table', [
        { name: 'Name', type: 'text', required: false },
        { name: 'Count', type: 'number', required: false }
      ]);
      
      // Convert test data to Row objects
      const rows = createRowsFromData(testData, testTable);
      
      // Store data first
      const storeResult = await arrowService.storeData(rows, testTable);
      expect(storeResult.success).toBe(true);
      
      // Read metadata
      const metadataResult = await arrowService.readMetadata(storeResult.data as Buffer, testTable);
      
      expect(metadataResult.success).toBe(true);
      expect(metadataResult.data).toBeDefined();
      
      const metadata = metadataResult.data!;
      expect(metadata.format).toBe('Apache Arrow IPC');
      expect(metadata.totalRows).toBe(1);
      expect(metadata.totalBytes).toBeGreaterThan(0);
      expect(metadata.tableId).toEqual(testTable.id);
      expect(metadata.databaseId).toEqual(testTable.databaseId);
      expect(metadata.organizationId).toEqual(testTable.organizationId);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    const errorHandlingTests: TestCase<ArrowStorageTestInput, ArrowStorageTestOutput>[] = [
      {
        name: 'should handle empty data arrays',
        input: {
          data: [],
          table: createMockTableWithFields('Test Table', [
            { name: 'Name', type: 'text', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should handle missing field names in data',
        input: {
          data: [
            { Name: 'John' }, // missing 'Age' field
            { Name: 'Jane', Age: 25 } // complete data
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Name', type: 'text', required: false },
            { name: 'Age', type: 'number', required: false }
          ])
        },
        expected: { success: true } // Should fill missing values with null
      },
      {
        name: 'should handle null and undefined values',
        input: {
          data: [
            { Name: null, Age: undefined, Active: false },
            { Name: 'Valid', Age: 30, Active: true }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Name', type: 'text', required: false },
            { name: 'Age', type: 'number', required: false },
            { name: 'Active', type: 'boolean', required: false }
          ])
        },
        expected: { success: true }
      }
    ];

    errorHandlingTests.forEach((testCase) => {
      test(testCase.name, async () => {
        const { data, table } = testCase.input;
        
        // Convert test data to Row objects
        const rows = createRowsFromData(data, table);
        
        // Store data
        const storeResult = await arrowService.storeData(rows, table);
        expect(storeResult.success).toBe(true);
        
        // Retrieve data
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table);
        expect(retrieveResult.success).toBe(true);
        
        if (testCase.expected.retrievedDataMatches) {
          // Extract field data from retrieved Row objects for comparison
          const retrievedFieldData = extractFieldDataFromRows(retrieveResult.data || [], table, data);
          expect(retrievedFieldData).toEqual(data);
        }
      });
    });
  });

  describe('Type Mapping Registry Validation', () => {
    test('should handle all supported field types', async () => {
      const allTypesData = [{
        'Text Field': 'Sample text',
        'Email Field': 'test@example.com',
        'URL Field': 'https://example.com',
        'Number Field': 42,
        'Boolean Field': true,
        'Date Field': new Date('2024-01-15T10:30:00.000Z'),
        'Relation Field': [
          { id: '123', displayValue: 'Related Item', tableId: 2 }
        ],
        'File Field': [
          {
            id: 'comprehensive-file-1',
            name: 'test-file.pdf',
            size: 1024,
            mimeType: 'application/pdf',
            s3Key: 'org_1/files/test-file.pdf',
            uploadedAt: '2024-01-15T10:30:00.000Z'
          }
        ]
      }];

      const allTypesTable = createMockTableWithFields('All Types Table', [
        { name: 'Text Field', type: 'text', required: false },
        { name: 'Email Field', type: 'text', required: false },
        { name: 'URL Field', type: 'text', required: false },
        { name: 'Number Field', type: 'number', required: false },
        { name: 'Boolean Field', type: 'boolean', required: false },
        { name: 'Date Field', type: 'date', required: false },
        { name: 'Relation Field', type: 'relation', required: false },
        { name: 'File Field', type: 'file', required: false }
      ]);

      // Convert test data to Row objects
      const rows = createRowsFromData(allTypesData, allTypesTable);

      // Store all types
      const storeResult = await arrowService.storeData(rows, allTypesTable);
      expect(storeResult.success).toBe(true);

      // Retrieve all types
      const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, allTypesTable);
      expect(retrieveResult.success).toBe(true);
      
      // Extract field data from retrieved Row objects for comparison
      const retrievedFieldData = extractFieldDataFromRows(retrieveResult.data || [], allTypesTable, allTypesData);
      expect(retrievedFieldData).toEqual(allTypesData);
    });
  });
});

// Mock helper functions for consolidated field architecture
function createMockTable(id: number, name: string): DynamicTable {
  return DynamicTable.fromPersistence({
    id,
    name,
    organizationId: 1,
    databaseId: 1,
    storageLocation: `s3://test-bucket/org_1/db_1/table_${id}`,
    fields: [], // Mock table with empty fields for testing
    createdBy: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID format
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z')
  });
}

function createMockTableWithFields(name: string, fieldDefs: Array<{ name: string; type: FieldType; required: boolean }>): DynamicTable {
  const table = createMockTable(Math.floor(Math.random() * 1000) + 1, name); // Ensure positive integer (1-1000)
  
  // Add fields to the table using the consolidated approach
  for (let i = 0; i < fieldDefs.length; i++) {
    const fieldDef = fieldDefs[i];
    // AIDEV-NOTE: Use internal method for test setup only - normal code should use TableApplicationService
    const field = TableField.create({
      name: fieldDef.name,
      type: fieldDef.type,
      orderIndex: i,
      relatedTableId: fieldDef.type === 'relation' ? undefined : undefined, // Could be set for actual relations
      required: fieldDef.required,
      metadata: undefined
    });
    
    table.addField(field);
  }
  
  return table;
}