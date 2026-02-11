# Workspace Sync Feature

Bidirectional file sync between local folders and agent workspaces via rsync over SSH in the Tauri desktop app.

## Status: Phase 2 In Progress

- Phase 1 (Local Dev): Complete - rsync + SSH working locally
- Phase 2 (Cloud Deploy): In progress - SSH bastion/container deployment

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

## See Also

- Plan file: `.claude/plans/refactored-wiggling-scone.md`
- Original SFTP implementation: git history
