"""
Workspace storage abstraction layer.

Provides cloud-agnostic workspace storage.
Uses WORKSPACE_STORAGE_PATH environment variable to configure the base path.
"""

from .delta_paths import build_table_relative_path, build_table_s3_path, get_delta_bucket
from .shared_filesystem_storage import SharedFilesystemStorage
from .workspace_paths import (
    AGENT_WORKSPACE_DIRS,
    USER_WORKSPACE_DIRS,
    WORKSPACE_STORAGE_PATH,
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
    # Workspace paths
    "WORKSPACE_STORAGE_PATH",
    "AGENT_WORKSPACE_DIRS",
    "USER_WORKSPACE_DIRS",
    # Delta Lake paths
    "build_table_s3_path",
    "build_table_relative_path",
    "get_delta_bucket",
]
