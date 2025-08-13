# Multi-Tenancy Implementation Plan

This document outlines the plan to implement robust, secure, and scalable multi-tenancy using the industry-standard "Shared Database, Shared Schema" model with PostgreSQL's Row-Level Security (RLS).

## 1. Architecture Overview

The chosen architecture is based on the following principles:

- **Shared Database, Shared Schema:** All tenants (organizations) will share the same database and the same set of tables.
- **Data Isolation:** A mandatory `organizationId` column on each tenant-specific table will identify data ownership.
- **Database-Enforced Security:** PostgreSQL's Row-Level Security (RLS) will be the primary mechanism for enforcing data isolation. This is more secure than relying solely on application-level checks, as it prevents accidental data leakage even if there is a bug in the application code.
- **Scalability:** The architecture is designed to scale efficiently through proper indexing of the `organizationId` and vector embedding columns.

## 2. Implementation Steps

The implementation is divided into three main phases:

### Phase 1: Database-Level Hardening (SQL Migration)

This phase involves modifying the database to enable and enforce RLS.

**Action:** Create a new SQL migration file (e.g., `database/rls-policies.sql`) with the following commands:

```sql
-- Step 1.1: Enable RLS on all tenant-specific tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

-- Step 1.2: Create a reusable function to generate the RLS policies
CREATE OR REPLACE FUNCTION create_rls_policy(table_name TEXT) RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE POLICY "Tenant Isolation Policy"
    ON %I
    FOR ALL
    USING (organizationId = current_setting(''SESSION.current_organization_id'')::integer)
    WITH CHECK (organizationId = current_setting(''SESSION.current_organization_id'')::integer);
  ', table_name);
END;
$$ LANGUAGE plpgsql;

-- Step 1.3: Apply the generic policy to all tables with a direct organizationId
SELECT create_rls_policy('databases');
SELECT create_rls_policy('tables');
SELECT create_rls_policy('roles');
SELECT create_rls_policy('teams');
SELECT create_rls_policy('agents');
SELECT create_rls_policy('rag_indexes');

-- Step 1.4: Create specific policies for tables with indirect relationships
-- Example for 'fields', which is linked via 'tables'
CREATE POLICY "Tenant Isolation for Fields"
ON fields
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tables
    WHERE tables.id = fields.tableId
    AND tables.organizationId = current_setting('SESSION.current_organization_id')::integer
  )
);

-- Example for 'rag_documents', which is linked via 'rag_indexes'
CREATE POLICY "Tenant Isolation for RAG Documents"
ON rag_documents
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM rag_indexes
    WHERE rag_indexes.id = rag_documents.ragIndexId
    AND rag_indexes.organizationId = current_setting('SESSION.current_organization_id')::integer
  )
);

-- Step 1.5: Create indexes on organizationId for performance
CREATE INDEX IF NOT EXISTS idx_databases_organization_id ON databases (organizationId);
CREATE INDEX IF NOT EXISTS idx_tables_organization_id ON tables (organizationId);
CREATE INDEX IF NOT EXISTS idx_roles_organization_id ON roles (organizationId);
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams (organizationId);
CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON agents (organizationId);
CREATE INDEX IF NOT EXISTS idx_rag_indexes_organization_id ON rag_indexes (organizationId);

-- Step 1.6: Create a vector index for RAG performance
-- This ensures fast similarity searches within a tenant's documents.
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding ON rag_documents USING hnsw (embedding vector_cosine_ops);
```

### Phase 2: Application-Level Integration

This phase involves creating a secure wrapper function to ensure that every database query is executed within the correct tenant context.

**Action:** Create a new file `lib/db/tenant-client.ts` and add the `runQueryForTenant` function.

```typescript
// lib/db/tenant-client.ts
import { db } from './client';
import { sql } from 'drizzle-orm';

/**
 * Securely executes a database query within the context of a specific tenant.
 * It sets a session-local variable for the organizationId, which is then
 * used by the Row-Level Security policies in PostgreSQL.
 *
 * @param organizationId The ID of the organization to scope the query to.
 * @param queryCallback A callback function that receives the transaction client
 *                      and executes the desired database operations.
 * @returns The result of the callback function.
 */
export async function runQueryForTenant<T>(
  organizationId: number,
  queryCallback: (tx: typeof db) => Promise<T>
): Promise<T> {
  // Use a transaction to ensure the session variable is scoped correctly.
  return db.transaction(async (tx) => {
    // Set the session variable for the current transaction. RLS policies rely on this.
    await tx.execute(sql`SET LOCAL SESSION.current_organization_id = ${organizationId}`);

    // Execute the actual query logic within this secure context.
    const result = await queryCallback(tx);

    // The session variable is automatically cleared at the end of the transaction.
    return result;
  });
}
```

### Phase 3: Refactor Data Access Logic

This final phase involves updating all existing data access code to use the new secure wrapper. This centralizes the security logic and simplifies the application code.

**Action:** Refactor all server actions (e.g., in `app/actions/*.ts`) that perform database queries.

**Example Refactor (`app/actions/agents.ts`)**

**Before:**

```typescript
// app/actions/agents.ts (Old Way)
export async function getAgents(filters: ...) {
  const currentOrg = await requireCurrentOrganization();
  const conditions = [eq(agents.organizationId, currentOrg.id)];
  // ... other filters
  return await db.select().from(agents).where(and(...conditions));
}
```

**After:**

```typescript
// app/actions/agents.ts (New, Secure Way)
import { runQueryForTenant } from '@/lib/db/tenant-client';

export async function getAgents(filters: ...) {
  const currentOrg = await requireCurrentOrganization();

  return runQueryForTenant(currentOrg.id, (tx) => {
    // The `where organizationId` check is now handled by RLS and can be removed.
    const conditions = []; // Security is implicit.
    if (filters.searchQuery) {
      conditions.push(like(agents.name, `%${filters.searchQuery}%`));
    }
    // ... other filters
    return tx.select().from(agents).where(and(...conditions));
  });
}
```

This refactoring needs to be applied to **all** functions that create, read, update, or delete tenant-specific data.

## 3. Next Steps

1.  **Review and Approve:** Confirm this plan is correct.
2.  **Toggle to Act Mode:** Give the command to begin implementation.
3.  **Execute Plan:** I will execute the three phases in order.
4.  **Test:** Thoroughly test the application to ensure data is correctly isolated between tenants.
