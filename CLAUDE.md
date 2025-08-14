# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Emery is a Baserow-style dynamic database builder that allows users to create tables, fields, and manage data at runtime. It implements a hybrid architecture using both static and dynamic schemas.

## Core Architecture

### Dual Schema Approach
- **Static Schema** (`lib/db/schema.ts`): Drizzle ORM manages metadata tables (organizations, tables, fields, users, agents)
- **Dynamic Tables**: Created at runtime using raw SQL with `field_{id}` column naming pattern (Baserow-style)

### Key Architectural Patterns
- **Database Layer**: Uses both Drizzle ORM (static) and raw postgres client (dynamic operations)
- **Column Naming**: Dynamic table columns use `field_{id}` format where `id` is the field's database ID
- **JSONB Relations**: Relation fields use JSONB datatype with GIN indexes for performance
- **UUID Primary Keys**: All dynamic tables use `gen_random_uuid()` for primary keys
- **RBAC System**: Role-Based Access Control with organizations, roles, and permissions
- **Agent System**: Agents belong to users and can use owner's OAuth credentials via Pipedream Connect
- **AI Models**: Uses HuggingFace models (Qwen series) for chat, code generation, and embeddings

### Critical Files
- `lib/db/dynamic.ts`: Core dynamic table operations (create, alter, insert, update, delete)
- `lib/db/client.ts`: Database connection setup with dotenv loading
- `lib/db/schema.ts`: Static schema with organizations, users, agents, roles, permissions
- `lib/auth.ts`: NextAuth configuration with RBAC integration
- `app/api/rows/route.ts`: Handles JSONB parsing for relation fields in data operations
- `app/dashboard/TableEditor.tsx`: Main UI for table schema and data management
- `app/actions/agents.ts`: Agent management server actions
- `lib/pipedream/`: Pipedream Connect integration for OAuth credential delegation

## Development Commands

### Database Operations
```bash
pnpm db:generate    # Generate Drizzle migrations from schema changes
pnpm db:migrate     # Apply migrations to database
pnpm db:studio      # Open Drizzle Studio for database inspection
```

### Development Server
```bash
pnpm dev           # Start Next.js development server
pnpm build         # Production build
pnpm lint          # Run ESLint
```

### Database Setup
```bash
docker-compose up -d              # Start PostgreSQL with pgvector
docker-compose down               # Stop database
docker volume rm emery_db   # Reset database (removes all data)
```

## Environment Configuration

- Copy `.env.example` to `.env.local` for local development
- Database runs on port 5433 to avoid conflicts with local PostgreSQL
- Environment variables are loaded by dotenv in database client and Drizzle config

### AI Model Configuration
- **HuggingFace Models**: Uses advanced Qwen models for AI functionality
  - **Default Chat**: `Qwen/Qwen2.5-Coder-32B-Instruct` - Best for code generation and technical tasks
  - **General Chat**: `Qwen/Qwen2.5-72B-Instruct` - Superior reasoning and conversation
  - **Fast Model**: `Qwen/Qwen2.5-Coder-7B-Instruct` - Faster responses with good quality
  - **Embeddings**: `sentence-transformers/all-mpnet-base-v2` - High-quality text embeddings
- **Required**: Set `HF_TOKEN` environment variable with your HuggingFace API token
- **Get Token**: Visit https://huggingface.co/settings/tokens to create your token

## Field Type System

### Supported Types
- `text`: TEXT columns
- `number`: INTEGER columns  
- `boolean`: BOOLEAN columns
- `email`: TEXT with email validation in UI
- `url`: TEXT with URL validation in UI
- `date`: DATE columns
- `relation`: JSONB columns with GIN indexes for relationship data

### Dynamic Column Management
When adding fields via API:
1. Field metadata is stored in static `fields` table
2. `addFieldToTable()` creates `field_{id}` column in dynamic table
3. JSONB fields automatically get GIN indexes for query performance

## Data Flow Patterns

### Row Operations
1. API receives data keyed by field slug/name
2. Backend maps to `field_{id}` column names using field metadata
3. JSONB fields are parsed from JSON strings if needed
4. Raw postgres client handles parameterized queries for dynamic tables

### Authentication & Authorization
- **NextAuth v4**: OAuth providers (GitHub, Google) with DrizzleAdapter
- **RBAC System**: Organizations → Roles → Permissions hierarchy
- **Initial Setup**: First user becomes Super Admin with full permissions
- **Session Management**: Server-side sessions with organization context
- **Permission Levels**: Super Admin, Admin, Editor, Viewer with granular permissions

## OAuth Proxy Service with Pipedream Connect

### Architecture Overview
- **OAuth Credential Delegation**: Agents execute actions using their owner's connected OAuth accounts
- **No Local Token Storage**: OAuth credentials managed entirely through Pipedream Connect
- **Universal Proxy**: Single proxy endpoint (`/api/agents/proxy`) supporting any OAuth service
- **Agent Ownership Model**: Strict ownership verification - agents can only use owner's credentials
- **External User Mapping**: Users mapped to Pipedream external users with `emery_user_{userId}` format

### Core Components

#### Backend Integration Layer
- `lib/pipedream/client.ts`: PipedreamClient initialization with environment validation
- `lib/pipedream/users.ts`: User account management, OAuth connections, and disconnect functionality
- `lib/pipedream/agents.ts`: Agent action execution using owner credentials
- `app/actions/pipedream.ts`: Server actions for OAuth connection management

#### Frontend Connection Management
- `app/dashboard/connections/page.tsx`: OAuth connections dashboard
- `app/dashboard/connections/ConnectionsManager.tsx`: UI for connecting/disconnecting OAuth accounts
- **Supported Services**: Gmail, Slack, GitHub, Google Sheets, Discord, Twitter

#### Agent API Routes
- `/api/agents/[id]/execute`: Execute Pipedream actions with webhook support
- `/api/agents/[id]/capabilities`: Get agent capabilities and connected services  
- `/api/agents/proxy`: Universal OAuth proxy for all agent OAuth calls

### Python Backend Integration

#### Client Library Structure
```
backend/
├── src/emery_client/
│   ├── __init__.py
│   ├── client.py          # Full client with webhook support
│   ├── simple_client.py   # Minimal OAuth proxy client
│   ├── gmail.py          # Gmail integration examples
│   └── types.py          # Type definitions
├── scripts/
│   └── test_integration.py  # Integration test runner
└── pyproject.toml        # Python project configuration with uv
```

#### Two Client Approaches
1. **Full Client** (`client.py`): Complete client with webhook support, capabilities discovery, structured types
2. **Simple Client** (`simple_client.py`): Minimal OAuth proxy client for agent libraries

#### Development Testing Commands
```bash
# Backend integration tests using uv package manager
uv run scripts/test_integration.py <agent_id>
pnpm test:agent-api <agent_id>

# Direct Python client testing  
python scripts/python_agent_client.py <agent_id>
```

### Authentication System

#### Current Development Authentication
- **Development Bypass**: Uses test user ID `550e8400-e29b-41d4-a716-446655440000` via `x-test-user-id` header
- **Session-based Auth**: NextAuth v4 for frontend user authentication  
- **Agent Ownership Verification**: Agents can only be used by their owners

#### Planned Production Authentication (Multiple Options)
1. **API Key Authentication (Recommended)**: JWT-based API keys for backend applications
2. **OAuth App-to-App Flow (Enterprise)**: OAuth 2.0 Client Credentials Flow
3. **Agent API Keys (Simple)**: Each agent gets its own API key

### Environment Configuration
```bash
# Pipedream Connect Integration (Required)
PIPEDREAM_PROJECT_ID=your_project_id
PIPEDREAM_CLIENT_ID=your_client_id  
PIPEDREAM_CLIENT_SECRET=your_client_secret
PIPEDREAM_API_KEY=your_api_key

# Webhook Security
WEBHOOK_SECRET=default-webhook-secret

# NextAuth Configuration
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000
```

### OAuth Connection Flow
1. User clicks "Connect" in dashboard → Server creates Pipedream token
2. User redirects to Pipedream Connect → Completes OAuth with service (Gmail, Slack, etc.)
3. Pipedream redirects back → UI refreshes connections list
4. Agents can now use owner's connected accounts for actions
5. **Disconnect Support**: Users can disconnect accounts to enable reconnection with different credentials

### Key Features

#### Webhook Integration
- **Async Execution**: Support for long-running actions with webhook result delivery
- **HMAC Signature Verification**: Webhook payloads verified with HMAC signatures
- **Development Testing**: Webhook bypass for synchronous testing during development

#### Service Discovery
- **Dynamic Capabilities**: Runtime discovery of available services and actions based on user's connections
- **Service Mapping**: Map service+action combinations to Pipedream action IDs
- **Error Propagation**: Comprehensive error handling and user feedback

#### Security Patterns
- **OAuth Delegation**: Agents use owner's credentials, not elevated privileges
- **Webhook Signatures**: HMAC signature verification for webhook payloads  
- **Parameter Binding**: All database operations use parameterized queries
- **Agent Ownership**: Strict ownership verification for all agent operations

## Common Development Tasks

### Adding New Field Types
1. Update `typeMap` in `lib/db/dynamic.ts`
2. Add UI input component in `TableEditor.tsx` `renderFieldInput()`
3. Add display logic in table row rendering
4. Update API parsing logic in `app/api/rows/route.ts` if special handling needed

### Database Schema Changes
1. Modify `lib/db/schema.ts` for static schema changes
2. Run `pnpm db:generate` to create migration
3. Run `pnpm db:migrate` to apply changes
4. Reset database with `docker-compose down && docker volume rm emery_db` if needed

### Testing Complete System
1. **Fresh Database Setup**:
   ```bash
   docker-compose down && docker volume rm emery_db && docker-compose up -d
   pnpm db:migrate
   ```

2. **Start Development Environment**:
   ```bash
   pnpm dev  # Starts Next.js on http://localhost:3000
   ```

3. **Complete Integration Flow**:
   - OAuth login → create organization → create table → add fields → add rows
   - Create agent → connect OAuth accounts via `/dashboard/connections`
   - Test agent execution via Python client or API

### Testing OAuth Proxy Service
1. **Prerequisites**:
   - Emery running: `pnpm dev`
   - Pipedream environment variables configured
   - Agent created with valid agent API key

2. **Frontend OAuth Connection Testing**:
   - Navigate to `/dashboard/connections`
   - Connect Gmail, Slack, or other supported services
   - Test disconnect/reconnect functionality

3. **Python Backend Integration Testing**:
   ```bash
   # Using uv package manager (recommended)
   uv run scripts/test_integration.py <agent_id>
   
   # Using npm script
   pnpm test:agent-api <agent_id>
   
   # Direct Python execution
   python scripts/python_agent_client.py <agent_id>
   ```

4. **Manual API Testing**:
   ```bash
   # Test agent capabilities
   curl -X GET "http://localhost:3000/api/agents/<agent_id>/capabilities" \
     -H "Authorization: Bearer <agent_api_key>"
   
   # Test OAuth proxy
   curl -X POST "http://localhost:3000/api/agents/proxy" \
     -H "Authorization: Bearer <agent_api_key>" \
     -H "Content-Type: application/json" \
     -d '{"service": "gmail", "action": "send_email", "params": {...}}'
   ```

### Development Authentication Testing
For development without full OAuth setup:
- Use test user ID: `550e8400-e29b-41d4-a716-446655440000`
- Add `x-test-user-id` header to bypass authentication
- Webhook verification can be disabled for local testing

## Development Workflow

### NextJS Component Architecture Rules
Follow these patterns for consistent component usage:

**Use Server Actions when:**
- Using App Router for internal-only actions
- Want type-safe, co-located DB logic (Drizzle)
- Don't need custom HTTP headers/status codes
- Handling form submissions or component-triggered mutations

**Use API Routes when:**
- Need to expose HTTP endpoint (mobile clients, webhooks)
- Require custom HTTP responses (headers, status)
- Action called via fetch or by external services
- Need independent testing (Postman, curl)

**Use Server Components when:**
- No interactivity needed (no event listeners)
- Want server-side data fetching (DB queries)
- Want better performance and smaller bundles
- Using Server Actions, file system, or sensitive logic

**Use Client Components when:**
- Need interactivity (onClick, useState, useEffect)
- Using browser-only APIs (localStorage, window)
- Component relies on real-time updates, sockets, animations
- Handling forms with client-side validation

### Pre-commit Testing Protocol

**MANDATORY**: Always run tests before committing to ensure changes don't break existing functionality.

```bash
# Quick smoke test (no external dependencies)
uv run python quick_test.py

# If quick tests pass, run full test suite
uv run python run_tests.py all

# For Python projects specifically:
uv run pytest tests/ -v
```

**Test-Driven Commit Process:**
1. Make your code changes
2. Run `uv run python quick_test.py`
3. If successful, run `uv run python run_tests.py all`
4. Fix any failing tests before proceeding
5. Commit only when all tests pass
6. Include test status in commit message if relevant

### Python Code Quality Standards

**Type Hints:**
- Prefer TypedDict over Dict[str, Any] for structured data
- Use Union types over generic Any when possible
- Create domain-specific type aliases for better clarity

**Error Handling:**
- Avoid over-defensive patterns like excessive `.get(key, default)` usage
- Use proper exception handling rather than defensive programming
- Chain exceptions with `raise ... from e` to preserve stack traces

**Function Design:**
- Keep functions under 50 lines when possible
- Extract complex logic into helper methods
- Single responsibility principle - one function, one purpose

## Important Implementation Details

### Error Handling
- **Dynamic Table Operations**: Use raw SQL with proper parameter binding
- **JSONB Parsing**: Includes try/catch for malformed JSON in relation fields
- **Field Validation**: Ensures required fields are provided
- **OAuth Proxy Errors**: Comprehensive error propagation from Pipedream Connect to client
- **Webhook Failures**: Graceful handling of webhook delivery failures with retry logic
- **Authentication Errors**: Clear error messages for missing or invalid API keys

### Performance Considerations
- **Database Indexes**: GIN indexes automatically created for all JSONB (relation) fields
- **Connection Management**: Raw postgres client connections are properly closed after operations
- **Parameterized Queries**: Prevent SQL injection across all database operations
- **OAuth Token Caching**: Short-lived Pipedream tokens prevent unnecessary API calls
- **Webhook Async Processing**: Long-running agent actions don't block API responses

### Data Consistency
- **Field Management**: Field deletions remove both metadata and dynamic table columns
- **Table Cleanup**: Table deletions cascade through metadata cleanup and dynamic table drops
- **Field ID Consistency**: Maintained between metadata and dynamic column names
- **Agent Ownership**: Strict ownership verification ensures secure credential delegation
- **RBAC Enforcement**: Permissions enforced at both API and UI levels
- **OAuth Account Mapping**: Consistent external user ID mapping for Pipedream integration

### Security Considerations
- **OAuth Credential Management**: Credentials never stored locally - fully delegated through Pipedream Connect
- **Agent Execution Security**: Agents run with owner's permissions, not elevated privileges
- **Token Expiration**: Pipedream tokens have short expiration for security
- **Webhook Verification**: HMAC signature verification for all webhook payloads
- **API Key Security**: Agent API keys provide secure backend authentication
- **RBAC System**: Prevents unauthorized access to resources and data
- **SQL Injection Prevention**: All database operations use parameterized queries
- **Development Security**: Test authentication bypass only enabled in development environment

### OAuth Proxy Architecture
- **Universal Proxy Design**: Single `/api/agents/proxy` endpoint handles all OAuth services
- **Service Agnostic**: Supports any OAuth-enabled service through Pipedream Connect
- **Dynamic Service Discovery**: Runtime discovery of available services based on user connections
- **Error Propagation**: Maintains full error context from external services to client applications
- **Webhook Integration**: Supports both synchronous and asynchronous execution patterns
- **Multi-Client Support**: Both full-featured and simple Python clients for different use cases

## Frontend Architecture Refactoring (2025-01)

### Component Architecture Improvements

#### Refactored Component Structure
The frontend has been significantly refactored for better maintainability and consistency:

**Component Organization:**
- **Core UI Components**: Standardized shadcn/ui components with consistent design tokens
- **Composite Components**: Business logic components built from core UI components
- **Custom Hooks**: Extracted state management and side effects into reusable hooks
- **Utility Components**: Reusable patterns like `FormField`, `EmptyState`, `Loading`

#### Major Component Refactoring

**RowManager Component (394 → 84 lines)**
- **Extracted Components**: 
  - `FieldInput.tsx` - Field type-specific input handling
  - `CellRenderer.tsx` - Cell value display formatting
  - `RowForm.tsx` - Form creation and editing
  - `RowTable.tsx` - Table display and inline editing
- **Custom Hook**: `useRowManager.ts` - State management and CRUD operations
- **Benefits**: 80% reduction in complexity, better testability, clear separation of concerns

**Other Refactored Components:**
- **TableList**: Converted to shadcn/ui Card and Button components
- **FieldManager**: Standardized form inputs and improved UX with EmptyState
- **TableEditorClient**: Consolidated with better error handling

#### Removed Dead Code
- **Deleted Files**: 
  - `app/TableEditor.tsx` (394 lines) - Replaced by refactored components
  - `app/components/DashboardClient.tsx` (88 lines) - Unused component
  - `app/components/DashboardWithData.tsx` - Dead data loader
  - `app/utils/validation.ts` - Unused validation utilities
  - `app/mission-control/dashboard-content.tsx` - Unnecessary wrapper
- **Clean Directories**: Removed empty `dashboard/` subdirectories
- **Import Cleanup**: Removed unused imports across all components

### Styling Standardization

#### Design System Implementation
**Consistent Component Usage:**
- **Buttons**: All hardcoded button styles replaced with `Button` component variants
- **Forms**: Standardized `Input`, `Select`, `Checkbox` components
- **Cards**: Consistent `Card`, `CardHeader`, `CardContent` structure
- **Tables**: Proper `Table`, `TableHeader`, `TableBody` components
- **Loading States**: Unified loading and disabled state styling

**Color Token Migration:**
- **Before**: `bg-blue-600`, `text-gray-900`, `text-red-500` (hardcoded colors)
- **After**: `bg-primary`, `text-foreground`, `text-destructive` (design tokens)
- **Benefits**: Automatic dark mode support, consistent theming, maintainable styles

**Added Utility Components:**
```typescript
// New standardized components
<FormField label="Name" required error={error}>
  <Input {...props} />
</FormField>

<EmptyState 
  title="No items" 
  description="Add your first item"
  action={{ label: "Add Item", onClick: handler }}
/>

<Loading text="Loading..." />
<LoadingOverlay isLoading={pending}>...</LoadingOverlay>
```

#### Button Variant System
Extended shadcn/ui Button with application-specific variants:
- `success` - Green buttons for creation actions
- `destructive` - Red buttons for delete actions  
- `outline` - Secondary actions and cancellation
- `ghost` - Icon buttons and subtle actions

### Development Patterns

#### Consistent Patterns Established
**Form Handling:**
- Standardized `FormField` wrapper with built-in error handling
- Consistent loading states and disabled styling
- Proper ARIA attributes and accessibility

**Data Display:**
- `EmptyState` for consistent empty states across all lists
- `CellRenderer` for proper field type display formatting
- Hover states and interaction patterns standardized

**Component Composition:**
- Clear separation between UI components and business logic
- Proper prop interfaces and TypeScript types
- Consistent naming conventions and file organization

#### Custom Hooks Pattern
**State Management Hooks:**
- `useRowManager` - Row CRUD operations and form state
- `useEmeryData` - Global data fetching and caching
- Extracted from components for better testability and reuse

### Code Quality Improvements

#### TypeScript Integration
- Consistent type definitions across all components
- Proper prop interface definitions
- Better error handling with type safety

#### Performance Optimizations  
- Component splitting reduces bundle size and improves tree shaking
- Proper React patterns for state updates and side effects
- Reduced re-renders through better state management

#### Developer Experience
- Clear component boundaries and responsibilities
- Consistent import patterns and file organization
- Better error messages and development warnings
- Standardized loading and error states

### Migration Benefits

#### Maintainability
- **Single Source of Truth**: All UI patterns now use shadcn/ui components
- **Consistent Styling**: Design tokens ensure visual consistency
- **Better Organization**: Clear separation of concerns and component responsibilities

#### Developer Productivity
- **Reusable Components**: Standard patterns reduce duplicate code
- **Type Safety**: Better TypeScript integration prevents runtime errors
- **Testing**: Smaller, focused components are easier to test

#### User Experience
- **Consistent Interactions**: Standardized hover, focus, and loading states
- **Accessibility**: Proper ARIA attributes and keyboard navigation
- **Performance**: Smaller components and better code splitting

### Future Refactoring Opportunities

#### Remaining Complex Components
- **EditableCell.tsx** (341 lines) - Candidate for field-type component extraction
- **DataViewsClient-simplified.tsx** (307 lines) - Could benefit from hook extraction
- **EmerySidebar.tsx** (298 lines) - Navigation state management improvements

#### Additional Improvements
- **API Route Consolidation**: Review Server Actions vs API routes usage
- **Error Boundary Implementation**: Consistent error handling across components
- **Testing Strategy**: Unit tests for extracted hooks and components
- **Performance Monitoring**: Bundle size analysis and optimization

## Agent Scheduler & gRPC Executor Architecture (2025-01)

### Simplified Execution Architecture

The agent execution system has been consolidated to use a unified pattern:

#### Simplified gRPC Executor (`lib/agents/grpc-executor.ts`)
- **Single Function**: `executeAgentViaGRPC()` handles all agent execution
- **JSONB Instructions Structure**: Database field storing `{instructions, tools[], servers[], metadata}`
- **Real-time Progress**: gRPC streaming provides step-by-step execution updates
- **Automatic Recording**: All executions stored in database with complete audit trail

```typescript
interface AgentExecutionRequest {
  agentId: number;
  instructions: string; // Main instruction text
  tools?: Array<{name: string, version?: string, config?: Record<string, any>}>; // Optional tools
  servers?: Array<{name: string, endpoint?: string, config?: Record<string, any>}>; // Optional servers
  executionId: string;
  metadata?: Record<string, any>; // Optional context metadata
}
```

#### Enhanced Agent Scheduler (`lib/scheduler/agent-scheduler.ts`)
- **Pending Task Processing**: `processPendingTasks()` runs automatically every minute
- **Manual Execution**: `processPendingTasksManually()` for immediate task execution
- **Multiple Trigger Types**: CRON, DATABASE_EVENT, WEBHOOK, and MANUAL triggers
- **Dynamic Agent Discovery**: Automatically detects new/updated/deleted agents
- **JSONB Task Instructions**: Supports complex task configuration with tools and servers

#### Legacy Pattern Removal
All legacy execution patterns have been removed:
- ❌ `triggerData: trigger_data || {}` fallback patterns
- ❌ `stepOverrides: step_overrides` legacy parameters  
- ❌ `executeAgentCapabilityViaGRPC()` (replaced by simplified `executeAgentViaGRPC()`)
- ❌ Capability-specific routing (now handled by smolagents hierarchy)

#### API Endpoint Consistency
All agent execution now uses the same simplified pattern:
- `/api/agents/[id]/execute` - Direct agent execution with tools/servers support
- `/api/scheduler` - Manual pending task processing with `processPendingTasks` action
- `/api/scheduler/webhook` - Webhook triggers using simplified execution

#### Database Task Schema
Tasks are stored with JSONB instructions supporting the complete execution context:
```sql
tasks.instructions JSONB: {
  instructions: string,     -- Main task description
  tools: ToolConfig[],     -- Optional tool configurations
  servers: ServerConfig[], -- Optional server configurations  
  metadata: object         -- Execution context (trigger_type, user_id, etc.)
}
```

### Scheduler Operation Modes

#### Automatic Processing (Every Minute)
- Checks for new pending tasks and executes them immediately
- Processes up to 10 tasks per cycle to prevent overload
- Updates task status in real-time during execution

#### Manual Processing (On-Demand)
```bash
# Trigger immediate processing of all pending tasks
curl -X POST "http://localhost:3000/api/scheduler" \
  -H "Content-Type: application/json" \
  -d '{"action": "processPendingTasks"}'
```

#### CRON Scheduled Jobs
- Dynamic CRON job management with node-cron
- Automatic job cleanup when agents are deleted/deactivated
- Timezone support with `SCHEDULER_TIMEZONE` environment variable

#### Database Event Triggers
- PostgreSQL LISTEN/NOTIFY for real-time table change detection
- Agents triggered when specific tables are modified
- Supports INSERT, UPDATE, DELETE operations

### AIDEV Anchor Comments
The codebase uses searchable AIDEV comments for inline documentation:
- `AIDEV-NOTE:` - Important architectural decisions and explanations
- `AIDEV-TODO:` - Known improvement opportunities
- `AIDEV-QUESTION:` - Areas needing architectural decisions

Search for these patterns when working on complex areas:
```bash
grep -r "AIDEV-" --include="*.ts" --include="*.py" .
```