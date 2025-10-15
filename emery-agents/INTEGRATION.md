# gRPC Agent Worker Integration Guide

This guide shows how to integrate your frontend with the gRPC agent worker using fixed package versions for reliable testing.

## Overview

The emery-agents service provides gRPC-based agent execution with:
- **Fixed Package Versions**: Using `uv.lock` for reproducible builds
- **Streaming Progress**: Real-time task execution updates
- **Multi-tenant Support**: Organization-based worker routing
- **Container Testing**: Docker containers with fixed dependencies

## Quick Start

### 1. Start Test Container with Fixed Versions

```bash
# Build container with exact package versions from uv.lock
cd emery-agents
./scripts/test-container.sh build

# Start the test container
./scripts/test-container.sh start

# Check worker status
./scripts/test-container.sh test
```

### 2. Frontend Integration

Use the provided test client for frontend integration:

```typescript
import { AgentWorkerTestClient } from '@/lib/grpc/test-integration-client';

const client = new AgentWorkerTestClient({
  host: 'localhost',
  port: 50051,
  organizationId: 'your-org-id'
});

// Test connectivity
const workerInfo = await client.getWorkerInfo();
console.log('Worker capabilities:', workerInfo.capabilities);

// Execute task with streaming progress
const result = await client.executeTask({
  taskId: `task-${Date.now()}`,
  agentId: 1,
  instructions: 'Your task instructions here',
  agentConfig: {
    name: 'Your Agent Name',
    role: 'Assistant'
  },
  ownerId: 'user-123',
  name: 'Task Name'
}, (progress) => {
  console.log(`${progress.progressPercent}%: ${progress.status}`);
});
```

## Fixed Version Container Setup

### Why Use uv.lock for Fixed Versions?

The `uv.lock` file ensures:
- **Exact Reproducibility**: Same package versions across environments
- **Dependency Resolution**: All transitive dependencies locked
- **Security**: No unexpected package updates in production
- **Performance**: Faster installs with pre-resolved dependencies

### Container Architecture

```
emery-agents/
├── Dockerfile.test          # Test container with fixed versions
├── docker-compose.test.yml  # Test environment setup
├── uv.lock                  # Fixed package versions (642KB)
├── pyproject.toml          # Project configuration
└── scripts/
    └── test-container.sh    # Container management script
```

## Testing Workflow

### Container Management Commands

```bash
# Build with current uv.lock versions
./scripts/test-container.sh build

# Start test environment
./scripts/test-container.sh start

# Run integration tests
./scripts/test-container.sh test

# View container logs
./scripts/test-container.sh logs

# Stop containers
./scripts/test-container.sh stop
```

### Test Categories

The container supports multiple test categories:

1. **Unit Tests**: Fast tests with mocked dependencies
2. **Integration Tests**: Multi-component tests with real gRPC
3. **gRPC Tests**: Protocol buffer communication tests
4. **Real Execution Tests**: Full AI model execution (requires HF_TOKEN)

```bash
# Run specific test categories
docker-compose -f docker-compose.test.yml exec emery-agent-worker-test \\
  uv run pytest tests/ -v -m "integration"

# Run with AI models (set HF_TOKEN first)
HF_TOKEN=your_token ./scripts/test-container.sh test
```

## Frontend Integration Examples

### API Route Integration

```typescript
// app/api/agent/execute/route.ts
import { AgentWorkerTestClient } from '@/lib/grpc/test-integration-client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const client = new AgentWorkerTestClient({
    host: process.env.WORKER_HOST || 'localhost',
    port: parseInt(process.env.WORKER_ADDRESS || '50051'),
    organizationId: 'your-org'
  });

  try {
    const body = await request.json();
    
    // Execute task with progress streaming
    const result = await client.executeTask({
      taskId: body.taskId,
      agentId: body.agentId,
      instructions: body.instructions,
      agentConfig: body.agentConfig,
      ownerId: body.ownerId,
      name: body.name
    }, (progress) => {
      // Handle progress updates (could emit to SSE, WebSocket, etc.)
      console.log('Task progress:', progress);
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  } finally {
    client.close();
  }
}
```

### Server Action Integration

```typescript
// app/actions/agent-actions.ts
'use server'

import { AgentWorkerTestClient } from '@/lib/grpc/test-integration-client';

export async function executeAgentTask(formData: FormData) {
  const client = new AgentWorkerTestClient({
    host: process.env.WORKER_HOST || 'localhost',
    port: parseInt(process.env.WORKER_ADDRESS || '50051'),
    organizationId: process.env.ORGANIZATION_ID || 'default'
  });

  try {
    const result = await client.executeTask({
      taskId: formData.get('taskId') as string,
      agentId: parseInt(formData.get('agentId') as string),
      instructions: formData.get('instructions') as string,
      agentConfig: {
        name: formData.get('agentName') as string,
        role: formData.get('agentRole') as string
      },
      ownerId: formData.get('ownerId') as string,
      name: formData.get('taskName') as string
    }, (progress) => {
      // Progress updates in server actions require alternative approach
      // Consider using database updates or message queues for real-time updates
    });

    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    client.close();
  }
}
```

## Environment Configuration

### Development Environment

```bash
# .env.local (for development)
WORKER_HOST=localhost
WORKER_ADDRESS=50051
ORGANIZATION_ID=dev-org
HF_TOKEN=your_huggingface_token  # For AI model tests
```

### Production Environment

```bash
# Production environment variables
WORKER_HOST=your-production-worker.example.com
WORKER_ADDRESS=443  # Use 443 for TLS in production
ORGANIZATION_ID=prod-org
# TLS certificates would be configured here
```

## Package Version Management

### Updating Packages

```bash
# Update uv.lock with new package versions
cd emery-agents
uv lock --upgrade

# Rebuild container with new versions
./scripts/test-container.sh build

# Test with new versions
./scripts/test-container.sh test
```

### Version Pinning Strategy

The `pyproject.toml` uses semantic versioning:
```toml
dependencies = [
    "grpcio>=1.60.0",          # Allow patch updates
    "smolagents>=1.20.0",      # Allow minor updates
    "pydantic>=2.5.0",         # Allow minor updates
]
```

While `uv.lock` pins exact versions:
```
[[package]]
name = "grpcio"
version = "1.74.0"          # Exact version
```

## Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   # Check logs
   ./scripts/test-container.sh logs
   
   # Rebuild container
   ./scripts/test-container.sh build
   ```

2. **gRPC connection refused**
   ```bash
   # Check if worker is listening
   docker-compose -f docker-compose.test.yml exec emery-agent-worker-test netstat -tlnp | grep 50051
   
   # Test worker health
   ./scripts/test-container.sh test
   ```

3. **Package version conflicts**
   ```bash
   # Regenerate lock file
   uv lock --refresh
   
   # Rebuild container
   ./scripts/test-container.sh build
   ```

### Health Checks

The container includes health checks:

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \\
  CMD python -c "..." || exit 1
```

Monitor health status:
```bash
docker-compose -f docker-compose.test.yml ps
```

## Performance Considerations

### Container Startup Time
- **Cold start**: ~30-60 seconds (downloading models)
- **Warm start**: ~5-10 seconds (cached dependencies)

### Package Installation Speed
- **uv**: 2-5x faster than pip
- **Lock file**: Skip dependency resolution
- **Layer caching**: Reuse unchanged layers

### Memory Usage
- **Base container**: ~200MB
- **With AI models**: ~2-4GB (depending on model size)
- **Per task**: ~50-100MB additional

## Security Considerations

### Production Deployment

1. **Use TLS encryption** for gRPC in production
2. **Network isolation** with Docker networks
3. **Secret management** for API keys and tokens
4. **Resource limits** to prevent container abuse

```yaml
# Production docker-compose.yml additions
services:
  emery-agent-worker:
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
    restart: unless-stopped
```

## Next Steps

1. **Scale Testing**: Test with multiple concurrent tasks
2. **Load Testing**: Benchmark performance under load
3. **Production Deployment**: Set up TLS and production configs
4. **Monitoring**: Add metrics and logging
5. **CI/CD Integration**: Automated testing in pipelines

For more advanced usage, see the existing integration in `lib/grpc/client.ts` and `lib/grpc/chat-processing-client.ts`.