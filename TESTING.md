# Emery Testing Guide

This guide covers testing the complete agent execution pipeline in Emery, from seeding test data to running end-to-end tests.

## Quick Start

```bash
# 1. Seed test data (required first step)
pnpm seed:test

# 2. Start the development server  
pnpm dev

# 3. Start the agent worker (in another terminal)
cd emery-agents && ./scripts/start-test-server.sh

# 4. Run agent execution tests
pnpm test:agent-execution
```

## Test Data Setup

### Seeding Test Data

The seed script creates a complete testing environment:

```bash
# Create test data for the first time
pnpm seed:test

# Clean and recreate all test data
pnpm seed:clean
```

**What gets created:**
- **Test User**: `test@emery.dev` with ID `550e8400-e29b-41d4-a716-446655440000`
- **Test Organization**: "Test Organization" with full permissions
- **Test Agents**: Multiple agents with different capabilities and configurations
- **Test Capabilities**: Built-in test capabilities for infrastructure validation
- **Test Database Tables**: Sample dynamic tables with test data

### Manual Database Reset

If you need to completely reset the database:

```bash
# Stop all services first
docker-compose down

# Remove database volume (loses ALL data)
docker volume rm emery_db

# Restart database
docker-compose up -d

# Run migrations
pnpm db:migrate

# Seed test data
pnpm seed:test
```

## Agent Execution Testing

### Prerequisites

1. **Database Running**: `docker-compose up -d`
2. **Migrations Applied**: `pnpm db:migrate`
3. **Test Data Seeded**: `pnpm seed:test`
4. **Next.js Server**: `pnpm dev`
5. **Agent Worker**: `cd emery-agents && ./scripts/start-test-server.sh`

### Running Tests

#### Basic Agent Execution Test

```bash
# Test agent ID 1 (default)
pnpm test:agent-execution

# Test specific agent
pnpm test:agent-execution 2
```

**What this tests:**
- Agent capabilities discovery
- Agent execution via gRPC
- OAuth proxy functionality (with graceful failure if no connections)
- End-to-end pipeline validation

#### Component Testing

```bash
# Test gRPC communication
pnpm test:grpc

# Test Next.js to gRPC integration
pnpm test:nextjs-grpc

# Test scheduler system
pnpm test:scheduler
```

### Test Capabilities

The system includes built-in test capabilities that work without complex AI logic:

- **`test_capability`**: Basic infrastructure validation
- **`ping`**: Simple ping/pong test
- **`health_check`**: System health validation with tools

These capabilities automatically return successful responses for testing purposes.

## OAuth and Connections Testing

### Frontend Authentication Testing

#### Email Sign-In (for Test Users)
1. **Start all services** (includes MailHog):
   ```bash
   docker-compose up -d
   ```
2. **Visit sign-in page**: `http://localhost:3000/auth/signin`
3. **Enter test email**: `test@emery.dev`
4. **Check MailHog**: `http://localhost:8025` to see the magic sign-in link
5. **Click the link** to sign in

#### OAuth Testing
1. **Start the development server**: `pnpm dev`
2. **Visit connections page**: `http://localhost:3000/connections`
3. **Connect OAuth accounts**: Gmail, Slack, GitHub, etc.
4. **Test disconnection**: Ensure you can disconnect and reconnect

### OAuth Proxy Testing

The OAuth proxy can be tested directly with agent API keys:

```bash
# Get agent API key from seed output or database
curl -X POST "http://localhost:3000/api/agents/proxy" \
  -H "Authorization: Bearer YOUR_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "gmail",
    "action": "send_email", 
    "params": {
      "to": "test@example.com",
      "subject": "Test",
      "body": "Hello"
    }
  }'
```

## Development Authentication

### Test User Authentication

For development testing, the system supports a test user bypass:

**Test User ID**: `550e8400-e29b-41d4-a716-446655440000`

This can be used in API requests via the `x-test-user-id` header:

```bash
curl -H "x-test-user-id: 550e8400-e29b-41d4-a716-446655440000" \
  http://localhost:3000/api/agents
```

**Important**: This bypass only works in development mode and should be removed in production.

## Agent Configuration

### Test Agent Capabilities

The seeded agents include various test configurations:

```json
{
  "name": "test_capability",
  "description": "Test capability for infrastructure validation",
  "steps": [
    {
      "id": "test_step_1",
      "type": "TOOL_STEP", 
      "instructions": "Return success response with trigger data",
      "tools": [],
      "servers": []
    }
  ]
}
```

### Adding Custom Test Agents

You can modify `scripts/seed-test-data.ts` to add custom agent configurations:

```typescript
const CUSTOM_AGENT = {
  name: 'Custom Test Agent',
  description: 'My custom test agent',
  capabilities: [
    // Your custom capabilities
  ],
  tools: [
    // Your custom tools
  ]
};
```

## Troubleshooting

### Common Issues

**Database Connection Errors**
```bash
# Check if database is running
docker-compose ps

# Check database logs
docker-compose logs db
```

**Agent Worker Not Responding**
```bash
# Check if gRPC server is running
cd emery-agents && ps aux | grep python

# Restart the worker
cd emery-agents && ./scripts/start-test-server.sh
```

**OAuth Connection Issues**
- Ensure `PIPEDREAM_*` environment variables are set
- Check Pipedream Connect configuration
- Verify webhook URLs are accessible

**Test Data Issues**
```bash
# Clean and recreate test data
pnpm seed:clean

# Check database contents
pnpm db:studio
```

### Debug Logging

Enable debug logging for detailed execution traces:

```bash
# Enable debug logging
export DEBUG=emery:*

# Run tests with verbose output
pnpm test:agent-execution
```

## CI/CD Testing

### Automated Testing

For CI/CD pipelines, use the following sequence:

```bash
# Setup
docker-compose up -d
pnpm db:migrate
pnpm seed:test

# Test
pnpm build
pnpm test:agent-execution

# Cleanup
docker-compose down
```

### Test Data Validation

Verify test data integrity:

```bash
# Check test user exists
npx tsx -e "
import { db } from './lib/db/client';
import { users } from './lib/db/schema';
import { eq } from 'drizzle-orm';

const testUser = await db.select().from(users)
  .where(eq(users.id, '550e8400-e29b-41d4-a716-446655440000'));
console.log('Test user:', testUser.length > 0 ? 'EXISTS' : 'MISSING');
"
```

## Production Considerations

### Security

- **Remove test user bypass** in production
- **Use proper authentication** for all API endpoints
- **Secure agent API keys** with proper rotation
- **Validate webhook signatures** for external integrations

### Performance

- **Database connection pooling** is configured for production load
- **gRPC worker scaling** can be implemented with multiple instances
- **OAuth token caching** reduces external API calls

### Monitoring

- **Agent execution metrics** via logging and monitoring
- **Database performance** monitoring for dynamic operations
- **OAuth connection health** checks for service availability

## Next Steps

1. **Run the complete test suite** to verify everything works
2. **Connect real OAuth accounts** for full integration testing
3. **Create custom agents** for your specific use cases
4. **Monitor execution logs** to understand the pipeline
5. **Scale testing** with multiple concurrent agents

For additional help, check the main project documentation in `CLAUDE.md`.