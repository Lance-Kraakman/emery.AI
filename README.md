# Orchastrate - Dynamic Database Builder

A Baserow-style backend built with Next.js, Drizzle ORM, and PostgreSQL that allows users to create dynamic tables, fields, and manage data.

## Features

- **Dynamic Table Creation**: Create tables on the fly with custom schemas
- **Custom Fields**: Add text, number, boolean, and relation fields
- **Data Management**: Insert, update, and delete rows with a clean UI
- **Workspace Management**: Organize tables within workspaces

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React + TypeScript
- **Backend**: Next.js API Routes
- **ORM**: Drizzle ORM (for static schema) + Raw SQL (for dynamic tables)
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Quick Start

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Set up PostgreSQL database**:
   ```bash
   docker-compose up -d
   ```
   This will start a PostgreSQL database with pgvector extension on port 5433.

3. **Configure environment**:
   ```bash
   cp .env.example .env.local
   ```
   The default configuration works with the Docker database. Environment variables are automatically loaded by:
   - Next.js (from `.env.local`)
   - Drizzle Kit (via dotenv)
   - All API routes and database connections

4. **Generate and run migrations**:
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

5. **Start development server**:
   ```bash
   pnpm dev
   ```

6. **Open the app**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
/app
  /api
    /tables      # Table CRUD operations
    /fields      # Field CRUD operations  
    /rows        # Row CRUD operations
    /workspaces  # Workspace management
  /dashboard     # Main dashboard UI
    - page.tsx           # Dashboard overview
    - TableEditor.tsx    # Table field and data editor

/lib
  /db
    - schema.ts    # Static Drizzle schema
    - dynamic.ts   # Dynamic table operations
    - client.ts    # Database client

/types
  - db.ts        # TypeScript types

/utils
  - slugify.ts   # String utilities
```

## Core Concepts

### Static Schema (Drizzle)
- `workspaces`: User workspaces
- `tables`: Table metadata
- `fields`: Field definitions
- `users`: User accounts

### Dynamic Tables
- Created at runtime using raw SQL
- Column naming: `field_{slug}` format
- Automatic UUID primary keys and timestamps

## API Endpoints

### Workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces?userId={id}` - List user workspaces

### Tables  
- `POST /api/tables` - Create table
- `GET /api/tables?workspaceId={id}` - List workspace tables
- `DELETE /api/tables?id={id}` - Delete table

### Fields
- `POST /api/fields` - Add field to table
- `GET /api/fields?tableId={id}` - List table fields
- `DELETE /api/fields?id={id}` - Remove field

### Rows
- `POST /api/rows` - Insert row
- `GET /api/rows?tableId={id}` - List table rows
- `PUT /api/rows` - Update row
- `DELETE /api/rows?tableId={id}&rowId={id}` - Delete row

## Development

### Database Scripts
```bash
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations  
pnpm db:studio    # Open Drizzle Studio
```

### Next.js Scripts
```bash
pnpm dev         # Development server
pnpm build       # Production build
pnpm start       # Start production server
pnpm lint        # Run ESLint
```

## Field Types

- **text**: String data
- **number**: Integer data  
- **boolean**: True/false values
- **relation**: UUID references (future enhancement)

## Next Steps

- [ ] Add user authentication
- [ ] Implement relation fields
- [ ] Add file upload support
- [ ] Row-level permissions
- [ ] Real-time updates
- [ ] Data validation rules
- [ ] Export/import functionality