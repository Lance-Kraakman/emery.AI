# Bug: Document Loading Fails After Adding New Field

**Date:** 2026-02-07
**Status:** Fixed
**Affected Component:** Delta Lake gRPC Service (`table_proccessing_service.py`)

## Symptoms

When a user:
1. Creates a new document field in the UI
2. Immediately creates a document in that new field (without page reload)

The document fails to load with error: `"Document not found in database"`

After ~5 minutes or a page reload, the document loads correctly.

## Root Cause

The Python gRPC service uses a `DeltaTableCache` to reduce S3 metadata reads. The cache has a 5-minute TTL.

**The Bug:** The `AddField` method was missing a call to `invalidate_delta_cache()` after evolving the schema, while all other write operations (`CreateRows`, `UpdateRows`, `DeleteRows`, `UpdateField`, `DeleteField`) correctly invalidate the cache.

### Cache Configuration
```python
# delta_cache.py line 157
_delta_cache = DeltaTableCache(ttl_seconds=300, max_size=100)  # 5-minute TTL
```

### What the Cache Stores
The `DeltaTable` object contains the table's schema metadata. When cached, the schema is frozen. Even if Delta Lake's `_delta_log` has been updated with a new schema, the cached `DeltaTable` object doesn't know about the new columns.

## Flow Analysis

### Before Fix (Broken):
```
1. User creates new field "DOC" (field ID 280)
2. TypeScript calls gRPC AddField
3. Python AddField evolves Delta Lake schema (7 → 8 columns)
4. Python does NOT call invalidate_delta_cache() ← BUG
5. Cache still has old DeltaTable with 7-column schema
6. User creates document in new field
7. TypeScript calls gRPC UpdateRows → writes document data
8. TypeScript fetches document:
   - Query uses cached DeltaTable (old 7-column schema)
   - Query returns only 7 columns (missing new column 280)
   - Document lookup fails → "Document not found"
```

### After Fix (Working):
```
1. User creates new field "DOC" (field ID 280)
2. TypeScript calls gRPC AddField
3. Python AddField evolves Delta Lake schema (7 → 8 columns)
4. Python calls invalidate_delta_cache(s3_uri) ← FIXED
5. Cache entry removed
6. User creates document → UpdateRows invalidates cache again
7. TypeScript fetches document:
   - Query → cache MISS → loads fresh DeltaTable (8 columns)
   - Query returns all 8 columns including new field
   - Document found successfully
```

## Evidence from Logs

```
09:40:22 [evolve_schema] Added new field '280' (large_string)
09:40:22 [AddField] ✅ Added field 'DOC' to table '8' (schema evolved)
09:40:22 [prepare_query_rows] Query result: (1, 7) rows  ← Still 7 columns!
...
09:53:01 [prepare_query_rows] Query result: (1, 8) rows  ← Now 8 columns (cache expired)
```

## The Fix

**File:** `emery-agents/src/emery_agents/grpc/table_proccessing_service.py`

**Change:** Added `invalidate_delta_cache(s3_uri)` after `apply_field_additions()` in the `AddField` method.

```python
# Apply field additions to Delta Lake schema if table exists
if delta_table and s3_uri:
    apply_field_additions(delta_table, [request.field], s3_uri, storage_options)
    invalidate_delta_cache(s3_uri)  # Clear stale cache so next query gets new schema
    logger.info(f"[AddField] ✅ Added field '{request.field.name}' to table...")
```

## Cache Invalidation Pattern

All write operations should invalidate the Delta table cache:

| Method | Invalidates Cache | Status |
|--------|-------------------|--------|
| CreateRows | ✅ Yes (line 270) | OK |
| UpdateRows | ✅ Yes (line 425) | OK |
| DeleteRows | ✅ Yes (line 469) | OK |
| AddField | ✅ Yes (line 619) | **Fixed** |
| UpdateField | ✅ Yes (line 785) | OK |
| DeleteField | ✅ Yes (line 872) | OK |

## Prevention

When adding new write operations to the Delta Lake service, always call `invalidate_delta_cache(s3_uri)` after any operation that modifies the table schema or data.
