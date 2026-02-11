"""
Abstract interface for workspace storage.

Provides cloud-agnostic workspace access.
Implementations: SharedFilesystemStorage (EFS, Azure Files, NFS, local disk)
"""

from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional


class WorkspaceType(str, Enum):
    """
    Type of workspace - determines directory structure.

    AGENTS: Agent task workspaces at /{org_id}/agents/{agent_id}/
    USERS: User chat session workspaces at /{org_id}/users/{user_id}/
    """
    AGENTS = "agents"
    USERS = "users"


class WorkspaceStorage(ABC):
    """
    Abstract interface for workspace storage.

    Workspaces are persistent directories that contain:
    - .agent/ - Agent configuration and memory
    - workspace/ - Working files (context, scratch, outputs)
    - history/ - Task execution history

    Implementations should provide:
    - SharedFilesystemStorage: EFS, Azure Files, NFS, local disk
    """

    @abstractmethod
    def get_workspace_path(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> Path:
        """
        Get the local path for a workspace. Creates if doesn't exist.

        Args:
            org_id: Organization ID
            workspace_type: Type of workspace (AGENTS or USERS)
            workspace_id: Workspace identifier (agent_id or user_id)

        Returns:
            Path to workspace directory (already exists on return)
        """
        pass

    @abstractmethod
    def workspace_exists(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> bool:
        """
        Check if workspace exists.

        Args:
            org_id: Organization ID
            workspace_type: Type of workspace (AGENTS or USERS)
            workspace_id: Workspace identifier

        Returns:
            True if workspace directory exists
        """
        pass

    @abstractmethod
    def delete_workspace(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> None:
        """
        Delete a workspace entirely.

        Args:
            org_id: Organization ID
            workspace_type: Type of workspace (AGENTS or USERS)
            workspace_id: Workspace identifier
        """
        pass

    @abstractmethod
    def get_last_modified(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> Optional[datetime]:
        """
        Get last modification time of workspace.

        Args:
            org_id: Organization ID
            workspace_type: Type of workspace (AGENTS or USERS)
            workspace_id: Workspace identifier

        Returns:
            Most recent file modification time, or None if workspace doesn't exist
        """
        pass

    @abstractmethod
    def rotate_history(
        self,
        org_id: int,
        workspace_type: WorkspaceType,
        workspace_id: str,
        max_days: int = 30,
    ) -> int:
        """
        Delete history older than max_days.

        Args:
            org_id: Organization ID
            workspace_type: Type of workspace (AGENTS or USERS)
            workspace_id: Workspace identifier
            max_days: Maximum age of history to keep

        Returns:
            Count of deleted history directories
        """
        pass

    @abstractmethod
    def prepare_task_history(
        self,
        org_id: int,
        workspace_type: WorkspaceType,
        workspace_id: str,
        task_id: str,
    ) -> Path:
        """
        Prepare history directory for a new task execution.

        Creates: history/{date}/{task_id}/

        Args:
            org_id: Organization ID
            workspace_type: Type of workspace (AGENTS or USERS)
            workspace_id: Workspace identifier
            task_id: Task ID

        Returns:
            Path to task history directory
        """
        pass

    @abstractmethod
    def save_task_result(
        self,
        org_id: int,
        workspace_type: WorkspaceType,
        workspace_id: str,
        task_id: str,
        result: dict[str, Any],
    ) -> Path:
        """
        Save task result to workspace history.

        Args:
            org_id: Organization ID
            workspace_type: Type of workspace (AGENTS or USERS)
            workspace_id: Workspace identifier
            task_id: Task ID
            result: Result data to save

        Returns:
            Path to result file
        """
        pass

    @abstractmethod
    def append_to_session_log(
        self,
        org_id: int,
        workspace_type: WorkspaceType,
        workspace_id: str,
        task_id: str,
        entry: dict[str, Any],
    ) -> None:
        """
        Append entry to task session log.

        Args:
            org_id: Organization ID
            workspace_type: Type of workspace (AGENTS or USERS)
            workspace_id: Workspace identifier
            task_id: Task ID
            entry: Log entry to append
        """
        pass
