# Repository Unit Testing Guide

This directory contains comprehensive mock-based unit tests for Drizzle repositories. Since PGlite doesn't support vector types and setting up a full PostgreSQL instance for unit tests is complex, we use mocking to test business logic.

## Approach: Mock-Based Unit Testing

### Why Mock-Based Testing?

1. **Fast**: No database setup or teardown
2. **Isolated**: Tests only business logic, not database implementation
3. **Reliable**: No external dependencies
4. **Comprehensive**: Can test error scenarios easily

### Architecture

Our repositories have dual dependencies that need mocking:
- **Drizzle Client**: For static schema operations (metadata CRUD)
- **Raw Postgres Client**: For dynamic operations (DDL, dynamic table operations)

## Test Structure

### 1. Basic Test Setup

```typescript
import { setupRepositoryMocks, testDataFactories, assertions } from './test-utils';
import { DrizzleDynamicTableRepository } from '@/lib/infrastructure/db/repositories/drizzle-dynamic-table-repository';

describe('DrizzleDynamicTableRepository', () => {
  let repository: DrizzleDynamicTableRepository;
  let mocks: ReturnType<typeof setupRepositoryMocks>;

  beforeEach(() => {
    const mockData = [testDataFactories.dynamicTable()];
    mocks = setupRepositoryMocks(mockData);
    repository = new DrizzleDynamicTableRepository(mocks.mockDb, mocks.mockRawClient);
  });
});
```

### 2. Test Categories

#### Metadata Operations (Use Drizzle Mocks)
```typescript
it('should find table by ID', async () => {
  const result = await repository.findById(1);
  
  expect(result).toEqual(testDataFactories.dynamicTable());
  expect(mocks.mockDb.select).toHaveBeenCalled();
});
```

#### Physical Operations (Use Raw SQL Mocks)
```typescript
it('should create physical table', async () => {
  const result = await repository.create(testDataFactories.createTableData());
  
  assertions.expectSqlOperation(mocks.mockRawClient, 'CREATE TABLE');
  assertions.expectDrizzleInsert(mocks.mockDb, expect.objectContaining({
    name: 'Test Table'
  }));
});
```

#### Error Scenarios
```typescript
it('should handle database errors', async () => {
  testScenarios.simulateDatabaseError(mocks.mockDb, 'select');
  
  await expect(repository.findById(1)).rejects.toThrow('Database connection failed');
});
```

## Key Patterns

### 1. Drizzle Fluent API Mocking

Drizzle uses fluent API chains that need proper mocking:

```typescript
const mockSelectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([mockData]),
};
mockDb.select.mockReturnValue(mockSelectChain);
```

### 2. Postgres Tagged Template Mocking

Raw postgres calls use tagged template literals with complex structure:

```typescript
// Don't do this (won't work):
expect(mockRawClient).toHaveBeenCalledWith('CREATE TABLE ...');

// Do this instead:
assertions.expectSqlOperation(mockRawClient, 'CREATE TABLE');
```

### 3. Multiple Operation Scenarios

Some operations call both Drizzle and raw SQL:

```typescript
it('should create field with physical column', async () => {
  await repository.create(fieldData);
  
  // Check metadata creation (Drizzle)
  expect(mocks.mockDb.insert).toHaveBeenCalled();
  
  // Check physical column creation (Raw SQL)
  assertions.expectSqlOperation(mocks.mockRawClient, 'ALTER TABLE');
  assertions.expectSqlOperation(mocks.mockRawClient, 'ADD COLUMN');
});
```

## Test Utilities

### Data Factories
```typescript
testDataFactories.dynamicTable()     // Creates test table data
testDataFactories.field()            // Creates test field data
testDataFactories.createTableData()  // Creates table creation data
```

### Mock Helpers
```typescript
setupRepositoryMocks(mockData)       // Sets up both DB clients
testScenarios.simulateEmptyResult()  // Simulates no results found
testScenarios.simulateDatabaseError() // Simulates DB connection errors
```

### Assertions
```typescript
assertions.expectDrizzleInsert()     // Verifies Drizzle insert calls
assertions.expectSqlOperation()      // Verifies raw SQL operations
assertions.expectRawSqlUnsafe()      // Verifies parameterized queries
```

## Running Tests

```bash
# Run all repository tests
pnpm test __tests__/lib/repositories/ --run

# Run specific repository test
pnpm test __tests__/lib/repositories/drizzle-dynamic-table-repository.test.ts --run

# Run with coverage
pnpm test __tests__/lib/repositories/ --coverage --run
```

## Best Practices

### 1. Test Business Logic, Not Implementation
Focus on testing the behavior and outcomes, not the specific SQL generated.

### 2. Use Realistic Test Data
Use the data factories to create realistic test data that matches your domain entities.

### 3. Test Error Scenarios
Always test error conditions - database failures, validation errors, not found scenarios.

### 4. Keep Tests Focused
Each test should verify one specific behavior or scenario.

### 5. Use Descriptive Test Names
Test names should clearly describe what behavior is being tested.

## Example: Complete Test

```typescript
describe('create table', () => {
  it('should create table with physical schema and rollback on failure', async () => {
    // Arrange
    const createData = testDataFactories.createTableData();
    mocks.mockRawClient.mockResolvedValue(undefined); // Success
    
    // Act
    const result = await repository.create(createData);
    
    // Assert
    expect(result).toEqual(testDataFactories.dynamicTable());
    assertions.expectDrizzleInsert(mocks.mockDb, createData);
    assertions.expectSqlOperation(mocks.mockRawClient, 'CREATE TABLE');
  });

  it('should rollback metadata on physical table creation failure', async () => {
    // Arrange
    testScenarios.simulateSqlError(mocks.mockRawClient);
    
    // Act & Assert
    await expect(repository.create(testDataFactories.createTableData()))
      .rejects.toThrow('Failed to create physical table');
    
    expect(mocks.mockDb.delete).toHaveBeenCalled(); // Rollback
  });
});
```

## Working Tests

- ✅ `drizzle-dynamic-table-repository.test.ts` - Comprehensive tests for dynamic table operations
- 🚧 `drizzle-field-repository.test.ts` - Field repository tests (needs assertion fixes)
- ✅ `test-utils.ts` - Reusable testing utilities
- ✅ `example-repository.test.ts` - Example using test utilities

This approach provides thorough testing coverage while avoiding the complexity of setting up real databases for unit tests.