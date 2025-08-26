# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emery is a Baserow-style dynamic database builder that allows users to create tables, fields, and manage data at runtime. It implements a hybrid architecture using both static and dynamic schemas with agent automation and OAuth integration.

## Core Architecture

### Dual Schema Approach
- **Static Schema** (`lib/db/schema.ts`): Drizzle ORM manages metadata (organizations, tables, fields, users, agents)
- **Dynamic Tables**: Runtime creation using raw SQL with `field_{id}` column naming pattern

### Key Patterns
- **Database**: Drizzle ORM (static) + raw postgres client (dynamic operations)
- **Column Naming**: `field_{id}` format where `id` is the field's database ID
- **JSONB Relations**: With GIN indexes for performance, UUID primary keys
- **RBAC System**: Organizations → Roles → Permissions hierarchy
- **Agent System**: Agents use owner's OAuth credentials via Pipedream Connect
- **AI Models**: HuggingFace Qwen series (chat, code generation, embeddings)

### Critical Files
- `lib/db/schema.ts`: Static schema definitions with Drizzle ORM
- `lib/db/client.ts`: Database connection and configuration
- `lib/auth.ts`: NextAuth v4 with RBAC integration
- `lib/pipedream/`: OAuth credential delegation components
- `lib/agents/`: Agent type configurations and tools registry

## Development Commands

```bash
# Database
pnpm db:generate    # Generate Drizzle migrations
pnpm db:migrate     # Apply migrations
pnpm db:studio      # Database inspection

# Development
pnpm dev           # Start Next.js server
pnpm build         # Production build
pnpm lint          # Run ESLint

# Docker
docker-compose up -d              # Start PostgreSQL with pgvector
docker-compose down               # Stop database
docker volume rm emery_db         # Reset database
```

## Environment Setup

Copy `.env.example` to `.env.local`. Database runs on port 5433 to avoid conflicts.

### Required Environment Variables
```bash
# HuggingFace AI Models
HF_TOKEN=your_token  # Get from https://huggingface.co/settings/tokens

# Pipedream OAuth Integration  
PIPEDREAM_PROJECT_ID=your_project_id
PIPEDREAM_CLIENT_ID=your_client_id
PIPEDREAM_CLIENT_SECRET=your_client_secret
PIPEDREAM_API_KEY=your_api_key

# NextAuth
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
```

### AI Models Used
- **Chat**: `Qwen/Qwen2.5-Coder-14B-Instruct` (code generation)
- **General**: `Qwen/Qwen2.5-14B-Instruct` (reasoning)
- **Fast**: `Qwen/Qwen2.5-Coder-7B-Instruct` (quick responses)
- **Embeddings**: `sentence-transformers/all-mpnet-base-v2`

## Field Types & Data Flow

### Supported Field Types
- `text`, `number`, `boolean`, `date`: Standard SQL columns
- `email`, `url`: TEXT with UI validation
- `relation`: JSONB columns with GIN indexes

### Dynamic Column Management
1. Field metadata stored in static `fields` table
2. `addFieldToTable()` creates `field_{id}` column in dynamic table
3. JSONB fields get automatic GIN indexes

### Row Operations Flow
1. API receives data keyed by field slug/name
2. Backend maps to `field_{id}` column names using metadata
3. JSONB fields parsed from JSON strings if needed
4. Raw postgres client handles parameterized queries

### Authentication & Authorization
- **NextAuth v4**: OAuth providers (GitHub, Google) with DrizzleAdapter
- **RBAC**: Organizations → Roles → Permissions hierarchy
- **Initial Setup**: First user becomes Super Admin
- **Permission Levels**: Super Admin, Admin, Editor, Viewer

## OAuth Proxy Service with Pipedream Connect

### Architecture Overview
- **OAuth Credential Delegation**: Agents execute actions using owner's connected OAuth accounts
- **No Local Token Storage**: OAuth credentials managed through Pipedream Connect
- **Universal Proxy**: Single endpoint (`/api/agents/proxy`) supporting any OAuth service
- **Agent Ownership**: Strict verification - agents only use owner's credentials

### Core Components
- `lib/pipedream/`: Client, user management, agent execution, connection mapping
- OAuth connections managed through Pipedream Connect UI
- **Supported Services**: Gmail, Slack, GitHub, Google Sheets, Discord, Twitter

### API Routes
- `/api/agents/[id]/execute`: Execute actions with webhook support
- `/api/agents/[id]/capabilities`: Get capabilities and connected services
- `/api/agents/proxy`: Universal OAuth proxy

### Python Backend Integration
```
backend/src/emery_client/
├── client.py          # Full client with webhook support
├── simple_client.py   # Minimal OAuth proxy client
├── gmail.py          # Integration examples
└── types.py          # Type definitions
```

### Authentication
- **Development**: Test user ID `550e8400-e29b-41d4-a716-446655440000` via `x-test-user-id` header
- **Production Options**: API keys (recommended), OAuth App-to-App, Agent API keys

### OAuth Connection Flow
1. User clicks "Connect" → Server creates Pipedream token
2. User redirects to Pipedream Connect → Completes OAuth
3. Pipedream redirects back → UI refreshes connections
4. Agents can now use owner's connected accounts

### Key Features
- **Webhook Integration**: Async execution with HMAC signature verification
- **Service Discovery**: Runtime discovery of available services/actions
- **Security**: OAuth delegation, parameter binding, ownership verification

## Development Workflows

### Adding New Field Types
1. Update field type definitions in `lib/db/schema.ts`
2. Add UI input component in table editor components
3. Update API parsing in `app/api/rows/route.ts`

### Database Schema Changes
1. Modify `lib/db/schema.ts`
2. Run `pnpm db:generate` and `pnpm db:migrate`
3. Reset if needed: `docker-compose down && docker volume rm emery_db`

### Testing Complete System
```bash
# Fresh setup
docker-compose down && docker volume rm emery_db && docker-compose up -d
pnpm db:migrate && pnpm dev

# Integration flow
# 1. OAuth login → create organization → create table → add fields → add rows
# 2. Create agent → connect OAuth accounts via /dashboard/connections
# 3. Test agent execution via Python client or API
```

### Testing OAuth Proxy
```bash
# Python integration testing
uv run scripts/test_integration.py <agent_id>
pnpm test:agent-api <agent_id>

# Manual API testing
curl -X GET "http://localhost:3000/api/agents/<agent_id>/capabilities" \
  -H "Authorization: Bearer <agent_api_key>"
```

## Domain-Driven Design (DDD) Architecture

### Folder Structure
```
/ddd/
├── domain/              # Pure domain logic - NO infrastructure dependencies
│   ├── [domain]/
│   │   ├── entities/    # Domain entities with business rules
│   │   ├── value-objects/ # Immutable value objects with validation
│   │   ├── repositories/ # Repository INTERFACES only
│   │   ├── services/    # Domain service INTERFACES only
│   │   └── events/      # Domain events
│
├── application/         # Application services - orchestration layer
│   ├── [domain]/
│   │   ├── services/    # Application services that orchestrate domain operations
│   │   ├── commands/    # Command objects with validation
│   │   ├── queries/     # Query objects with validation
│   │   └── use-cases/   # Focused business operation Use Cases
│
└── infrastructure/      # External integrations and concrete implementations
    ├── db/repositories/ # Database repository implementations
    └── external/        # External service integrations (APIs, file processors)
```

### DDD Anti-Patterns to Avoid

❌ **No legacy wrapper classes for "backwards compatibility"**:
- If migrating patterns, just migrate them - don't maintain both
- Use direct exports: `export const myService = new MyService()`

❌ **No lazy singleton patterns with private statics**:
- Export configured instances directly
- Avoids unnecessary if-checks and private field management

❌ **No Value Object conversions for internal operations**:
- Use domain entities directly in internal service calls
- Value Objects are for external API boundaries only

### DDD Layer Rules

#### Domain Layer (`/ddd/domain/`)
- **MUST contain ONLY**: Interfaces, domain entities, value objects, domain events, pure domain logic
- **MUST NOT contain**: Infrastructure dependencies, concrete implementations, framework-specific code

#### Application Layer (`/ddd/application/`)
- **Orchestrates**: Domain operations, transaction management, security/authorization
- **Contains**: Application services, Command/Query handlers, DTOs, Use Cases

#### Infrastructure Layer (`/ddd/infrastructure/`)
- **Implements**: Domain interfaces, database repositories, external service integrations
- **Organization**: `/infrastructure/db/repositories/[domain]/`, `/infrastructure/external/[service]/`

### Import Rules
- **Domain → Domain**: ✅ Allowed
- **Application → Domain**: ✅ Allowed  
- **Infrastructure → Domain/Application**: ✅ Allowed
- **Domain → Application/Infrastructure**: ❌ FORBIDDEN
- **Application → Infrastructure**: ❌ FORBIDDEN (use DI container)

### Naming Conventions
- **Repositories**: `RagIndexRepository` (domain interface), `DrizzleRagIndexRepository` (infrastructure)
- **Services**: `ContentProcessor` (domain), `RagIndexingApplicationService` (application)
- **Value Objects**: `RagIndexId`, `OrganizationId` (always with validation)
- **Entities**: `RagIndex`, `RagDocument` (with business rules)

### 2025 DDD Implementation Status ✅
- **Folder Structure**: Proper `/ddd/domain/`, `/application/`, `/infrastructure/` organization
- **Value Objects**: Type-safe IDs (`AgentId`, `UserId`, `TeamId`, `TaskId`, `OrganizationId`)
- **Domain Services**: `MeasurementAnalysisService`, `ProcessOptimizationService`, `AnalysisCoordinationService`
- **Use Cases**: Focused business operations (`CreateAgentUseCase`)
- **Schema Type Safety**: Replaced `$type<any>()` with proper TypeScript types
- **Benefits**: Type safety, business logic encapsulation, clear boundaries, maintainability

### Example DDD Patterns

#### Value Objects
```typescript
export class AgentId {
  constructor(private readonly _value: number) {
    if (!Number.isInteger(_value) || _value <= 0) {
      throw new Error('AgentId must be a positive integer');
    }
  }
  get value(): number { return this._value; }
  equals(other: AgentId): boolean { return this._value === other._value; }
}
```

#### Use Cases
```typescript
export class CreateAgentUseCase {
  async execute(request: CreateAgentRequest): Promise<Result<CreateAgentResponse>> {
    // 1. Validate business rules
    // 2. Delegate to Application Service for orchestration
  }
}
```

#### Repository Pattern
```typescript
// Domain interface
export interface RagIndexRepository {
  findById(id: RagIndexId): Promise<RagIndex | null>;
  save(index: RagIndex): Promise<void>;
}

// Infrastructure implementation  
export class DrizzleRagIndexRepository implements RagIndexRepository {
  // Actual database operations
}
```

## NextJS Component Architecture

### When to Use Each Pattern

**Server Actions**: App Router internal actions, type-safe DB logic, form submissions
**API Routes**: HTTP endpoints for external clients, custom responses, independent testing
**Server Components**: No interactivity, server-side data fetching, better performance
**Client Components**: Interactivity (onClick, useState), browser APIs, real-time updates

## Testing & Code Quality

### Pre-commit Testing (MANDATORY)
```bash
# Run focused tests
uv run python -m pytest tests/test_module_name.py -v

# Run all tests
uv run python -m pytest tests/ -v

# With coverage
uv run python -m pytest tests/ --cov=src/emery_agents --cov-report=term-missing
```

**Process**: Make changes → run relevant tests → run full suite → fix failures → commit only when all pass

**Guidelines**: Focused unit tests, pytest fixtures, mock external dependencies, test success/error cases

### Python Code Quality Standards

**Structure:**
- All imports at top, type hints on all functions, fail fast on dependencies
- Use @dataclass for structured data, TypedDict for result dictionaries
- Functions under 50 lines, single responsibility principle

**Types:**
```python
@dataclass
class TaskConfig:
    name: str
    instructions: str
    timeout: int = 30

class ExecutionResult(TypedDict, total=False):
    status: str
    result: Optional[Any]
    error: Optional[str]
```

**Anti-patterns to Avoid:**
- Dict[str, Any] instead of @dataclass
- Untyped function parameters/returns
- Generic exception handling without context
- Magic numbers, hard-coded paths
- Multiple loose parameters (use @dataclass)

## Implementation Details

### Error Handling & Performance
- **Database**: Raw SQL with parameter binding, GIN indexes for JSONB fields
- **OAuth Proxy**: Comprehensive error propagation, token caching, async processing
- **Webhooks**: HMAC signature verification, graceful failure handling

### Security & Data Consistency
- **Authentication**: OAuth credentials delegated through Pipedream (never stored locally)
- **RBAC**: Permissions enforced at API/UI levels, strict agent ownership verification
- **Data Integrity**: Field deletions cascade through metadata and dynamic columns

## Frontend Architecture (2025-01 Refactor)

### Component Improvements
- **Major Refactoring**: RowManager (394→84 lines), extracted `FieldInput`, `CellRenderer`, `RowForm`, `RowTable`
- **Custom Hooks**: `useRowManager` for state management, `useEmeryData` for caching
- **Dead Code Removal**: Deleted unused components, cleaned directories, removed unused imports

### Design System Standardization
- **shadcn/ui Components**: Standardized `Button`, `Input`, `Card`, `Table` components
- **Design Tokens**: Replaced hardcoded colors with semantic tokens (`bg-primary`, `text-foreground`)
- **Utility Components**: Added `FormField`, `EmptyState`, `Loading`, `LoadingOverlay`
- **Button Variants**: `success`, `destructive`, `outline`, `ghost`

### Benefits Achieved
- **Maintainability**: Single source of truth, consistent styling, clear separation
- **Developer Productivity**: Reusable components, type safety, easier testing
- **User Experience**: Consistent interactions, accessibility, performance improvements

## Agent Scheduler & gRPC Executor (2025-01)

### Simplified Execution Architecture

#### Agent Execution System
- **Simplified Architecture**: Unified agent execution pattern
- **JSONB Instructions**: Database field storing `{instructions, tools[], servers[], metadata}`
- **Real-time Progress**: Streaming provides step-by-step execution updates

#### Agent Scheduler (`lib/scheduler/agent-scheduler.ts`)
- **Auto Processing**: `processPendingTasks()` runs every minute (up to 10 tasks/cycle)
- **Manual Execution**: `processPendingTasksManually()` for immediate execution
- **Trigger Types**: CRON, DATABASE_EVENT, WEBHOOK, MANUAL
- **Dynamic Discovery**: Automatically detects new/updated/deleted agents

#### Legacy Pattern Removal
- ❌ Removed `triggerData` fallbacks, `stepOverrides`, `executeAgentCapabilityViaGRPC()`
- ❌ Capability-specific routing (now handled by smolagents hierarchy)

#### API Endpoints
- `/api/agents/[id]/execute` - Direct execution with tools/servers
- `/api/scheduler/webhook` - Webhook triggers

#### Task Schema
```sql
tasks.instructions JSONB: {
  instructions: string,     -- Main task description
  tools: ToolConfig[],     -- Optional tool configurations
  servers: ServerConfig[], -- Optional server configurations  
  metadata: object         -- Execution context (trigger_type, user_id, etc.)
}
```

### AIDEV Anchor Comments
Use searchable comments for inline documentation: `AIDEV-NOTE:`, `AIDEV-TODO:`, `AIDEV-QUESTION:`