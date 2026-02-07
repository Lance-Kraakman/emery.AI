"""
Agent Engine - Encapsulated workspace and execution management.

The AgentEngine class provides a unified interface for:
- Workspace filesystem management
- Memory (ChromaDB semantic storage)
- Plan persistence
- History/transcripts (future)
- File versioning (future)
- Sandbox execution

Directory structure:
    {workspace_id}/
    ├── .engine/
    │   ├── memory/chroma/    # ChromaDB
    │   ├── plans/            # Saved plans
    │   ├── history/          # Transcripts (future)
    │   ├── file-history/     # Edit snapshots (future)
    │   ├── todos/            # Todo lists (future)
    │   ├── cache/            # Cached data (future)
    │   └── debug/            # Debug logs (future)
    ├── workspace/            # Working files
    └── context/              # Synced table data
"""

from .engine import AgentEngine
from .paths import EnginePaths

__all__ = ["AgentEngine", "EnginePaths"]
