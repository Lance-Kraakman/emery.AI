# Fixed Version Agent Worker for Testing

Quick setup to use the emery-agents worker with fixed package versions in your test environment.

## Quick Start

### 1. Build Fixed Version Agent Worker

```bash
# Build agent worker with fixed versions from uv.lock
cd emery-agents
./scripts/build-fixed-version.sh

# Or build with specific version tag
./scripts/build-fixed-version.sh v2025.01.02
```

### 2. Start Test Environment

```bash
# Start test services (uses existing .env.local.test configuration)
./scripts/test-env.sh start

# Or start with specific agent worker version
./scripts/test-env.sh start --version v2025.01.02
```

### 3. Test Integration

```bash
# Run integration tests
./scripts/test-env.sh test

# Or run specific gRPC test
npx tsx scripts/test-grpc-integration.ts
```

## What This Gives You

✅ **Fixed Package Versions**: Uses `uv.lock` to ensure exact same dependencies every time  
✅ **Isolated Test Environment**: Separate ports/databases from development (matches your `.env.local.test`)  
✅ **Easy Integration**: Works with your existing frontend code  
✅ **Version Tracking**: Built images include metadata about package versions  

## Port Configuration (matches .env.local.test)

- **Database**: `localhost:5436` 
- **Agent Worker**: `localhost:50053`
- **MinIO**: `localhost:9005`
- **Frontend** (optional): `localhost:3002`

## Usage Examples

### Frontend Integration

```typescript
// Your existing client works, just point to test port
const client = new AgentWorkerTestClient({
  host: 'localhost',
  port: 50053,  // Test port from .env.local.test
  organizationId: 'test-org'
});

const result = await client.executeTask({...});
```

### Environment Variables

The test environment uses your existing `.env.local.test` file, so everything should work out of the box with your current configuration.

## Commands

```bash
./scripts/test-env.sh build                    # Build fixed version image
./scripts/test-env.sh start                    # Start test environment  
./scripts/test-env.sh test                     # Run integration tests
./scripts/test-env.sh logs                     # View logs
./scripts/test-env.sh stop                     # Stop test environment
./scripts/test-env.sh clean                    # Clean up everything
```

That's it! The setup respects your existing `.env.local.test` configuration and provides fixed, reproducible agent worker versions for testing.