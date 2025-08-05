# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Orchastrate is a Baserow-style dynamic database builder that allows users to create tables, fields, and manage data at runtime. It implements a hybrid architecture using both static and dynamic schemas.

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
docker volume rm orchastrate_db   # Reset database (removes all data)
```

## Environment Configuration

- Copy `.env.example` to `.env.local` for local development
- Database runs on port 5433 to avoid conflicts with local PostgreSQL
- Environment variables are loaded by dotenv in database client and Drizzle config

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

## Pipedream Connect Integration

### Overview
- **Agent Ownership**: Agents belong to users (`ownerId` field)
- **OAuth Delegation**: Agents use their owner's connected OAuth accounts
- **External User Mapping**: Users are mapped to Pipedream external users with `orchastrate_user_{userId}` format
- **Token Management**: Server-side token creation with short expiration for security

### Key Components
- `lib/pipedream/client.ts`: PipedreamClient initialization with environment validation
- `lib/pipedream/users.ts`: User account management and OAuth connection URLs
- `lib/pipedream/agents.ts`: Agent action execution using owner credentials
- `app/actions/pipedream.ts`: Server actions for OAuth connection management
- `app/dashboard/connections/`: UI for managing OAuth connections

### Environment Configuration
```bash
PIPEDREAM_PROJECT_ID=your_project_id
PIPEDREAM_CLIENT_ID=your_client_id  
PIPEDREAM_CLIENT_SECRET=your_client_secret
PIPEDREAM_API_KEY=your_api_key
```

### OAuth Flow
1. User clicks "Connect" → Server creates Pipedream token
2. User redirects to Pipedream Connect → Completes OAuth
3. Pipedream redirects back → UI refreshes connections list
4. Agents can now use owner's connected accounts for actions

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
4. Reset database with `docker-compose down && docker volume rm orchastrate_db` if needed

### Testing Complete System
1. Fresh database: `docker-compose down && docker volume rm orchastrate_db && docker-compose up -d`
2. Run migrations: `pnpm db:migrate`
3. Start dev server: `pnpm dev`
4. Complete flow: OAuth login → create organization → create table → add fields → add rows → create agent → connect OAuth accounts

## Important Implementation Details

### Error Handling
- Dynamic table operations use raw SQL with proper parameter binding
- JSONB parsing includes try/catch for malformed JSON
- Field validation ensures required fields are provided

### Performance Considerations
- GIN indexes automatically created for all JSONB (relation) fields
- Raw postgres client connections are properly closed after operations
- Parameterized queries prevent SQL injection

### Data Consistency
- Field deletions remove both metadata and dynamic table columns
- Table deletions cascade through metadata cleanup and dynamic table drops
- Field ID consistency maintained between metadata and dynamic column names
- Agent ownership ensures secure credential delegation through Pipedream
- RBAC permissions are enforced at both API and UI levels

### Security Considerations
- OAuth credentials never stored locally - delegated through Pipedream Connect
- Agent actions run with owner's permissions, not elevated privileges
- Pipedream tokens have short expiration for security
- RBAC system prevents unauthorized access to resources
- All database operations use parameterized queries to prevent SQL injection