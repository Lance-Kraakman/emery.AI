# System Architecture Overview

**Last Updated:** 2025-01-27

## Overview

Orchastrate is a full-stack platform that enables users to build custom applications with AI-powered agents. The system consists of three main layers:

1. **Frontend Layer** (TypeScript/Next.js)
2. **Backend Services** (TypeScript/Next.js API routes)
3. **Agent Execution Layer** (Python/gRPC)

## Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14, React, TailwindCSS | User interface, app builder |
| API | Next.js API Routes | REST endpoints, authentication |
| Database | PostgreSQL, Prisma | Data persistence |
| Agent Runtime | Python, DSPy, smolagents | LLM orchestration |
| IPC | gRPC | Frontend ↔ Agent communication |
| File Storage | S3-compatible | Document/file storage |

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐  │
│  │   App Builder │ │  Chat UI      │ │   Workspace Manager   │  │
│  │   (Puck)      │ │               │ │                       │  │
│  └───────────────┘ └───────────────┘ └───────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js Routes)                    │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────────────┐  │
│  │ /api/apps     │ │ /api/chat     │ │ /api/workspace        │  │
│  │ /api/pages    │ │ /api/agents   │ │ /api/databases        │  │
│  │ /api/skills   │ │ /api/views    │ │ /api/tables           │  │
│  └───────────────┘ └───────────────┘ └───────────────────────┘  │
└────────────┬────────────────────────────────────────────────────┘
             │                              │
             │ Prisma ORM                   │ gRPC
             ▼                              ▼
┌────────────────────────┐    ┌────────────────────────────────────┐
│     PostgreSQL         │    │     Agent Worker (Python)          │
│  ┌──────────────────┐  │    │  ┌──────────────────────────────┐  │
│  │ Organizations    │  │    │  │ gRPC ChatProcessingService   │  │
│  │ Apps, Pages      │  │    │  │ ExecutionCoordinator         │  │
│  │ Agents, Skills   │  │    │  │ PlannerModule (DSPy)         │  │
│  │ Databases,Tables │  │    │  │ StepExecutor                 │  │
│  │ Chat Sessions    │  │    │  │ Tool Registry                │  │
│  └──────────────────┘  │    │  └──────────────────────────────┘  │
└────────────────────────┘    └────────────────────────────────────┘
```

## Domain Model

### Core Entities

| Entity | Description |
|--------|-------------|
| **Organization** | Tenant container for all resources |
| **App** | User-built application (contains pages) |
| **Page** | Individual page within an app (Puck JSON) |
| **Agent** | AI agent configuration |
| **Skill** | Reusable agent behavior with stored plan |
| **Database** | Container for tables |
| **Table** | User data schema (dynamic fields) |
| **View** | Filtered/sorted view of table data |

### Domain-Driven Design Structure

```
src/ddd/
├── domain/           # Domain entities, value objects, aggregates
│   ├── puck/         # App builder domain (apps, pages)
│   ├── agents/       # Agent domain (agents, skills)
│   ├── dynamic-tables/  # Data domain (databases, tables)
│   ├── views/        # View domain
│   └── shared/       # Shared value objects
├── application/      # Application services (use cases)
│   ├── services/     # Business logic orchestration
│   └── di/           # Dependency injection
└── infrastructure/   # External concerns
    ├── persistence/  # Database access
    └── grpc/         # gRPC client
```

## Key Components

### 1. API Layer (`src/app/api/`)

RESTful endpoints using Next.js App Router. All routes use `withAuthenticatedRoute` for consistent auth.

**Key Patterns:**
- Result type returns (`{ success: boolean, data?: T, error?: string }`)
- Organization-scoped resources
- Parallel data fetching where possible

**Unified Workspace API:**
- `GET /api/workspace` - Returns all workspace resources in one call
- Replaces 6+ separate API calls for workspace context

### 2. Chat Processing (`src/app/api/chat/`)

Entry point for all chat/agent interactions.

**Main Flow:**
1. User sends message to `/api/chat/stream-grpc`
2. Authentication and session management (TypeScript)
3. gRPC call to Python agent worker
4. Streaming response back to frontend

### 3. Agent Worker (`emery-agents/`)

Python service handling LLM orchestration.

**Key Components:**
- `ChatProcessingService` - gRPC service entry point
- `ExecutionCoordinator` - Orchestrates planning and execution
- `PlannerModule` - DSPy-based plan generation
- `StepExecutor` - Executes individual plan steps
- Tool Registry - Available agent capabilities

### 4. App Builder (Puck)

Visual page builder for creating user applications.

**Components:**
- Puck Editor - Drag-and-drop page builder
- Component Library - Pre-built UI components
- Data Binding - Connect components to table views

## Data Flow Patterns

### 1. Workspace Context Flow

```
Frontend Request
    ↓
GET /api/workspace
    ↓
Parallel Fetch: [apps+pages, agents, skills, databases+tables, views]
    ↓
Single Response: WorkspaceData
    ↓
Agent has full context of existing resources
```

### 2. Chat Message Flow

```
User Message
    ↓
/api/chat/stream-grpc (Auth, Session)
    ↓
gRPC: ChatProcessingService.ProcessMessage()
    ↓
[Planning or Direct Execution]
    ↓
Streaming Response (tokens, events)
    ↓
Frontend UI Updates
```

## Security Model

### Authentication
- NextAuth.js session-based auth
- API routes require authenticated user
- Organization context from user session

### Authorization
- Organization-scoped resources
- All resources filtered by `organizationId`
- No cross-tenant data access

### API Key Management
- Organization-level API keys for LLM providers
- Keys stored encrypted in database
- Passed to agent worker via gRPC context

## Configuration

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `GRPC_TARGET` | Agent worker gRPC endpoint |
| `S3_*` | File storage configuration |
| `NEXTAUTH_*` | Authentication config |

### Model Selection

Model selection follows a hierarchy:
1. Organization-specific model (if configured)
2. System default model
3. Fallback to Claude

See `docs/model-selection-hierarchy.md` for details.

## Related Documentation

- [Agentic Chat System](./AGENTIC_CHAT_SYSTEM.md) - How the chat/agent system works
- [Orchestration Flow](./ORCHESTRATION_FLOW.md) - Planning vs execution flows
- [ADR-001: Server Action Patterns](./decisions/001-server-action-patterns.md)
- [ADR-002: Server/Client Components](./decisions/002-server-client-components.md)
