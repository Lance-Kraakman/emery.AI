# Data Grid Architecture

This document describes the architecture of the dynamic data grid system, including data flow, state management, and component hierarchy.

## Table of Contents

- [Overview](#overview)
- [Component Hierarchy](#component-hierarchy)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Key Architectural Decisions](#key-architectural-decisions)
- [Performance Optimizations](#performance-optimizations)
- [Testing Strategy](#testing-strategy)

## Overview

The data grid system is a spreadsheet-like interface for viewing and editing dynamic table data. It's built on top of `react-datasheet-grid` with extensive customizations for our Baserow-style table system.

### Key Features

- **Server-side operations**: Search, sort, filter, and pagination all happen on the server
- **Optimistic updates**: Immediate UI feedback using TanStack Query
- **Infinite scroll**: Load data progressively as user scrolls
- **Real-time collaboration ready**: Optimistic update system designed for eventual consistency
- **Type-safe**: Full TypeScript coverage with domain-driven design patterns
- **Flexible field types**: Support for text, number, boolean, date, relation, file, and document fields

## Component Hierarchy

```
DataViewsClient-simplified.tsx (Container)
├── DynamicDataSheetGrid.tsx (Grid Manager)
│   ├── GridContext.Provider (State Container)
│   │   ├── GridHeaderBar (Header)
│   │   │   ├── Table Name Display
│   │   │   ├── SearchBar
│   │   │   ├── FilterPopover
│   │   │   │   └── FilterChip[] (Active Filters)
│   │   │   └── Actions (Refresh, Manage Fields)
│   │   ├── DataSheetGrid (Grid Core)
│   │   │   ├── Columns (via useGridColumns hook)
│   │   │   │   ├── ID Column (non-editable)
│   │   │   │   ├── Field Columns
│   │   │   │   │   ├── ColumnHeader (with sort/edit/delete)
│   │   │   │   │   └── Cell Components
│   │   │   │   │       ├── Built-in cells (text, number, boolean, date)
│   │   │   │   │       └── Custom cells (relation, file, document)
│   │   │   │   └── Add Column Button
│   │   │   └── Rows (from TanStack Query)
│   │   └── GridFooter (Pagination Info)
│   └── EditFieldPanel (Field Editor Modal)
```

### Component Responsibilities

#### `DataViewsClient-simplified.tsx`
- **Purpose**: Container component managing queries and mutations
- **Responsibilities**:
  - TanStack Query setup (infinite query, search query, field query)
  - Mutation handlers (update row, add rows, delete row)
  - Query key management with exact matching for optimistic updates
  - Scroll handling with throttling
- **State**: TanStack Store for UI state (selectedTableId, sortBy, searchTerm, activeFilters)

#### `DynamicDataSheetGrid.tsx`
- **Purpose**: Grid manager and local state coordinator
- **Responsibilities**:
  - Field management (create, update, delete fields)
  - Column building via `useGridColumns` hook
  - Grid-level event handling (onChange)
  - GridContext provider setup
  - Local reducer state for sync status
- **State**: Local reducer for grid synchronization state

#### `GridContext` + `useGrid()`
- **Purpose**: Eliminate prop drilling for grid state
- **Provides**: 20+ props to all child components via context
- **Benefits**:
  - GridHeaderBar has 0 props (was 17)
  - Clean component interfaces
  - Easy access to grid state anywhere in tree

#### `GridHeaderBar`
- **Purpose**: Header controls for grid operations
- **Responsibilities**:
  - Display table name and row count
  - Search input with Enter/Escape key handling
  - Filter management via FilterPopover
  - Active filter chips with removal
  - Sort indicator and clear
  - Action buttons (refresh, manage fields)
- **State**: Local state for search input value

#### `useGridColumns` Hook
- **Purpose**: Column configuration builder
- **Responsibilities**:
  - Map field DTOs to column configurations
  - Configure built-in columns (text, number, boolean, date)
  - Configure custom cell components (relation, file, document)
  - Add ID column and Add Column button
  - Wire up ColumnHeader for each field
- **Parameters**: 11 parameters including cell components
- **Returns**: Array of column configurations

## Data Flow

### Query Data Flow (Read Operations)

```
User Action (Scroll/Search/Filter/Sort)
  ↓
DataViewsClient updates query parameters
  ↓
TanStack Query fires query
  ↓
Server Action (getRowsDSG / searchRowsDSG)
  ↓
DuckDB/PostgreSQL via Repository Pattern
  ↓
Arrow format → DSG Row Mapper
  ↓
TanStack Query cache
  ↓
DynamicDataSheetGrid receives rows
  ↓
DataSheetGrid renders cells
```

### Mutation Data Flow (Write Operations)

```
User Edits Cell
  ↓
DataSheetGrid onChange event
  ↓
DynamicDataSheetGrid handleChange
  ↓
Identifies operation type (UPDATE/CREATE/DELETE)
  ↓
For UPDATE:
  ├─→ Local reducer: CELL_CHANGED
  └─→ onUpdateRow mutation
      ├─→ Optimistic update (setQueryData)
      ├─→ Server Action (updateRowData)
      └─→ On error: Rollback (restore previousData)

For CREATE:
  ├─→ Local reducer: ROW_ADDED
  └─→ onAddRows mutation
      ├─→ Server Action (createRows)
      └─→ On success: Invalidate queries

For DELETE:
  ├─→ Local reducer: ROW_DELETED
  └─→ onDeleteRow mutation
      ├─→ Server Action (deleteRowData)
      └─→ On success: Invalidate queries
```

### Filter Data Flow

```
User Adds Filter (FilterPopover)
  ↓
handleAddFilter
  ↓
dataActions.addFilter(filter)
  ↓
TanStack Store updates activeFilters
  ↓
DataViewsClient detects activeFilters change
  ↓
Infinite query re-runs with new filter predicate
  ↓
Server-side filtering (DuckDB WHERE clause)
  ↓
Filtered results → Grid
```

## State Management

### TanStack Store (Global UI State)

Located in: `src/stores/data-management.store.ts`

**State Shape**:
```typescript
interface DataState {
  selectedTableId: number | null
  sortBy: { field?: string; order: 'asc' | 'desc' }
  searchTerm: string
  activeFilters: FilterConfig[]
  // ... other fields
}
```

**Why TanStack Store?**
- Lightweight (~1KB)
- Framework-agnostic
- Simple API
- Perfect for UI state (not domain data)

### TanStack Query (Server State)

**Query Keys** (centralized in `src/lib/query-keys/rows.ts`):
```typescript
rowQueryKeys.all(tableId)                              // All rows for table
rowQueryKeys.infinite(tableId, sortBy, activeFilters)  // Infinite scroll query
rowQueryKeys.search(tableId, searchTerm)               // Search results
rowQueryKeys.detail(tableId, rowId)                    // Single row
```

**Critical Pattern: Exact Query Key Matching**
```typescript
// ❌ WRONG - Creates new query, breaks optimistic updates
const queryKey = ['rows', tableId, 'infinite']

// ✅ CORRECT - Matches infinite query exactly
const queryKey = rowQueryKeys.infinite(tableId, sortBy, activeFilters)
```

**Why This Matters**:
- Optimistic updates must use EXACT same key as the query
- Missing sortBy/activeFilters creates orphaned cache entry
- User sees stale data until next refetch

### Local Component State (GridContext)

**Purpose**: Share props to eliminate drilling

**Contents**:
- Grid data (rows, fields, totalCount)
- Loading/error states
- Event handlers (onUpdateRow, onSort, onAddFilter, etc.)
- Search and filter state

**Why Context Here?**
- Avoids passing 17+ props through multiple layers
- GridHeaderBar needs access to many grid operations
- Not frequently changing (re-renders acceptable)

### Local Reducer State (DynamicDataSheetGrid)

**Purpose**: Track local grid sync state

**State Shape**:
```typescript
type GridState = {
  data: DSGRow[]
  isSyncing: boolean
}
```

**Why Reducer?**
- Multiple state updates need to be atomic
- Clear action-based API
- Easy to track sync status

## Key Architectural Decisions

### 1. Context-Based Grid Architecture (Phase 2)

**Problem**: GridHeaderBar needed 17 props, creating maintenance burden

**Solution**: GridContext + useGrid() hook

**Trade-offs**:
- ✅ Clean component interfaces (GridHeaderBar: 17 props → 0 props)
- ✅ Easy to access grid state throughout component tree
- ❌ Slight performance cost (re-renders on any context change)
- ❌ More indirection (jumping to context definition)

**Decision**: Benefits outweigh costs for header/footer components that render once

**Why NOT for cell components?**
- Cells render 100s of times
- Context re-renders on ANY grid state change
- Only need 2-4 props via columnData
- Performance > convenience for frequently-rendered components

### 2. Centralized Filter Types (Phase 3)

**Problem**: Filter operators defined separately in 3+ files

**Solution**: Single source of truth in `lib/types/filters.ts`

**Benefits**:
- 90% reduction in duplicate code
- Type-safe operator definitions
- Easy to add new operators
- Consistent behavior across components

**Pattern**:
```typescript
export type FilterOperator = 'eq' | 'ne' | 'gt' | /* ... */

export const OPERATORS_BY_FIELD_TYPE = {
  text: TEXT_OPERATORS,
  number: NUMBER_OPERATORS,
  // ...
} as const

export function operatorNeedsValue(op: FilterOperator): boolean
export function getOperatorLabel(op: FilterOperator): string
```

### 3. Centralized activeFilters in Store (Phase 4)

**Problem**: Filters managed in local component state, harder to sync with queries

**Solution**: Move to TanStack Store as global UI state

**Benefits**:
- Single source of truth
- Automatic reset when table changes
- Easy to access from anywhere
- Query keys stay in sync

**Implementation**:
```typescript
// Store
activeFilters: FilterConfig[]

// Actions
dataActions.addFilter(filter)
dataActions.removeFilter(index)
dataActions.clearActiveFilters()

// Usage in queries
rowQueryKeys.infinite(tableId, sortBy, activeFilters)
```

### 4. Extracted Column Builder Hook (Phase 5)

**Problem**: 120+ lines of column building logic in DynamicDataSheetGrid

**Solution**: Extract to `useGridColumns` hook

**Benefits**:
- Can test column building in isolation
- Reduced complexity in main component
- Reusable for other grid implementations
- Better separation of concerns

**Why pass cell components as parameters?**
- Cell components need many dependencies (FileTypeDetector, uiStateActions, etc.)
- Tight coupling to component context
- Passing as params avoids duplicating complex logic
- Hook remains generic and reusable

**Why NOT extract change handler?**
- Tightly coupled to component's reducer state
- Uses dispatch and local state.data
- Would require many parameters
- No clear benefit for added complexity

### 5. Constants and Query Keys (Phase 1)

**Problem**: Magic numbers and manual query key typing throughout codebase

**Solution**: Centralized constants and query key factory

**Constants** (`lib/constants/grid.ts`):
```typescript
export const GRID_CONFIG = {
  PAGE_SIZE: 100,
  FIELD_STALE_TIME: 5 * 60 * 1000,
  ROW_STALE_TIME: 2 * 60 * 1000,
  SEARCH_STALE_TIME: 30 * 1000,
  SCROLL_THRESHOLD: 300,
} as const
```

**Query Keys** (`lib/query-keys/rows.ts`):
```typescript
export const rowQueryKeys = {
  all: (tableId: number) => ['rows', tableId] as const,
  infinite: (tableId, sortBy, filters) =>
    ['rows', tableId, 'infinite', sortBy, filters] as const,
  // ...
}
```

**Benefits**:
- Single place to tune performance
- Type-safe query keys
- Prevents optimistic update bugs
- Self-documenting code

## Performance Optimizations

### 1. Infinite Scroll with Throttling

```typescript
const handleScrollThrottled = useMemo(() => {
  let timeoutId: NodeJS.Timeout | null = null
  let lastRan = 0

  return (e: React.UIEvent<HTMLDivElement>) => {
    const now = Date.now()
    if (now - lastRan >= 100) {
      handleScroll(e)
      lastRan = now
    } else {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(() => {
        handleScroll(e)
        lastRan = Date.now()
      }, 100 - (now - lastRan))
    }
  }
}, [handleScroll])
```

**Why**: Prevents excessive scroll events from triggering too many checks (max 10/sec)

### 2. Optimistic Updates with Rollback

```typescript
onMutate: async ({ rowId, fieldId, value }) => {
  const queryKey = rowQueryKeys.infinite(tableId, sortBy, activeFilters)
  await queryClient.cancelQueries({ queryKey })
  const previousData = queryClient.getQueryData(queryKey)

  queryClient.setQueryData(queryKey, (old: any) => {
    // Update all pages optimistically
    return {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        rows: page.rows.map((row) =>
          row.id === rowId ? { ...row, [fieldName]: value } : row
        )
      }))
    }
  })

  return { previousData, queryKey }
},
onError: (err, variables, context) => {
  if (context?.previousData) {
    queryClient.setQueryData(context.queryKey, context.previousData)
  }
}
```

**Why**: Instant UI feedback, automatic rollback on error

### 3. Stale Time Configuration

```typescript
fieldsQuery: { staleTime: 5 * 60 * 1000 }  // 5 minutes - fields rarely change
rowsQuery: { staleTime: 2 * 60 * 1000 }    // 2 minutes - data moderately fresh
searchQuery: { staleTime: 30 * 1000 }      // 30 seconds - search results change
```

**Why**: Balance between freshness and network requests

### 4. Separate Search Query

```typescript
const rows = useMemo(() => {
  if (searchTerm && searchQuery.data?.rows) {
    return searchQuery.data.rows  // Use search results
  }
  return infiniteRowsQuery.data?.pages.flatMap(page => page.rows) ?? []
}, [searchTerm, searchQuery.data, infiniteRowsQuery.data])
```

**Why**:
- Search has different staleTime and limit
- Prevents infinite query from being disabled during search
- Smooth transition between search and browse modes

## Testing Strategy

### Unit Tests

**What to test**:
- Filter type helpers (`operatorNeedsValue`, `getOperatorLabel`)
- Query key factory consistency
- Column builder hook with different field configurations

**Example**:
```typescript
describe('useGridColumns', () => {
  it('should create text column for text field', () => {
    const { result } = renderHook(() => useGridColumns({
      fields: [{ id: 1, name: 'name', type: 'text' }],
      // ... other params
    }))

    expect(result.current).toHaveLength(3) // ID + field + add button
    expect(result.current[1].type).toBe('text')
  })
})
```

### Integration Tests

**What to test**:
- Full query flow (fetch → render → update → refetch)
- Optimistic update and rollback
- Filter application and server-side filtering
- Search behavior

**Example**:
```typescript
describe('DynamicDataSheetGrid', () => {
  it('should optimistically update and rollback on error', async () => {
    // Mock successful field fetch, failing row update
    // Render grid
    // Edit a cell
    // Verify optimistic update shows immediately
    // Verify rollback happens on error
  })
})
```

### E2E Tests

**What to test**:
- User workflows (add row → edit → save → verify)
- Search, filter, and sort combinations
- Field management (add field → edit field → delete field)
- Infinite scroll behavior

## Common Patterns

### Adding a New Filter Operator

1. Add to `FilterOperator` union type
2. Add to appropriate operator set (TEXT_OPERATORS, etc.)
3. Add label to `OPERATOR_LABELS`
4. Update `operatorNeedsValue` if needed
5. Update server-side predicate builder

### Adding a New Field Type

1. Add to `FieldType` in domain
2. Add to `OPERATORS_BY_FIELD_TYPE` in filters.ts
3. Add case to `useGridColumns` switch statement
4. Create cell component if complex (relation/file/document)
5. Update predicate builder for server-side filtering

### Adding a New Grid Action

1. Add handler to `DataViewsClient` (if needs mutation/query)
2. Pass through DynamicDataSheetGrid props
3. Add to GridContext interface
4. Add to gridValue in DynamicDataSheetGrid
5. Access via `useGrid()` in child components

## Future Improvements

### Potential Optimizations

1. **Virtual scrolling**: For tables with 10,000+ rows
2. **Column virtualization**: For tables with 100+ columns
3. **Web Workers**: For heavy client-side operations
4. **Service Workers**: For offline support

### Potential Features

1. **Bulk operations**: Select multiple rows, bulk edit/delete
2. **Column reordering**: Drag-and-drop column reordering
3. **Row reordering**: Drag-and-drop row reordering
4. **Cell formatting**: Custom formatters per field
5. **Conditional formatting**: Highlight cells based on rules
6. **Export**: CSV/Excel export
7. **Import**: CSV/Excel import with mapping UI

### Technical Debt

1. **Error boundaries**: Add error boundaries for better error handling
2. **Loading states**: More granular loading indicators
3. **Retry logic**: Automatic retry for failed mutations
4. **Conflict resolution**: Handle concurrent edits
5. **Undo/Redo**: Action history with undo/redo

## References

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [TanStack Store Docs](https://tanstack.com/store/latest)
- [react-datasheet-grid Docs](https://react-datasheet-grid.netlify.app/)
- [DDD Patterns](https://martinfowler.com/tags/domain%20driven%20design.html)
