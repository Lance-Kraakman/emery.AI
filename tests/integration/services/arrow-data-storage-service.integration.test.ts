import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { ArrowDataStorageService } from '@/ddd/infrastructure/arrow/arrow-data-storage-service';
import { DynamicTable } from '@/ddd/domain/tables/entities/dynamic-table';
import { Field, type FieldType } from '@/ddd/domain/fields/entities/field';
import type { TestCase } from '../../shared/types';

// AIDEV-NOTE: ArrowDataStorageService integration tests focusing on lowest-level
// Arrow IPC storage and retrieval functionality. Tests proper type mapping,
// serialization, and round-trip data accuracy.

interface ArrowStorageTestInput {
  data: Array<Record<string, any>>;
  table: DynamicTable;
  fields: Field[];
}

interface ArrowStorageTestOutput {
  success: boolean;
  error?: string;
  bufferSize?: number;
  retrievedDataMatches?: boolean;
}

describe('ArrowDataStorageService Integration Tests', () => {
  let arrowService: ArrowDataStorageService;
  let mockTable: DynamicTable;

  beforeAll(() => {
    arrowService = new ArrowDataStorageService();
  });

  beforeEach(() => {
    // Create a consistent mock table for all tests
    mockTable = createMockTable(1, 'Test Table');
  });

  afterEach(() => {
    // Clean up any test data or references
    mockTable = undefined as any;
  });

  describe('Basic Type Mapping', () => {
    const basicTypeTests: TestCase<ArrowStorageTestInput, ArrowStorageTestOutput>[] = [
      {
        name: 'should store and retrieve text fields',
        input: {
          data: [
            { name: 'John Doe', email: 'john@example.com', website: 'https://example.com' },
            { name: 'Jane Smith', email: 'jane@example.com', website: 'https://jane.dev' }
          ],
          table: mockTable,
          fields: [
            createMockField('name', 'text'),
            createMockField('email', 'email'), 
            createMockField('website', 'url')
          ]
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should store and retrieve numeric fields',
        input: {
          data: [
            { age: 30, score: 95.5, count: 0 },
            { age: 25, score: 87.2, count: 10 }
          ],
          table: mockTable,
          fields: [
            createMockField('age', 'number'),
            createMockField('score', 'number'), 
            createMockField('count', 'number')
          ]
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should store and retrieve boolean fields',
        input: {
          data: [
            { active: true, verified: false },
            { active: false, verified: true }
          ],
          table: mockTable,
          fields: [
            createMockField('active', 'boolean'),
            createMockField('verified', 'boolean')
          ]
        },
        expected: { success: true, retrievedDataMatches: true }
      }
    ];

    basicTypeTests.forEach((testCase) => {
      test(testCase.name, async () => {
        const { data, table, fields } = testCase.input;
        
        // Store data using Arrow service
        const storeResult = await arrowService.storeData(data, table, fields);
        expect(storeResult.success).toBe(true);
        expect(storeResult.data).toBeDefined();
        expect(Buffer.isBuffer(storeResult.data)).toBe(true);
        
        if (testCase.expected.bufferSize) {
          expect((storeResult.data as Buffer).length).toBeGreaterThan(0);
        }
        
        // Retrieve data using Arrow service
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table, fields);
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
              created_at: '2024-01-15T10:30:00.000Z', 
              updated_at: '2024-01-16T15:45:30.000Z' 
            },
            { 
              created_at: '2023-12-25T00:00:00.000Z', 
              updated_at: '2023-12-25T23:59:59.999Z' 
            }
          ],
          table: mockTable,
          fields: [
            createMockField('created_at', 'date'),
            createMockField('updated_at', 'date')
          ]
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should handle null date values',
        input: {
          data: [
            { start_date: null, end_date: null },
            { start_date: '2024-01-01T00:00:00.000Z', end_date: null }
          ],
          table: mockTable,
          fields: [
            createMockField('start_date', 'date', false),
            createMockField('end_date', 'date', false)
          ]
        },
        expected: { success: true, retrievedDataMatches: true }
      }
    ];

    dateConversionTests.forEach((testCase) => {
      test(testCase.name, async () => {
        const { data, table, fields } = testCase.input;
        
        // Store data
        const storeResult = await arrowService.storeData(data, table, fields);
        expect(storeResult.success).toBe(true);
        
        // Retrieve data
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table, fields);
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
              related_user: [
                { id: '123', displayValue: 'John', tableId: 2 }
              ],
              tags: [
                { id: 'tag-1', displayValue: 'urgent' },
                { id: 'tag-2', displayValue: 'customer' },
                { id: 'tag-3', displayValue: 'vip' }
              ]
            },
            { 
              related_user: [
                { id: '456', displayValue: 'Jane', tableId: 2 }
              ],
              tags: [
                { id: 'tag-4', displayValue: 'low-priority' }
              ]
            }
          ],
          table: mockTable,
          fields: [
            createMockField('related_user', 'relation'),
            createMockField('tags', 'relation')
          ]
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should serialize file fields to JSON strings',
        input: {
          data: [
            { 
              avatar: [
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
              avatar: [
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
          table: mockTable,
          fields: [createMockField('avatar', 'file')]
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should handle multiple files and relations in single field',
        input: {
          data: [
            { 
              attachments: [
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
              assigned_users: [
                { id: '789', displayValue: 'Alice Johnson', tableId: 2 },
                { id: '101', displayValue: 'Bob Smith', tableId: 2 }
              ]
            }
          ],
          table: mockTable,
          fields: [
            createMockField('attachments', 'file'),
            createMockField('assigned_users', 'relation')
          ]
        },
        expected: { success: true, retrievedDataMatches: true }
      }
    ];

    jsonSerializationTests.forEach((testCase) => {
      test(testCase.name, async () => {
        const { data, table, fields } = testCase.input;
        
        // Store data
        const storeResult = await arrowService.storeData(data, table, fields);
        expect(storeResult.success).toBe(true);
        
        // Retrieve data
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table, fields);
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
        { id: 1, name: 'test1', active: true },
        { id: 2, name: 'test2', active: false }
      ];
      const fields = [
        createMockField('id', 'number'),
        createMockField('name', 'text'),
        createMockField('active', 'boolean')
      ];
      
      const result = await arrowService.storeData(testData, mockTable, fields);
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect((result.data as Buffer).length).toBeGreaterThan(0);
    });

    test('should read metadata with domain context', async () => {
      const testData = [{ name: 'test', count: 5 }];
      const fields = [
        createMockField('name', 'text'),
        createMockField('count', 'number')
      ];
      
      // Store data first
      const storeResult = await arrowService.storeData(testData, mockTable, fields);
      expect(storeResult.success).toBe(true);
      
      // Read metadata
      const metadataResult = await arrowService.readMetadata(storeResult.data as Buffer, mockTable);
      
      expect(metadataResult.success).toBe(true);
      expect(metadataResult.data).toBeDefined();
      
      const metadata = metadataResult.data!;
      expect(metadata.format).toBe('Apache Arrow IPC');
      expect(metadata.totalRows).toBe(1);
      expect(metadata.totalBytes).toBeGreaterThan(0);
      expect(metadata.tableId).toEqual(mockTable.id);
      expect(metadata.databaseId).toEqual(mockTable.databaseId);
      expect(metadata.organizationId).toEqual(mockTable.organizationId);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    const errorHandlingTests: TestCase<ArrowStorageTestInput, ArrowStorageTestOutput>[] = [
      {
        name: 'should handle empty data arrays',
        input: {
          data: [],
          table: mockTable,
          fields: [createMockField('name', 'text')]
        },
        expected: { success: true, retrievedDataMatches: true }
      },
      {
        name: 'should handle missing field slugs in data',
        input: {
          data: [
            { name: 'John' }, // missing 'age' field
            { name: 'Jane', age: 25 } // complete data
          ],
          table: mockTable,
          fields: [
            createMockField('name', 'text'),
            createMockField('age', 'number')
          ]
        },
        expected: { success: true } // Should fill missing values with null
      },
      {
        name: 'should handle null and undefined values',
        input: {
          data: [
            { name: null, age: undefined, active: false },
            { name: 'Valid', age: 30, active: true }
          ],
          table: mockTable,
          fields: [
            createMockField('name', 'text', false),
            createMockField('age', 'number', false),
            createMockField('active', 'boolean')
          ]
        },
        expected: { success: true }
      }
    ];

    errorHandlingTests.forEach((testCase) => {
      test(testCase.name, async () => {
        const { data, table, fields } = testCase.input;
        
        // Store data
        const storeResult = await arrowService.storeData(data, table, fields);
        expect(storeResult.success).toBe(true);
        
        // Retrieve data
        const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, table, fields);
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
        text_field: 'Sample text',
        email_field: 'test@example.com',
        url_field: 'https://example.com',
        number_field: 42,
        boolean_field: true,
        date_field: '2024-01-15T10:30:00.000Z',
        relation_field: [
          { id: '123', displayValue: 'Related Item', tableId: 2 }
        ],
        file_field: [
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

      const allTypeFields = [
        createMockField('text_field', 'text'),
        createMockField('email_field', 'email'),
        createMockField('url_field', 'url'),
        createMockField('number_field', 'number'),
        createMockField('boolean_field', 'boolean'),
        createMockField('date_field', 'date'),
        createMockField('relation_field', 'relation'),
        createMockField('file_field', 'file')
      ];

      // Store all types
      const storeResult = await arrowService.storeData(allTypesData, mockTable, allTypeFields);
      expect(storeResult.success).toBe(true);

      // Retrieve all types
      const retrieveResult = await arrowService.retrieveData(storeResult.data as Buffer, mockTable, allTypeFields);
      expect(retrieveResult.success).toBe(true);
      expect(retrieveResult.data).toEqual(allTypesData);
    });
  });
});

// Mock helper functions
function createMockTable(id: number, name: string): DynamicTable {
  return DynamicTable.fromPersistence({
    id,
    name,
    organizationId: 1,
    databaseId: 1,
    storageLocation: `s3://test-bucket/org_1/db_1/table_${id}`,
    createdBy: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID format
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z')
  });
}

function createMockField(slug: string, type: FieldType, required = false): Field {
  return Field.fromPersistence({
    id: Math.floor(Math.random() * 1000),
    tableId: 1,
    name: slug.charAt(0).toUpperCase() + slug.slice(1).replace('_', ' '),
    slug,
    type,
    required,
    orderIndex: 1,
    relatedTableId: type === 'relation' ? 2 : null,
    metadata: undefined,
    createdAt: new Date('2024-01-01T00:00:00.000Z')
  });
}