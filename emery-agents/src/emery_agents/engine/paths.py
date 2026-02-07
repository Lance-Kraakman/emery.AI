"""Engine filesystem paths."""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class EnginePaths:
    """
    Directory structure for Agent Engine.

    Structure:
        {root}/
        └── .engine/
            ├── config.json
            ├── memory/chroma/        # ChromaDB
            ├── plans/{id}.json
            ├── history/
            │   ├── transcript.jsonl
            │   └── {date}/{task_id}.json
            ├── file-history/{hash}@v{N}
            ├── todos/{session}.json
            ├── cache/
            ├── debug/{session}.log
            ├── workspace/            # Sandbox working directory
            └── context/{table}.parquet  # Synced table embeddings
    """

    def __init__(self, root: Path):
        self.root = root
        self.engine = root / ".engine"

        # Core
        self.memory = self.engine / "memory" / "chroma"
        self.plans = self.engine / "plans"

        # Future
        self.history = self.engine / "history"
        self.file_history = self.engine / "file-history"
        self.todos = self.engine / "todos"
        self.cache = self.engine / "cache"
        self.debug = self.engine / "debug"

        # Working directories (inside .engine for S3 sync consistency)
        self.workspace = self.engine / "workspace"
        self.context = self.engine / "context"

        self.config = self.engine / "config.json"

    def ensure_structure(self) -> None:
        """Create required directories."""
        for path in [self.engine, self.memory, self.plans, self.history, self.workspace, self.context]:
            path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Engine structure created: {self.root}")

    def fix_permissions(self, mode: int = 0o700) -> None:
        """Fix permissions after tar extraction (owner-only for security)."""
        for path in [self.root, self.engine, self.memory, self.plans, self.history, self.workspace, self.context]:
            if path.exists():
                try:
                    path.chmod(mode)
                except PermissionError:
                    logger.warning(f"Cannot chmod {path}")

    # Path helpers for future services
    @property
    def transcript(self) -> Path:
        return self.history / "transcript.jsonl"

    def task_result_path(self, date: str, task_id: str) -> Path:
        return self.history / date / f"{task_id}.json"

    def plan_path(self, plan_id: str) -> Path:
        return self.plans / f"{plan_id}.json"

    def file_snapshot_path(self, file_hash: str, version: int) -> Path:
        return self.file_history / f"{file_hash}@v{version}"

    def debug_log_path(self, session_id: str) -> Path:
        return self.debug / f"{session_id}.log"
