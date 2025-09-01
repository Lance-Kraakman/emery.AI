# Integration Testing Guidelines

## Quick Commands

```bash
# Run all integration tests
pnpm test:integration

# Run specific integration test suite
pnpm vitest tests/integration/services/clean-agent-service.integration.test.ts --config vitest.config.integration.ts --run

# Run with Docker containers (full integration)
NODE_ENV=test pnpm test:integration
```

## Integration Test Best Practices

### Test Application Services, Not Repositories

** Good - Test business logic through application services:**
```typescript
const agentApplicationService = getAgentApplicationService();
const result = await agentApplicationService.createAgent({
  name: 'Test Agent',
  ownerId: UserId.fromString('user-123'),
  organizationId: OrganizationId.fromNumber(1)
});
expect(result.success).toBe(true);
```

**L Avoid - Testing repositories directly:**
```typescript
const repository = getAgentRepository();
await repository.save(agent); // Skip this approach
```

### Use TestCase Interface Pattern

```typescript
interface TestCase<TInput, TOutput> {
  name: string;
  input: TInput;
  expected: TOutput;
}

const createAgentTestCases: TestCase<CreateAgentInput, CreateAgentOutput>[] = [
  {
    name: 'should create agent with valid input',
    input: { name: 'Test Agent', ownerId: UserId.fromString('user-123') },
    expected: { success: true }
  },
  {
    name: 'should reject empty agent name',
    input: { name: '', ownerId: UserId.fromString('user-123') },
    expected: { success: false, error: 'Agent name is required' }
  }
];
```

### Test Setup Patterns

**Use Application Services with Proper Context:**
```typescript
describe('Agent Application Service Integration Tests', () => {
  let testOrgId: number;
  let testUserId: string;

  beforeEach(async () => {
    // Create test organization using domain services
    const { createTestOrganization } = await import('../shared/test-setup');
    const context = await createTestOrganization('Test Organization');

  });

  afterEach(async () => {
    // Clean test data and clear context
    await testClient.cleanTestData();
  });
});
```

### Value Objects in Tests

**Always use domain value objects:**
```typescript
//  Good - Use value objects
const command: CreateAgentCommand = {
  name: 'Test Agent',
  ownerId: UserId.fromString('user-123'),
  organizationId: OrganizationId.fromNumber(1),
  role: 'assistant'
};

// L Avoid - Primitive types
const command = {
  name: 'Test Agent',
  ownerId: 'user-123',          // String instead of UserId
  organizationId: 1,            // Number instead of OrganizationId
  role: 'assistant'
};
```

### Test Organization and Isolation

**Create Fresh Context Per Test:**
```typescript
beforeEach(async () => {
  // Each test gets unique organization to prevent interference
  const context = await createTestOrganization('Test Organization');
  testOrgId = context.organizationId;
  testUserId = context.ownerUserId;
});
```

**Test Multi-Tenant Isolation:**
```typescript
test('should enforce organization boundaries', async () => {
  const org2Context = await createTestOrganization('Organization 2');
  
  // Create agent in org 1
  contextDb.setContext(testUserId, testOrgId);
  await agentService.createAgent(org1Command);
  
  // Create agent in org 2
  contextDb.setContext(org2Context.ownerUserId, org2Context.organizationId);
  await agentService.createAgent(org2Command);
  
  // Verify isolation - each org only sees its own agents
  const org1Agents = await agentService.getAgents(testOrgId);
  const org2Agents = await agentService.getAgents(org2Context.organizationId);
  
  expect(org1Agents.length).toBe(1);
  expect(org2Agents.length).toBe(1);
});
```

### Error Testing

**Test both success and failure paths:**
```typescript
test('should handle validation errors gracefully', async () => {
  const result = await agentApplicationService.createAgent({
    name: '', // Invalid empty name
    ownerId: UserId.fromString('user-123'),
    organizationId: OrganizationId.fromNumber(testOrgId)
  });
  
  expect(result.success).toBe(false);
  expect(result.error).toContain('Agent name is required');
  expect(result.data).toBeUndefined();
});
```

## Database Integration Testing

### Environment Setup

```bash
# Tests use dedicated Docker containers
DATABASE_URL=postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test
```

### RLS Context Testing

```typescript
// Test RLS behavior with proper context
const contextDb = getContextAwareDb();
contextDb.setContext(userId, organizationId);

// All subsequent operations automatically get RLS context
const result = await applicationService.performOperation();
```

## Common Patterns

### Testing Application Services

1. **Focus on business logic outcomes**
2. **Test complete workflows, not implementation details**  
3. **Use real database connections when possible**
4. **Test RLS isolation and security boundaries**
5. **Verify error handling and validation**

### File Organization

```
tests/integration/
  services/           # Application service integration tests
    clean-agent-service.integration.test.ts
    user-role-service.integration.test.ts
  database/          # Database-specific integration tests  
    simplified-rbac.integration.test.ts
  shared/            # Test utilities and setup helpers
    test-setup.ts
    integration-helpers.ts
```

### Minimal Mocking

- Use real database connections
- Test actual business workflows
- Mock only external services (APIs, file systems)
- Prefer integration over unit tests for application services

This approach ensures tests validate real business value rather than implementation details.