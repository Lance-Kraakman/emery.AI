"""Engine filesystem paths."""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class EnginePaths:
    """
    Directory structure for Agent Engine.

    Structure:
        {root}/
        ├── [user files]           # Agent-created files
        └── .engine/
            ├── config.json
            ├── memory/chroma/     # ChromaDB embeddings
            └── plans/{id}.json
    """

    def __init__(self, root: Path):
        self.root = root
        self.engine = root / ".engine"

        # Core paths
        self.memory = self.engine / "memory" / "chroma"
        self.plans = self.engine / "plans"
        self.config = self.engine / "config.json"

    def ensure_structure(self) -> None:
        """Create required directories."""
        for path in [self.engine, self.memory, self.plans]:
            path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Engine structure created: {self.root}")

    def fix_permissions(self, mode: int = 0o700) -> None:
        """Fix permissions after tar extraction (owner-only for security)."""
        for path in [self.root, self.engine, self.memory, self.plans]:
            if path.exists():
                try:
                    path.chmod(mode)
                except PermissionError:
                    logger.warning(f"Cannot chmod {path}")
