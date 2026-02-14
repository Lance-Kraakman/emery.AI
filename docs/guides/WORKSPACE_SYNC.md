# Workspace Sync Feature

Bidirectional file sync between local folders and agent workspaces via rsync over SSH in the Tauri desktop app, with real-time SSE notifications.

## Status: Production Ready

- Phase 1 (Local Dev): Complete - rsync + SSH working locally
- Phase 2 (Cloud Deploy): Complete - SSH bastion/container deployed
- Phase 3 (Real-time): Complete - SSE notifications for workspace changes

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        SERVER SIDE                          │
│                                                             │
│   ┌─────────────────┐         ┌─────────────────┐          │
│   │  Python Worker  │         │   Next.js API   │          │
│   │  (task exec)    │         │   (SSE/REST)    │          │
│   └────────┬────────┘         └────────┬────────┘          │
│            │ direct fs                 │ direct fs          │
│            │                           │                    │
│            ▼                           ▼                    │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                      EFS / NFS                       │  │
│   │  .emery-lock   .emery-sync-version   user-files/    │  │
│   └─────────────────────────────────────────────────────┘  │
│                              ▲                              │
└──────────────────────────────┼──────────────────────────────┘
                               │ rsync (SSH)
                               │ ⬅️ EXCLUSIONS APPLY HERE
┌──────────────────────────────┼──────────────────────────────┐
│                              ▼                              │
│   ┌─────────────────────────────────────────────────────┐  │
│   │               Local Filesystem (Mac/Win)             │  │
│   │  .emery-lock ❌  .emery-sync-version ❌  user-files/ │  │
│   └─────────────────────────────────────────────────────┘  │
│                        CLIENT SIDE                          │
│                     (Tauri Desktop)                         │
└─────────────────────────────────────────────────────────────┘
```

**Key insight:** rsync exclusions only affect Tauri ↔ EFS sync. They don't affect:
- Python agent reading/writing `.emery-lock` on EFS (direct filesystem)
- SSE endpoint reading files on EFS (direct filesystem)

## Architecture

### Storage
- **Remote**: EFS filesystem at `/mnt/storage/workspaces/{orgId}/agents/{agentId}/`
- **Local**: User-selected folder synced with Tauri store config
- **Sync Protocol**: rsync over SSH (native delta sync)

### Sync Protocol

```
┌─────────────┐   rsync over SSH    ┌─────────────────┐
│ Tauri App   │ ─────────────────── │ SSH Container   │ ──── EFS
│ (Desktop)   │    (delta sync)     │ (port 2222)     │
└─────────────┘                     └─────────────────┘
                                           │
       HTTP API (lock check, key reg)      │
       ─────────────────────────────────────
                                           │
                                    ┌──────▼──────┐
                                    │ Next.js App │
                                    └─────────────┘
```

**Why rsync over SSH instead of SFTP?**
- Native delta sync (only changed bytes transfer)
- Built-in compression (`-z` flag)
- Partial file resume (`--partial`)
- Battle-tested (30+ years)
- No AWS Transfer Family needed (~$216/mo savings)

### Workspace Structure
```
{workspace_root}/
├── {AgentName}.enhancd.json    # Agent identifier (visible in folder)
├── .agent/
│   ├── config.json
│   ├── memory/chroma/          # Agent memory (ChromaDB)
│   └── plans/{id}.json         # Execution plans
├── workspace/
│   ├── context/                # Synced tables/data
│   ├── scratch/                # Working files
│   └── outputs/                # Generated artifacts
└── history/
    └── {date}/{task_id}/
        ├── session.jsonl       # Execution log
        └── result.json         # Task result
```

## SSH Key Management

### Key Generation (Tauri)
Keys are generated client-side using pure Rust (`ssh-key` crate):
- Algorithm: Ed25519
- Location: `~/.ssh/emery_sync_ed25519`
- Cross-platform: Works on Windows/Mac/Linux without external dependencies

### Key Registration Flow
1. Tauri generates Ed25519 key pair on first connect
2. Registers public key via `POST /api/user/ssh-keys`
3. Backend stores in `user_ssh_keys` table
4. Lambda/cron syncs keys to SSH container every 60 seconds
5. SSH container reloads `authorized_keys`

### Database Schema
```sql
CREATE TABLE user_ssh_keys (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  public_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  name TEXT DEFAULT 'Desktop Sync',
  last_used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, fingerprint)
);
```

## UI Behavior

### Web (Cloud)
- Download button only (existing behavior)
- Downloads tar.gz archive via HTTP
- No real-time sync

### Tauri (Desktop)
- **Not connected**: Shows "Connect Folder" button
- **Connected**: Shows sync popover with:
  - Connection status (SSH/rsync)
  - File watcher status
  - Lock status (agent working)
  - Pull/Push buttons
  - Pending changes count
  - Last sync timestamp
  - Disconnect option

### Workspace Locking
File-based locking prevents sync conflicts during agent execution:

- **Lock file**: `.emery-lock` in workspace root
- **Created by**: Agent when task starts
- **Deleted by**: Agent when task completes
- **Tauri behavior**: Queues changes locally, shows "Agent working..."
- **Stale locks**: Ignored after 1 hour (agent crashed)
- **Lock check**: Via HTTP API (not rsync)

## Real-Time Updates (SSE)

### Event System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS SERVER                                  │
│                                                                              │
│  GET /api/agents/[id]/stream (stream/route.ts)                               │
│  ├── Creates ReadableStream                                                  │
│  ├── Polls EVERY 1 SECOND                                                    │
│  │                                                                           │
│  │   Each poll cycle:                                                        │
│  │   ├── Reads DB for tasks                                                  │
│  │   ├── Reads .emery-lock file existence                                    │
│  │   │   └── access(join(workspacePath, '.emery-lock'))                      │
│  │   ├── Reads .emery-sync-version content                                   │
│  │   │   └── readFile(join(workspacePath, '.emery-sync-version'))            │
│  │   │                                                                       │
│  │   └── IF value changed from last poll:                                    │
│  │       └── sendEvent() → writes to SSE stream                              │
│  │                                                                           │
│  └── Events emitted:                                                         │
│      ├── lock_changed: { locked: boolean }                                   │
│      ├── workspace_updated: { version: string }                              │
│      └── tasks_updated: [...]                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ SSE Stream (HTTP long-poll)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TAURI DESKTOP                                   │
│                                                                              │
│  start_agent_sse (workspace_sync.rs)                                         │
│  ├── Creates EventSource connection to /api/agents/[id]/stream              │
│  ├── Runs in background tokio task                                           │
│  │                                                                           │
│  └── On receiving SSE event:                                                 │
│      ├── "lock_changed" → app.emit("agent-lock-changed", { locked })         │
│      └── "workspace_updated" → app.emit("agent-workspace-updated", { ver })  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Tauri Events (in-process)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REACT FRONTEND                                  │
│                                                                              │
│  useWorkspaceSync.ts                                                         │
│  ├── listen("agent-lock-changed") → handleLockChange(locked)                 │
│  │   └── If locked: true→false transition (agent finished)                   │
│  │       └── Calls pull_workspace (rsync pull)                               │
│  │                                                                           │
│  └── listen("agent-workspace-updated") → handleWorkspaceUpdate(version)      │
│      └── Calls pull_workspace (rsync pull)                                   │
│                                                                              │
│  WorkspaceSection.tsx                                                        │
│  └── useAgentStream → onWorkspaceUpdate + onLockChange                       │
│      └── Calls refreshEntries() (silent, no loading spinner)                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Coordination Files

| File | Purpose | Location | Written By |
|------|---------|----------|------------|
| `.emery-lock` | Workspace locking | EFS only | Python agent |
| `.emery-sync-version` | Change detection | EFS only | Web editor, sync/push API, desktop (via SSH) |

**Important:** These files are **excluded from rsync** to prevent sync loops. They are server-side only coordination files.

### Who Reads/Writes Coordination Files

#### `.emery-lock`

| Component | Operation | Access Method |
|-----------|-----------|---------------|
| Python Worker | CREATE (acquire) | Direct FS on EFS |
| Python Worker | DELETE (release) | Direct FS on EFS |
| Python Worker | READ (check) | Direct FS on EFS |
| SSE Endpoint | READ (check exists) | Direct FS on EFS |
| Tauri Desktop | READ (check) | HTTP API call |
| File Watcher | IGNORED | `IGNORED_PATTERNS` |
| rsync | EXCLUDED | `--exclude .emery-lock` |

#### `.emery-sync-version`

| Component | Operation | Access Method |
|-----------|-----------|---------------|
| Web File Editor | WRITE (timestamp) | Direct FS on EFS |
| sync/push API | WRITE (timestamp) | Direct FS on EFS |
| Desktop rsync push | WRITE (timestamp) | SSH command after rsync |
| SSE Endpoint | READ (detect changes) | Direct FS on EFS |
| File Watcher | IGNORED | `IGNORED_PATTERNS` |
| rsync | EXCLUDED | `--exclude .emery-sync-version` |

### When `.emery-sync-version` Gets Updated

| Event | Updates Version | Location |
|-------|-----------------|----------|
| Web editor saves file | ✅ Yes | `file/route.ts` |
| Web deletes via sync/push | ✅ Yes | `sync/push/route.ts` |
| Desktop rsync push | ✅ Yes | SSH write after rsync |
| Agent task completion | ❌ No | Uses lock release as proxy |

**Agent changes:** The UI refreshes on `lock_changed: false` event (agent finished working), not on workspace_updated.

## Data Flows

### Flow A: Desktop User Edits File

```
1. User edits file in local synced folder
   ↓
2. File watcher detects change (workspace_sync.rs)
   - Filters via IGNORED_PATTERNS (excludes .emery-lock, .emery-sync-version)
   - Emits "workspace-file-change" event
   ↓
3. useWorkspaceSync receives event
   - Calls push() → push_workspace
   ↓
4. push_workspace runs rsync PUSH
   - Uses excludes: .DS_Store, Thumbs.db, *.swp, *.swo, *~, .emery-lock, .emery-sync-version
   - Syncs only user files to EFS
   ↓
5. SSH write updates .emery-sync-version on server
   - echo '{timestamp}' > {remote}/.emery-sync-version
   ↓
6. SSE detects version change
   - Sends workspace_updated event
   ↓
7. Web UI receives event
   - WorkspaceSection calls refreshEntries() (no loading spinner)
   - File tree updates to show new content
```

### Flow B: Web Editor Saves File

```
1. Web editor PUT /api/agents/[id]/workspace/file
   ↓
2. file/route.ts
   - Writes file to EFS
   - Writes .emery-sync-version = Date.now()
   ↓
3. SSE detects version change
   - Sends workspace_updated event
   ↓
4. Tauri receives event via SSE client
   - Emits 'agent-workspace-updated' Tauri event
   ↓
5. useWorkspaceSync handles event
   - Calls pull_workspace() → rsync pull
   - Local folder updated (excludes coordination files)
```

### Flow C: Agent Task Execution

```
1. Python worker receives task via gRPC
   ↓
2. Acquire lock (workspace_lock.py)
   - Creates .emery-lock on EFS
   ↓
3. SSE detects lock file exists
   - Sends lock_changed: { locked: true }
   ↓
4. Tauri receives lock event
   - Sets lockState = true
   - User edits are queued instead of pushed
   ↓
5. Agent modifies workspace files on EFS
   - Does NOT update .emery-sync-version (uses lock as proxy)
   ↓
6. Release lock (workspace_lock.py)
   - Deletes .emery-lock on EFS
   ↓
7. SSE detects lock gone
   - Sends lock_changed: { locked: false }
   ↓
8. Tauri receives event
   - Detects transition: locked=true → locked=false
   - Calls pull_workspace() → gets agent's file changes
   - Syncs any pending local changes
   ↓
9. Web UI receives lock_changed event
   - WorkspaceSection calls refreshEntries()
   - File tree shows agent's changes
```

### Flow D: Web Delete via sync/push API

```
1. User clicks delete in WorkspaceSection
   ↓
2. confirmDelete() → POST /api/agents/[id]/workspace/sync/push
   - Body: { deleted: ["path/to/file"], files: {} }
   ↓
3. sync/push/route.ts processes
   - rm(fullPath, { recursive: true, force: true })
   - Updates .emery-sync-version
   ↓
4. SSE detects version change
   - Sends workspace_updated event
   ↓
5. Tauri receives, pulls changes
   - rsync --delete removes local file too
```

## API Endpoints

### EFS-based (Current)
- `GET /api/agents/[id]/workspace/download` - Streams tar.gz from EFS
- `HEAD /api/agents/[id]/workspace/download` - Returns metadata
- `POST /api/agents/[id]/workspace/upload` - Extracts tar.gz to EFS
- `GET /api/agents/[id]/workspace/file?path=/...` - Read single file (for lock check)
- `PUT /api/agents/[id]/workspace/file?path=/...` - Write single file

### SSH Key Management
- `POST /api/user/ssh-keys` - Register SSH public key
- `GET /api/user/ssh-keys` - List user's SSH keys
- `DELETE /api/user/ssh-keys?fingerprint=xxx` - Delete a key

### Phase 2 (Planned)
- `GET /api/agents/[id]/workspace/ssh-info` - Get SSH connection details

## Authentication for Tauri

Rust commands can't access httpOnly session cookies.
Solution: API key auto-generated during device flow login.

1. User authenticates via device flow
2. Server generates API key, returns in response
3. Tauri stores key in secure store
4. Rust commands use key for authenticated HTTP requests
5. SSH uses Ed25519 key pair (registered via API)

## Files

### Tauri (Rust)
- `src-tauri/Cargo.toml` - Dependencies (ssh-key, dirs, notify, reqwest)
- `src-tauri/src/lib.rs` - Plugin registration
- `src-tauri/src/workspace_sync.rs` - rsync sync + file watcher + SSH key generation

### Backend (TypeScript)
- `src/app/api/agents/[id]/workspace/download/route.ts` - GET/HEAD (EFS)
- `src/app/api/agents/[id]/workspace/upload/route.ts` - POST (EFS)
- `src/app/api/agents/[id]/workspace/file/route.ts` - GET/PUT single file
- `src/app/api/user/ssh-keys/route.ts` - SSH key registration

### Python (Agent)
- `emery-agents/.../infrastructure/storage/shared_filesystem_storage.py` - EFS storage
- `emery-agents/.../services/tasks/workspace_lock.py` - File-based locking

### Frontend (React)
- `src/hooks/useWorkspaceSync.ts` - rsync sync hook
- `src/hooks/useDeviceFlow.ts` - API key storage
- `src/components/workspace/WorkspaceSyncControls.tsx` - Sync UI

### Infrastructure
- `docker-compose.yml` - SSH+rsync container for local dev
- `infra/infra/app_stack.py` - Production SSH bastion (planned)

## Rust Commands

```rust
// SSH Connection (key generation + registration)
sftp_connect(agent_id, org_id, api_key, api_base) -> ()
sftp_disconnect(agent_id) -> ()
sftp_is_connected(agent_id) -> bool

// Sync Operations (via rsync)
pull_workspace(agent_id, local_path, api_key, api_base) -> SyncResult
push_workspace(agent_id, local_path, api_key, api_base) -> SyncResult
sync_pending_changes(agent_id, api_key, api_base) -> SyncResult

// Lock Check (via HTTP API)
check_workspace_lock(agent_id, api_key, api_base) -> WorkspaceLockState

// File Watcher
start_watching(agent_id, local_path) -> ()
stop_watching(agent_id) -> ()
is_watching(agent_id) -> bool

// Config
select_sync_folder() -> String
get_sync_config(agent_id) -> Option<SyncConfig>
set_sync_config(agent_id, folder_path) -> ()
store_api_key(api_key) -> ()
get_api_key() -> Option<String>
```

## Testing

### Local Development
1. Start SSH container: `docker compose up ssh-sync -d`
2. Run Tauri: `pnpm tauri:dev`
3. Navigate to an agent
4. Click "Connect Folder" and select directory
5. Click "Pull" - verify files appear
6. Modify a local file - verify auto-sync
7. Run agent task - verify lock status shows
8. Verify `{AgentName}.enhancd.json` appears in folder

### Manual rsync test
```bash
# Test rsync connectivity
rsync -avz -e "ssh -p 2222 -i ~/.ssh/emery_sync_ed25519 -o StrictHostKeyChecking=no" \
  ./test-folder/ agent@localhost:/workspace/test/
```

## Windows Support

**SSH Key Generation**: Pure Rust (`ssh-key` crate), works everywhere.

**rsync**: Bundled cwRsync binaries in Tauri app:
- `src-tauri/resources/cwrsync/rsync.exe`
- `src-tauri/resources/cwrsync/ssh.exe`
- Required DLLs

Download from: https://itefix.net/cwrsync (free version)

## Cost Comparison

| Component | Old (SFTP) | New (rsync) |
|-----------|------------|-------------|
| AWS Transfer Family | $216+/mo | $0 |
| EC2 t4g.nano | $0 | ~$3/mo |
| EFS | Same | Same |
| **Total** | $216+/mo | ~$3/mo |

## rsync Configuration

### Exclude Patterns

Both push and pull operations use the same excludes:

```
--exclude .DS_Store
--exclude Thumbs.db
--exclude *.swp
--exclude *.swo
--exclude *~
--exclude .emery-lock
--exclude .emery-sync-version
```

**Why exclude coordination files:**
- `.emery-lock` and `.emery-sync-version` are server-side only
- Desktop reads them via HTTP API / SSE events, NOT from local filesystem
- Syncing them causes stale values to overwrite server values
- This triggers false "change detected" events → sync loops

### File Watcher Patterns

The file watcher uses `IGNORED_PATTERNS` to filter events:

```rust
const IGNORED_PATTERNS: &[&str] = &[
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "__pycache__",
    "target",
    ".DS_Store",
    "Thumbs.db",
    "*.swp",
    "*.swo",
    "*~",
    ".emery-lock",
    ".emery-sync-version",
];
```

## Troubleshooting

### Sync Loop (Constant Refreshes)

**Symptoms:**
- WorkspaceSection refreshes every second
- Network tab shows constant `/workspace/browse` requests
- SSE sends `workspace_updated` events continuously

**Root Cause (Fixed):**
rsync was syncing `.emery-sync-version` bidirectionally:
1. Web editor saves → writes `.emery-sync-version = "1707500000"` on server
2. SSE detects → sends `workspace_updated`
3. Tauri rsync PULL → copied `.emery-sync-version` to local
4. User edits → Tauri rsync PUSH
5. rsync PUSHED old `.emery-sync-version` back to server
6. SSE sees "change" → sends another event
7. LOOP!

**Solution:**
- Added rsync excludes for `.emery-lock` and `.emery-sync-version`
- Files stay server-side only, no sync loop

### Workspace Not Updating After Agent Task

**Check:**
1. Is SSE connection active? Check network tab for `/api/agents/[id]/stream`
2. Is `lock_changed` event being received? Check console for `agent-lock-changed`
3. Does WorkspaceSection have `onLockChange` handler?

### Desktop Edits Not Syncing to Web

**Check:**
1. Is file watcher running? Check sync popover status
2. Is workspace locked? Agent might be working
3. Is rsync push succeeding? Check Tauri logs
4. Is SSH write to `.emery-sync-version` succeeding?

## See Also

- Plan file: `.claude/plans/gleaming-petting-newt.md`
- Original SFTP implementation: git history
