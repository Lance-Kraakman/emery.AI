"""Agent Engine - unified workspace management."""

import logging
from pathlib import Path

from ..ace.services.strategy_service import StrategyAccumulationService
from ..services.memory import MemoryService
from ..services.plan_service import PlanService
from ..services.planning.plan_file_repository import PlanFileRepository
from ..services.sandbox import GVisorExecutor

from .paths import EnginePaths

logger = logging.getLogger(__name__)


class AgentEngine:
    """
    Unified interface for workspace services.

    Services are lazy-initialized on first access because:
    - MemoryService creates ChromaDB client + HF API embeddings
    - Not all requests need all services (simple queries skip plans)

    Usage:
        engine = AgentEngine("user-123", "users")
        engine.initialize()
        engine.memory.add("fact", memory_type="fact")
    """

    def __init__(
        self,
        workspace_id: str,
        workspace_type: str,
        base_path: Path = Path("/tmp/workspace"),
    ):
        self.workspace_id = workspace_id
        self.workspace_type = workspace_type
        self.base_path = base_path
        self.paths = EnginePaths(base_path / workspace_id)

        self._memory: MemoryService | None = None
        self._plans: PlanFileRepository | None = None
        self._sandbox: GVisorExecutor | None = None
        self._ace: StrategyAccumulationService | None = None
        self._planner: PlanService | None = None
        self._initialized = False

    def initialize(self) -> None:
        """Create directory structure and fix permissions."""
        if self._initialized:
            return
        self.paths.ensure_structure()
        self.paths.fix_permissions()
        self._initialized = True
        logger.info(
            f"AgentEngine initialized: {self.workspace_type}/{self.workspace_id}"
        )

    def _ensure_initialized(self) -> None:
        if not self._initialized:
            self.initialize()

    @property
    def memory(self) -> MemoryService:
        """ChromaDB-backed semantic memory."""
        self._ensure_initialized()
        if self._memory is None:
            self._memory = MemoryService(
                workspace_type=self.workspace_type,
                workspace_id=self.workspace_id,
                base_path=self.base_path,
            )
        return self._memory

    @property
    def plans(self) -> PlanFileRepository:
        """Filesystem-backed plan persistence."""
        self._ensure_initialized()
        if self._plans is None:
            self._plans = PlanFileRepository(
                base_path=self.base_path,
                workspace_id=self.workspace_id,
            )
        return self._plans

    @property
    def sandbox(self) -> GVisorExecutor:
        """gVisor sandbox executor."""
        self._ensure_initialized()
        if self._sandbox is None:
            self._sandbox = GVisorExecutor(base_path=self.base_path)
        return self._sandbox

    @property
    def ace(self) -> StrategyAccumulationService:
        """ACE strategy accumulation service."""
        self._ensure_initialized()
        if self._ace is None:
            self._ace = StrategyAccumulationService(workspace_path=self.paths.root)
        return self._ace

    @property
    def planner(self) -> PlanService:
        """Plan generation service."""
        self._ensure_initialized()
        if self._planner is None:
            self._planner = PlanService()
        return self._planner

    def execute_command(
        self, command: str, timeout: int = 300
    ) -> str:
        """Execute command in sandboxed workspace.

        Network access is always enabled via filtered proxy
        (blocks private IPs, AWS metadata).
        """
        result = self.sandbox.execute(
            command=command,
            workspace_path=self.paths.root,
            timeout=timeout,
        )
        return str(result)

    def cleanup(self) -> None:
        """Release service resources."""
        self._memory = None
        self._plans = None
        self._sandbox = None
        self._ace = None
        self._planner = None
        self._initialized = False
        logger.info(f"AgentEngine cleaned up: {self.workspace_id}")

    def __enter__(self) -> "AgentEngine":
        self.initialize()
        return self

    def __exit__(
        self,
        exc_type: type | None,
        exc_val: BaseException | None,
        exc_tb: object | None,
    ) -> None:
        self.cleanup()

    def __repr__(self) -> str:
        return f"AgentEngine({self.workspace_id!r}, {self.workspace_type!r}, initialized={self._initialized})"
