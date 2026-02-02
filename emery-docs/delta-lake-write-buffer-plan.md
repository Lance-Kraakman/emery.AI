# Delta Lake Write Buffer: Redis-Backed Batching Layer

## Context: Why This Is Needed

### Current Architecture

Orchastrate stores dynamic table data in **Delta Lake** (Parquet files on S3/MinIO). The write path is:

```
TypeScript API (Next.js)
  -> gRPC call to Python worker
    -> write_deltalake() or delta_table.merge()
      -> S3: new Parquet file + delta log commit
```

Every single write operation calls `write_deltalake()` directly, which creates:
1. **A new Parquet data file** in S3 (even for 1 row)
2. **A new JSON commit entry** in `_delta_log/`

That's 2 S3 PUT operations per row write. 100 individual row inserts = 100 Parquet files + 100 log entries = 200 S3 API calls.

### The Problem: Small Files

This causes the classic **small files problem**:

- **Slow reads**: Querying a table with hundreds of tiny Parquet files is significantly slower than reading a few well-sized files. Each file requires an S3 GET + Parquet metadata read.
- **High S3 costs**: S3 charges per API call (PUT/GET), not just storage. Tiny writes are expensive.
- **Growing delta log**: Each commit adds a JSON file to `_delta_log/`, slowing down table operations.
- **No compaction**: There are currently no VACUUM or OPTIMIZE jobs to clean this up.

### Current Write Path (What Gets Changed)

**Python gRPC handlers** in `table_proccessing_service.py`:

| Handler | Line | Current Call | What It Does |
|---------|------|-------------|--------------|
| `CreateRows` | 258 | `write_with_schema_evolution(s3_uri, arrow_table, write_mode, storage_options)` | Writes new Parquet file per call |
| `UpdateRows` | 417 | `write_with_merge_operation(s3_uri, arrow_table, storage_options)` | Reads + rewrites affected Parquet files |
| `DeleteRows` | 465 | `dt.delete(predicate)` | Rewrites Parquet files excluding deleted rows |

**Python read path** in `operations.py`:

| Function | Line | What It Does |
|----------|------|--------------|
| `prepare_query_rows` | 143 | Loads from Delta Lake with predicate pushdown, applies filters, sorts, paginates |
| `load_filtered_data` | ~300 | `delta_table.to_pyarrow_table(filters=predicate)` |

### Current Redis Usage

Redis (ioredis) is used **only on the TypeScript side** for:
- Distributed caching with TTL (table metadata, fields, stats, view configs)
- Tag-based cache invalidation
- Data structures: Strings (`setex`) + Sets (tag-based groups)

The **Python worker has no Redis connection** currently.

Config: `src/lib/cache/cache-service.ts`, keys in `src/lib/cache/cache-keys.ts`.

---

## Solution: Redis-Backed Write Buffer

### Overview

Instead of writing directly to Delta Lake on every row operation, buffer writes in Redis and flush to Delta Lake periodically as a single batched write.

```
Write:  TypeScript -> gRPC -> Python -> Redis buffer (instant return)
                                     \-> fallback: direct Delta Lake write if Redis down

Read:   TypeScript -> gRPC -> Python -> Delta Lake + Redis buffer merge -> Arrow IPC

Flush:  Background thread -> read Redis buffer -> batch write to Delta Lake -> clear buffer
```

### Why Redis Hashes (Not Streams)

Redis Streams are the textbook choice for event logs, but they add unnecessary complexity here:

- **Read merging needs O(1) lookup by row_id** -- Hashes give this directly. Streams require sequential reads or consumer groups.
- **Updates/deletes must override prior state** -- In a Hash, a later HSET for the same row_id replaces the previous value. In Streams, entries accumulate and need compaction.
- **Self-compacting** -- If you insert row_1 then update row_1 before flush, only the update exists in the Hash. This keeps the buffer small.

### Redis Key Structure

```
buffer:{s3_uri}:ops           -- Hash: row_id -> JSON {op, data, ts}
buffer:{s3_uri}:flushing      -- Hash: ops being flushed (transient, for crash recovery)
buffer:active_tables           -- Set: s3_uris with pending ops
```

Each entry in the ops Hash looks like:

```json
// Insert
{"op": "insert", "data": {"id": "abc-123", "79": "hello", "80": 42.0}, "ts": 1706803200000}

// Update (full row snapshot, not a diff)
{"op": "update", "data": {"id": "abc-123", "79": "updated", "80": 43.0}, "ts": 1706803200100}

// Delete
{"op": "delete", "data": {"id": "abc-123"}, "ts": 1706803200200}
```

### Read Merge Strategy

Reads must be immediately consistent (user writes a row, queries, sees it). The merge happens in `prepare_query_rows` **after** Delta Lake load but **before** filters/sorting/pagination:

1. Load from Delta Lake with predicate pushdown (existing)
2. Fetch all buffered ops from Redis Hash for this table
3. Merge into DataFrame:
   - Delete ops: filter out matching row_ids
   - Update ops: remove old row, add updated row
   - Insert ops: append new rows
4. Apply LIKE/ILIKE filters (existing)
5. Apply JSONB filters (existing)
6. Apply sorting (existing)
7. Apply pagination (existing)

All existing filter/sort/pagination logic works unchanged on the merged DataFrame.

### Flush Mechanism

A **daemon thread** in the Python gRPC worker flushes based on a dual trigger — time or size, whichever comes first:

- **Time trigger**: 60 seconds since last flush for a table (configurable via `BUFFER_FLUSH_INTERVAL_SECONDS`, default: 60)
- **Size trigger**: Buffer exceeds threshold for a table (configurable via `BUFFER_FLUSH_SIZE_MB`, default: 5MB)

The flush worker checks both thresholds each cycle (runs every ~5s to poll). Per-table buffer size is tracked by summing JSON byte lengths on HSET.

Flush procedure per table:
1. `RENAME buffer:{s3_uri}:ops -> buffer:{s3_uri}:flushing` (atomic -- new writes go to fresh `:ops` key)
2. Read all entries from `:flushing`
3. Partition into inserts, updates, deletes
4. Batch inserts: `write_with_schema_evolution(mode='append')`
5. Batch updates: `write_with_merge_operation`
6. Batch deletes: `dt.delete(predicate)` with combined row_ids
7. `DEL buffer:{s3_uri}:flushing`
8. `invalidate_delta_cache(s3_uri)`
9. Remove from `buffer:active_tables` if `:ops` is empty

The RENAME in step 1 is critical: it atomically rotates the buffer so writes during flush go to a fresh key. Zero write blocking during flush.

### Error Handling

| Scenario | Behavior |
|----------|----------|
| **Redis down** | Falls through to direct Delta Lake write (current behavior). Logged as warning. |
| **Flush failure** | `:flushing` key preserved, retried on next cycle. |
| **Worker restart** | On startup, check for lingering `:flushing` keys and retry immediately. Pending `:ops` survive in Redis (AOF persistence). |
| **Buffer too large** | If ops exceed 10k for a table, force synchronous flush on next write. |
| **Read during flush** | Reads check `:ops` (fresh key), which only has ops that arrived after flush started. No double-counting. |

### Graceful Degradation

If Redis is unavailable at any point:
- **Writes**: Fall back to direct `write_deltalake()` (current behavior)
- **Reads**: Skip buffer merge, query Delta Lake only (current behavior)
- **No data loss**: The system works exactly as it does today, just without batching

---

## Implementation Steps

### Step 1: Add Redis dependency to Python worker

**File:** `emery-agents/pyproject.toml`

Add to `dependencies`:
```
"redis>=5.0.0",
```

### Step 2: Create Redis client singleton

**New file:** `emery-agents/src/emery_agents/grpc/table/redis_client.py`

Singleton `get_redis_client()` that:
- Returns `redis.Redis` instance or `None` if unavailable
- Uses `REDIS_URL` env var (same one used by TypeScript side)
- Connection retry: 3 attempts with exponential backoff
- `decode_responses=True` for string returns (not bytes)

### Step 3: Create write buffer module

**New file:** `emery-agents/src/emery_agents/grpc/table/write_buffer.py`

Class `WriteBuffer`:

```python
class WriteBuffer:
    def __init__(self):
        self._redis = get_redis_client()  # None if unavailable

    @property
    def enabled(self) -> bool:
        return self._redis is not None

    def buffer_creates(self, s3_uri: str, rows_data) -> bool:
        """Buffer insert operations. Returns False if Redis unavailable."""

    def buffer_updates(self, s3_uri: str, rows_data) -> bool:
        """Buffer update operations. Returns False if Redis unavailable."""

    def buffer_deletes(self, s3_uri: str, row_ids: list[str]) -> bool:
        """Buffer delete operations. Returns False if Redis unavailable."""

    def get_buffered_ops(self, s3_uri: str) -> dict[str, dict]:
        """Get all buffered ops for a table. Returns empty dict if Redis unavailable."""

    def rotate_for_flush(self, s3_uri: str) -> dict[str, dict]:
        """Atomically move :ops -> :flushing, return flushing ops."""

    def complete_flush(self, s3_uri: str):
        """Delete :flushing key after successful flush."""

    def get_active_tables(self) -> set[str]:
        """Get all s3_uris with pending buffered ops."""

    def get_incomplete_flushes(self) -> list[str]:
        """Find :flushing keys from prior crashes."""
```

Standalone function:

```python
def merge_buffer_into_dataframe(
    df: pl.DataFrame,
    buffered_ops: dict[str, dict],
    schema: pa.Schema
) -> pl.DataFrame:
    """Merge buffered ops into a Polars DataFrame.

    1. Remove deleted row_ids from df
    2. Remove updated row_ids from df
    3. Build new DataFrame from insert + update data
    4. Concat with original df (vertical_relaxed for schema flexibility)
    """
```

### Step 4: Intercept write operations

**Modify:** `emery-agents/src/emery_agents/grpc/table_proccessing_service.py`

Add `WriteBuffer` to `TableService.__init__`:
```python
from .table.write_buffer import WriteBuffer
self._write_buffer = WriteBuffer()
```

**CreateRows (line 258)** -- replace:
```python
# Current:
write_with_schema_evolution(s3_uri, arrow_table, write_mode, storage_options)
invalidate_delta_cache(s3_uri or "")

# New:
buffered = self._write_buffer.buffer_creates(s3_uri, request.rows_data)
if not buffered:
    write_with_schema_evolution(s3_uri, arrow_table, write_mode, storage_options)
    invalidate_delta_cache(s3_uri or "")
```

**UpdateRows (line 417)** -- replace:
```python
# Current:
write_with_merge_operation(s3_uri or "", arrow_table, storage_options)
invalidate_delta_cache(s3_uri or "")

# New:
buffered = self._write_buffer.buffer_updates(s3_uri, request.rows_data)
if not buffered:
    write_with_merge_operation(s3_uri or "", arrow_table, storage_options)
    invalidate_delta_cache(s3_uri or "")
```

**DeleteRows (line 465)** -- replace:
```python
# Current:
dt.delete(predicate)
invalidate_delta_cache(s3_uri or "")

# New:
buffered = self._write_buffer.buffer_deletes(s3_uri, list(request.row_ids))
if not buffered:
    dt.delete(predicate)
    invalidate_delta_cache(s3_uri or "")
```

### Step 5: Intercept read operations (buffer merge)

**Modify:** `emery-agents/src/emery_agents/grpc/table/operations.py`

Add `s3_uri` and `write_buffer` params to `prepare_query_rows` (line 143):

```python
def prepare_query_rows(
    delta_table: DeltaTable,
    filters, order_by, order_direction, limit, offset, aggregation,
    s3_uri: str = None,           # NEW
    write_buffer = None            # NEW
) -> Tuple[pl.DataFrame, Dict[str, Any]]:
```

Insert merge **after line 177** (load_filtered_data) and **before line 180** (LIKE filters):

```python
df = load_filtered_data(delta_table, filters, schema)

# NEW: Merge buffered writes for immediate consistency
if write_buffer and s3_uri:
    buffered_ops = write_buffer.get_buffered_ops(s3_uri)
    if buffered_ops:
        df = merge_buffer_into_dataframe(df, buffered_ops, schema)

# Existing: Apply LIKE/ILIKE filters...
```

**Modify caller** in `table_proccessing_service.py` QueryRows handler to pass new args:
```python
df, metadata = prepare_query_rows(
    delta_table, ...,
    s3_uri=s3_uri,
    write_buffer=self._write_buffer
)
```

### Step 6: Create flush worker

**New file:** `emery-agents/src/emery_agents/grpc/table/flush_worker.py`

Class `FlushWorker`:
- Daemon thread (Python gRPC server uses threadpool, not asyncio)
- Configurable interval via `BUFFER_FLUSH_INTERVAL_SECONDS` env var (default: 5s)
- Each cycle:
  1. Retry incomplete flushes (`:flushing` keys from prior crashes)
  2. Get active tables from `buffer:active_tables`
  3. For each: rotate -> partition ops -> batch Delta Lake writes -> complete flush
- After flush: `invalidate_delta_cache(s3_uri)`
- Error handling: log and continue on failure, don't crash the thread

### Step 7: Wire flush worker into server startup

**Modify:** `emery-agents/src/emery_agents/grpc/server.py` (line 226-231)

```python
def register_table_services(server):
    table_service_impl = TableService()
    table_service_pb2_grpc.add_TableServiceServicer_to_server(table_service_impl, server)
    table_service_impl.start_flush_worker()  # NEW
```

Add `start_flush_worker` method to `TableService`:
```python
def start_flush_worker(self):
    from .table.flush_worker import FlushWorker
    self._flush_worker = FlushWorker(
        write_buffer=self._write_buffer,
        storage_options_fn=self._get_storage_options,
        flush_interval=int(os.getenv("BUFFER_FLUSH_INTERVAL_SECONDS", "5"))
    )
    self._flush_worker.start()
```

### Step 8: Update GetTableStats for buffer awareness

**Modify:** `table_proccessing_service.py` GetTableStats handler

After computing stats from Delta Lake, adjust row_count:
```python
buffered_ops = self._write_buffer.get_buffered_ops(s3_uri)
if buffered_ops:
    insert_count = sum(1 for op in buffered_ops.values() if op["op"] == "insert")
    delete_count = sum(1 for op in buffered_ops.values() if op["op"] == "delete")
    stats['row_count'] += insert_count - delete_count
```

---

## Environment Configuration

No new infrastructure needed. Redis is already running in both local (docker-compose) and production (ElastiCache).

Add to Python worker environment:
```
REDIS_URL=redis://redis:6379/0
BUFFER_FLUSH_INTERVAL_SECONDS=5
BUFFER_ENABLED=true
```

---

## Files Summary

| Action | File |
|--------|------|
| Modify | `emery-agents/pyproject.toml` -- add `redis>=5.0.0` |
| Create | `emery-agents/src/emery_agents/grpc/table/redis_client.py` |
| Create | `emery-agents/src/emery_agents/grpc/table/write_buffer.py` |
| Create | `emery-agents/src/emery_agents/grpc/table/flush_worker.py` |
| Modify | `emery-agents/src/emery_agents/grpc/table_proccessing_service.py` |
| Modify | `emery-agents/src/emery_agents/grpc/table/operations.py` |
| Modify | `emery-agents/src/emery_agents/grpc/server.py` |

---

## Risk Areas

**Schema drift during buffer period:** If fields are added/removed between buffering and flushing, buffered data may not match current schema. Mitigated by using `vertical_relaxed` concat and `schema_mode="merge"` on flush writes.

**Predicate pushdown bypass:** Delta Lake predicate pushdown only filters Parquet data. Buffered rows bypass pushdown but go through all in-memory filters (LIKE, JSONB, etc.), so results are correct. At worst, a few extra rows are loaded from Delta Lake that would have been filtered -- no functional impact.

**Concurrent flush and read:** After `RENAME`, reads see the fresh `:ops` key (only post-rotation writes), while the flush processes the `:flushing` key. No double-counting possible.

---

## Verification Plan

1. Start local env (Redis already in docker-compose)
2. Create a table, insert 20 single rows rapidly -- verify S3 shows ~1 batched Parquet file (not 20)
3. Insert a row, immediately query -- verify the row appears (buffer merge)
4. Update a buffered row before flush -- verify read returns updated data
5. Delete a buffered row before flush -- verify read excludes it
6. Kill Python worker mid-buffer, restart -- verify buffered data survives (Redis AOF) and flushes
7. Stop Redis -- verify writes fall through to direct Delta Lake (graceful degradation)

---

## Complexity Assessment

- **~250 lines new code, ~280 lines reused** from existing operations
- **Fully isolated** in `emery-agents/src/emery_agents/grpc/table/` — 3 new files, small mods to 3 existing
- **Runs as a daemon thread** inside the existing table gRPC server (port 50052), not a separate service
- **Flush worker reuses existing functions directly** — `write_with_schema_evolution`, `write_with_merge_operation`, `DeltaTable.delete()` have no gRPC coupling
- **Follows established patterns** — `delta_cache.py` for thread-safe singleton, `SessionManager._cleanup_loop()` for background timer

### Relationship to `delta_cache.py`

The delta cache and write buffer solve different problems and are both needed:

| | Delta Cache | Write Buffer |
|---|---|---|
| What it caches | `DeltaTable` metadata objects | Actual row data waiting to be written |
| Problem it solves | Avoids ~50-100ms S3 metadata reads | Avoids new Parquet file per row write |
| Lives in | Python process memory | Redis |

With the write buffer, delta cache becomes *more* important — the flush worker needs `DeltaTable` objects and shouldn't re-read S3 metadata every cycle.

### Infra Gap

`REDIS_URL` is not currently passed to the Python worker. Must be added to:
- `docker-compose.yml` (Python worker environment)
- `infra/app_stack.py` (agent ECS task definition)

---

## Future Considerations (Not In Scope)

- **Redis Multi-AZ failover**: Current setup is single-node ElastiCache Redis (`cache.t4g.micro`, ~$9/month). With a 60-second buffer window, up to 1 minute of writes could be lost on node failure. Upgrading to a `CfnReplicationGroup` with `num_cache_clusters=2` and `automatic_failover_enabled=True` adds a replica in another AZ for ~$18/month total. Recommended when write volume or data criticality increases.
- **Delta Lake VACUUM job**: Separate concern -- clean up old Parquet files from past flushes. Should be scheduled independently (e.g., daily cron).
- **Delta Lake OPTIMIZE/COMPACT**: Separate concern -- consolidate small files from historical writes. Run periodically.
- **TypeScript-side cache invalidation on flush**: Could publish Redis Pub/Sub from flush worker. Low priority since TS cache has TTL-based expiry already.
