"""
Workspace Path Utilities - Single source of truth for workspace paths.

All workspace path constants and helpers live here.
Use these instead of hardcoding paths throughout the codebase.

Environment Variables:
    WORKSPACE_STORAGE_PATH: Base path for all workspaces (default: /mnt/storage/workspaces)

Structure:
    {base}/{org_id}/agents/{agent_id}/
    ├── [user files]           <- Synced from local folder
    ├── .engine/               <- Agent config + memory
    ├── history/               <- Task execution logs
    └── scratch/               <- Agent working space
"""

from __future__ import annotations

import os
from pathlib import Path

# Base paths from environment
WORKSPACE_STORAGE_PATH = Path(
    os.getenv("WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces")
)

# Subdirectory names (engine-created)
AGENT_CONFIG_DIR = ".engine"
HISTORY_DIR = "history"
SCRATCH_DIR = "scratch"
SCRATCH_CONTEXT_DIR = "scratch/context"
SCRATCH_OUTPUTS_DIR = "scratch/outputs"

# All directories engine should create for agent workspaces
AGENT_WORKSPACE_DIRS: list[str] = [
    AGENT_CONFIG_DIR,
    f"{AGENT_CONFIG_DIR}/plans",
    f"{AGENT_CONFIG_DIR}/memory",
    f"{AGENT_CONFIG_DIR}/memory/chroma",
    HISTORY_DIR,
    SCRATCH_DIR,
    SCRATCH_CONTEXT_DIR,
    SCRATCH_OUTPUTS_DIR,
]

# Directories for user workspaces (simpler structure)
USER_WORKSPACE_DIRS: list[str] = [
    ".user",
    HISTORY_DIR,
    SCRATCH_DIR,
    SCRATCH_OUTPUTS_DIR,
]


def get_workspace_root(org_id: int, agent_id: int) -> Path:
    """Get agent workspace root path."""
    return WORKSPACE_STORAGE_PATH / str(org_id) / "agents" / str(agent_id)


def get_user_workspace_root(org_id: int, user_id: str) -> Path:
    """Get user workspace root path."""
    return WORKSPACE_STORAGE_PATH / str(org_id) / "users" / user_id


def get_agent_config_path(workspace_root: Path) -> Path:
    """Get path to agent config directory."""
    return workspace_root / AGENT_CONFIG_DIR


def get_scratch_path(workspace_root: Path) -> Path:
    """Get path to agent scratch/working directory."""
    return workspace_root / SCRATCH_DIR


def get_history_path(workspace_root: Path) -> Path:
    """Get path to task history directory."""
    return workspace_root / HISTORY_DIR


def get_outputs_path(workspace_root: Path) -> Path:
    """Get path to agent outputs directory."""
    return workspace_root / SCRATCH_OUTPUTS_DIR
