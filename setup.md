# Setup Instructions

## Prerequisites

1. **Node.js 18+** and **pnpm** installed
2. **PostgreSQL** database running

## Setup Steps

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Start PostgreSQL with Docker**:
   ```bash
   docker-compose up -d
   ```
   This starts PostgreSQL with pgvector extension on port 5433.

3. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   The default configuration connects to the Docker database.

4. **Generate and run migrations**:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. **Start development server**:
   ```bash
   pnpm dev
   ```

## Testing the Application

1. Open http://localhost:3000
2. Create a workspace
3. Create a table
4. Add fields to the table
5. Add rows of data

## Troubleshooting

- Make sure PostgreSQL is running
- Check database connection string in `.env.local`
- Verify all dependencies are installed

## Architecture Summary

The MVP includes:
- ✅ Static schema for metadata (workspaces, tables, fields)
- ✅ Dynamic table creation with raw SQL
- ✅ Full CRUD API for tables, fields, and rows
- ✅ React dashboard with table editor
- ✅ Field types: text, number, boolean, relation
- ✅ Real-time UI updates