# RLS Context Pattern

Row-Level Security via PostgreSQL session variables + AsyncLocalStorage.

## CRITICAL: Fail-Closed Proxy

The `contextAwareDb` proxy is **fail-closed**: if no RLS context is set, queries throw an error. This prevents accidental cross-tenant data access.

```
Error: RLS context required but not set for select().
Use withAuthContext() for protected operations or raw db for intentionally public queries.
```

## Two Database Clients

| Client | When to use |
|--------|-------------|
| `db` (raw) | Public endpoints, unauthenticated queries |
| `contextAwareDb` | Authenticated operations (via DI container) |

## Authenticated Operations (via DI)

All repository code uses `contextAwareDb` through the DI container. **Context MUST be set before calling any DI service.**

```typescript
// Server actions MUST use withServerAction or withAuthContext
export async function createAgent(...) {
  return withServerAction("agents:manage", async ({ session, org }) => {
    // RLS context set by withAuthContext wrapper
    const service = getAgentApplicationService();
    await service.createAgent(...);
  });
}

// Alternative: explicit withAuthContext
export async function createRow(data: CreateRowCommand): Promise<Result> {
  return withAuthContext(async () => {
    const session = await requirePermission("table:manage");
    const rowService = getRowApplicationService();
    // ... DI service calls now have RLS context
  });
}
```

## Public Pages vs Public Views

**Important distinction:**
- **Public Page** = Puck page accessible without login (still belongs to an org)
- **Public View** = Data view with `requiresAuth = false` (data accessible without auth)

A public page can show:
1. A **public view** (`requiresAuth = false`) → use public service methods
2. A **protected view** (`requiresAuth = true`) → user must authenticate first

## Public/Unauthenticated Operations

**Option 1: Raw db for public page checks**
```typescript
// Verify page is public - uses raw db (no RLS needed)
const page = await db.query.pages.findFirst({
  where: and(
    eq(pages.slug, slug),
    eq(pages.isPublic, true)
  )
});
```

**Option 2: Public view methods (for views with requiresAuth=false)**

Services with public data access have dedicated methods that use `rawDb` internally:

```typescript
export async function executePublicView(viewId: number, pageId: number) {
  // 1. Verify page is public (raw db)
  const page = await db.query.pages.findFirst({
    where: and(eq(pages.id, pageId), eq(pages.isPublic, true))
  });

  // 2. Use PUBLIC service methods - they use rawDb internally
  // and verify requiresAuth=false on the view
  const viewService = getViewApplicationService();

  const view = await viewService.getPublicView(viewId);        // Uses rawDb
  const result = await viewService.executePublicView({...});   // Uses rawDb
  const schema = await viewService.getPublicViewSchema(viewId); // Uses rawDb
}
```

**Repository pattern for public access:**
```typescript
class DrizzleViewRepository {
  constructor(
    private readonly db: DbClient,      // contextAwareDb for protected ops
    private readonly rawDb: DbClient    // raw db for public queries
  ) {}

  // Protected method - uses contextAwareDb (needs RLS context)
  async findById(id: ViewId): Promise<View | null> {
    return this.db.query.views.findFirst({...});
  }

  // Public method - uses rawDb (no RLS context needed)
  async findFieldsForPublicView(viewId: ViewId): Promise<TableField[] | null> {
    // First verify view is public
    const view = await this.rawDb.query.views.findFirst({
      where: and(eq(views.id, viewId.value), eq(views.requiresAuth, false))
    });
    if (!view) return null;
    // Then fetch data with rawDb
    return this.rawDb.query.fields.findMany({...});
  }
}
```

## System Services

```typescript
await withSystemContext(organizationId, async () => {
  // Uses SYSTEM_USER_ID for audit trail
});
```

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `RLS context required but not set` | DI service called without context | Wrap with `withAuthContext` or use public service methods |
| Cross-tenant data access | Using raw `db` for protected data | Use DI services with context |
| Public view method fails | View has `requiresAuth = true` | User must authenticate, use regular methods with context |

See `db/client.ts`, `db/simple-context-proxy.ts`, `db/context-manager.ts`, `actions/lib/with-server-action.ts`.
