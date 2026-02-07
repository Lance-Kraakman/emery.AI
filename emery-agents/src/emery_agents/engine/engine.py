"""
Agent Engine - Encapsulated workspace and execution management.

The AgentEngine class provides a unified interface for all workspace
operations, replacing scattered service instantiation with a single
coherent abstraction.
"""

import logging
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from .paths import EnginePaths

if TYPE_CHECKING:
    from ..services.memory import MemoryService
    from ..services.planning.plan_file_repository import PlanFileRepository
    from ..services.sandbox.bwrap_executor import BwrapExecutor

logger = logging.getLogger(__name__)


class AgentEngine:
    """
    Encapsulated agent execution engine.

    Manages:
    - Workspace filesystem (.engine/ directory structure)
    - Memory (ChromaDB semantic storage)
    - Plans (filesystem-backed plan persistence)
    - Sandbox execution (bwrap isolation)

    Future:
    - History/transcripts
    - File versioning (undo/redo)
    - Todo persistence
    - Settings/preferences

    Usage:
        engine = AgentEngine(workspace_id="user-123", workspace_type="users")
        engine.initialize()

        # Access services via properties
        engine.memory.add("Remember this fact", memory_type="fact")
        engine.plans.save(my_plan)
    """

    def __init__(
        self,
        workspace_id: str,
        workspace_type: str,
        base_path: Path = Path("/tmp/workspace"),
    ):
        """
        Initialize the agent engine.

        Args:
            workspace_id: Unique identifier for the workspace (user ID or agent ID)
            workspace_type: Type of workspace ("agents" or "users")
            base_path: Base directory for workspaces (default: /tmp/workspace)
        """
        self.workspace_id = workspace_id
        self.workspace_type = workspace_type
        self.base_path = base_path
        self.paths = EnginePaths(base_path / workspace_id)

        # Lazy-initialized services
        self._memory: Optional["MemoryService"] = None
        self._plans: Optional["PlanFileRepository"] = None
        self._sandbox: Optional["BwrapExecutor"] = None

        # Initialization state
        self._initialized = False

    def initialize(self) -> None:
        """
        Initialize the engine.

        Creates directory structure and fixes permissions.
        Must be called before accessing services.
        """
        if self._initialized:
            return

        self.paths.ensure_structure()
        self.paths.fix_permissions()
        self._initialized = True

        logger.info(
            f"AgentEngine initialized: type={self.workspace_type}, "
            f"id={self.workspace_id}, root={self.paths.root}"
        )

    def _ensure_initialized(self) -> None:
        """Ensure engine is initialized before service access."""
        if not self._initialized:
            self.initialize()

    # === Memory Service ===

    @property
    def memory(self) -> "MemoryService":
        """
        Semantic memory service (ChromaDB).

        Provides persistent semantic memory storage with:
        - Add/search/delete memories
        - Memory types: general, preference, fact, procedure
        - PII filtering for agent workspaces

        Returns:
            Lazily-initialized MemoryService instance
        """
        self._ensure_initialized()
        if self._memory is None:
            from ..services.memory import MemoryService

            self._memory = MemoryService(
                workspace_type=self.workspace_type,
                workspace_id=self.workspace_id,
                base_path=self.base_path,
            )
        return self._memory

    # === Plan Repository ===

    @property
    def plans(self) -> "PlanFileRepository":
        """
        Plan file repository (filesystem-backed).

        Provides plan persistence with:
        - Save/load plans as JSON
        - List all plans
        - Load most recent plan

        Returns:
            Lazily-initialized PlanFileRepository instance
        """
        self._ensure_initialized()
        if self._plans is None:
            from ..services.planning.plan_file_repository import PlanFileRepository

            self._plans = PlanFileRepository(
                base_path=self.base_path,
                workspace_id=self.workspace_id,
            )
        return self._plans

    # === Sandbox Executor ===

    @property
    def sandbox(self) -> "BwrapExecutor":
        """
        Sandbox executor (bwrap isolation).

        Provides isolated command execution with:
        - Bubblewrap namespace isolation
        - Seccomp syscall filtering
        - Optional filtered network access

        Returns:
            Lazily-initialized BwrapExecutor instance
        """
        self._ensure_initialized()
        if self._sandbox is None:
            from ..services.sandbox.bwrap_executor import BwrapExecutor

            self._sandbox = BwrapExecutor(base_path=self.base_path)
        return self._sandbox

    def execute_command(
        self,
        command: str,
        allow_network: bool = False,
        timeout: int = 300,
    ) -> str:
        """
        Execute a command in the sandboxed workspace.

        Args:
            command: Shell command to execute
            allow_network: Enable filtered network access (default: False)
            timeout: Command timeout in seconds (default: 300)

        Returns:
            Command output (stdout on success, stderr on failure)
        """
        result = self.sandbox.execute(
            command=command,
            workspace_path=self.paths.root,
            timeout=timeout,
            allow_network=allow_network,
        )
        return str(result)

    # === Lifecycle ===

    def cleanup(self) -> None:
        """
        Clean up resources.

        Called when engine is no longer needed. Closes database
        connections and releases resources.
        """
        # ChromaDB client doesn't need explicit cleanup
        self._memory = None
        self._plans = None
        self._sandbox = None
        self._initialized = False
        logger.info(f"AgentEngine cleaned up: {self.workspace_id}")

    # === Context Manager ===

    def __enter__(self) -> "AgentEngine":
        """Context manager entry."""
        self.initialize()
        return self

    def __exit__(
        self,
        exc_type: Optional[type],
        exc_val: Optional[BaseException],
        exc_tb: Optional[object],
    ) -> None:
        """Context manager exit."""
        self.cleanup()

    # === String Representation ===

    def __repr__(self) -> str:
        return (
            f"AgentEngine(workspace_id={self.workspace_id!r}, "
            f"workspace_type={self.workspace_type!r}, "
            f"initialized={self._initialized})"
        )
