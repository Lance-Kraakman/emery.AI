"""
Shared filesystem workspace storage implementation.

Works with EFS, Azure Files, NFS, or local disk.
Configured via WORKSPACE_STORAGE_PATH environment variable.
"""

import json
import logging
import re
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, ClassVar, Optional

from .workspace_paths import (
    AGENT_WORKSPACE_DIRS,
    USER_WORKSPACE_DIRS,
    WORKSPACE_STORAGE_PATH,
)
from .workspace_storage import WorkspaceStorage, WorkspaceType

logger = logging.getLogger(__name__)


class SharedFilesystemStorage(WorkspaceStorage):
    """
    Workspace storage using a shared filesystem (EFS, Azure Files, NFS, local).

    Directory structure (user files synced to root, system dirs created by engine):
        {base_path}/
        └── {org_id}/
            ├── agents/
            │   └── {agent_id}/
            │       ├── [user files]         # Synced from local folder (rsync)
            │       ├── .agent/              # Agent config + memory (persistent)
            │       │   ├── config.json
            │       │   ├── plans/
            │       │   └── memory/chroma/
            │       ├── history/             # Task execution logs
            │       │   └── {date}/{task_id}/
            │       │       ├── session.jsonl
            │       │       └── result.json
            │       └── scratch/             # Agent working space
            │           ├── context/
            │           └── outputs/
            └── users/
                └── {user_id}/
                    ├── .user/
                    ├── history/
                    └── scratch/

    Note: User files appear in workspace root (synced via rsync).
    System directories (.agent, history, scratch) are created by the engine.
    See workspace_paths.py for the source of truth on directory names.
    """

    # Directory structures imported from workspace_paths.py (source of truth)
    AGENT_DIRS: ClassVar[list[str]] = AGENT_WORKSPACE_DIRS
    USER_DIRS: ClassVar[list[str]] = USER_WORKSPACE_DIRS

    # Regex for validating workspace IDs (alphanumeric, underscore, hyphen)
    WORKSPACE_ID_PATTERN: ClassVar[re.Pattern[str]] = re.compile(r"^[a-zA-Z0-9_-]+$")

    def __init__(self, base_path: Optional[str] = None):
        """
        Initialize storage.

        Args:
            base_path: Root path for workspaces.
                       Defaults to WORKSPACE_STORAGE_PATH from workspace_paths.py
        """
        self.base_path = Path(base_path) if base_path else WORKSPACE_STORAGE_PATH
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
        """Get workspace path, always ensuring structure exists.

        Note: Always ensures structure because rsync may pre-create the root
        directory before the engine runs. We need to create system directories
        (.agent, history, scratch) on every access.
        """
        path = self._workspace_path(org_id, workspace_type, workspace_id)

        # Always ensure structure exists (rsync may have created root only)
        self._ensure_workspace_structure(path, workspace_type, workspace_id)

        return path

    def _ensure_workspace_structure(
        self, path: Path, workspace_type: WorkspaceType, workspace_id: str
    ) -> None:
        """Ensure workspace has required directory structure (idempotent).

        Creates all required subdirectories and config if missing.
        Safe to call multiple times - won't overwrite existing files.
        """
        # Create all required directories
        dirs = self.AGENT_DIRS if workspace_type == WorkspaceType.AGENTS else self.USER_DIRS
        for subdir in dirs:
            (path / subdir).mkdir(parents=True, exist_ok=True)

        # Create config only if it doesn't exist
        config_dir = ".agent" if workspace_type == WorkspaceType.AGENTS else ".user"
        config_path = path / config_dir / "config.json"
        if not config_path.exists():
            config = {
                "workspace_id": workspace_id,
                "workspace_type": workspace_type.value,
                "created_at": datetime.now().isoformat(),
                "version": 1,
            }
            config_path.write_text(json.dumps(config, indent=2))
            logger.info(f"Created workspace config: {config_path}")

    def create_agent_identifier(
        self,
        org_id: int,
        workspace_id: str,
        agent_name: str,
        agent_id: int | None = None,
    ) -> Path:
        """
        Create visible agent identifier file in workspace root.

        Creates a file like `ProjectManager.enhancd.json` so users can
        easily identify which agent the synced folder belongs to.

        Args:
            org_id: Organization ID
            workspace_id: Workspace identifier (usually agent_id as string)
            agent_name: Human-readable agent name
            agent_id: Optional agent ID (uses workspace_id if not provided)

        Returns:
            Path to the created identifier file
        """
        path = self._workspace_path(org_id, WorkspaceType.AGENTS, workspace_id)

        # Sanitize agent name for filename (remove special chars)
        safe_name = "".join(c if c.isalnum() or c in " -_" else "" for c in agent_name)
        safe_name = safe_name.strip().replace(" ", "-") or "Agent"

        # Remove any existing .enhancd.json files first
        for existing in path.glob("*.enhancd.json"):
            existing.unlink()
            logger.debug(f"Removed old identifier file: {existing}")

        identifier = {
            "id": agent_id or int(workspace_id),
            "name": agent_name,
            "org_id": org_id,
            "created_at": datetime.now().isoformat(),
            "workspace_path": str(path),
        }

        identifier_path = path / f"{safe_name}.enhancd.json"
        identifier_path.write_text(json.dumps(identifier, indent=2))
        logger.info(f"Created agent identifier: {identifier_path}")

        return identifier_path

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
