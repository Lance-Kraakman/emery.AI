# Storage Architecture: S3 + Parquet + DuckDB

## Overview

Emery uses a modern data architecture optimized for scalability and analytics:

- **Metadata Storage**: PostgreSQL for table/field definitions, users, organizations
- **Data Storage**: S3 + Parquet files for actual table data  
- **Query Engine**: DuckDB for analytical queries on Parquet data
- **Search**: pgvector in PostgreSQL for RAG/semantic search on metadata

This hybrid approach separates fast transactional metadata from large analytical datasets, enabling better scalability and performance.

## Architecture Diagram

```
┌─────────────────┐    Metadata Queries    ┌──────────────────┐
│   PostgreSQL    │ ←─────────────────────→ │   NextJS App     │
│   (Metadata)    │                         │   (Frontend)     │
└─────────────────┘                         └──────────────────┘
         │                                           │
         │ Schema Info                               │ Data Queries
         ▼                                           ▼
┌─────────────────┐    S3 Parquet Files    ┌──────────────────┐
│     DuckDB      │ ←─────────────────────→ │       S3         │
│  (Query Engine) │                         │  (Data Storage)  │
└─────────────────┘                         └──────────────────┘

Storage Structure:
s3://bucket/org_1/db_2/table_3/
├── data.parquet          (main data file)
├── manifest.json         (metadata about the data)
└── schema.json          (parquet schema info)
```

## Current Storage Capabilities

### ✅ Supported Operations (Efficient)

**INSERT (Row Creation)**
- **Performance**: Excellent ⭐⭐⭐⭐⭐
- **How it works**: Appends new data to existing Parquet file
- **Cost**: File rewrite (acceptable for data growth)
- **Use case**: New records, data ingestion

**SELECT (Data Querying)**  
- **Performance**: Excellent ⭐⭐⭐⭐⭐
- **How it works**: DuckDB queries Parquet directly from S3
- **Cost**: Very low - columnar format optimized for analytics  
- **Use case**: Analytics, reporting, data exploration

### ❌ Limited Operations (Expensive)

**UPDATE (Row Modification)**
- **Performance**: Poor ⭐⭐
- **Why limited**: Parquet is append-only format
- **Required process**: Load entire file → Modify in memory → Rewrite entire file
- **Cost**: Very high for large tables
- **Current status**: **Not implemented** - throws descriptive error

**DELETE (Row Removal)**
- **Performance**: Poor ⭐⭐  
- **Why limited**: Parquet is append-only format
- **Required process**: Load entire file → Filter out row → Rewrite entire file
- **Cost**: Very high for large tables
- **Current status**: **Not implemented** - throws descriptive error

## Why Parquet + S3?

### Benefits
- **Scalability**: Handle petabyte-scale data
- **Cost**: S3 storage much cheaper than database storage
- **Analytics**: Columnar format perfect for analytical queries
- **Compression**: Excellent compression ratios (often 10:1)
- **Ecosystem**: Works with many analytical tools (Spark, Athena, etc.)

### Trade-offs
- **OLTP Limitations**: Not optimized for frequent updates/deletes
- **Complexity**: More complex than simple database tables
- **Latency**: Small additional latency for S3 operations

## Current Implementation Status

### Row Operations in S3TableRepository

```typescript
// ✅ IMPLEMENTED - Works well with Parquet
async insertRow(tableId: number, data: CreateRowData): Promise<DynamicTableRow>

// ❌ NOT IMPLEMENTED - Throws helpful error
async updateRow(tableId: number, rowId: string, data: UpdateRowData): Promise<DynamicTableRow>
async deleteRow(tableId: number, rowId: string): Promise<void>
```

### Error Messages
The system provides clear, educational error messages explaining Parquet limitations:

```
Row updates not supported with Parquet storage. 
Parquet is optimized for append-only operations. 
Consider using batch operations or alternative storage for frequently updated data.
```

## Future Enhancements (Roadmap)

### Phase 1: Batch Operations ⏱️ *Planned*

**Batch Insert**
- Bulk load multiple rows efficiently
- Optimized Parquet writing with larger row groups
- Better compression through batching

**Batch Update**
- Collect multiple updates, apply in single file rewrite
- Cost amortization across multiple operations
- Transaction-like semantics

**Batch Delete**
- Collect multiple deletions, filter in single operation
- Efficient bulk removal workflows

### Phase 2: Advanced Patterns ⏱️ *Future*

**Soft Delete Pattern**
```sql
-- Add deleted_at column to all tables
ALTER TABLE user_data ADD COLUMN deleted_at TIMESTAMP;

-- Queries automatically filter deleted rows  
SELECT * FROM user_data WHERE deleted_at IS NULL;
```
- **Pros**: No file rewrites needed
- **Cons**: Storage overhead, requires query modification

**Delta Lake Pattern** 
- Transaction log for all operations
- Tombstone files for deleted rows
- Time travel and versioning capabilities
- **Implementation effort**: High (2-3 months)

**Partition-Based Storage**
```
s3://bucket/org_1/db_2/table_3/
├── year=2024/month=01/part-001.parquet
├── year=2024/month=02/part-001.parquet  
└── year=2024/month=03/part-001.parquet
```
- Updates/deletes only affect relevant partitions
- Much more efficient for time-series data

### Phase 3: Hybrid Storage ⏱️ *Research*

**Hot/Cold Data Separation**
- Frequently updated data in PostgreSQL  
- Archived/analytical data in Parquet
- Automatic migration based on access patterns

## Developer Guidelines

### When to Use This Architecture

**✅ Great For:**
- Analytics and reporting
- Data warehousing  
- Append-heavy workloads (logs, events, measurements)
- Large datasets (>1GB)
- Columnar analysis queries

**❌ Avoid For:**
- High-frequency updates/deletes
- Small datasets (<100MB)
- OLTP workloads
- Real-time transactional systems

### Best Practices

**Data Modeling**
1. Design for append-heavy workflows
2. Use soft deletes where possible (deleted_at columns)
3. Batch operations when feasible
4. Consider data lifecycle (hot vs cold)

**Query Optimization**  
1. Use columnar-friendly WHERE clauses
2. Leverage DuckDB's analytical functions
3. Consider partitioning for time-series data
4. Push filters down to Parquet level

**Performance Considerations**
1. **Row Count**: Optimal 10K-1M rows per file
2. **File Size**: Target 100MB-1GB per Parquet file  
3. **Schema**: Stable schemas work best
4. **Compression**: SNAPPY for balance of speed/size

## Migration Considerations

### From PostgreSQL Dynamic Tables
- ✅ **Schema Migration**: Automated via DDD repositories
- ✅ **Data Migration**: Bulk export → Parquet conversion  
- ✅ **Query Migration**: DuckDB SQL largely compatible
- ⚠️ **Application Changes**: Update/delete operations need rework

### Rollback Plan
- Keep PostgreSQL schema as fallback
- Gradual migration table-by-table
- Feature flags for storage backend selection

## Monitoring and Observability

### Key Metrics
- **Storage Cost**: S3 costs vs PostgreSQL storage
- **Query Performance**: DuckDB response times
- **File Sizes**: Parquet file size distribution  
- **Operation Frequency**: Insert vs update/delete ratios

### Health Checks
```typescript
// Built into DuckDBQueryServiceImpl
async healthCheck(): Promise<Result<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  responseTime: number;
}>>
```

## Support and Troubleshooting

### Common Issues
1. **"Table not found"** → Check S3 path and permissions
2. **"Query timeout"** → Optimize WHERE clauses, consider partitioning  
3. **"Schema mismatch"** → Verify Parquet schema matches field definitions
4. **"Update/Delete not supported"** → Expected behavior, use batch operations when available

### Getting Help
- Check error messages for specific guidance
- Review this documentation for architectural context
- Consider alternative approaches (soft delete, batch operations)
- For complex migrations, consult with the platform team

## Related Documentation
- [SYSTEM_ARCHITECTURE_ANALYSIS.md](./SYSTEM_ARCHITECTURE_ANALYSIS.md) - Overall system design
- [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) - Data migration procedures  
- [CLAUDE.md](../CLAUDE.md) - Development guidelines and patterns

---

*Last Updated: January 2025*  
*Version: 1.0*  
*Status: Current Implementation*