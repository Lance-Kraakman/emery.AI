# Integration Testing with Vitest & Docker Containers

## Overview

Unified Vitest-based integration testing system that runs against real Docker containers, providing practical testing of the complete system stack.

## Quick Start

```bash
# Check if integration test ports are available
./tests/check-ports.sh

# Run integration tests (starts containers automatically)
pnpm test:integration

# Watch mode for development
pnpm test:integration:watch

# Clean containers and run fresh tests
pnpm test:integration:clean

# Run all tests (unit + integration)
pnpm test:all
```

## Architecture

### Container Isolation
- **Separate ports**: `5436` (DB), `3002` (App), `50053` (Agent), `50054` (Table Services)
- **Isolated network**: `integration-test-network`
- **Clean volumes**: Dropped between test runs
- **Environment**: Uses `.env.local.test` for configuration

### Test Structure
```
tests/integration/
├── vitest.config.integration.ts    # Vitest configuration
├── global-setup.ts                 # Container lifecycle management
├── setup.ts                        # Database setup/cleanup per test file
├── shared/
│   ├── test-case.ts                # Standardized TestCase<TInput, TOutput>
│   └── integration-helpers.ts      # HTTP/gRPC/Database clients
├── api/                            # API endpoint integration tests
├── database/                       # Database operation tests (RLS, etc.)
└── e2e/                           # End-to-end workflow tests
```

### Test Categories

#### **API Integration Tests** (`api/`)
- HTTP endpoint testing with real database
- CRUD operations with actual data persistence
- Authentication and authorization flows
- Uses `TestCase<TInput, TOutput>` pattern for clean test data

#### **Database Integration Tests** (`database/`)
- Row Level Security (RLS) multi-tenant isolation
- Direct database operations and migrations
- Vector search and RAG functionality
- PostgreSQL feature testing (pgvector, etc.)

#### **End-to-End Workflow Tests** (`e2e/`)
- Complete user journeys across multiple services
- Agent creation → configuration → task execution
- Multi-agent coordination scenarios
- Error recovery and cleanup workflows

## Container Management

### Automatic Container Lifecycle
```typescript
// Global setup handles container orchestration
export async function setup() {
  // 1. Clean previous containers & volumes
  // 2. Start fresh containers with force-recreate
  // 3. Wait for health checks
  // 4. Run database migrations
  // 5. Set environment variables for tests
}

export async function teardown() {
  // Always cleanup volumes for clean state
}
```

### Health Checks & Dependencies
- **PostgreSQL**: `pg_isready` health check
- **Next.js App**: `/api/health` endpoint check
- **Agent Worker**: gRPC connection test
- **Migration Dependency**: Migrations run after containers are healthy

### Port Allocation
- **Main Dev**: `5433` (DB), `3000` (App), `50051` (Agent)
- **RLS Tests**: `5434` (DB only)
- **Integration**: `5436` (DB), `3002` (App), `50053` (Agent), `50054` (Table Services)

## Test Patterns

### Standardized TestCase Interface
```typescript
interface CreateAgentInput {
  organizationId: number;
  name: string;
  role?: string;
}

interface AgentResponse {
  success: boolean;
  status: number;
  data?: { id: number; name: string };
  error?: string;
}

const testCases: TestCase<CreateAgentInput, AgentResponse>[] = [
  {
    name: 'should create agent with valid data',
    input: { organizationId: 1, name: 'Test Agent' },
    expected: { 
      success: true, 
      data: expect.objectContaining({ name: 'Test Agent' })
    }
  }
];

test.each(testCases)('$name', async ({ input, expected }) => {
  const result = await testClient.post('/api/agents', input);
  expect(result).toEqual(expected);
});
```

### Integration Test Client
```typescript
export class IntegrationTestClient {
  // HTTP API operations
  async post(endpoint: string, data: any): Promise<any>
  async get(endpoint: string): Promise<any>
  
  // Direct database operations
  async query(sql: string, params?: any[]): Promise<any[]>
  
  // Test data management
  async seedBasicTestData(): Promise<void>
  async cleanTestData(): Promise<void>
}
```

## Benefits

1. **Unified Testing**: Same Vitest runner for unit and integration tests
2. **Real Environment**: Tests against actual containers that match production
3. **Clean State**: Fresh containers and data for every test run
4. **Standardized**: Same `TestCase` pattern as application service tests
5. **Isolated**: No interference with development containers
6. **Fast Development**: Watch mode with container persistence
7. **CI/CD Ready**: Deterministic, isolated test environment

## Debugging

```bash
# Check container status
docker ps | grep integration

# View container logs
docker logs emery-integration-db
docker logs emery-integration-app
docker logs emery-integration-agent

# Connect to test database
PGPASSWORD=integration_test_password psql -h localhost -p 5436 -U postgres -d emery_integration_test

# Test app health
curl http://localhost:3002/api/health

# Manual container cleanup
docker-compose -f tests/docker-compose.integration.yml down -v
```

## Migration from Old Tests

This system replaces:
- ❌ `tests/run_integration_tests.sh` scripts
- ❌ Scattered test scripts in various folders  
- ❌ `tests/rls/` Python-based tests (will be ported)

All integration testing now uses:
- ✅ Unified Vitest runner
- ✅ Standardized `TestCase` patterns
- ✅ Single `pnpm test:integration` command
- ✅ Proper container lifecycle management