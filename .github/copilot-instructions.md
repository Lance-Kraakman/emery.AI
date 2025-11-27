# Emery.AI Copilot Instructions

## Project Architecture
- **Frontend**: Next.js application with TypeScript
- **Backend Services**: Python microservices (emery-agents) using gRPC
- **Database**: PostgreSQL with pgvector (Drizzle ORM)
- **Testing**: Vitest for TypeScript, pytest for Python

## Critical Commands
```bash
# Development
pnpm dev  # Start Next.js dev server
pnpm worker:start  # Start Python gRPC agent worker
pnpm grpc:generate  # Regenerate protobuf code

# Database
docker-compose up -d  # Start PostgreSQL + pgvector
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate  # Apply migrations

# Testing
pnpm test:integration:server  # Start test containers (60-120s)
pnpm test:integration:dev  # Fast tests against running server
cd emery-agents && uv run pytest tests/  # Run Python tests
```

## Key Patterns

### TypeScript
1. **TestCase Pattern**: Use interface-based test cases as shown in `CLAUSE.md`
2. **DDD Patterns**: Follow domain-driven design principles (entities, value objects)
3. **gRPC Integration**: All gRPC calls should use the generated protobuf client

### Python (emery-agents)
1. **Simple DDD Architecture**:
   - Domain: Entities with business logic (`domain/agents/entities`)
   - Application: Services for orchestration (`application/services`)
   - Infrastructure: Repository implementations (`infrastructure/db/repositories`)
2. **Mutable Entities**: Follow TypeScript patterns (entities can change state)
3. **No Value Objects**: Use simple types (`int`, `str`) for IDs

## Workflow Tips
1. **Persistent Testing**: Use `test:integration:server` to avoid container restarts
2. **Environment**: Always set `DATABASE_URL=postgresql://postgres:dashlet@localhost:5433/emery`
3. **Code Generation**: Run `grpc:generate` after changing `.proto` files
4. **Frontend Development**: Use `docker-compose -f src/tests/docker-compose.integration.yml up -d --build app-integration` for local development (maps to `localhost:3002`)

## Key Files
- `proto/agent_worker.proto`: gRPC service definitions
- `drizzle.config.ts`: Database schema configuration
- `emery-agents/src/emery_agents/domain/agents/entities/agent.py`: Core domain entity
- `src/lib/auth.ts`: Authentication utilities