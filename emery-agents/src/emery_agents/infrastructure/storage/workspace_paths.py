"""
Workspace Path Utilities - Single source of truth for workspace paths.

Environment Variables:
    WORKSPACE_STORAGE_PATH: Base path for all workspaces (default: /mnt/storage/workspaces)

Structure:
    {base}/{org_id}/agents/{agent_id}/
    ├── [user files]           <- Agent-created files (synced to user)
    └── .engine/               <- Internal state (NOT synced)
        ├── memory/chroma/     <- ChromaDB embeddings
        ├── plans/             <- Plan files
        └── config.json        <- Agent config
"""

from __future__ import annotations

import os
from pathlib import Path

# Base path from environment (EFS mount in production)
WORKSPACE_STORAGE_PATH = Path(
    os.getenv("WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces")
)

# Directories to create for agent workspaces
AGENT_WORKSPACE_DIRS: list[str] = [
    ".engine",
    ".engine/plans",
    ".engine/memory/chroma",
]

# Directories to create for user workspaces
USER_WORKSPACE_DIRS: list[str] = [
    ".user",
]
