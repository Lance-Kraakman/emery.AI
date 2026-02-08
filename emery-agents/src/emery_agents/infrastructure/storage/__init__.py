"""
Workspace storage abstraction layer.

Provides cloud-agnostic workspace storage.
Uses WORKSPACE_STORAGE_PATH environment variable to configure the base path.
"""

import os

from .shared_filesystem_storage import SharedFilesystemStorage
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
]
