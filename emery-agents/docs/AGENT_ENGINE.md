# Agent Engine Architecture

## Overview

The Agent Engine provides a unified interface for workspace management, replacing scattered service instantiation with a single coherent abstraction. Inspired by Claude Code's `~/.claude/` filesystem structure.

**Entry Point:** `src/emery_agents/engine/engine.py`

---

## Current State

### Directory Structure

```
/tmp/workspace/{workspace_id}/
├── .engine/                      # Engine state directory
│   ├── memory/
│   │   └── chroma/               # ChromaDB persistent storage
│   │       ├── chroma.sqlite3    # Metadata & IDs
│   │       └── {collection}/     # HNSW vector index
│   ├── plans/
│   │   └── {plan_id}.json        # Saved execution plans
│   └── history/                  # (created, unused)
├── workspace/                    # Working directory (sandbox mount)
└── context/                      # Synced table data (parquet)
```

### Implemented Services

| Service | Access | Storage | Status |
|---------|--------|---------|--------|
| MemoryService | `engine.memory` | ChromaDB (SQLite + HNSW) | ✅ Complete |
| PlanFileRepository | `engine.plans` | JSON files | ✅ Complete |
| BwrapExecutor | `engine.sandbox` | N/A (execution) | ✅ Complete |

### Service Mapping

```python
# Old pattern (scattered)
memory_service = MemoryService(workspace_type, workspace_id, base_path)
plan_repo = PlanFileRepository(base_path, workspace_id)

# New pattern (unified)
engine = AgentEngine(workspace_id, workspace_type, base_path)
engine.memory   # Same MemoryService, lazy-initialized
engine.plans    # Same PlanFileRepository, lazy-initialized
```

---

## Usage

### Basic Usage

```python
from emery_agents.engine import AgentEngine

# Create and initialize
engine = AgentEngine(
    workspace_id="user-abc123",
    workspace_type="users",  # or "agents"
    base_path=Path("/tmp/workspace"),
)
engine.initialize()

# Use services
engine.memory.add("User prefers dark mode", memory_type="preference")
memories = engine.memory.search("theme preferences", n_results=3)

engine.plans.save(my_plan)
latest_plan = engine.plans.load_latest()

# Execute commands in sandbox
output = engine.execute_command("ls -la /workspace", allow_network=False)
```

### Context Manager

```python
with AgentEngine(workspace_id, workspace_type) as engine:
    engine.memory.add("Remember this")
    # Automatic cleanup on exit
```

### In Orchestration

```python
# coordinator_streaming.py
engine = AgentEngine(workspace_id, workspace_type, base_path)
engine.initialize()

runtime = RuntimeContext(
    engine=engine,
    # ... other fields
)

# Nodes access via runtime
# triage.py, direct.py, execution.py:
if runtime.engine:
    tools.append(create_memory_crud(runtime.engine.memory))

# planning.py, replan.py:
if runtime.engine:
    runtime.engine.plans.save(plan)
```

---

## Data Storage Details

### Memory (ChromaDB)

**Path:** `.engine/memory/chroma/`

**Files Created:**
- `chroma.sqlite3` - SQLite database for metadata
- `{collection-uuid}/data_level0.bin` - HNSW index vectors
- `{collection-uuid}/header.bin` - Index configuration

**How it works:**
1. Memory content → HuggingFace API → 768-dim embedding
2. ChromaDB stores embedding + metadata in SQLite
3. Semantic search uses HNSW approximate nearest neighbors
4. Entire directory syncs to S3 as tar.gz

**Memory Types:**
- `general` - Default category
- `preference` - User preferences
- `fact` - Learned facts
- `procedure` - How-to knowledge

**PII Handling:**
- Agent workspaces (`workspace_type="agents"`): PII stripped before storage
- User workspaces (`workspace_type="users"`): No redaction (private)

### Plans (JSON Files)

**Path:** `.engine/plans/{plan_id}.json`

**Format:**
```json
{
  "id": "plan-abc123",
  "goal": "Create user registration form",
  "status": "approved",
  "context": "React application with TypeScript",
  "analysis": "Requires form component and validation",
  "steps": [
    {
      "step_id": "step-1",
      "description": "Create FormComponent.tsx",
      "tool_call": "file_write",
      "status": "completed"
    },
    {
      "step_id": "step-2",
      "description": "Add validation logic",
      "status": "pending"
    }
  ]
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 Request Entry Point                          │
│              coordinator_streaming.py                        │
│                                                             │
│  1. Create AgentEngine(workspace_id, workspace_type)        │
│  2. engine.initialize() → creates .engine/ structure        │
│  3. engine.memory.get_context_summary(task)                 │
│  4. Pass engine to RuntimeContext                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    RuntimeContext                            │
│  engine: AgentEngine ────────────────────────────────────┐  │
│    ├── .memory: MemoryService (lazy)                     │  │
│    ├── .plans: PlanFileRepository (lazy)                 │  │
│    └── .sandbox: BwrapExecutor (lazy)                    │  │
└──────────────────────────┬───────────────────────────────┴──┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
     ┌─────────┐     ┌──────────┐     ┌──────────┐
     │ triage  │     │ planning │     │  replan  │
     │  node   │     │   node   │     │   node   │
     └────┬────┘     └────┬─────┘     └────┬─────┘
          │               │                │
          │ memory.add()  │ plans.save()   │ plans.save()
          │ memory.search │                │ memory.add()
          ▼               ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                      Filesystem                              │
│  /tmp/workspace/{id}/.engine/                               │
│    ├── memory/chroma/ ← ChromaDB                            │
│    └── plans/*.json   ← Plan files                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ WorkspaceSync (tar.gz)
                           ▼
                    ┌─────────────┐
                    │  S3 Bucket  │
                    │ (persists)  │
                    └─────────────┘
```

---

## Future Features

### Planned Services

| Service | Path | Purpose | Priority |
|---------|------|---------|----------|
| HistoryService | `.engine/history/transcript.jsonl` | Conversation logging | High |
| FileHistoryService | `.engine/file-history/{hash}@v{N}` | Undo/redo for files | Medium |
| TodoService | `.engine/todos/{session}.json` | Persistent todos | Medium |
| SettingsService | `.engine/config.json` | Workspace preferences | Low |
| DebugService | `.engine/debug/{session}.log` | Debug logs | Low |
| CacheService | `.engine/cache/` | Embedding/API cache | Low |

### Future Directory Structure

```
.engine/
├── config.json               # Workspace settings
├── memory/chroma/            # ✅ Implemented
├── plans/                    # ✅ Implemented
├── history/
│   ├── transcript.jsonl      # Append-only conversation log
│   └── {date}/
│       └── {task_id}.json    # Task results
├── file-history/
│   └── {hash}@v{N}           # File snapshots for undo
├── todos/
│   └── {session}.json        # Todo lists
├── cache/
│   ├── embeddings/           # Cached embeddings
│   └── api-responses/        # Cached API responses
└── debug/
    └── {session}.log         # Debug logs
```

### Implementation Template

To add a new service:

```python
# 1. Create service class (e.g., src/emery_agents/engine/history.py)
class HistoryService:
    def __init__(self, paths: EnginePaths):
        self._transcript = paths.transcript

    def append(self, role: str, content: str, metadata: dict = None) -> None:
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "role": role,
            "content": content,
            **(metadata or {})
        }
        with open(self._transcript, "a") as f:
            f.write(json.dumps(entry) + "\n")

    def get_recent(self, n: int = 10) -> list[dict]:
        if not self._transcript.exists():
            return []
        lines = self._transcript.read_text().strip().split("\n")
        return [json.loads(line) for line in lines[-n:]]

# 2. Add lazy property to AgentEngine
@property
def history(self) -> HistoryService:
    self._ensure_initialized()
    if self._history is None:
        self._history = HistoryService(self.paths)
    return self._history

# 3. Add to __init__ lazy fields
self._history: Optional[HistoryService] = None

# 4. Add to cleanup()
self._history = None
```

---

## Key Files

| File | Purpose |
|------|---------|
| `engine/__init__.py` | Module exports |
| `engine/engine.py` | AgentEngine class |
| `engine/paths.py` | EnginePaths with directory structure |
| `services/memory/memory_service.py` | ChromaDB wrapper |
| `services/planning/plan_file_repository.py` | Plan JSON persistence |
| `orchestrators/runtime.py` | RuntimeContext with engine field |
| `grpc/coordinator_streaming.py` | Engine creation and initialization |

---

## S3 Sync Behavior

1. **Session Start:** `WorkspaceSync.download()` pulls tar.gz from S3
2. **Extract:** Tar unpacked to `/tmp/workspace/{workspace_id}/`
3. **Engine Init:** `AgentEngine.initialize()` fixes permissions (0o700)
4. **Session Work:** ChromaDB/plans write to filesystem
5. **Session End:** `WorkspaceSync.upload()` tars and uploads to S3
6. **Cleanup:** Local directory removed

**Persistence:** All `.engine/` data survives across sessions via S3 sync.

---

## Security

- **Permissions:** 0o700 (owner-only) on all `.engine/` directories
- **Path Validation:** Workspace IDs validated against traversal attacks
- **PII Filtering:** Agent workspaces strip PII before memory storage
- **Sandbox Isolation:** Commands run in bwrap namespace with seccomp filtering
