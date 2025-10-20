# DuckDB Infrastructure Layer

## Overview

This directory contains the DuckDB infrastructure implementation for analytical queries on dynamic tables. DuckDB provides high-performance analytics on Arrow-backed tables stored in S3.

## Architecture

### 1:1 Mapping
```
Domain Table (PostgreSQL)          DuckDB Virtual Table            S3 Arrow File
├── id: 123                  →     table_123              →       s3://bucket/org_1/db_5/table_123/data.arrow
├── name: "Customers"
├── organizationId: 1
└── databaseId: 5
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Application Layer                                            │
│ - TableApplicationService                                    │
│ - Uses repository interface (domain abstraction)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Infrastructure Layer (DuckDB)                                │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ DuckDBDynamicTableRepository                           │  │
│ │ - Implements IDynamicTableRepository                   │  │
│ │ - Creates virtual tables (1:1 with domain tables)      │  │
│ │ - Uses SQL templates for queries                       │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ DuckDBSqlTemplates                                     │  │
│ │ - Type-safe SQL template builder                       │  │
│ │ - CRUD operations                                       │  │
│ │ - Analytical queries (aggregations, joins)             │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ DuckDBSqlExecutor                                      │  │
│ │ - Executes SQL with logging                            │  │
│ │ - Transaction support                                   │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ DuckDB Engine                                                │
│ - In-process analytical database                            │
│ - Reads Arrow files directly from S3 (zero-copy)           │
│ - SQL optimizer for complex queries                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ S3 Storage                                                   │
│ - Arrow IPC files (columnar format)                         │
│ - Efficient for analytical workloads                         │
└─────────────────────────────────────────────────────────────┘
```

## Files

### `duckdb-sql-templates.ts`
SQL template builder following the same pattern as `db/sql-templates.ts`.

**Key classes:**
- `DuckDBSqlTemplates` - Static template methods
- `DuckDBSqlLogger` - Development logging
- `DuckDBSqlExecutor` - Template execution with transaction support

**Example:**
```typescript
import { DuckDBSqlTemplates, DuckDBSqlExecutor } from './duckdb-sql-templates'

// Simple select query
const sql = DuckDBSqlTemplates.selectRows({
  tableId: 123,
  limit: 50,
  offset: 0,
  orderBy: 'created_at',
  orderDirection: 'DESC'
})

// Analytical aggregation
const aggSql = DuckDBSqlTemplates.aggregateQuery({
  tableId: 123,
  groupBy: ['category', 'region'],
  aggregates: [
    { field: 'revenue', function: 'SUM' },
    { field: 'orders', function: 'COUNT' }
  ]
})
```

### `duckdb-dynamic-table-repository.ts`
Infrastructure implementation of `IDynamicTableRepository` using DuckDB.

**Features:**
- 1:1 virtual table mapping
- SQL template-based queries
- Automatic virtual table refresh after writes
- S3 Arrow file integration

**Example:**
```typescript
// Repository is injected via DI container
const repository = getDynamicTableRepository()

// Paginated query (uses DuckDB SQL)
const rows = await repository.getRows(
  TableId.fromNumber(123),
  { limit: 50, offset: 0 }
)

// DuckDB executes: SELECT * FROM table_123 LIMIT 50 OFFSET 0
```

### `duckdb-sql-builder.ts` (Existing)
Fluent query builder for complex analytical queries.

**Use cases:**
- Dynamic filters
- Complex WHERE clauses
- Multi-table joins

## DI Container Integration

### Registration
The DuckDB repository is automatically registered in the DI container:

```typescript
// src/ddd/application/di/container.ts

// Create DuckDB connection
const duckdbConnection = await DuckDBConnection.create()

// Register DuckDB repository (with fallback)
const tableRepository = duckdbConnection
  ? new DuckDBDynamicTableRepository(db, duckdbConnection, arrowService)
  : new DynamicTableRepository(db, arrowService, queryService) // Fallback

// Application services use the interface - don't know it's DuckDB!
const tableAppService = new TableApplicationService(
  dynamicTableService,
  databaseRepository,
  organizationRepository,
  tableRepository // ← Could be DuckDB or standard repository
)
```

### Usage
```typescript
// In server actions or application code
import { getTableApplicationService } from '@/ddd/application/di/container'

const service = getTableApplicationService()

// This will use DuckDB repository if available
const rows = await service.getRows(tableId, { limit: 50, offset: 0 })
```

## Server Actions

### Infinite Scroll with DuckDB

```typescript
// src/app/actions/duckdb-rows.ts

export async function getRowsDataDSGPaginated(
  tableId: number,
  options: { limit?: number; offset?: number }
): Promise<{ rows: DSGRow[]; hasMore: boolean }> {
  const tableAppService = getTableApplicationService()

  // Uses DuckDB repository for efficient pagination
  const rows = await tableAppService.getRows(
    TableId.fromNumber(tableId),
    { limit: options.limit ?? 50, offset: options.offset ?? 0 }
  )

  return {
    rows: rows.map(row => ({ id: row.id.value, ...row.toPlainObject() })),
    hasMore: rows.length === options.limit
  }
}
```

### Frontend Integration
```typescript
// Using TanStack Query's useInfiniteQuery
const rowsQuery = useInfiniteQuery({
  queryKey: ['rows', tableId],
  queryFn: ({ pageParam = 0 }) =>
    getRowsDataDSGPaginated(tableId, {
      limit: 50,
      offset: pageParam
    }),
  getNextPageParam: (lastPage) =>
    lastPage.hasMore ? lastPage.rows.length : undefined
})

// Flatten pages for grid display
const rows = rowsQuery.data?.pages.flatMap(page => page.rows) ?? []
```

## Table Lifecycle

### 1. Table Creation
```typescript
// Domain layer
const table = await tableAppService.createTable({
  name: "Customers",
  databaseId,
  organizationId,
  createdBy
})

// DuckDB repository automatically:
// 1. Creates PostgreSQL metadata record
// 2. Initializes empty Arrow file in S3
// 3. Creates DuckDB virtual table: table_{id}
```

### 2. Virtual Table Mapping
```sql
-- DuckDB virtual table points to S3 Arrow file
CREATE OR REPLACE TABLE table_123 AS
SELECT * FROM read_arrow_ipc('s3://bucket/org_1/db_5/table_123/data.arrow')
```

### 3. Data Operations
```typescript
// INSERT
await repository.insertRow(tableId, row)
// → DuckDB: INSERT INTO table_123 VALUES (...)
// → Refreshes virtual table to see new data

// UPDATE
await repository.updateRow(tableId, rowId, row)
// → DuckDB: UPDATE table_123 SET ... WHERE id = '...'
// → Refreshes virtual table

// SELECT (with pagination)
await repository.getRows(tableId, { limit: 50, offset: 100 })
// → DuckDB: SELECT * FROM table_123 LIMIT 50 OFFSET 100
// → No need to load entire dataset!
```

### 4. Table Deletion
```typescript
await repository.delete(tableId)
// 1. DROP TABLE table_123 (DuckDB)
// 2. Delete S3 Arrow files
// 3. Delete PostgreSQL metadata
```

## Benefits

### 🚀 Performance
- **Zero-copy reads**: DuckDB reads Arrow files directly without conversion
- **True pagination**: LIMIT/OFFSET at database level, not in-memory
- **Column-oriented**: Arrow format optimized for analytical queries
- **Parallel processing**: DuckDB uses all CPU cores

### 📊 Analytics
- **Aggregations**: Fast GROUP BY, SUM, AVG, COUNT
- **Joins**: Efficient multi-table joins
- **Window functions**: ROW_NUMBER, RANK, LAG, LEAD
- **Complex filters**: Full SQL WHERE clause support

### 🏗️ Architecture
- **DDD compliant**: Infrastructure layer implements domain interface
- **Separation of concerns**: Templates, executor, repository clearly separated
- **Testable**: Each component can be tested independently
- **Fallback support**: Gracefully falls back to standard repository if DuckDB unavailable

## Testing

### Unit Tests
```typescript
describe('DuckDBSqlTemplates', () => {
  it('generates correct SELECT with pagination', () => {
    const sql = DuckDBSqlTemplates.selectRows({
      tableId: 123,
      limit: 50,
      offset: 100
    })

    expect(sql).toContain('SELECT * FROM table_123')
    expect(sql).toContain('LIMIT 50')
    expect(sql).toContain('OFFSET 100')
  })
})
```

### Integration Tests
```bash
# Start test environment
pnpm test:integration:server

# Run DuckDB repository tests
pnpm test:integration:file src/tests/integration/duckdb-repository.test.ts
```

## DDD Principles Compliance

### ✅ Correct Patterns
- **Infrastructure layer**: DuckDB is pure infrastructure, no domain logic
- **Repository interface**: Implements `IDynamicTableRepository` from domain
- **Dependency injection**: Registered in DI container, injected into services
- **Domain isolation**: Domain entities (Row, DynamicTable) have no DuckDB knowledge

### ❌ Anti-patterns Avoided
- **No domain leakage**: Domain doesn't know about DuckDB
- **No mixed concerns**: SQL templates separate from execution logic
- **No god objects**: Clear single responsibility (templates, executor, repository)

## Future Enhancements

### 1. Indexes
```sql
-- Create index on virtual table for faster queries
CREATE INDEX idx_table_123_status ON table_123(status)
```

### 2. Materialized Views
```sql
-- Pre-computed aggregations
CREATE MATERIALIZED VIEW table_123_daily_stats AS
SELECT DATE_TRUNC('day', created_at), COUNT(*), SUM(revenue)
FROM table_123
GROUP BY 1
```

### 3. Partitioning
```typescript
// Split large tables into partitions
const partitionPath = s3Path.getPartitionPath(0) // part_000000.arrow
```

### 4. Query Optimization
```typescript
// Add EXPLAIN ANALYZE support
const stats = await executor.explain(sql)
console.log('Query plan:', stats)
```

## Troubleshooting

### DuckDB Connection Issues
```bash
# Check if DuckDB is initialized
✅ DuckDB connection created for analytical queries
✅ Using DuckDB repository for table operations
```

If you see:
```bash
⚠️ Failed to create DuckDB connection, falling back to standard repository
```

Check:
1. `@duckdb/node-api` is installed: `pnpm install @duckdb/node-api`
2. Node version supports DuckDB (v16+)
3. Platform supports DuckDB (Linux, macOS, Windows x64)

### S3 Configuration
Ensure environment variables are set:
```bash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=ap-southeast-2
S3_ENDPOINT_URL=http://localhost:9000  # For local development
```

### Virtual Table Not Found
```sql
Error: table_123 does not exist
```

Solution: Virtual table needs to be created when table is first accessed:
```typescript
await repository.refreshVirtualTable(tableId, s3Path)
```

## References

- [DuckDB Documentation](https://duckdb.org/docs/)
- [Apache Arrow Format](https://arrow.apache.org/docs/format/Columnar.html)
- [React DataSheet Grid Infinite Scroll](https://react-datasheet-grid.netlify.app/docs/examples/infinite-scroll)
- [DDD Infrastructure Layer](../../CLAUDE.md)
