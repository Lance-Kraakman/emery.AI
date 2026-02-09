# Workspace Sync Feature

Bidirectional file sync between local folders and agent workspaces via SFTP in the Tauri desktop app.

## Status: Phase 1 Complete

- Phase 1 (Local Dev): Complete - SFTP + rsync working locally
- Phase 2 (Cloud Deploy): Not started - AWS Transfer Family needed

## Architecture

### Storage
- **Remote**: EFS filesystem at `/mnt/storage/workspaces/{orgId}/agents/{agentId}/`
- **Local**: User-selected folder synced with Tauri store config
- **Sync Protocol**: SFTP with rsync algorithm (byte-level delta sync)

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

## UI Behavior

### Web (Cloud)
- Download button only (existing behavior)
- Downloads tar.gz archive via HTTP
- No real-time sync

### Tauri (Desktop)
- **Not connected**: Shows "Connect Folder" button
- **Connected**: Shows sync popover with:
  - Connection status (SFTP)
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

## API Endpoints

### EFS-based (Current)
- `GET /api/agents/[id]/workspace/download` - Streams tar.gz from EFS
- `HEAD /api/agents/[id]/workspace/download` - Returns metadata
- `POST /api/agents/[id]/workspace/upload` - Extracts tar.gz to EFS
- `GET /api/agents/[id]/workspace/signatures` - SHA256 manifest for delta sync
- `POST /api/agents/[id]/workspace/sync/push` - Delta push (changed files only)
- `POST /api/agents/[id]/workspace/sync/pull` - Delta pull (changed files only)

### Phase 2 (Planned)
- `GET /api/agents/[id]/sftp-credentials` - Generate temp SFTP credentials
- `POST /api/sftp/authenticate` - Validate SFTP login (for AWS Transfer Family)

## Authentication for Tauri

Rust commands can't access httpOnly session cookies.
Solution: API key auto-generated during device flow login.

1. User authenticates via device flow
2. Server generates API key, returns in response
3. Tauri stores key in secure store
4. Rust commands use key for authenticated requests
5. SFTP uses temporary credentials from API

## Files

### Tauri (Rust)
- `src-tauri/Cargo.toml` - Dependencies (fast-rsync, ssh2, notify)
- `src-tauri/.cargo/config.toml` - RUST_LOG=debug enabled
- `src-tauri/src/lib.rs` - Plugin registration
- `src-tauri/src/workspace_sync.rs` - SFTP sync + file watcher

### Backend (TypeScript)
- `src/app/api/agents/[id]/workspace/download/route.ts` - GET/HEAD (EFS)
- `src/app/api/agents/[id]/workspace/upload/route.ts` - POST (EFS)
- `src/app/api/agents/[id]/workspace/signatures/route.ts` - SHA256 manifest
- `src/app/api/agents/[id]/workspace/sync/push/route.ts` - Delta push
- `src/app/api/agents/[id]/workspace/sync/pull/route.ts` - Delta pull

### Python (Agent)
- `emery-agents/.../infrastructure/storage/shared_filesystem_storage.py` - EFS storage
- `emery-agents/.../services/tasks/workspace_lock.py` - File-based locking

### Frontend (React)
- `src/hooks/useWorkspaceSync.ts` - SFTP sync hook
- `src/hooks/useDeviceFlow.ts` - API key storage
- `src/components/workspace/WorkspaceSyncControls.tsx` - Sync UI

## Rust Commands

```rust
// SFTP Connection
sftp_connect(agent_id, api_key, api_base) -> ()
sftp_disconnect(agent_id) -> ()

// Sync Operations
pull_workspace(agent_id, local_path, api_key, api_base) -> SyncResult
push_workspace(agent_id, local_path, api_key, api_base) -> SyncResult
check_workspace_lock(agent_id) -> WorkspaceLockState

// File Watcher
start_watching(agent_id, local_path) -> ()
stop_watching(agent_id) -> ()

// Config
select_sync_folder() -> String
get_sync_config(agent_id) -> Option<SyncConfig>
set_sync_config(agent_id, folder_path) -> ()
store_api_key(api_key) -> ()
get_api_key() -> Option<String>
```

## Testing

### Local Development
1. Start SFTP: `docker-compose -f src/tests/docker-compose.integration.yml up sftp-integration`
2. Run Tauri: `pnpm tauri:dev`
3. Navigate to an agent
4. Click "Connect Folder" and select directory
5. Click "Pull" - verify files appear
6. Modify a local file - verify auto-sync
7. Run agent task - verify lock status shows
8. Verify `{AgentName}.enhancd.json` appears in folder

## See Also

- Plan file: `.claude/plans/goofy-wobbling-waterfall.md`
- Phase 2 details: AWS Transfer Family deployment
- Phase 3 (planned): File-based event triggers
