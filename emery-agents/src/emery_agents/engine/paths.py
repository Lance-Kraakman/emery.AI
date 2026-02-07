"""
Engine path constants and helpers.

Defines the directory structure for the Agent Engine filesystem.
"""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class EnginePaths:
    """
    Path constants for engine directory structure.

    All paths are relative to a workspace root directory.
    The .engine/ directory contains all engine state.

    Structure:
        {root}/
        ├── .engine/
        │   ├── config.json       # Engine configuration
        │   ├── memory/
        │   │   └── chroma/       # ChromaDB persistent storage
        │   ├── plans/
        │   │   └── {id}.json     # Saved plans
        │   ├── history/
        │   │   ├── transcript.jsonl  # Conversation log
        │   │   └── {date}/
        │   │       └── {task_id}.json  # Task results
        │   ├── file-history/
        │   │   └── {hash}@v{N}   # File snapshots
        │   ├── todos/
        │   │   └── {session}.json  # Todo lists
        │   ├── cache/
        │   │   ├── embeddings/
        │   │   └── api-responses/
        │   └── debug/
        │       └── {session}.log
        ├── workspace/            # Working directory
        │   ├── scratch/
        │   └── outputs/
        └── context/              # Synced table data
            └── {table}.parquet
    """

    def __init__(self, root: Path):
        """
        Initialize paths for a workspace.

        Args:
            root: Workspace root directory (e.g., /tmp/workspace/{workspace_id})
        """
        self.root = root

        # Engine state directory
        self.engine = root / ".engine"

        # Core services
        self.memory = self.engine / "memory" / "chroma"
        self.plans = self.engine / "plans"

        # Future services
        self.history = self.engine / "history"
        self.file_history = self.engine / "file-history"
        self.todos = self.engine / "todos"
        self.cache = self.engine / "cache"
        self.debug = self.engine / "debug"

        # Working directories
        self.workspace = root / "workspace"
        self.context = root / "context"

        # Config file
        self.config = self.engine / "config.json"

    def ensure_structure(self) -> None:
        """
        Create all required directories.

        Called during engine initialization to ensure the directory
        structure exists before services try to use it.
        """
        directories = [
            self.engine,
            self.memory,
            self.plans,
            self.history,
            self.workspace,
            self.context,
        ]

        for path in directories:
            path.mkdir(parents=True, exist_ok=True)

        logger.debug(f"Engine directory structure created at {self.root}")

    def fix_permissions(self, mode: int = 0o700) -> None:
        """
        Fix permissions on engine directories.

        Uses owner-only permissions (0o700) for security.
        Called after directory creation or extraction from tar.

        Args:
            mode: Permission mode (default: 0o700 = owner rwx only)
        """
        directories = [
            self.root,
            self.engine,
            self.memory,
            self.plans,
            self.history,
            self.workspace,
            self.context,
        ]

        for path in directories:
            if path.exists():
                try:
                    path.chmod(mode)
                except PermissionError:
                    logger.warning(f"Cannot fix permissions on {path}")

    @property
    def transcript(self) -> Path:
        """Path to conversation transcript file."""
        return self.history / "transcript.jsonl"

    def task_result_path(self, date: str, task_id: str) -> Path:
        """
        Get path for a task result file.

        Args:
            date: Date string (YYYY-MM-DD)
            task_id: Task identifier

        Returns:
            Path to task result JSON file
        """
        return self.history / date / f"{task_id}.json"

    def plan_path(self, plan_id: str) -> Path:
        """
        Get path for a plan file.

        Args:
            plan_id: Plan identifier

        Returns:
            Path to plan JSON file
        """
        return self.plans / f"{plan_id}.json"

    def file_snapshot_path(self, file_hash: str, version: int) -> Path:
        """
        Get path for a file snapshot.

        Args:
            file_hash: Content hash of the file
            version: Version number

        Returns:
            Path to snapshot file
        """
        return self.file_history / f"{file_hash}@v{version}"

    def debug_log_path(self, session_id: str) -> Path:
        """
        Get path for a session debug log.

        Args:
            session_id: Session identifier

        Returns:
            Path to debug log file
        """
        return self.debug / f"{session_id}.log"
