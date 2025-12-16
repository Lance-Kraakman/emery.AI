# ADR-003: TypeScript Standards

**Status:** Accepted
**Date:** 2025-01-14
**Context:** Puck Frontend Refactor Phase 1

## Context

TypeScript usage in Puck implementation has inconsistencies:
- `any` types in several critical places
- Mixed use of `undefined` vs `null`
- Inconsistent optional/nullable patterns
- Type assertions masking real type issues

This reduces type safety and makes refactoring risky.

## Decision

### Rule 1: No 'any' Types

**Never use `any`.** Use proper types or `unknown` if type truly unknown.

#### ❌ Bad
```typescript
export interface PageDTO {
  themeConfig?: any; // Lost type safety
}

const uiUpdate: any = {}; // No IDE help

render: (props) => <Block {...(props as any)} /> // Hiding errors
```

#### ✅ Good
```typescript
import type { ThemeConfigProps } from '@/ddd/domain/puck/value-objects/theme-config';

export interface PageDTO {
  themeConfig?: ThemeConfigProps | null; // Explicit type
}

import type { AppState } from '@measured/puck';
const uiUpdate: Partial<AppState['ui']> = {}; // Proper type

render: (props) => <Block {...props} /> // Fix types, don't mask
```

#### Exception: Puck Content (Legitimately Dynamic)
```typescript
// Puck's content IS dynamic by design - this is OK
templateData: {
  content: Array<{ type: string; props: any }>;
  root: Record<string, any>;
  zones: Record<string, any[]>;
}
```

### Rule 2: Consistent Null/Undefined Handling

**Use `undefined` for optional props, `null` for nullable values.**

#### Optional Props (Use `?`)
```typescript
// ✅ Property may not be provided
interface BlockProps {
  title?: string; // Means: string | undefined
  count?: number; // Means: number | undefined
}

// Usage
<Block /> // Valid
<Block title="Hello" /> // Valid
```

#### Nullable Values (Use `| null`)
```typescript
// ✅ Value explicitly set to null (vs not provided)
interface UserState {
  currentUser: User | null; // null = logged out, User = logged in
  selectedId: number | null; // null = none selected
}

// Usage
const [user, setUser] = useState<User | null>(null);
setUser(null); // Explicitly clear
```

#### Never Both (Redundant)
```typescript
// ❌ Don't do this (redundant)
interface Props {
  value?: string | null; // Confusing - can be undefined OR null
}

// ✅ Pick one based on meaning
interface Props {
  optionalValue?: string; // May not be provided
  nullableValue: string | null; // Always provided, may be null
}
```

### Rule 3: DTOs Use Explicit Types

All DTO interfaces must use explicit imported types, not `any`.

#### ❌ Bad
```typescript
// src/app/mappers/puck-page-mapper.ts
export interface PageDTO {
  id: number;
  name: string;
  themeConfig?: any; // Lost type information
}
```

#### ✅ Good
```typescript
import type { ThemeConfigProps } from '@/ddd/domain/puck/value-objects/theme-config';

export interface PageDTO {
  id: number;
  name: string;
  themeConfig?: ThemeConfigProps | null; // Explicit type, nullable
}
```

### Rule 4: Type Assertions Last Resort

Only use `as` when you know more than TypeScript.

#### ❌ Bad (Hiding Real Issues)
```typescript
render: (props) => <TableBlock {...(props as any)} />
// ^ Why do props not match? FIX the root cause!
```

#### ✅ Good (Legitimate Use)
```typescript
// Type narrowing after runtime check
if (typeof value === 'string') {
  const str = value as string; // Compiler needs help
}

// Importing untyped JSON
import data from './data.json' as { items: Item[] };
```

### Rule 5: Type Guards for Runtime Checks

Create type guard functions for runtime validation.

```typescript
// src/lib/puck/type-guards.ts

export function isPageDTO(value: unknown): value is PageDTO {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as any).id === 'number' &&
    'name' in value &&
    typeof (value as any).name === 'string'
  );
}

// Usage
const data = JSON.parse(response);
if (isPageDTO(data)) {
  // TypeScript knows data is PageDTO here
  const page: PageDTO = data;
}
```

## Migration Checklist

### Fixing 'any' Types

1. **Find all 'any'**
   ```bash
   grep -r "any" src/ --include="*.ts" --include="*.tsx"
   ```

2. **For each 'any', determine:**
   - Is this DTO? → Use explicit imported type
   - Is this Puck content? → Keep (legitimately dynamic)
   - Is this UI state? → Import proper Puck type
   - Is this type assertion? → Fix root cause
   - Is this truly unknown? → Use `unknown`, add type guard

3. **Update imports**
   ```typescript
   import type { ThemeConfigProps } from '@/ddd/domain/puck/value-objects/theme-config';
   import type { AppState } from '@measured/puck';
   ```

### Fixing Null/Undefined

1. **Review each optional/nullable field**
2. **Ask: "Can this be omitted OR set to null?"**
   - Omitted → Use `?`
   - Set to null → Use `| null`
   - Both → Reconsider API design

3. **Update consistently**

## Consequences

### Positive

- **Type Safety:** Catch errors at compile time
- **IDE Support:** Better autocomplete, refactoring
- **Documentation:** Types document intent
- **Confidence:** Refactor without fear

### Negative

- **Verbosity:** More import statements
- **Strict:** Can't use quick `any` shortcuts
- **Learning:** Team must understand null vs undefined

### Enforcement

Add to `.eslintrc`:
```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-module-boundary-types": "warn"
  }
}
```

Add to `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
```

## Examples

### Before: Multiple Issues
```typescript
// ❌ Multiple violations
export interface PageDTO {
  id: number;
  themeConfig?: any; // Rule 1: No any
  metadata?: Record<string, any> | null; // Rule 2: Both optional and null
}

function updatePage(data: any): Promise<any> { // Rule 1: No any
  const result = await savePage(data as PageDTO); // Rule 4: Bad assertion
  return result;
}
```

### After: Standards Applied
```typescript
// ✅ All rules followed
import type { ThemeConfigProps } from '@/ddd/domain/puck/value-objects/theme-config';

export interface PageDTO {
  id: number;
  themeConfig: ThemeConfigProps | null; // Rule 1 & 2: Explicit type, nullable
  metadata: Record<string, string>; // Rule 1: Specific type
}

function updatePage(data: PageDTO): Promise<Result<PageDTO>> { // Rule 1: Explicit types
  if (!isPageDTO(data)) { // Rule 5: Type guard
    return { success: false, error: "Invalid data" };
  }
  const result = await savePage(data);
  return result;
}
```

## Files to Update

High priority:
- `src/app/mappers/puck-page-mapper.ts`
- `src/app/mappers/puck-app-mapper.ts`
- `src/components/puck/blocks/TableBlock/index.tsx`
- `src/app/(app)/apps/[id]/pages/[pageId]/edit/page.tsx`

Medium priority:
- Review all block components
- Review all page components

## References

- [TypeScript Handbook: Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TypeScript: Null vs Undefined](https://basarat.gitbook.io/typescript/recap/null-undefined)
