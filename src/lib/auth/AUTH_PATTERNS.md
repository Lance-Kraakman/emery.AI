# Authentication & RLS Context Patterns

## Quick Reference

| Function | Purpose | When to Use |
|----------|---------|-------------|
| `withAuthContext()` | Set RLS context | Wrap server action logic |
| `withAuthenticatedRoute()` | Auth + RLS for API routes | Wrap API route handlers |
| `requireAuth()` | Get session (user info) | Inside server actions/routes |
| `requirePermission()` | Check RBAC permission | Inside server actions/routes |

## Server Actions

Always wrap with `withAuthContext()`:

```typescript
export async function createRow(data) {
  return withAuthContext(async () => {
    const session = await requirePermission("table:manage");
    // DB operations are RLS-scoped
  });
}
```

## API Routes

Always wrap with `withAuthenticatedRoute()`:

```typescript
export async function POST(request: NextRequest) {
  return withAuthenticatedRoute(request, async (user) => {
    // Context already set, can call server actions
    const result = await createRow(data);
    return { success: true, data: result };
  });
}
```

## How They Work Together

```
Browser → Server Action
  └─ withAuthContext() sets context via auth() cookies

API Route → Server Action
  └─ withAuthenticatedRoute() sets context via API key
      └─ withAuthContext() detects existing context, skips re-auth
```

## Auth Methods Supported

1. **NextAuth cookies** - Browser sessions
2. **User API keys** - Format: `user_xxx`
3. **Agent API keys** - Uses agent owner's identity

`requireAuth()` tries all methods in order.

## File Locations

- `src/lib/auth/with-context.ts` - `withAuthContext()`
- `src/lib/api/base.ts` - `withAuthenticatedRoute()`
- `src/app/actions/permissions.ts` - `requireAuth()`, `requirePermission()`
- `src/lib/auth/test-auth.ts` - `authenticateRequest()`, `authenticateWithApiKey()`
- `src/ddd/infrastructure/db/context-manager.ts` - `contextManager`
