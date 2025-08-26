# Test Suite Documentation

## Overview

This test suite follows DDD (Domain-Driven Design) principles and provides comprehensive testing for the Emery application's business logic layer.

## Structure

```
__tests__/
├── application/services/          # Application service unit tests (NEW)
│   ├── agents/                   # Agent management service tests
│   ├── teams/                    # Team management service tests  
│   ├── rag/                      # RAG indexing service tests
│   └── shared/                   # Shared test utilities
│       ├── test-case.ts         # TestCase interface for structured testing
│       ├── mock-factories.ts    # Mock repository and entity factories
│       └── test-helpers.ts      # Common test helper functions
├── lib/                          # Library and utility tests
│   ├── client-parser.test.ts    # Database client parsing
│   ├── domain/rag/entities/     # Domain entity tests (existing)
│   └── repositories/            # Repository test utilities (existing)
├── grpc/                         # gRPC integration tests
└── app/                          # Component tests
```

## Testing Patterns

### 1. Structured Input/Output Testing

Uses clean `TestCase<TInput, TOutput>` interface for declarative test data:

```typescript
const testCases: TestCase<CreateAgentCommand, AgentApplicationResult<Agent>>[] = [
  {
    name: 'should create agent with valid data',
    input: { name: 'Test Agent', ownerId: UserId.fromString('user1') },
    expected: { success: true, data: expect.objectContaining({ name: 'Test Agent' }) }
  },
  {
    name: 'should fail with empty name',
    input: { name: '', ownerId: UserId.fromString('user1') },
    expected: { success: false, error: 'Agent name is required' }
  }
];

test.each(testCases)('$name', async ({ input, expected }) => {
  const result = await service.createAgent(input);
  expect(result).toEqual(expected);
});
```

### 2. Mock Factory Pattern

Consistent mock implementations for repositories:

```typescript
const mockAgentRepository = MockRepositoryFactory.createAgentRepository();
const mockAgent = MockEntityFactory.createAgent({ name: 'Test Agent' });
```

### 3. DDD-Focused Testing

- **Application Services**: Business logic, validation, orchestration
- **Domain Entities**: Business rules and invariants (existing)
- **Value Objects**: Validation and immutability
- **Mock Repositories**: Clean separation from infrastructure

## Test Scripts

```bash
# Run all tests
pnpm test

# Run only application service tests  
pnpm test:app-services

# Watch mode for development
pnpm test:app-services:watch  

# Coverage for application services
pnpm test:app-services:coverage

# Run specific test suites
pnpm test agents
pnpm test teams
pnpm test rag
```

## Coverage Goals

- **Application Services**: 90%+ coverage of business logic paths
- **Domain Entities**: 95%+ coverage of business rules
- **Happy Path**: All success scenarios tested
- **Error Handling**: All validation and failure scenarios covered

## Benefits

1. **DDD Alignment**: Tests reflect domain boundaries and business concepts
2. **Maintainable**: Clear separation between test data and setup logic
3. **Comprehensive**: Covers business logic, validation, and error scenarios
4. **Fast**: Pure unit tests with mocked dependencies
5. **Structured**: Consistent patterns across all test suites

## Examples

See the following files for implementation examples:
- `__tests__/application/services/agents/agent-application-service.test.ts`
- `__tests__/application/services/teams/team-application-service.test.ts`
- `__tests__/application/services/rag/rag-indexing-application-service.test.ts`