// AIDEV-NOTE: Test utilities for repository testing
// Provides helper functions and mock factories for repository unit tests

import { vi, type MockedFunction } from 'vitest';

// Common mock types
export type MockDbClient = {
  insert: MockedFunction<any>;
  select: MockedFunction<any>;
  update: MockedFunction<any>;
  delete: MockedFunction<any>;
};

export type MockRawClient = MockedFunction<any> & {
  unsafe: MockedFunction<any>;
};

// Mock factory for Drizzle database client
export function createMockDbClient(): MockDbClient {
  return {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

// Mock factory for postgres raw client
export function createMockRawClient(): MockRawClient {
  const mock = vi.fn() as MockRawClient;
  mock.unsafe = vi.fn();
  return mock;
}

// Helper to create Drizzle fluent API chains
export function createDrizzleChains(mockData: any[] = []) {
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(mockData),
  };

  const mockInsertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(mockData),
  };

  const mockUpdateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(mockData),
  };

  const mockDeleteChain = {
    where: vi.fn().mockResolvedValue(undefined),
  };

  return {
    select: mockSelectChain,
    insert: mockInsertChain,
    update: mockUpdateChain,
    delete: mockDeleteChain,
  };
}

// Helper to setup complete repository mocks
export function setupRepositoryMocks(mockData: any[] = []) {
  const mockDb = createMockDbClient();
  const mockRawClient = createMockRawClient();
  const chains = createDrizzleChains(mockData);

  // Setup method chains
  mockDb.insert.mockReturnValue(chains.insert);
  mockDb.select.mockReturnValue(chains.select);
  mockDb.update.mockReturnValue(chains.update);
  mockDb.delete.mockReturnValue(chains.delete);

  return {
    mockDb,
    mockRawClient,
    chains,
  };
}

// Test data factories
export const testDataFactories = {
  dynamicTable: (overrides = {}) => ({
    id: 1,
    databaseId: 10,
    organizationId: 100,
    name: 'Test Table',
    dbName: 'test_table_123',
    metadata: { description: 'Test table' },
    createdBy: 'user-123',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }),

  field: (overrides = {}) => ({
    id: 1,
    tableId: 10,
    name: 'Test Field',
    slug: 'test_field',
    type: 'text',
    orderIndex: 0,
    relatedTableId: null,
    required: false,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  }),

  dynamicTableRow: (overrides = {}) => ({
    id: 'row-uuid-123',
    created_at: new Date('2025-01-01T00:00:00Z'),
    updated_at: new Date('2025-01-01T00:00:00Z'),
    field_1: 'Test Value',
    field_2: 42,
    ...overrides,
  }),

  createTableData: (overrides = {}) => ({
    databaseId: 10,
    organizationId: 100,
    name: 'Test Table',
    dbName: 'test_table_123',
    createdBy: 'user-123',
    ...overrides,
  }),

  createFieldData: (overrides = {}) => ({
    tableId: 10,
    name: 'Test Field',
    slug: 'test_field',
    type: 'text',
    orderIndex: 0,
    required: false,
    ...overrides,
  }),
};

// Common test scenarios
export const testScenarios = {
  // Simulate database errors
  simulateDatabaseError: (mockDb: MockDbClient, operation: keyof MockDbClient) => {
    const errorChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockRejectedValue(new Error('Database connection failed')),
      set: vi.fn().mockReturnThis(),
    };
    mockDb[operation].mockReturnValue(errorChain);
  },

  // Simulate empty results
  simulateEmptyResult: (mockDb: MockDbClient) => {
    const emptyChain = createDrizzleChains([]);
    mockDb.select.mockReturnValue(emptyChain.select);
    mockDb.update.mockReturnValue({
      ...emptyChain.update,
      returning: vi.fn().mockResolvedValue([]),
    });
  },

  // Simulate SQL execution errors
  simulateSqlError: (mockRawClient: MockRawClient, errorMessage = 'SQL execution failed') => {
    mockRawClient.mockRejectedValue(new Error(errorMessage));
    mockRawClient.unsafe.mockRejectedValue(new Error(errorMessage));
  },
};

// Assertion helpers
export const assertions = {
  // Check if Drizzle insert was called with expected data
  expectDrizzleInsert: (mockDb: MockDbClient, expectedData: any) => {
    expect(mockDb.insert).toHaveBeenCalled();
    const insertChain = mockDb.insert.mock.results[0].value;
    expect(insertChain.values).toHaveBeenCalledWith(expect.objectContaining(expectedData));
  },

  // Check if postgres tagged template was called with expected SQL patterns
  expectPostgresTaggedTemplate: (mockRawClient: MockRawClient, expectedPatterns: string[]) => {
    expect(mockRawClient).toHaveBeenCalled();
    const calls = mockRawClient.mock.calls;
    
    for (const pattern of expectedPatterns) {
      const matchingCall = calls.find(call => 
        call[0] && call[0].some && call[0].some((part: string) => 
          part.includes(pattern)
        )
      );
      expect(matchingCall).toBeDefined();
    }
  },

  // Check if raw SQL unsafe was called with expected query pattern
  expectRawSqlUnsafe: (mockRawClient: MockRawClient, queryPattern: string, expectedParams?: any[]) => {
    expect(mockRawClient.unsafe).toHaveBeenCalledWith(
      expect.stringContaining(queryPattern),
      expectedParams ? expect.arrayContaining(expectedParams) : expect.any(Array)
    );
  },

  // Check if a specific SQL operation was called (CREATE TABLE, ALTER TABLE, etc.)
  expectSqlOperation: (mockRawClient: MockRawClient, operation: string) => {
    expect(mockRawClient).toHaveBeenCalled();
    const calls = mockRawClient.mock.calls;
    const operationCall = calls.find(call => 
      call[0] && call[0].some && call[0].some((part: string) => 
        part.includes(operation)
      )
    );
    expect(operationCall).toBeDefined();
  },
};

// Example usage helper
export function createRepositoryTestSuite<T>(
  RepositoryClass: new (db: any, rawClient: any, ...args: any[]) => T,
  testName: string
) {
  return {
    describe: (name: string, tests: () => void) => {
      describe(`${testName} - ${name}`, tests);
    },
    
    beforeEach: (callback: (repository: T, mocks: ReturnType<typeof setupRepositoryMocks>) => void) => {
      return () => {
        const mocks = setupRepositoryMocks();
        const repository = new RepositoryClass(mocks.mockDb, mocks.mockRawClient);
        callback(repository, mocks);
      };
    },
  };
}