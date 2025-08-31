import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ArrowDataStorageService } from '@/ddd/infrastructure/arrow/arrow-data-storage-service';
import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { TableField, type FieldType } from '@/ddd/domain/tables/value-objects/table-field';
import type { TestCase } from '../../shared/types';

// AIDEV-NOTE: ArrowDataStorageService integration tests focusing on lowest-level
// Arrow IPC storage and retrieval functionality. Tests proper type mapping,
// serialization, and round-trip data accuracy.

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
        
        // Store data using Arrow service (new interface with table.fields)
        const storeResult = await arrowService.storeData(data, table);
        expect(storeResult.success).toBe(true);
        expect(storeResult.data).toBeDefined();
        expect(Buffer.isBuffer(storeResult.data)).toBe(true);
        
        if (testCase.expected.bufferSize) {
          expect((storeResult.data as Buffer).length).toBeGreaterThan(0);
        }
        
        // Retrieve data using Arrow service (new interface with table.fields)
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table);
        expect(retrieveResult.success).toBe(true);
        expect(retrieveResult.data).toBeDefined();
        
        if (testCase.expected.retrievedDataMatches) {
          expect(retrieveResult.data).toEqual(data);
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
              'Created At': '2024-01-15T10:30:00.000Z', 
              'Updated At': '2024-01-16T15:45:30.000Z' 
            },
            { 
              'Created At': '2023-12-25T00:00:00.000Z', 
              'Updated At': '2023-12-25T23:59:59.999Z' 
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
            { 'Start Date': '2024-01-01T00:00:00.000Z', 'End Date': null }
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
        
        // Store data
        const storeResult = await arrowService.storeData(data, table);
        expect(storeResult.success).toBe(true);
        
        // Retrieve data
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table);
        expect(retrieveResult.success).toBe(true);
        
        // Verify date conversion pipeline works correctly
        if (testCase.expected.retrievedDataMatches) {
          expect(retrieveResult.data).toEqual(data);
        }
      });
    });
  });

  describe('JSON Serialization', () => {
    const jsonSerializationTests: TestCase<ArrowStorageTestInput, ArrowStorageTestOutput>[] = [
      {
        name: 'should serialize relation fields to JSON strings',
        input: {
          data: [
            { 
              'Related User': [
                { id: '123', displayValue: 'John', tableId: 2 }
              ],
              'Tags': [
                { id: 'tag-1', displayValue: 'urgent' },
                { id: 'tag-2', displayValue: 'customer' },
                { id: 'tag-3', displayValue: 'vip' }
              ]
            },
            { 
              'Related User': [
                { id: '456', displayValue: 'Jane', tableId: 2 }
              ],
              'Tags': [
                { id: 'tag-4', displayValue: 'low-priority' }
              ]
            }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Related User', type: 'relation', required: false },
            { name: 'Tags', type: 'relation', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should serialize file fields to JSON strings',
        input: {
          data: [
            { 
              'Avatar': [
                {
                  id: 'file-uuid-1',
                  name: 'avatar.jpg',
                  size: 1024,
                  mimeType: 'image/jpeg',
                  s3Key: 'org_1/files/avatar.jpg',
                  uploadedAt: '2024-01-15T10:30:00.000Z',
                  metadata: { width: 200, height: 200 }
                }
              ]
            },
            { 
              'Avatar': [
                {
                  id: 'file-uuid-2',
                  name: 'profile.png',
                  size: 2048,
                  mimeType: 'image/png',
                  s3Key: 'org_1/files/profile.png',
                  uploadedAt: '2024-01-16T11:00:00.000Z'
                }
              ]
            }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Avatar', type: 'file', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should handle multiple files and relations in single field',
        input: {
          data: [
            { 
              'Attachments': [
                {
                  id: 'file-uuid-3',
                  name: 'document.pdf',
                  size: 5120,
                  mimeType: 'application/pdf',
                  s3Key: 'org_1/files/document.pdf',
                  uploadedAt: '2024-01-17T09:15:00.000Z'
                },
                {
                  id: 'file-uuid-4',
                  name: 'spreadsheet.xlsx',
                  size: 3072,
                  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  s3Key: 'org_1/files/spreadsheet.xlsx',
                  uploadedAt: '2024-01-17T09:20:00.000Z'
                }
              ],
              'Assigned Users': [
                { id: '789', displayValue: 'Alice Johnson', tableId: 2 },
                { id: '101', displayValue: 'Bob Smith', tableId: 2 }
              ]
            }
          ],
          table: createMockTableWithFields('Test Table', [
            { name: 'Attachments', type: 'file', required: false },
            { name: 'Assigned Users', type: 'relation', required: false }
          ])
        },
        expected: { success: true, retrievedDataMatches: true }
      }
    ];

    jsonSerializationTests.forEach((testCase) => {
      test(testCase.name, async () => {
        const { data, table } = testCase.input;
        
        // Store data
        const storeResult = await arrowService.storeData(data, table);
        expect(storeResult.success).toBe(true);
        
        // Retrieve data
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table);
        expect(retrieveResult.success).toBe(true);
        
        // Verify JSON serialization works correctly
        if (testCase.expected.retrievedDataMatches) {
          expect(retrieveResult.data).toEqual(data);
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
      
      const result = await arrowService.storeData(testData, testTable);
      
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
      
      // Store data first
      const storeResult = await arrowService.storeData(testData, testTable);
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
        
        // Store data
        const storeResult = await arrowService.storeData(data, table);
        expect(storeResult.success).toBe(true);
        
        // Retrieve data
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table);
        expect(retrieveResult.success).toBe(true);
        
        if (testCase.expected.retrievedDataMatches) {
          expect(retrieveResult.data).toEqual(data);
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
        'Date Field': '2024-01-15T10:30:00.000Z',
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
        { name: 'Number Field', type: 'number', required: false },
        { name: 'Boolean Field', type: 'boolean', required: false },
        { name: 'Date Field', type: 'date', required: false },
        { name: 'Relation Field', type: 'relation', required: false },
        { name: 'File Field', type: 'file', required: false }
      ]);

      // Store all types
      const storeResult = await arrowService.storeData(allTypesData, allTypesTable);
      expect(storeResult.success).toBe(true);

      // Retrieve all types
      const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, allTypesTable);
      expect(retrieveResult.success).toBe(true);
      expect(retrieveResult.data).toEqual(allTypesData);
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
  const table = createMockTable(Math.floor(Math.random() * 1000), name);
  
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