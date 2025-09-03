# Connection System Integration Test Plan

## Overview

This document outlines the comprehensive integration testing strategy for the DDD Connection System that replaces the legacy Pipedream integration. The test plan ensures full coverage of business logic, infrastructure integration, and API contracts.

## Test Architecture

### Layer-Based Testing Approach

```
Frontend Components
        ↓
Server Actions (API Layer)
        ↓
Application Services (Business Logic)
        ↓
Infrastructure Repositories (External APIs)
        ↓
Pipedream Connect API
```

Each layer has dedicated integration tests that verify:
- **Contract compliance** between layers
- **Error handling** and resilience 
- **Business rule enforcement**
- **Security and multi-tenancy**

## Test Suite Structure

### 1. Application Service Tests
**File**: `connection-application-service.integration.test.ts`

**Purpose**: Test core business logic and domain rule enforcement

**Coverage**:
- ✅ `getUserConnections()` - Connection retrieval and sorting
- ✅ `initiateConnection()` - OAuth flow initiation 
- ✅ `disconnectConnection()` - Connection termination
- ✅ `canUseApp()` - Authorization checks
- ✅ `getMissingConnections()` - Requirement validation
- ✅ `getConnectionSummary()` - Dashboard metrics
- ✅ `getConnectionStatus()` - Individual app status

**Key Test Patterns**:
- Uses TestCase interface for maintainable test scenarios
- Tests with real database integration (no mocking)
- Validates Value Object constraints and domain rules
- Ensures multi-tenant isolation through test contexts

### 2. Server Actions Tests  
**File**: `connections.integration.test.ts`

**Purpose**: Test API layer, authentication, and request/response handling

**Coverage**:
- ✅ `getUserOAuthConnections()` - Authentication + connection retrieval
- ✅ `getAppConnectionUrl()` - Input validation + URL generation
- ✅ `disconnectOAuthAccount()` - Authorization + disconnection
- ✅ `checkRequiredConnections()` - Batch requirement checking
- ✅ `getConnectionSummary()` - Dashboard data aggregation
- ✅ `canUseApp()` - Single app authorization

**Key Test Patterns**:
- Mocks authentication (requireAuth) for isolated testing
- Validates input parameter sanitization
- Ensures consistent Result type responses
- Tests error propagation from lower layers

### 3. Infrastructure Repository Tests
**File**: `pipedream-connection-repository.integration.test.ts`

**Purpose**: Test external API integration and data mapping

**Coverage**:
- ✅ `findByUserId()` - Pipedream API querying + connection mapping
- ✅ `findByUserAndApp()` - Filtered connection retrieval
- ✅ `generateConnectionUrl()` - OAuth URL generation with Pipedream tokens
- ✅ `disconnect()` - Connection removal via Pipedream API
- ✅ `hasActiveConnection()` - Connection status validation
- ✅ Connection mapping from Pipedream format to domain entities
- ✅ Error handling for API failures and malformed responses

**Key Test Patterns**:
- Tests actual Pipedream API integration (requires credentials)
- Validates resilience to external service failures  
- Ensures proper data transformation between formats
- Tests concurrent request handling

## Value Object Integration Testing

All test suites validate domain Value Objects:

### AppName Value Object
- ✅ Validation of supported apps ('gmail', 'slack', 'github', etc.)
- ✅ App name normalization ('google' → 'gmail', 'google-drive' → 'google-sheets')  
- ✅ Error handling for unsupported apps
- ✅ Empty string validation

### ConnectionId Value Object
- ✅ Pipedream account ID format validation
- ✅ Minimum length requirements (3+ characters)
- ✅ String type enforcement
- ✅ Construction from Pipedream responses

### UserId Value Object
- ✅ UUID format validation
- ✅ Integration with authentication system
- ✅ Multi-tenant context isolation

## Test Data and Isolation

### Test Context Pattern
Each test creates isolated test organizations:

```typescript
beforeEach(async () => {
  testContext = await createTestOrganization('Connection Test Org');
  // Fresh context prevents test interference
});
```

### Database Isolation
- **Context-aware database client** ensures RLS isolation
- **Superuser cleanup client** for test data removal
- **Unique identifiers** prevent concurrent test conflicts

## Error Handling Coverage

### Network and API Failures
- ✅ Pipedream API unavailability
- ✅ Network timeouts and connection issues
- ✅ Malformed API responses
- ✅ Rate limiting scenarios

### Validation Failures  
- ✅ Invalid app names and connection IDs
- ✅ Malformed user IDs and authentication tokens
- ✅ Missing required parameters
- ✅ Business rule violations

### Infrastructure Failures
- ✅ Database connection issues
- ✅ Missing environment variables
- ✅ DI container initialization failures

## Security and Multi-Tenancy

### Authentication Integration
- ✅ Server actions require valid authentication
- ✅ User session validation and context setting
- ✅ Authorization for connection management operations

### Multi-Tenant Isolation
- ✅ Users only see their own connections
- ✅ Cross-organization data leakage prevention
- ✅ RLS policy enforcement in database queries

## Performance Testing

### Concurrent Operations
- ✅ Multiple simultaneous connection requests
- ✅ Bulk connection status checking
- ✅ High-frequency connection URL generation

### Response Time Validation
- ✅ Connection listing under 2s for typical users
- ✅ OAuth URL generation under 1s
- ✅ Connection status checks under 500ms

## Environment Requirements

### Test Database
```bash
DATABASE_URL=postgresql://postgres:integration_test_password@localhost:5436/emery_integration_test
```

### Pipedream Credentials (Optional for Full Testing)
```bash
PIPEDREAM_PROJECT_ID=your_test_project_id
PIPEDREAM_CLIENT_ID=your_test_client_id
PIPEDREAM_CLIENT_SECRET=your_test_client_secret
```

### Running the Tests

#### Individual Test Suites
```bash
# Application service tests
pnpm test:integration tests/integration/services/connection-application-service.integration.test.ts

# Server actions tests  
pnpm test:integration tests/integration/actions/connections.integration.test.ts

# Infrastructure tests (requires Pipedream credentials)
pnpm test:integration tests/integration/infrastructure/pipedream-connection-repository.integration.test.ts
```

#### Full Connection System Test Suite
```bash
# Run all connection-related integration tests
pnpm test:integration --grep="Connection.*Integration"
```

## Test Coverage Metrics

### Business Logic Coverage
- ✅ 100% of application service public methods
- ✅ All domain value object validation rules
- ✅ Complete error handling paths
- ✅ Multi-tenant isolation scenarios

### API Contract Coverage  
- ✅ 100% of server action endpoints
- ✅ All input parameter combinations
- ✅ Authentication and authorization flows
- ✅ Consistent Result type responses

### Infrastructure Coverage
- ✅ All Pipedream API integration points
- ✅ Connection mapping and normalization
- ✅ External service failure scenarios
- ✅ Data consistency validation

## Maintenance and Evolution

### Adding New Apps
When adding support for new OAuth apps:

1. **Update Value Objects**: Add to `AppName.VALID_APPS`
2. **Update Mapper**: Add normalization rules if needed
3. **Add Test Cases**: Include in all relevant test suites
4. **Validate Integration**: Test with actual OAuth flow

### Extending Functionality
For new connection-related features:

1. **Domain First**: Add to application service with tests
2. **API Layer**: Expose through server actions with validation
3. **Infrastructure**: Implement repository methods as needed
4. **Integration**: Add end-to-end test scenarios

### Performance Monitoring
- Track test execution times for regression detection
- Monitor external API response times in infrastructure tests
- Validate memory usage under concurrent load scenarios

## Quality Gates

### Pre-Deployment Checklist
- ✅ All integration tests pass
- ✅ No test timeouts or flaky failures
- ✅ Error handling coverage > 95%
- ✅ Multi-tenant isolation verified
- ✅ Performance benchmarks met

### Regression Prevention
- ✅ TestCase pattern ensures stable test scenarios
- ✅ Value object tests prevent domain rule violations
- ✅ Infrastructure tests catch external API changes
- ✅ Authentication tests prevent security regressions

This comprehensive test plan ensures the Connection System maintains high quality, security, and performance while supporting the evolving needs of the Emery platform.