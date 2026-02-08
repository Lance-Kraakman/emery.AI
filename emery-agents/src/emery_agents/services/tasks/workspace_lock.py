"""
Workspace Lock - File-based locking for agent workspaces.

Creates/deletes a .emery-lock file in the workspace to coordinate with
Tauri sync. When the agent is actively working on a task, the lock file
prevents the Tauri client from syncing changes.

Lock file format (JSON):
{
    "task_id": "abc-123",
    "started_at": 1707400000,  // Unix timestamp
    "agent_id": 42
}
"""

import json
import time
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

LOCK_FILE = ".emery-lock"
LOCK_TTL_SECS = 3600  # 1 hour - matches Tauri TTL


async def acquire_lock(workspace_path: Path, task_id: str, agent_id: int) -> bool:
    """
    Acquire a workspace lock by creating .emery-lock file.

    Args:
        workspace_path: Path to the workspace directory
        task_id: Unique identifier for the current task
        agent_id: ID of the agent acquiring the lock

    Returns:
        True if lock was acquired successfully
    """
    lock_path = workspace_path / LOCK_FILE

    # Check for existing lock
    if lock_path.exists():
        try:
            existing = json.loads(lock_path.read_text())
            existing_age = int(time.time()) - existing.get("started_at", 0)

            # If lock is stale (older than TTL), we can overwrite it
            if existing_age < LOCK_TTL_SECS:
                logger.warning(
                    "workspace_lock_exists",
                    existing_task_id=existing.get("task_id"),
                    existing_agent_id=existing.get("agent_id"),
                    age_seconds=existing_age,
                )
                # Don't fail - overwrite the lock since we're the agent
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("invalid_lock_file", error=str(e))

    lock_data = {
        "task_id": task_id,
        "started_at": int(time.time()),
        "agent_id": agent_id,
    }

    try:
        lock_path.write_text(json.dumps(lock_data))
        logger.info(
            "workspace_lock_acquired",
            task_id=task_id,
            agent_id=agent_id,
            lock_path=str(lock_path),
        )
        return True
    except OSError as e:
        logger.error("workspace_lock_failed", error=str(e))
        return False


async def release_lock(workspace_path: Path, task_id: str) -> bool:
    """
    Release a workspace lock by deleting .emery-lock file.

    Only deletes the lock if the task_id matches (we own the lock).

    Args:
        workspace_path: Path to the workspace directory
        task_id: Task ID that should own the lock

    Returns:
        True if lock was released, False if lock doesn't exist or isn't ours
    """
    lock_path = workspace_path / LOCK_FILE

    if not lock_path.exists():
        logger.debug("workspace_lock_not_found", task_id=task_id)
        return False

    try:
        lock_data = json.loads(lock_path.read_text())

        # Only delete if we own the lock
        if lock_data.get("task_id") == task_id:
            lock_path.unlink()
            logger.info(
                "workspace_lock_released",
                task_id=task_id,
                lock_path=str(lock_path),
            )
            return True
        else:
            logger.warning(
                "workspace_lock_not_owned",
                our_task_id=task_id,
                lock_task_id=lock_data.get("task_id"),
            )
            return False
    except (json.JSONDecodeError, OSError) as e:
        logger.error("workspace_lock_release_failed", error=str(e))
        return False


async def check_lock(workspace_path: Path) -> dict | None:
    """
    Check if workspace is locked and return lock info.

    Args:
        workspace_path: Path to the workspace directory

    Returns:
        Lock data dict if locked, None if not locked
    """
    lock_path = workspace_path / LOCK_FILE

    if not lock_path.exists():
        return None

    try:
        lock_data = json.loads(lock_path.read_text())
        age = int(time.time()) - lock_data.get("started_at", 0)

        # Ignore stale locks
        if age > LOCK_TTL_SECS:
            logger.debug(
                "workspace_lock_stale",
                task_id=lock_data.get("task_id"),
                age_seconds=age,
            )
            return None

        return lock_data
    except (json.JSONDecodeError, OSError):
        return None
