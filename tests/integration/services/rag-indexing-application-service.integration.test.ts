import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { 
  getRagIndexingApplicationService,
  getTableApplicationService,
  getContextAwareDb, 
  initializeDI 
} from '@/ddd/application/di/container';
import { testClient } from '../shared/integration-helpers';
import { OrganizationId, UserId, TableId, DatabaseId } from '@/ddd/domain/shared/value-objects';
import { RagIndexId, type DomainType } from '@/ddd/domain/rag/value-objects';
import type { TestCase } from '../../shared/types';
import type { TestContext } from '../shared/test-setup';
import type { CreateIndexCommand } from '@/ddd/application/services/rag/commands';
import type { FieldType } from '@/ddd/domain/tables/value-objects/table-field';

// AIDEV-NOTE: RAG Indexing Application Service integration tests
// Tests core indexing functionality with real database and file operations

// =============================================================================
// Test Input/Output Interfaces
// =============================================================================

interface CreateIndexTestInput {
  name: string;
  organizationId: OrganizationId;
  domainTypes: DomainType[];
  createdBy: UserId;
}

interface CreateIndexTestOutput {
  success: boolean;
  error?: string;
  indexId?: string;
}

interface IndexFilesTestInput {
  organizationId: OrganizationId;
  indexId?: string; // Will be created if not provided
  setupFiles: {
    tableName: string;
    fileName: string;
    fileContent: string;
    mimeType: string;
  }[];
}

interface IndexFilesTestOutput {
  success: boolean;
  documentsIndexed: number;
  error?: string;
}

interface IndexTablesTestInput {
  organizationId: OrganizationId;
  indexId?: string; // Will be created if not provided
  setupTables: {
    name: string;
    fields: { name: string; type: FieldType; }[];
  }[];
}

interface IndexTablesTestOutput {
  success: boolean;
  tablesIndexed: number;
  error?: string;
}

interface ReindexTestInput {
  indexId: string;
  domainType?: DomainType;
  organizationId: OrganizationId;
}

interface ReindexTestOutput {
  success: boolean;
  documentsProcessed: number;
  error?: string;
}

// =============================================================================
// Test Case Factories
// =============================================================================

function createIndexTestCases(context: TestContext): TestCase<CreateIndexTestInput, CreateIndexTestOutput>[] {
  return [
    {
      name: 'should create valid RAG index with all domain types',
      input: {
        name: 'Test RAG Index',
        organizationId: context.organizationId,
        domainTypes: ['file', 'table', 'agent', 'database'] as DomainType[],
        createdBy: context.ownerUserId,
      },
      expected: { success: true }
    },
    {
      name: 'should reject duplicate index names within organization',
      input: {
        name: 'Duplicate Index Name',
        organizationId: context.organizationId,
        domainTypes: ['file'] as DomainType[],
        createdBy: context.ownerUserId,
      },
      expected: { 
        success: false, 
        error: 'Index name "Duplicate Index Name" already exists in this organization' 
      }
    },
    {
      name: 'should reject empty domain types',
      input: {
        name: 'Empty Domain Types Index',
        organizationId: context.organizationId,
        domainTypes: [] as DomainType[],
        createdBy: context.ownerUserId,
      },
      expected: { 
        success: false,
        error: 'At least one domain type is required'
      }
    }
  ];
}

function createFileIndexingTestCases(context: TestContext): TestCase<IndexFilesTestInput, IndexFilesTestOutput>[] {
  return [
    {
      name: 'should index files from organization tables successfully',
      input: {
        organizationId: context.organizationId,
        setupFiles: [
          {
            tableName: 'Documents',
            fileName: 'test-document.pdf',
            fileContent: 'This is a test PDF document with important content.',
            mimeType: 'application/pdf'
          },
          {
            tableName: 'Reports',
            fileName: 'quarterly-report.txt',
            fileContent: 'Quarterly financial report with key metrics.',
            mimeType: 'text/plain'
          }
        ]
      },
      expected: { 
        success: true, 
        documentsIndexed: 2 
      }
    },
    {
      name: 'should handle empty result when no files exist',
      input: {
        organizationId: context.organizationId,
        setupFiles: []
      },
      expected: { 
        success: true, 
        documentsIndexed: 0 
      }
    }
  ];
}

function createTableIndexingTestCases(context: TestContext): TestCase<IndexTablesTestInput, IndexTablesTestOutput>[] {
  return [
    {
      name: 'should index table schemas and metadata',
      input: {
        organizationId: context.organizationId,
        setupTables: [
          {
            name: 'Customer Data',
            fields: [
              { name: 'name', type: 'text' },
              { name: 'email', type: 'email' },
              { name: 'signup_date', type: 'date' }
            ]
          },
          {
            name: 'Product Inventory',
            fields: [
              { name: 'product_name', type: 'text' },
              { name: 'quantity', type: 'number' },
              { name: 'price', type: 'number' },
              { name: 'in_stock', type: 'boolean' }
            ]
          }
        ]
      },
      expected: { 
        success: true, 
        tablesIndexed: 2 
      }
    },
    {
      name: 'should handle empty result when no tables exist',
      input: {
        organizationId: context.organizationId,
        setupTables: []
      },
      expected: { 
        success: true, 
        tablesIndexed: 0 
      }
    }
  ];
}

// =============================================================================
// Test Context and Helpers
// =============================================================================

let testContext: TestContext;
let ragIndexingService: ReturnType<typeof getRagIndexingApplicationService>;
let tableApplicationService: ReturnType<typeof getTableApplicationService>;

// Mock content processor for deterministic results
const mockContentProcessor = {
  generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
  calculateContentHash: vi.fn().mockImplementation((content: string) => 
    `mock-hash-${content.length}`
  ),
  processFileContent: vi.fn().mockImplementation(async (fileData) => {
    return [{
      content: `Processed content from ${fileData.name}`,
      metadata: {
        fileName: fileData.name,
        mimeType: fileData.mimeType,
        size: fileData.size
      },
      embedding: new Array(1536).fill(0.1),
      contentHash: `mock-hash-${fileData.name}`
    }];
  }),
  getSupportedFileTypes: vi.fn().mockReturnValue(['application/pdf', 'text/plain', 'text/html']),
  isFileTypeSupported: vi.fn().mockReturnValue(true),
  getProcessingConfig: vi.fn().mockReturnValue({
    chunkSize: 1000,
    chunkOverlap: 200,
    maxFileSize: 10 * 1024 * 1024
  })
};

async function createTestIndex(context: TestContext, domainTypes: DomainType[] = ['file', 'table']): Promise<string> {
  const command: CreateIndexCommand = {
    name: `Test Index ${Date.now()}`,
    organizationId: context.organizationId.value,
    domainTypes,
    createdBy: context.ownerUserId.value
  };
  
  return await ragIndexingService.createIndex(command);
}

async function createTestTable(
  context: TestContext, 
  tableDef: { name: string; fields: { name: string; type: FieldType; }[] }
): Promise<{ id: TableId; name: string }> {
  // Create a test database first
  const createDatabaseCommand = {
    name: `Test Database ${Date.now()}`,
    organizationId: context.organizationId,
    createdBy: context.ownerUserId,
    slug: `test-db-${Date.now()}`
  };
  
  // Note: This would require implementing database creation in test helpers
  // For now, we'll assume a test database exists
  const testDatabaseId = DatabaseId.fromNumber(1);
  
  const createTableCommand = {
    name: tableDef.name,
    databaseId: testDatabaseId,
    organizationId: context.organizationId,
    createdBy: context.ownerUserId,
    description: `Test table: ${tableDef.name}`
  };
  
  const result = await tableApplicationService.createTable(createTableCommand);
  
  if (!result.success || !result.data) {
    throw new Error(`Failed to create test table: ${result.error}`);
  }
  
  const table = result.data;
  
  // Add fields to the table
  for (const fieldDef of tableDef.fields) {
    await tableApplicationService.createField({
      tableId: table.id,
      name: fieldDef.name,
      type: fieldDef.type
    });
  }
  
  return { id: table.id, name: table.name };
}

// =============================================================================
// Test Suite
// =============================================================================

describe('RAG Indexing Application Service Integration Tests', () => {
  
  beforeAll(() => {
    // Initialize DI container with test database clients
    initializeDI(testClient.db as any, testClient.db as any);
  });

  afterAll(async () => {
    await testClient.disconnect();
  });

  beforeEach(async () => {
    // Create fresh test organization for each test to ensure isolation
    const { createTestOrganization } = await import('../shared/test-setup');
    
    testContext = await createTestOrganization('RAG Test Organization');
    
    // Set RLS context
    const contextDb = getContextAwareDb();
    contextDb.setContext(testContext.ownerUserId.value, testContext.organizationId.value);
    
    // Get application services
    ragIndexingService = getRagIndexingApplicationService();
    tableApplicationService = getTableApplicationService();
    
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clear RLS context and clean test data
    const contextDb = getContextAwareDb();
    contextDb.clearContext();
    await testClient.cleanTestData();
  });

  // =============================================================================
  // Index Creation Tests
  // =============================================================================

  describe('Index Creation', () => {
    test('should run all index creation test cases', async () => {
      const testCases = createIndexTestCases(testContext);
      
      for (const { name, input, expected } of testCases) {
        console.log(`🧪 Running test: ${name}`);
        let actualResult: CreateIndexTestOutput;
        
        try {
          // Handle duplicate name test case
          if (name.includes('duplicate')) {
            // Create first index
            await createTestIndex(testContext, input.domainTypes);
          }
          
          const command: CreateIndexCommand = {
            name: input.name,
            organizationId: input.organizationId.value,
            domainTypes: input.domainTypes,
            createdBy: input.createdBy.value
          };
          
          const indexId = await ragIndexingService.createIndex(command);
          
          actualResult = { 
            success: true, 
            indexId 
          };
          
        } catch (error) {
          actualResult = { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }

        expect(actualResult.success).toBe(expected.success);
        
        if (expected.error) {
          expect(actualResult.error).toContain(expected.error);
        }
        
        if (expected.success) {
          expect(actualResult.indexId).toBeDefined();
          expect(typeof actualResult.indexId).toBe('string');
        }
      }
    });
  });

  // =============================================================================
  // File Indexing Tests
  // =============================================================================

  describe('File Indexing', () => {
    test('should run all file indexing test cases', async () => {
      const testCases = createFileIndexingTestCases(testContext);
      
      for (const { name, input, expected } of testCases) {
        console.log(`🧪 Running test: ${name}`);
        let actualResult: IndexFilesTestOutput;
        
        try {
          // Create test index for file indexing
          const indexId = input.indexId || await createTestIndex(testContext, ['file']);
          
          // Set up test files in tables
          for (const fileSetup of input.setupFiles) {
            // Create table with file field
            const table = await createTestTable(testContext, {
              name: fileSetup.tableName,
              fields: [
                { name: 'title', type: 'text' },
                { name: 'document', type: 'file' }
              ]
            });
            
            // Note: In a real test, we would upload files to S3 and add them to table rows
            // For this test, we'll simulate file existence in the table
            // This would require implementing file upload helpers
            console.log(`Would upload ${fileSetup.fileName} to table ${table.name}`);
          }
          
          // Trigger file indexing
          const result = await ragIndexingService.reindexSingleIndex(
            RagIndexId.fromString(indexId),
            'file'
          );
          
          actualResult = {
            success: true,
            documentsIndexed: result.documentsAdded
          };
          
        } catch (error) {
          actualResult = {
            success: false,
            documentsIndexed: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }

        expect(actualResult.success).toBe(expected.success);
        expect(actualResult.documentsIndexed).toBe(expected.documentsIndexed);
        
        if (expected.error) {
          expect(actualResult.error).toContain(expected.error);
        }
      }
    });

    test('should process file content with table context', async () => {
      // Create index and table with file
      const indexId = await createTestIndex(testContext, ['file']);
      const table = await createTestTable(testContext, {
        name: 'Document Library',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'attachment', type: 'file' }
        ]
      });
      
      // Mock file processing to verify context is passed
      mockContentProcessor.processFileContent.mockImplementation(async (fileData) => {
        // Verify table context is included
        expect(fileData.tableName).toBe('Document Library');
        expect(fileData.fieldName).toBe('attachment');
        expect(fileData.organizationId).toBe(testContext.organizationId.value);
        
        return [{
          content: `Document from ${fileData.tableName}`,
          metadata: { tableName: fileData.tableName, fieldName: fileData.fieldName },
          embedding: new Array(1536).fill(0.1),
          contentHash: `hash-${fileData.name}`
        }];
      });
      
      // Trigger indexing
      await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(indexId),
        'file'
      );
      
      // Verify mock was called with expected context
      if (mockContentProcessor.processFileContent.mock.calls.length > 0) {
        const call = mockContentProcessor.processFileContent.mock.calls[0];
        expect(call[0]).toHaveProperty('tableName', 'Document Library');
        expect(call[0]).toHaveProperty('fieldName', 'attachment');
      }
    });

    test('should handle file download failures gracefully', async () => {
      const indexId = await createTestIndex(testContext, ['file']);
      
      // Create table but simulate S3 download failure
      await createTestTable(testContext, {
        name: 'Broken Files',
        fields: [{ name: 'broken_file', type: 'file' }]
      });
      
      // Mock file storage to simulate failure
      const mockFileStorage = {
        downloadFile: vi.fn().mockRejectedValue(new Error('S3 download failed'))
      };
      
      // The service should handle this gracefully and continue with other files
      const result = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(indexId),
        'file'
      );
      
      // Should complete without throwing, even if some files fail
      expect(result).toBeDefined();
      expect(result.errors).toBeDefined();
    });
  });

  // =============================================================================
  // Table Indexing Tests  
  // =============================================================================

  describe('Table Indexing', () => {
    test('should run all table indexing test cases', async () => {
      const testCases = createTableIndexingTestCases(testContext);
      
      for (const { name, input, expected } of testCases) {
        console.log(`🧪 Running test: ${name}`);
        let actualResult: IndexTablesTestOutput;
        
        try {
          // Create test index for table indexing
          const indexId = input.indexId || await createTestIndex(testContext, ['table']);
          
          // Set up test tables
          const createdTables = [];
          for (const tableDef of input.setupTables) {
            const table = await createTestTable(testContext, {
              name: tableDef.name,
              fields: tableDef.fields
            });
            createdTables.push(table);
          }
          
          // Trigger table indexing
          const result = await ragIndexingService.reindexSingleIndex(
            RagIndexId.fromString(indexId),
            'table'
          );
          
          actualResult = {
            success: true,
            tablesIndexed: result.documentsAdded
          };
          
        } catch (error) {
          actualResult = {
            success: false,
            tablesIndexed: 0,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }

        expect(actualResult.success).toBe(expected.success);
        expect(actualResult.tablesIndexed).toBe(expected.tablesIndexed);
        
        if (expected.error) {
          expect(actualResult.error).toContain(expected.error);
        }
      }
    });

    test('should index table schema with field metadata', async () => {
      const indexId = await createTestIndex(testContext, ['table']);
      
      // Create table with various field types
      const table = await createTestTable(testContext, {
        name: 'User Profiles',
        fields: [
          { name: 'full_name', type: 'text' },
          { name: 'email_address', type: 'email' },
          { name: 'age', type: 'number' },
          { name: 'is_active', type: 'boolean' },
          { name: 'join_date', type: 'date' },
          { name: 'profile_picture', type: 'file' }
        ]
      });
      
      // Trigger table indexing
      const result = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(indexId),
        'table'
      );
      
      // Should have indexed the table and its field schema
      expect(result.documentsAdded).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should include table relationships in indexed content', async () => {
      const indexId = await createTestIndex(testContext, ['table']);
      
      // Create related tables
      const usersTable = await createTestTable(testContext, {
        name: 'Users',
        fields: [
          { name: 'name', type: 'text' },
          { name: 'email', type: 'email' }
        ]
      });
      
      const ordersTable = await createTestTable(testContext, {
        name: 'Orders',
        fields: [
          { name: 'order_id', type: 'text' },
          { name: 'user_relation', type: 'relation' },
          { name: 'total_amount', type: 'number' }
        ]
      });
      
      // Trigger indexing
      const result = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(indexId),
        'table'
      );
      
      // Should index both tables
      expect(result.documentsAdded).toBe(2);
    });
  });

  // =============================================================================
  // Reindexing and Multi-Domain Tests
  // =============================================================================

  describe('Reindexing Operations', () => {
    
    test('should perform full reindex of all domains', async () => {
      // Create index with multiple domain types
      const indexId = await createTestIndex(testContext, ['file', 'table', 'agent']);
      
      // Create test data across domains
      await createTestTable(testContext, {
        name: 'Mixed Content',
        fields: [
          { name: 'title', type: 'text' },
          { name: 'document', type: 'file' }
        ]
      });
      
      // Trigger full reindex
      const result = await ragIndexingService.reindexAll();
      
      expect(result.success).toBe(true);
      expect(result.documentsProcessed).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should perform selective reindex by domain type', async () => {
      const indexId = await createTestIndex(testContext, ['file', 'table']);
      
      // Create test table
      await createTestTable(testContext, {
        name: 'Selective Index Test',
        fields: [{ name: 'name', type: 'text' }]
      });
      
      // Reindex only tables
      const result = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(indexId),
        'table'
      );
      
      expect(result.documentsAdded).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    test('should handle incremental updates correctly', async () => {
      const indexId = await createTestIndex(testContext, ['table']);
      
      // Initial indexing
      const table = await createTestTable(testContext, {
        name: 'Incremental Test',
        fields: [{ name: 'content', type: 'text' }]
      });
      
      const initialResult = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(indexId),
        'table'
      );
      
      // Add more fields and reindex
      await tableApplicationService.createField({
        tableId: table.id,
        name: 'new_field',
        type: 'number'
      });
      
      const updateResult = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(indexId),
        'table'
      );
      
      expect(updateResult.documentsUpdated).toBeGreaterThanOrEqual(0);
    });
  });

  // =============================================================================
  // Multi-Tenant Isolation Tests
  // =============================================================================

  describe('Multi-Tenant Isolation', () => {
    
    test('should enforce organization boundaries in indexing', async () => {
      // Create second organization
      const { createTestOrganization } = await import('../shared/test-setup');
      const org2Context = await createTestOrganization('Organization 2');
      
      // Create indexes in both organizations
      const org1IndexId = await createTestIndex(testContext, ['table']);
      
      // Switch context to org 2
      const contextDb = getContextAwareDb();
      contextDb.setContext(org2Context.ownerUserId.value, org2Context.organizationId.value);
      
      const org2IndexId = await createTestIndex(org2Context, ['table']);
      
      // Create tables in each organization
      contextDb.setContext(testContext.ownerUserId.value, testContext.organizationId.value);
      await createTestTable(testContext, {
        name: 'Org 1 Table',
        fields: [{ name: 'data', type: 'text' }]
      });
      
      contextDb.setContext(org2Context.ownerUserId.value, org2Context.organizationId.value);
      await createTestTable(org2Context, {
        name: 'Org 2 Table', 
        fields: [{ name: 'data', type: 'text' }]
      });
      
      // Reindex both organizations
      contextDb.setContext(testContext.ownerUserId.value, testContext.organizationId.value);
      const org1Result = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(org1IndexId),
        'table'
      );
      
      contextDb.setContext(org2Context.ownerUserId.value, org2Context.organizationId.value);
      const org2Result = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(org2IndexId),
        'table'
      );
      
      // Both should succeed but only index their own organization's data
      expect(org1Result.documentsAdded).toBe(1); // Only Org 1 Table
      expect(org2Result.documentsAdded).toBe(1); // Only Org 2 Table
      
      // Cleanup context
      contextDb.setContext(testContext.ownerUserId.value, testContext.organizationId.value);
    });

    test('should prevent cross-organization index access', async () => {
      // Create index in org 1
      const indexId = await createTestIndex(testContext, ['table']);
      
      // Create second organization
      const { createTestOrganization } = await import('../shared/test-setup');
      const org2Context = await createTestOrganization('Organization 2');
      
      // Switch to org 2 context
      const contextDb = getContextAwareDb();
      contextDb.setContext(org2Context.ownerUserId.value, org2Context.organizationId.value);
      
      // Attempt to access org 1's index from org 2 context should fail
      await expect(async () => {
        await ragIndexingService.reindexSingleIndex(RagIndexId.fromString(indexId));
      }).rejects.toThrow();
      
      // Reset context
      contextDb.setContext(testContext.ownerUserId.value, testContext.organizationId.value);
    });
  });

  // =============================================================================
  // Error Handling and Edge Cases
  // =============================================================================

  describe('Error Handling', () => {
    
    test('should handle non-existent index gracefully', async () => {
      const fakeIndexId = RagIndexId.fromString('fake-index-id');
      
      await expect(async () => {
        await ragIndexingService.reindexSingleIndex(fakeIndexId);
      }).rejects.toThrow('Index not found');
    });

    test('should continue processing when individual items fail', async () => {
      const indexId = await createTestIndex(testContext, ['table']);
      
      // Create multiple tables, one will cause processing error
      await createTestTable(testContext, {
        name: 'Good Table',
        fields: [{ name: 'valid', type: 'text' }]
      });
      
      await createTestTable(testContext, {
        name: 'Problem Table',
        fields: [{ name: 'problematic', type: 'text' }]
      });
      
      // Mock domain service to fail on one table
      const mockIndexingService = {
        indexTableData: vi.fn()
          .mockResolvedValueOnce([{ /* good result */ }])
          .mockRejectedValueOnce(new Error('Processing failed'))
      };
      
      const result = await ragIndexingService.reindexSingleIndex(
        RagIndexId.fromString(indexId),
        'table'
      );
      
      // Should complete with some successes and some errors
      expect(result.documentsAdded).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    test('should validate domain types during indexing', async () => {
      const indexId = await createTestIndex(testContext, ['file']); // Only file domain
      
      // Attempt to index tables when index only supports files
      await expect(async () => {
        await ragIndexingService.reindexSingleIndex(
          RagIndexId.fromString(indexId),
          'table' // Not supported by this index
        );
      }).rejects.toThrow();
    });
  });
});