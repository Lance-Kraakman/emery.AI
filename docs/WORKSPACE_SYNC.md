# Workspace Sync Feature

Bidirectional file sync between local folders and agent workspaces in the Tauri desktop app.

## Status: Implemented

All phases completed. Ready for testing.

## Architecture

### Storage
- **Remote**: S3 as tar.gz archives at `workspaces/{orgId}/agents/{agentId}.tar.gz`
- **Local**: User-selected folder synced with Tauri store config

### Workspace Structure
```
{workspace_root}/
└── .engine/
    ├── config.json
    ├── memory/chroma/        # Agent memory (ChromaDB)
    ├── plans/{id}.json       # Execution plans
    ├── workspace/            # User files
    └── context/{table}.parquet
```

## UI Behavior

### Web (Cloud)
- Download button only (existing behavior)
- Downloads tar.gz archive

### Tauri (Desktop)
- **Not connected**: Shows "Connect Folder" button
- **Connected**: Shows sync popover with:
  - Folder path
  - Pull/Push buttons
  - Status indicator
  - Refresh status
  - Open folder in file manager
  - Disconnect option

### Conflict Detection
Compares `lastModified` timestamps:
- **Local**: File system mtime
- **Remote**: S3 LastModified header

| Local Changed | Remote Changed | Action |
|---------------|----------------|--------|
| No | No | No sync needed |
| Yes | No | Push allowed |
| No | Yes | Pull allowed |
| Yes | Yes | Conflict dialog |

### Conflict Resolution
Modal with 3 options:
1. **Keep Local** - Push local, overwrite remote
2. **Keep Remote** - Pull remote, overwrite local
3. **Cancel** - Do nothing

## API Endpoints

### GET /api/agents/[id]/workspace/download
Streams tar.gz archive from S3.

### HEAD /api/agents/[id]/workspace/download
Returns metadata (Last-Modified, Content-Length) without body.
Used by Tauri to check remote mtime.

### POST /api/agents/[id]/workspace/upload
Uploads tar.gz archive to S3.

## Authentication for Tauri

Rust commands can't access httpOnly session cookies.
Solution: API key auto-generated during device flow login.

1. User authenticates via device flow
2. Server generates API key, returns in response
3. Tauri stores key in secure store
4. Rust commands use key for authenticated requests

## Files

### Tauri (Rust)
- `src-tauri/Cargo.toml` - Dependencies
- `src-tauri/capabilities/default.json` - Permissions
- `src-tauri/src/lib.rs` - Plugin registration
- `src-tauri/src/workspace_sync.rs` - Sync commands

### Backend (TypeScript)
- `src/app/api/agents/[id]/workspace/download/route.ts` - GET/HEAD
- `src/app/api/agents/[id]/workspace/upload/route.ts` - POST
- `src/lib/workspace/workspace-s3.ts` - S3 operations

### Frontend (React)
- `src/hooks/useWorkspaceSync.ts` - Sync hook
- `src/hooks/useDeviceFlow.ts` - API key storage
- `src/components/workspace/WorkspaceSyncControls.tsx` - Sync UI
- `src/components/workspace/ConflictDialog.tsx` - Conflict modal
- `src/app/(app)/agents/components/CompactAgentHeader.tsx` - Integration

## Rust Commands

```rust
select_sync_folder() -> String
get_sync_config(agent_id) -> Option<SyncConfig>
set_sync_config(agent_id, folder_path) -> ()
check_sync_status(agent_id, api_key, api_base) -> SyncStatus
pull_workspace(agent_id, local_path, api_key, api_base) -> PullResult
push_workspace(agent_id, local_path, api_key, api_base) -> PushResult
store_api_key(api_key) -> ()
get_api_key() -> Option<String>
```

## Testing

### Manual Testing
1. Build Tauri: `cd src-tauri && cargo tauri build`
2. Run desktop app
3. Navigate to an agent
4. Click "Connect Folder" and select directory
5. Click "Pull" - verify extraction
6. Modify a local file
7. Click "Push" - verify upload
8. Run agent task (creates remote changes)
9. Click "Pull" with local changes - verify conflict dialog
10. Test each conflict resolution option

## Future Enhancements
- File watcher for auto-sync
- Selective sync (only `.engine/workspace/`)
- Sync history/log
- Background sync service
