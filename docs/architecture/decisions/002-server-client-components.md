# ADR-002: Server vs Client Components

**Status:** Accepted
**Date:** 2025-01-14
**Context:** Puck Frontend Refactor Phase 1

## Context

Next.js App Router defaults to Server Components, but Puck blocks and pages have inconsistent usage of `"use client"` directive:
- Some components use client when they don't need to
- Unclear when to add `"use client"`
- resolveData server/client boundary confusion
- Unnecessary client-side JavaScript being sent

## Decision

**Default to Server Components. Only add `"use client"` when absolutely necessary.**

### When to Use "use client"

Add `"use client"` directive ONLY when component needs:

1. **React Hooks**
   - `useState`, `useEffect`, `useContext`, `useReducer`, etc.
   - Exception: `use()` hook for promises (Server Components)

2. **Browser APIs**
   - `window`, `document`, `localStorage`, `sessionStorage`
   - `navigator`, `location`
   - DOM manipulation

3. **Event Handlers**
   - `onClick`, `onChange`, `onSubmit` (without form actions)
   - Mouse/keyboard/touch events

4. **Puck Editor Hooks**
   - `usePuck()` - Access Puck state
   - `createUsePuck()` - Custom Puck hooks
   - Only needed in editor, not in rendered pages

5. **Third-party Client Libraries**
   - Chart libraries, animation libraries, etc.
   - Libraries that require browser environment

### When NOT to Use "use client"

**DO NOT add `"use client"` for:**

1. **Static Rendering**
   ```typescript
   // ✅ Server Component (default)
   export function Card({ title, content }: CardProps) {
     return (
       <div>
         <h3>{title}</h3>
         <p>{content}</p>
       </div>
     );
   }
   ```

2. **Server Data Fetching**
   ```typescript
   // ✅ Server Component
   export async function DataDisplay({ id }: Props) {
     const data = await fetch(`/api/data/${id}`);
     return <div>{data.title}</div>;
   }
   ```

3. **Puck resolveData**
   ```typescript
   // ✅ Always server-side
   export const BlockConfig: ComponentConfig = {
     resolveData: async ({ props }) => {
       // This runs on SERVER
       const data = await getView(props.viewId);
       return { props: { ...props, _data: data } };
     },
     render: BlockComponent, // Can be server component
   };
   ```

### Pattern: Server Component with Client Island

When only PART of component needs interactivity, split it:

```typescript
// ✅ Main component: Server (default)
// src/components/puck/blocks/ToggleBlock/ToggleBlock.tsx
import { ToggleButton } from './ToggleButton.client';

export function ToggleBlock(props: ToggleBlockProps) {
  return (
    <div className="container">
      <h2>{props.title}</h2>
      <ToggleButton defaultExpanded={props.defaultExpanded}>
        <p>{props.content}</p>
      </ToggleButton>
    </div>
  );
}

// ✅ Interactive part: Client
// src/components/puck/blocks/ToggleBlock/ToggleButton.client.tsx
"use client";
import { useState } from 'react';

export function ToggleButton({ children, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <button onClick={() => setExpanded(!expanded)}>
      {expanded ? children : "Show more"}
    </button>
  );
}
```

### Puck-Specific Rules

**Editor Page** (`edit/page.tsx`):
```typescript
// ✅ MUST be "use client"
"use client";

export default function EditPage() {
  // Uses:
  // - useState for page/app state
  // - useEffect for data loading
  // - usePuck hook
  // - sessionStorage
}
```

**Preview Page** (`preview/page.tsx`):
```typescript
// ✅ Split: Server wrapper + Client component
// page.tsx - Server Component
export default async function PreviewPage() {
  const data = await loadData(); // Server-side
  return <PreviewClient data={data} />; // Pass to client
}

// preview-client.tsx - Client Component
"use client";
export function PreviewClient({ data }) {
  const [viewport, setViewport] = useState("desktop");
  // Interactive viewport controls
}
```

**Block Components**:
```typescript
// ✅ Default: Server Component
export function TableBlock(props: TableBlockProps) {
  // resolveData already ran on server
  // Just render the data
  return <table>...</table>;
}

// ❌ Don't do this unless needed
"use client";
export function TableBlock(props: TableBlockProps) {
  // No hooks, no browser APIs - doesn't need client!
}
```

## Consequences

### Positive

- **Performance:** Less client JavaScript, faster page loads
- **SEO:** More server-rendered content
- **Security:** Sensitive operations stay on server
- **Clarity:** Clear separation of concerns
- **Cost:** Reduced client bundle size

### Negative

- **Learning curve:** Developers must understand boundary
- **Hydration:** Client islands require careful data passing
- **Debugging:** Server errors vs client errors

### Migration Checklist

When refactoring a component:

1. ✅ Does it use React hooks? → `"use client"`
2. ✅ Does it use browser APIs? → `"use client"`
3. ✅ Does it have event handlers? → `"use client"` (or use form actions)
4. ✅ Is it just rendering props? → Server Component (remove `"use client"`)
5. ✅ Can I split into server + client parts? → Do the split

## Examples

### ✅ Good: Server Component

```typescript
// src/components/puck/blocks/Heading/Heading.tsx
// NO "use client" directive

export function Heading({ text, level }: HeadingProps) {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className="heading">{text}</Tag>;
}
```

### ✅ Good: Necessary Client Component

```typescript
// src/app/(app)/apps/[id]/pages/[pageId]/edit/page.tsx
"use client"; // NEEDED

import { useState, useEffect } from 'react';
import { usePuck } from '@measured/puck';

export default function EditPage() {
  const [page, setPage] = useState(null);
  const { appState } = usePuck(); // Puck hook
  // ... Uses hooks, sessionStorage, etc.
}
```

### ✅ Good: Server + Client Split

```typescript
// MetricBlock.tsx - Server
export function MetricBlock(props: MetricBlockProps) {
  return (
    <div>
      <MetricValue value={props._value} />
      <MetricChart data={props._chartData} /> {/* Client component */}
    </div>
  );
}

// MetricChart.client.tsx - Client
"use client";
import { LineChart } from 'chart-library'; // Needs browser

export function MetricChart({ data }) {
  return <LineChart data={data} />;
}
```

### ❌ Bad: Unnecessary Client Component

```typescript
// ❌ DON'T DO THIS
"use client"; // Not needed!

export function Card({ title, content }: CardProps) {
  // No hooks, no browser APIs, no events
  return (
    <div className="card">
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  );
}
```

## References

- [Next.js Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Puck resolveData Documentation](https://puckeditor.com/docs/api-reference/configuration/component-config#resolvedata)
- Current implementations: `src/components/puck/blocks/`
