# Comprehensive Application Scalability Audit

**Date:** 2026-02-08
**Audited By:** Claude Code

## Executive Summary

This audit covers 13 major areas of the application. The system has a solid architectural foundation (DDD, proper auth, good security patterns) but has **critical scalability bottlenecks** that will cause problems as you grow.

**Overall Assessment:** The system can handle moderate load (~50 concurrent users, <100MB workspaces) but has issues that will surface at scale.

---

## Critical Issues (Fix Immediately)

| # | Issue | Area | Impact |
|---|-------|------|--------|
| 1 | **No workspace-level locking** | Filesystem/S3 | Data loss when same agent runs concurrent tasks |
| 2 | **Full archive download/upload every task** | Filesystem/S3 | 10-100x unnecessary S3 transfer |
| 3 | **Migration init container `essential=False`** | Deployment | Migrations can fail silently, app starts anyway |
| 4 | **Health check endpoint doesn't exist** | Deployment | ECS health checks will fail in production |
| 5 | **Plaintext API key storage in Tauri** | Security | Desktop app stores API keys unencrypted on disk |
| 6 | **Path traversal in tar extraction** | Security | Malicious archives could escape directory |
| 7 | **No task-level timeout** | Agent Execution | Hung agents block gRPC workers indefinitely |
| 8 | **Blob URL memory leaks** | Frontend | `URL.createObjectURL()` never revoked in 8+ files |

---

## High Severity Issues

### Database Layer
- **N+1 queries** in `dynamic-table-repository.ts` - 100 tables = 101 queries
- **Unbounded queries** - `findAll()`, `getTasksForOrganization()` return everything
- **Missing pagination** on `/api/agents`, `/api/tasks`, `/api/tables`
- **Connection pool size = 5** - too small for concurrent load

### gRPC/API Layer
- **No message size limits** - DoS vector via large payloads
- **Swallowed exceptions** - workspace upload failures logged but not propagated
- **No graceful shutdown** - streaming responses cut off on deploy
- **Single Redis connection** - bottleneck under load

### Agent Execution
- **No persistent task queue** - tasks lost on restart
- **No retry logic** - transient failures become permanent
- **No step checkpointing** - multi-step plans lose progress on crash
- **Unbounded session cache** - memory leak over time

### Streaming
- **No backpressure handling** - slow consumers not signaled
- **ChatProcessingClientRegistry never evicts** - orphaned connections accumulate
- **Unbounded message accumulation** - no pagination in chat history

### File Storage
- **Full file in memory** - no streaming upload/download
- **Race condition in quota enforcement** - concurrent uploads can exceed quota
- **No orphaned file cleanup** - TODO noted but not implemented

---

## Medium Severity Issues

### Frontend
- **No list virtualization** - 100+ items will slow down
- **500KB+ initial bundle** - no code splitting for large modules
- **Missing memoization** - ToolPanel, ToolCard re-render on every message
- **No global error boundary** - errors crash the app

### Caching
- **Worker health cache unbounded** - grows forever
- **Worker connection pool never cleaned** - gRPC connections accumulate
- **localStorage unbounded** - chat histories can grow to 10MB+

### External Integrations
- **No OAuth token refresh logic visible** for Pipedream
- **No rate limiting** on external API calls
- **Webhook processing is synchronous** - could timeout on high load

### Tauri Desktop
- **No storage size limits** - signature cache grows unbounded
- **No schema migration** - config changes break old data
- **No backup before destructive sync** - data could be lost

### DDD Architecture
- **Domain logic leaking** - Tool entity imports from application layer
- **Anemic Agent model** - interface with no behavior
- **Minimal domain events** - cross-aggregate communication is procedural

---

## S3 Cost Analysis

**Request costs are negligible.** Data transfer is the real cost:

| Scenario | Monthly Cost |
|----------|--------------|
| 1K tasks/day, 50MB workspace | ~$135 |
| 1K tasks/day, 100MB workspace | ~$270 |
| 10K tasks/day, 50MB workspace | ~$1,350 |

**The architecture inefficiency (full archive transfer every task) is the problem, not S3 pricing.**

### Workspace Optimization Strategy

**Reality Check:** S3 costs are not that expensive at moderate scale:

| Scenario | Monthly Cost |
|----------|--------------|
| 100 tasks/day, 50MB workspace | **$4.50** |
| 500 tasks/day, 50MB workspace | **$22** |
| 1000 tasks/day, 50MB workspace | **$45** |

**It only gets expensive with:**
- 10K+ tasks/day, OR
- Workspaces bloating to 500MB+ (unbounded history problem)

#### Recommended: Sticky Routing + Local Cache + History Rotation

**1. Sticky Routing** - Route same agent to same machine

```python
# In worker selection logic (e.g., gRPC client or load balancer)
def get_worker_for_agent(agent_id: str, workers: list[str]) -> str:
    """Consistent hashing - same agent always goes to same worker."""
    return workers[hash(agent_id) % len(workers)]
```

**2. Local Cache with ETag Validation**

```python
# workspace_sync.py
from datetime import datetime, timedelta
from typing import ClassVar

class WorkspaceSync:
    # Class-level cache shared across instances
    _workspace_cache: ClassVar[dict[str, tuple[Path, str, datetime]]] = {}
    _cache_lock: ClassVar[asyncio.Lock] = asyncio.Lock()
    CACHE_TTL = timedelta(hours=1)

    def _get_s3_etag(self, org_id: int, workspace_type: str, workspace_id: str) -> str | None:
        """Get ETag without downloading (HEAD request)."""
        try:
            response = self.s3.head_object(
                Bucket=self.bucket,
                Key=self._s3_key(org_id, workspace_type, workspace_id)
            )
            return response.get('ETag', '').strip('"')
        except ClientError:
            return None

    def download(self, org_id: int, workspace_type: str, workspace_id: str) -> Path:
        cache_key = f"{org_id}/{workspace_type}/{workspace_id}"

        # Check cache
        if cache_key in self._workspace_cache:
            path, etag, cached_at = self._workspace_cache[cache_key]

            if datetime.now() - cached_at < self.CACHE_TTL and path.exists():
                # Verify S3 hasn't changed (cheap HEAD request)
                current_etag = self._get_s3_etag(org_id, workspace_type, workspace_id)

                if current_etag == etag:
                    logger.info(f"Using cached workspace: {workspace_id}")
                    return path  # Cache hit! No download needed

        # Cache miss or stale - full download
        local_path = self._full_download(org_id, workspace_type, workspace_id)

        # Update cache
        etag = self._get_s3_etag(org_id, workspace_type, workspace_id)
        self._workspace_cache[cache_key] = (local_path, etag, datetime.now())

        return local_path

    def _full_download(self, org_id: int, workspace_type: str, workspace_id: str) -> Path:
        """Original download logic, renamed."""
        # ... existing download code ...
```

**3. History Rotation** - Prevent unbounded growth

```python
# workspace_sync.py
import shutil
from pathlib import Path
from datetime import datetime, timedelta

class WorkspaceSync:
    MAX_HISTORY_DAYS = 30

    def _cleanup_old_history(self, workspace_path: Path) -> None:
        """Delete history older than MAX_HISTORY_DAYS before upload."""
        history_dir = workspace_path / "history"
        if not history_dir.exists():
            return

        cutoff = datetime.now() - timedelta(days=self.MAX_HISTORY_DAYS)
        deleted_count = 0

        for date_dir in history_dir.iterdir():
            if not date_dir.is_dir():
                continue
            try:
                dir_date = datetime.strptime(date_dir.name, "%Y-%m-%d")
                if dir_date < cutoff:
                    shutil.rmtree(date_dir)
                    deleted_count += 1
            except ValueError:
                pass  # Not a date directory

        if deleted_count > 0:
            logger.info(f"Cleaned up {deleted_count} old history directories")

    def upload(self, org_id: int, workspace_type: str, workspace_id: str) -> str:
        local_path = self._local_path(workspace_id)

        # Clean old history before upload
        self._cleanup_old_history(local_path)

        # ... rest of existing upload code ...
```

#### Future Improvements (Document for Later)

If costs become a concern at scale (10K+ tasks/day), consider:

1. **Delta Sync** - Only transfer changed files
   - Your Tauri frontend already has this (`push_workspace_delta`/`pull_workspace_delta`)
   - Would need to port to Python backend
   - 80-95% transfer reduction
   - Effort: 2-3 days

2. **Shared Cache (EFS)** - For multi-machine scenarios
   - Mount EFS across containers: `/mnt/efs/workspace-cache`
   - Any machine can use cached workspace
   - Cost: ~$0.30/GB/month (much cheaper than repeated S3 transfers)
   - Effort: 1 day + CDK changes

3. **Redis Signature Store** - For cross-machine coordination
   - Store file hashes in Redis
   - Enables delta sync across machines
   - Effort: 1 day

4. **Per-File S3 Storage** - Ultimate scalability
   - Store each file separately instead of tar.gz
   - Only transfer individual changed files
   - 90-99% transfer reduction
   - Effort: 1-2 weeks (significant refactor)

---

## Scalability Thresholds

| Metric | Current Limit | Bottleneck |
|--------|---------------|------------|
| Concurrent agents (same workspace) | **1** | No locking = data loss |
| Concurrent agents (different) | ~50 | gRPC max_concurrent_rpcs |
| Workspace size | 100MB | Memory, upload limit |
| Tasks before disk full (on failure) | ~100-500 | No cleanup on error |
| Concurrent desktop syncs | ~10-20 | In-memory buffering |
| Chat messages before slowdown | ~100 | No virtualization |
| Organizations with large file counts | ~1000 files | O(n) LIST scan |

---

## Recommended Fixes by Priority

### Immediate (This Week)

1. **Add workspace-level locking** in Python backend
   ```python
   workspace_locks: dict[str, asyncio.Lock] = {}
   ```

2. **Fix migration init container** - change `essential=False` to `essential=True`

3. **Create `/api/health` endpoint** - ECS is looking for it

4. **Add task-level timeout** - wrap with `asyncio.wait_for(timeout=3600)`

5. **Use OS keychain** for Tauri API keys instead of plaintext JSON

6. **Validate tar paths** before extraction to prevent traversal

### Short-term (This Month)

7. **Implement delta sync in Python** - only upload changed files

8. **Add pagination** to all list endpoints

9. **Fix N+1 queries** with proper JOINs

10. **Add list virtualization** using `@tanstack/react-virtual`

11. **Revoke blob URLs** in useEffect cleanup

12. **Add code splitting** for chat, org-chart, workflow modules

13. **Implement graceful shutdown** - handle SIGTERM in Next.js

14. **Add periodic /tmp cleanup** - delete workspaces older than 1 hour

### Medium-term (This Quarter)

15. **Stream file uploads/downloads** - use S3 multipart

16. **Implement persistent task queue** (Redis/SQS)

17. **Add retry logic** with exponential backoff

18. **Implement distributed rate limiting** (Redis-based)

19. **Add structured logging** (JSON format for aggregation)

20. **Add distributed tracing** (OpenTelemetry)

21. **Fix connection pool limits** (database, Redis, gRPC)

22. **Implement proper domain events** for cross-aggregate communication

---

## Architecture Strengths

Things that are done well:

- **Security patterns** - RLS, RBAC, proper auth, encrypted tokens
- **DDD structure** - good aggregate boundaries, value objects, repository patterns
- **Sandbox isolation** - bwrap for agent execution
- **Type safety** - TypeScript + Zod throughout
- **Delta sync concept** - exists in Tauri, needs Python implementation

---

## Files to Review

### Critical Path Files
- `emery-agents/src/emery_agents/infrastructure/workspace_sync.py` - workspace locking
- `emery-agents/src/emery_agents/grpc/server.py` - task timeouts, shutdown
- `infra/cdk/stacks/app_stack.py` - migration container, health checks
- `src-tauri/src/workspace_sync.rs` - API key storage, path validation
- `src/app/api/agents/[id]/workspace/sync/push/route.ts` - streaming

### Memory Leak Files
- `src/components/chat/useChatGRPC.tsx` - blob URLs, message accumulation
- `src/ddd/infrastructure/grpc/client.ts` - worker registry cleanup
- `emery-agents/src/emery_agents/services/context/session_manager.py` - session cleanup

### Database Files
- `src/ddd/infrastructure/db/repositories/tables/dynamic-table-repository.ts` - N+1 queries
- `src/ddd/infrastructure/db/client.ts` - connection pool size

---

## Testing Recommendations

To verify fixes:

1. **Workspace locking** - Run 2 concurrent tasks for same agent, verify no data loss
2. **Health checks** - Deploy and verify ECS health check passes
3. **Memory leaks** - Run chat for 30 min, monitor browser memory
4. **Large lists** - Load 1000 agents, verify UI doesn't freeze
5. **Task timeout** - Create task that hangs, verify timeout after 1 hour
6. **Delta sync** - Modify 1 file in 100MB workspace, verify only 1 file transferred

---

## Detailed Findings by Area

### 1. Filesystem/S3 Architecture

**Current Pattern:**
- Every task downloads full workspace tar.gz from S3
- Extracts to `/tmp/workspace/{agent_id}`
- Runs task
- Re-tars everything
- Uploads full archive back to S3

**Problems:**
- 200MB transfer per task for 100MB workspace (even for 1 byte change)
- No locking - concurrent tasks corrupt workspace
- No cleanup on failure - disk fills up
- Shell cache grows unbounded

### 2. Database Layer

**N+1 Query Example:**
```typescript
// dynamic-table-repository.ts - BAD
for (const tableRecord of tableRecords) {
  const fieldRecords = await this.db.query.fields.findMany({
    where: eq(fields.tableId, tableRecord.id),
  });
}

// GOOD - Use JOIN
const tablesWithFields = await this.db.query.tables.findMany({
  where: eq(tables.organizationId, orgId),
  with: { fields: true }
});
```

### 3. gRPC/API Layer

**Missing Limits:**
```python
# server.py - No message size limits
server = grpc.aio.server(
    futures.ThreadPoolExecutor(max_workers=20),
    options=[
        ('grpc.max_send_message_length', 100 * 1024 * 1024),  # ADD THIS
        ('grpc.max_receive_message_length', 100 * 1024 * 1024),  # ADD THIS
    ]
)
```

### 4. Security

**Path Traversal Fix:**
```rust
// workspace_sync.rs - ADD validation
fn validate_tar_path(path: &Path, target_dir: &Path) -> bool {
    let canonical = path.canonicalize().ok();
    canonical.map(|p| p.starts_with(target_dir)).unwrap_or(false)
}
```

### 5. Frontend Memory Leaks

**Blob URL Fix:**
```typescript
// useChatGRPC.tsx - ADD cleanup
useEffect(() => {
  const urls: string[] = [];
  // ... create blob URLs, store in urls array

  return () => {
    urls.forEach(url => URL.revokeObjectURL(url));
  };
}, []);
```

---

---

## Implementation Guide: Critical Fixes

### Fix 1: Workspace-Level Locking

**Problem:** Two concurrent tasks for the same agent will corrupt the workspace.

**File:** `emery-agents/src/emery_agents/infrastructure/workspace_sync.py`

```python
import asyncio
from typing import ClassVar

class WorkspaceSync:
    # Class-level locks shared across instances
    _workspace_locks: ClassVar[dict[str, asyncio.Lock]] = {}
    _locks_lock: ClassVar[asyncio.Lock] = asyncio.Lock()

    async def _get_workspace_lock(self, workspace_id: str) -> asyncio.Lock:
        """Get or create a lock for this workspace."""
        async with self._locks_lock:
            if workspace_id not in self._workspace_locks:
                self._workspace_locks[workspace_id] = asyncio.Lock()
            return self._workspace_locks[workspace_id]

    async def download_with_lock(self, org_id: int, workspace_type: str,
                                  workspace_id: str) -> Path:
        """Download workspace with exclusive lock."""
        lock = await self._get_workspace_lock(workspace_id)
        async with lock:
            return self.download(org_id, workspace_type, workspace_id)

    async def upload_with_lock(self, org_id: int, workspace_type: str,
                                workspace_id: str) -> str:
        """Upload workspace with exclusive lock."""
        lock = await self._get_workspace_lock(workspace_id)
        async with lock:
            return self.upload(org_id, workspace_type, workspace_id)
```

**Then update `server.py`:**
```python
# Change from:
workspace_path = self.workspace_sync.download(org_id, "agents", agent_id)

# To:
workspace_path = await self.workspace_sync.download_with_lock(org_id, "agents", agent_id)
```

---

### Fix 2: Migration Init Container

**Problem:** `essential=False` means migrations can fail and the app still starts.

**File:** `infra/cdk/stacks/app_stack.py`

```python
# Find this block (around line 204):
migration_init_container = frontend_task_definition.add_container(
    f"{prefix}-Migration-Init",
    ...
    essential=False  # <-- WRONG
)

# Change to:
migration_init_container = frontend_task_definition.add_container(
    f"{prefix}-Migration-Init",
    ...
    essential=True  # <-- CORRECT
)

# Also add proper dependency:
frontend_container.add_container_dependencies(
    ecs.ContainerDependency(
        container=migration_init_container,
        condition=ecs.ContainerDependencyCondition.SUCCESS  # Wait for success
    )
)
```

---

### Fix 3: Health Check Endpoint

**Problem:** ECS is configured to check `/api/health` but it doesn't exist.

**Create:** `src/app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/ddd/infrastructure/db/client';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check database connectivity
    await db.execute(sql`SELECT 1`);

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
      }
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
```

---

### Fix 4: Task-Level Timeout

**Problem:** Hung agents block gRPC workers indefinitely.

**File:** `emery-agents/src/emery_agents/grpc/server.py`

```python
import asyncio

class AgentWorkerServiceImplementation:
    TASK_TIMEOUT_SECONDS = 3600  # 1 hour max per task

    async def ExecuteTask(self, request, context):
        try:
            # Wrap entire execution in timeout
            async for event in asyncio.wait_for(
                self._execute_task_impl(request, context),
                timeout=self.TASK_TIMEOUT_SECONDS
            ):
                yield event
        except asyncio.TimeoutError:
            yield StreamResponse(
                type="error",
                error="Task timed out after 1 hour",
                error_code="TASK_TIMEOUT"
            )
        finally:
            # Cleanup even on timeout
            if self.workspace_sync and workspace_path:
                await self.workspace_sync.cleanup(workspace_id)

    async def _execute_task_impl(self, request, context):
        # Move existing ExecuteTask logic here
        ...
```

---

### Fix 5: Secure API Key Storage (Tauri)

**Problem:** API keys stored in plaintext JSON file.

**File:** `src-tauri/src/workspace_sync.rs`

**Option A: Use Tauri's secure storage plugin**

```toml
# Cargo.toml - Add dependency
[dependencies]
tauri-plugin-store = "2"
keyring = "2"  # For OS keychain access
```

```rust
use keyring::Entry;

const SERVICE_NAME: &str = "com.enhancd.workspace-sync";
const API_KEY_ACCOUNT: &str = "api_key";

pub async fn store_api_key(api_key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_ACCOUNT)
        .map_err(|e| format!("Keychain error: {}", e))?;

    entry.set_password(&api_key)
        .map_err(|e| format!("Failed to store API key: {}", e))?;

    Ok(())
}

pub async fn get_api_key() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE_NAME, API_KEY_ACCOUNT)
        .map_err(|e| format!("Keychain error: {}", e))?;

    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get API key: {}", e)),
    }
}
```

---

### Fix 6: Path Traversal Prevention

**Problem:** Tar extraction doesn't validate paths, allowing escape.

**File:** `src-tauri/src/workspace_sync.rs`

```rust
use std::path::Path;

fn validate_archive_path(entry_path: &Path, target_dir: &Path) -> Result<(), SyncError> {
    // Normalize the path
    let full_path = target_dir.join(entry_path);

    // Check for path traversal attempts
    let entry_str = entry_path.to_string_lossy();
    if entry_str.contains("..") || entry_str.starts_with('/') {
        return Err(SyncError::Api(format!(
            "Invalid archive path: {}",
            entry_str
        )));
    }

    // Verify the resolved path is within target directory
    let canonical_target = target_dir.canonicalize()
        .map_err(SyncError::Io)?;

    // For new files, check parent exists and is within target
    if let Some(parent) = full_path.parent() {
        if parent.exists() {
            let canonical_parent = parent.canonicalize()
                .map_err(SyncError::Io)?;
            if !canonical_parent.starts_with(&canonical_target) {
                return Err(SyncError::Api(format!(
                    "Path traversal detected: {}",
                    entry_str
                )));
            }
        }
    }

    Ok(())
}

// Use in extraction:
for entry in archive.entries().map_err(SyncError::Io)? {
    let mut entry = entry.map_err(SyncError::Io)?;
    let path = entry.path().map_err(SyncError::Io)?;

    // Validate before extraction
    validate_archive_path(&path, &local_dir)?;

    entry.unpack_in(&local_dir).map_err(SyncError::Io)?;
}
```

---

### Fix 7: Blob URL Memory Leaks

**Problem:** `URL.createObjectURL()` called without cleanup in 8+ files.

**File:** `src/components/chat/useChatGRPC.tsx`

```typescript
// Track blob URLs for cleanup
const blobUrlsRef = useRef<string[]>([]);

// When creating blob URLs:
const createTrackedBlobUrl = useCallback((file: File) => {
  const url = URL.createObjectURL(file);
  blobUrlsRef.current.push(url);
  return url;
}, []);

// Cleanup on unmount
useEffect(() => {
  return () => {
    blobUrlsRef.current.forEach(url => {
      URL.revokeObjectURL(url);
    });
    blobUrlsRef.current = [];
  };
}, []);

// Cleanup when attachments are cleared
const clearAttachments = useCallback(() => {
  blobUrlsRef.current.forEach(url => {
    URL.revokeObjectURL(url);
  });
  blobUrlsRef.current = [];
  setPendingAttachments([]);
}, []);
```

**Other files to fix:**
- `src/components/chat/artifacts/CodeViewer.tsx`
- `src/components/chat/artifacts/MarkdownViewer.tsx`
- `src/components/billing/CreditBreakdownTabs.tsx`
- `src/app/(app)/templates/components/TemplateGallery.tsx`
- `src/app/(app)/agents/components/CompactAgentHeader.tsx`
- `src/components/org-chart/dialogs/ExportTemplateDialog.tsx`

---

### Fix 8: N+1 Query in Table Repository

**Problem:** Fetching tables with fields makes N+1 queries.

**File:** `src/ddd/infrastructure/db/repositories/tables/dynamic-table-repository.ts`

```typescript
// BEFORE (N+1 queries):
async findByOrganization(organizationId: OrganizationId): Promise<DynamicTable[]> {
  const tableRecords = await this.db.query.tables.findMany({
    where: eq(tables.organizationId, organizationId.value),
  });

  const result: DynamicTable[] = [];
  for (const tableRecord of tableRecords) {
    // This runs N times!
    const fieldRecords = await this.db.query.fields.findMany({
      where: eq(fields.tableId, tableRecord.id),
    });
    result.push(this.toDomain(tableRecord, fieldRecords));
  }
  return result;
}

// AFTER (1 query with JOIN):
async findByOrganization(organizationId: OrganizationId): Promise<DynamicTable[]> {
  const tableRecords = await this.db.query.tables.findMany({
    where: eq(tables.organizationId, organizationId.value),
    with: {
      fields: {
        orderBy: [fields.orderIndex],
      },
    },
  });

  return tableRecords.map(record =>
    this.toDomain(record, record.fields)
  );
}
```

---

### Fix 9: Add Pagination to List Endpoints

**File:** `src/app/api/agents/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // Parse pagination params
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
  const offset = (page - 1) * limit;

  const { agents, total } = await agentService.getAgentsPaginated({
    organizationId,
    limit,
    offset,
  });

  return Response.json({
    success: true,
    data: agents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
```

---

### Fix 10: Graceful Shutdown

**File:** `src/instrumentation.ts` (Next.js instrumentation)

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { cacheService } = await import('@/lib/cache/cache-service');

    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, starting graceful shutdown...`);

      // Close cache connections
      await cacheService.disconnect();

      // Give in-flight requests time to complete
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log('Graceful shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}
```

---

## Conclusion

The application has a solid foundation but needs work on:

1. **Concurrency controls** - workspace locking is critical
2. **Resource efficiency** - delta sync for S3, pagination for DB
3. **Memory management** - cleanup blob URLs, limit caches
4. **Deployment safety** - fix migration container, add health checks

Most issues are fixable with moderate effort. The architecture itself is sound.
