# ADR-001: Server Action Patterns

**Status:** Accepted
**Date:** 2025-01-14
**Context:** Puck Frontend Refactor Phase 1

## Context

Server actions across `puck-apps.ts` and `puck-pages.ts` currently have inconsistent error handling:
- Some throw errors
- Some return Result type
- Error messages lack structure
- Call sites have to handle both patterns

This creates:
- Unpredictable error handling
- Difficult debugging
- Inconsistent user experience
- Type safety issues

## Decision

**All server actions MUST return `Result<T>` type. No exceptions.**

### Result Type Definition

```typescript
export type ErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION'
  | 'PERMISSION'
  | 'DATABASE'
  | 'UNKNOWN';

export interface Result<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: ErrorCode;
}
```

### Standard Pattern

```typescript
export async function getEntity(id: number): Promise<Result<EntityDTO>> {
  try {
    // 1. Input validation
    if (!id) {
      return {
        success: false,
        error: ActionError.validation(['ID is required']),
        errorCode: 'VALIDATION'
      };
    }

    // 2. Permission check (only place throws are allowed)
    const session = await requirePermission("entity:view");

    // 3. Business logic
    const entity = await service.getEntity(EntityId.fromNumber(id));

    // 4. Not found check
    if (!entity) {
      return {
        success: false,
        error: ActionError.notFound('Entity', id),
        errorCode: 'NOT_FOUND'
      };
    }

    // 5. Success response
    return {
      success: true,
      data: Mapper.toDTO(entity)
    };

  } catch (error) {
    // 6. Catch-all error handling
    console.error('Error in getEntity:', error);
    return {
      success: false,
      error: ActionError.database('fetch entity'),
      errorCode: 'DATABASE'
    };
  }
}
```

### Error Helper Functions

Create centralized error message helpers:

```typescript
export const ActionError = {
  notFound: (entity: string, id: number | string) =>
    `${entity} not found: ${id}`,
  validation: (errors: string[]) =>
    `Validation failed: ${errors.join(", ")}`,
  permission: (action: string) =>
    `Insufficient permissions: ${action}`,
  database: (operation: string) =>
    `Database error during ${operation}`,
  unknown: (message?: string) =>
    message || "An unexpected error occurred"
};
```

### Call Site Pattern

```typescript
// Component/Page code
const result = await getEntity(id);

if (!result.success) {
  // Handle error
  toast.error(result.error || "Failed to load entity");
  setError(result.error);
  return;
}

// Success - data is guaranteed to exist
const entity = result.data!;
```

## Consequences

### Positive

- **Predictable:** All actions have same error pattern
- **Type-safe:** TypeScript knows data exists on success
- **Debuggable:** Error codes enable programmatic handling
- **Consistent UX:** Standardized error messages
- **Catchable:** No uncaught throws crashing app

### Negative

- **Verbose:** More code than simple throws
- **Refactor effort:** All existing call sites must update

### Migration

- Update all actions in `puck-apps.ts` and `puck-pages.ts`
- Update all call sites in pages and components
- Create error helper utilities first
- Test thoroughly before deploying

## Examples

See implementation in:
- `/src/lib/puck/errors.ts` - Utilities
- `/src/app/actions/puck-pages.ts` - Updated actions
- `/src/app/(app)/apps/[id]/pages/[pageId]/edit/page.tsx` - Updated call sites
