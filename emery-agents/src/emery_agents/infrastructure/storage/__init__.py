"""
Workspace storage abstraction layer.

Provides cloud-agnostic workspace storage.
Uses WORKSPACE_STORAGE_PATH environment variable to configure the base path.
"""

import os

from .shared_filesystem_storage import SharedFilesystemStorage
from .workspace_paths import (
    AGENT_WORKSPACE_DIRS,
    SCRATCH_DIR,
    WORKSPACE_STORAGE_PATH,
    get_agent_config_path,
    get_history_path,
    get_outputs_path,
    get_scratch_path,
    get_workspace_root,
)
from .workspace_storage import WorkspaceStorage, WorkspaceType


def create_workspace_storage() -> WorkspaceStorage:
    """
    Create workspace storage backend.

    Environment variables:
        WORKSPACE_STORAGE_PATH: Base path for storage (default: /mnt/storage/workspaces)

    Returns:
        WorkspaceStorage implementation
    """
    return SharedFilesystemStorage()


__all__ = [
    "WorkspaceStorage",
    "WorkspaceType",
    "SharedFilesystemStorage",
    "create_workspace_storage",
    # Workspace paths (source of truth)
    "WORKSPACE_STORAGE_PATH",
    "AGENT_WORKSPACE_DIRS",
    "SCRATCH_DIR",
    "get_workspace_root",
    "get_agent_config_path",
    "get_scratch_path",
    "get_history_path",
    "get_outputs_path",
]
