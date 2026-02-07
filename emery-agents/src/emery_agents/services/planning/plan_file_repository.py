"""
Plan File Repository — Filesystem-backed plan persistence.

Saves/loads session plans as JSON files in .engine/plans/ within the workspace.
Plans persist across sessions via S3 tar.gz sync (WorkspaceSync).

Skill plans stay in the database (PlanRepository via gRPC). Only session/runtime
plans are stored here.
"""

import json
import logging
from pathlib import Path
from typing import Optional

from ...entities.models.plan import Plan

logger = logging.getLogger(__name__)


class PlanFileRepository:
    """Filesystem-backed plan persistence.

    Saves/loads plans as JSON files in .agent/plans/ within the workspace.
    Uses the same base_path + workspace_id pattern as MemoryService.
    """

    def __init__(self, base_path: Path, workspace_id: str):
        self._plans_dir = base_path / workspace_id / ".engine" / "plans"
        self._plans_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"PlanFileRepository initialized: {self._plans_dir}")

    def save(self, plan: Plan) -> Path:
        """Save plan to filesystem as JSON.

        Overwrites existing file for the same plan ID (idempotent).

        Args:
            plan: Plan to save.

        Returns:
            Path to the saved JSON file.
        """
        path = self._plans_dir / f"{plan.id}.json"
        path.write_text(json.dumps(plan.to_dict(), indent=2, default=str))
        logger.info(f"Saved plan {plan.id} to {path}")
        return path

    def load(self, plan_id: str) -> Optional[Plan]:
        """Load plan from filesystem by ID.

        Args:
            plan_id: Plan ID (filename stem).

        Returns:
            Plan if found, None otherwise.
        """
        path = self._plans_dir / f"{plan_id}.json"
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text())
            return Plan.from_dict(data)
        except Exception as e:
            logger.warning(f"Failed to load plan {plan_id}: {e}")
            return None

    def list_plans(self) -> list[str]:
        """List all plan IDs on disk.

        Returns:
            List of plan ID strings (filename stems).
        """
        return [p.stem for p in self._plans_dir.glob("*.json")]

    def load_latest(self) -> Optional[Plan]:
        """Load the most recently modified plan.

        Returns:
            Most recent Plan, or None if no plans exist.
        """
        plans = sorted(
            self._plans_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not plans:
            return None
        try:
            data = json.loads(plans[0].read_text())
            return Plan.from_dict(data)
        except Exception as e:
            logger.warning(f"Failed to load latest plan: {e}")
            return None
