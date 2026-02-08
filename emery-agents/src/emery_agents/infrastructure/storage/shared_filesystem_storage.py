"""
Shared filesystem workspace storage implementation.

Works with EFS, Azure Files, NFS, or local disk.
Configured via WORKSPACE_STORAGE_PATH environment variable.
"""

import json
import logging
import os
import re
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, ClassVar, Optional

from .workspace_storage import WorkspaceStorage, WorkspaceType

logger = logging.getLogger(__name__)


class SharedFilesystemStorage(WorkspaceStorage):
    """
    Workspace storage using a shared filesystem (EFS, Azure Files, NFS, local).

    Directory structure:
        {base_path}/
        └── {org_id}/
            ├── agents/
            │   └── {agent_id}/
            │       ├── .agent/
            │       │   ├── config.json      # Agent configuration
            │       │   ├── memory.jsonl     # Persistent memory (future)
            │       │   ├── plans/           # Saved execution plans
            │       │   └── memory/chroma/   # Vector store for RAG
            │       ├── workspace/
            │       │   ├── context/         # Synced tables/data
            │       │   ├── scratch/         # Working files
            │       │   └── outputs/         # Generated artifacts
            │       └── history/
            │           └── {date}/{task_id}/
            │               ├── session.jsonl  # Execution log
            │               └── result.json    # Task result
            └── users/
                └── {user_id}/
                    ├── .user/
                    │   └── config.json      # User session config
                    ├── workspace/
                    │   ├── scratch/         # Working files
                    │   └── outputs/         # Generated artifacts
                    └── history/
                        └── {date}/{task_id}/
    """

    # Default directories for agent workspaces (full agent context)
    AGENT_DIRS: ClassVar[list[str]] = [
        ".agent",
        ".agent/plans",
        ".agent/memory",
        ".agent/memory/chroma",
        "workspace",
        "workspace/context",
        "workspace/scratch",
        "workspace/outputs",
        "history",
    ]

    # Default directories for user workspaces (simpler - just chat sessions)
    USER_DIRS: ClassVar[list[str]] = [
        ".user",
        "workspace",
        "workspace/scratch",
        "workspace/outputs",
        "history",
    ]

    # Regex for validating workspace IDs (alphanumeric, underscore, hyphen)
    WORKSPACE_ID_PATTERN: ClassVar[re.Pattern[str]] = re.compile(r"^[a-zA-Z0-9_-]+$")

    def __init__(self, base_path: Optional[str] = None):
        """
        Initialize storage.

        Args:
            base_path: Root path for workspaces.
                       Defaults to WORKSPACE_STORAGE_PATH env var
                       or /mnt/storage/workspaces
        """
        self.base_path = Path(
            base_path
            or os.getenv("WORKSPACE_STORAGE_PATH", "/mnt/storage/workspaces")
        )
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"SharedFilesystemStorage initialized at {self.base_path}")

    def _validate_workspace_id(self, workspace_id: str) -> None:
        """Validate workspace ID to prevent path traversal."""
        if not self.WORKSPACE_ID_PATTERN.match(workspace_id):
            raise ValueError(
                f"Invalid workspace_id: {workspace_id}. "
                "Must contain only alphanumeric characters, underscores, and hyphens."
            )
        if ".." in workspace_id or workspace_id.startswith("/"):
            raise ValueError(f"Invalid workspace_id: {workspace_id}. Path traversal detected.")

    def _workspace_path(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> Path:
        """Get path without creating."""
        self._validate_workspace_id(workspace_id)
        return self.base_path / str(org_id) / workspace_type.value / workspace_id

    def get_workspace_path(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> Path:
        """Get workspace path, creating with default structure if needed."""
        path = self._workspace_path(org_id, workspace_type, workspace_id)

        if not path.exists():
            logger.info(f"Creating new workspace: {path}")
            self._create_workspace(path, workspace_type, workspace_id)

        return path

    def _create_workspace(
        self, path: Path, workspace_type: WorkspaceType, workspace_id: str
    ) -> None:
        """Create workspace with default directory structure."""
        # Use appropriate directory structure based on workspace type
        dirs = self.AGENT_DIRS if workspace_type == WorkspaceType.AGENTS else self.USER_DIRS
        for subdir in dirs:
            (path / subdir).mkdir(parents=True, exist_ok=True)

        # Create initial config in the appropriate directory
        config_dir = ".agent" if workspace_type == WorkspaceType.AGENTS else ".user"
        config = {
            "workspace_id": workspace_id,
            "workspace_type": workspace_type.value,
            "created_at": datetime.now().isoformat(),
            "version": 1,
        }
        config_path = path / config_dir / "config.json"
        config_path.write_text(json.dumps(config, indent=2))

    def workspace_exists(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> bool:
        """Check if workspace exists."""
        return self._workspace_path(org_id, workspace_type, workspace_id).exists()

    def delete_workspace(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> None:
        """Delete a workspace entirely."""
        path = self._workspace_path(org_id, workspace_type, workspace_id)
        if path.exists():
            shutil.rmtree(path)
            logger.info(f"Deleted workspace: {path}")

    def get_last_modified(
        self, org_id: int, workspace_type: WorkspaceType, workspace_id: str
    ) -> Optional[datetime]:
        """Get most recent modification time in workspace."""
        path = self._workspace_path(org_id, workspace_type, workspace_id)
        if not path.exists():
            return None

        latest = None
        for file_path in path.rglob("*"):
            if file_path.is_file():
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                if latest is None or mtime > latest:
                    latest = mtime
        return latest

    def rotate_history(
        self,
        org_id: int,
        workspace_type: WorkspaceType,
        workspace_id: str,
        max_days: int = 30,
    ) -> int:
        """Delete history older than max_days."""
        workspace_path = self._workspace_path(org_id, workspace_type, workspace_id)
        history_dir = workspace_path / "history"

        if not history_dir.exists():
            return 0

        cutoff = datetime.now() - timedelta(days=max_days)
        deleted = 0

        for date_dir in history_dir.iterdir():
            if not date_dir.is_dir():
                continue
            try:
                dir_date = datetime.strptime(date_dir.name, "%Y-%m-%d")
                if dir_date < cutoff:
                    shutil.rmtree(date_dir)
                    deleted += 1
            except ValueError:
                continue

        if deleted:
            logger.info(f"Rotated {deleted} old history dirs for {workspace_id}")

        return deleted

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
        workspace_path = self.get_workspace_path(org_id, workspace_type, workspace_id)
        date_str = datetime.now().strftime("%Y-%m-%d")
        history_dir = workspace_path / "history" / date_str / task_id

        history_dir.mkdir(parents=True, exist_ok=True)
        (history_dir / "session.jsonl").touch()

        return history_dir

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
        workspace_path = self.get_workspace_path(org_id, workspace_type, workspace_id)
        date_str = datetime.now().strftime("%Y-%m-%d")
        history_dir = workspace_path / "history" / date_str / task_id

        history_dir.mkdir(parents=True, exist_ok=True)
        result_path = history_dir / "result.json"
        result_path.write_text(json.dumps(result, indent=2, default=str))

        return result_path

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
        workspace_path = self.get_workspace_path(org_id, workspace_type, workspace_id)
        date_str = datetime.now().strftime("%Y-%m-%d")
        session_log = workspace_path / "history" / date_str / task_id / "session.jsonl"

        # Ensure directory exists
        session_log.parent.mkdir(parents=True, exist_ok=True)

        # Add timestamp if not present
        if "timestamp" not in entry:
            entry["timestamp"] = datetime.now().isoformat()

        with open(session_log, "a") as f:
            f.write(json.dumps(entry) + "\n")
