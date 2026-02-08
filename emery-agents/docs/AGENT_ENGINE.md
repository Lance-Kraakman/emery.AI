# Agent Engine

Unified workspace management for agent execution.

## Directory Structure

Everything lives inside `.engine/` for consistent S3 sync:

```
{workspace_root}/
└── .engine/
    ├── config.json
    ├── memory/chroma/           # ChromaDB (SQLite + HNSW)
    ├── plans/{id}.json          # Execution plans
    ├── history/                 # [future]
    │   ├── transcript.jsonl
    │   └── {date}/{task_id}.json
    ├── file-history/{hash}@v{N} # [future] undo snapshots
    ├── todos/{session}.json     # [future]
    ├── cache/                   # [future]
    ├── debug/{session}.log      # [future]
    ├── workspace/               # Sandbox working directory
    └── context/{table}.parquet  # Synced table &|| table embeddings
```

## Current Implementation

| Service | Property | Storage |
|---------|----------|---------|
| MemoryService | `engine.memory` | ChromaDB |
| PlanFileRepository | `engine.plans` | JSON files |
| BwrapExecutor | `engine.sandbox` | N/A |

### Why Lazy Initialization?

Services are created on first access because:
- `MemoryService` creates ChromaDB client + HF API embeddings (expensive)
- Not all requests need all services (simple queries skip plans)
- Avoids startup cost for unused services

### Why Optional Private Fields?

The `_memory`, `_plans`, `_sandbox` fields are `Optional` for lazy init.
Public properties return non-Optional types (guaranteed initialized).

## Usage

```python
engine = AgentEngine("user-123", "users")
engine.initialize()

# Memory
engine.memory.add("User prefers dark mode", memory_type="preference")
results = engine.memory.search("theme", n_results=3)

# Plans
engine.plans.save(plan)
latest = engine.plans.load_latest()

# Sandbox
output = engine.execute_command("ls -la", allow_network=False)
```

## Data Flow

```
coordinator_streaming.py
    │ creates AgentEngine
    │ calls engine.initialize()
    │ fetches engine.memory.get_context_summary(task)
    ▼
RuntimeContext(engine=engine)
    │ passed to graph nodes
    ▼
nodes (triage, planning, execution, replan)
    │ access runtime.engine.memory / runtime.engine.plans
    ▼
.engine/memory/chroma/  ←→  S3 (tar.gz sync)
.engine/plans/*.json    ←→  S3 (tar.gz sync)
```

## Future Features

### Phase 1: History & Debugging

| Feature | Path | Purpose |
|---------|------|---------|
| HistoryService | `.engine/history/transcript.jsonl` | Append-only conversation log |
| DebugService | `.engine/debug/{session}.log` | Session debug logs |

### Phase 2: File Operations

| Feature | Path | Purpose |
|---------|------|---------|
| FileHistoryService | `.engine/file-history/{hash}@v{N}` | Undo/redo snapshots |
| TodoService | `.engine/todos/{session}.json` | Persistent todos |

### Phase 3: Knowledge & Caching

| Feature | Path | Purpose |
|---------|------|---------|
| KnowledgeService | `.engine/context/{table}.parquet` | Table embeddings for semantic search |
| CacheService | `.engine/cache/` | Embedding/API response cache |

**KnowledgeService details:**
- Synced tables (parquet) already stored in `.engine/context/`
- Calculate embeddings for table columns/rows
- Store embeddings alongside parquet files
- Enable semantic search over structured data
- Similar to S3 Knowledge sync but local to workspace

### Phase 4: Configuration

| Feature | Path | Purpose |
|---------|------|---------|
| SettingsService | `.engine/config.json` | Workspace preferences |

## Implementation Template

```python
# 1. Create service (e.g., engine/history.py)
class HistoryService:
    def __init__(self, paths: EnginePaths):
        self._transcript = paths.transcript

    def append(self, role: str, content: str) -> None:
        with open(self._transcript, "a") as f:
            f.write(json.dumps({"role": role, "content": content}) + "\n")

# 2. Add to AgentEngine
@property
def history(self) -> HistoryService:
    self._ensure_initialized()
    if self._history is None:
        self._history = HistoryService(self.paths)
    return self._history
```

## Key Files

- `engine/engine.py` - AgentEngine class
- `engine/paths.py` - EnginePaths directory structure
- `services/memory/memory_service.py` - ChromaDB wrapper
- `services/planning/plan_file_repository.py` - Plan JSON persistence
