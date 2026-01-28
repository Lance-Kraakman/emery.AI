"""
Workspace Sync - S3-based workspace persistence for agents.

Downloads/uploads agent workspaces as tar.gz archives from/to S3.
Provides persistent storage across task executions.

All file writes within workspaces go through bwrap sandbox for isolation.

Workspace structure:
    /workspace/
    ├── .agent/
    │   ├── config.json         # Agent configuration
    │   ├── memory.jsonl        # Persistent memory
    │   └── plans/              # Saved plans
    ├── workspace/
    │   ├── context/            # Synced tables
    │   ├── scratch/            # Working files
    │   └── outputs/            # Generated artifacts
    └── history/
        └── {date}/{task_id}/
            ├── session.jsonl   # Execution log
            └── result.json     # Task result
"""

import json
import logging
import shutil
import tarfile
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import boto3
from botocore.exceptions import ClientError

from ..services.sandbox import BwrapExecutor, WorkspaceShell

logger = logging.getLogger(__name__)


class WorkspaceSync:
    """
    Sync agent workspaces between S3 and local temp storage.

    Each agent has a persistent workspace stored as a tar.gz archive in S3.
    Workspaces are downloaded at task start and uploaded at task end.
    All file writes go through bwrap sandbox via WorkspaceShell.
    """

    # Default directories to create in a new workspace
    DEFAULT_WORKSPACE_STRUCTURE = [
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

    def __init__(
        self,
        bucket: str,
        prefix: str = "workspaces/agents",
        local_base: Optional[Path] = None,
    ):
        """
        Initialize workspace sync.

        Args:
            bucket: S3 bucket name for workspace storage
            prefix: S3 key prefix for workspace archives
            local_base: Local directory for extracted workspaces (default: /tmp/workspace)
        """
        self.bucket = bucket
        self.prefix = prefix
        self.local_base = local_base or Path("/tmp/workspace")
        self.s3 = boto3.client("s3")
        self._executor = BwrapExecutor(base_path=self.local_base)
        self._shell_cache: dict[str, WorkspaceShell] = {}

        logger.info(
            f"WorkspaceSync initialized: bucket={bucket}, prefix={prefix}, local={self.local_base}"
        )

    def _get_shell(self, workspace_id: str) -> WorkspaceShell:
        """Get or create a sandboxed shell for the workspace ID.

        Uses BwrapExecutor.get_shell_for_id() which validates the workspace_id
        internally and ensures path safety.
        """
        if workspace_id not in self._shell_cache:
            self._shell_cache[workspace_id] = self._executor.get_shell_for_id(workspace_id)
        return self._shell_cache[workspace_id]

    def _s3_key(self, workspace_id: str, prefix: Optional[str] = None) -> str:
        """Generate S3 key for workspace.

        Validates workspace_id via BwrapExecutor's validation.
        """
        # Validate via executor (raises ValueError if invalid)
        self._executor._validate_workspace_id(workspace_id)
        actual_prefix = prefix or self.prefix
        return f"{actual_prefix}/{workspace_id}.tar.gz"

    def _local_path(self, workspace_id: str) -> Path:
        """Get local path for workspace.

        Uses BwrapExecutor's validation to ensure path safety.
        """
        # BwrapExecutor validates and returns the safe path
        return self._executor._validate_workspace_id(workspace_id)

    def _tar_path(self, workspace_id: str) -> Path:
        """Get local path for workspace tar archive."""
        return self.local_base / f"{workspace_id}.tar.gz"

    def download(self, workspace_id: str, prefix: Optional[str] = None) -> Path:
        """
        Download and extract workspace from S3.

        If no workspace exists in S3, creates a new empty workspace
        with default directory structure.

        Args:
            workspace_id: Workspace ID (agent_id or user_id)
            prefix: Optional S3 prefix override (e.g., "workspaces/users")

        Returns:
            Path to extracted workspace directory
        """
        local_path = self._local_path(workspace_id)
        tar_path = self._tar_path(workspace_id)
        s3_key = self._s3_key(workspace_id, prefix)

        # Ensure local base exists
        self.local_base.mkdir(parents=True, exist_ok=True)

        # Clean up any existing local workspace
        if local_path.exists():
            logger.info(f"Cleaning existing workspace: {local_path}")
            shutil.rmtree(local_path)

        local_path.mkdir(parents=True)

        try:
            # Download from S3
            logger.info(f"Downloading workspace from s3://{self.bucket}/{s3_key}")
            self.s3.download_file(self.bucket, s3_key, str(tar_path))

            # Extract archive
            with tarfile.open(tar_path, "r:gz") as tar:
                tar.extractall(local_path)

            tar_path.unlink()
            logger.info(f"Workspace extracted to {local_path}")

        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "Unknown")
            if error_code in ("404", "NoSuchKey", "403", "AccessDenied"):
                # New workspace or no permissions yet - create empty workspace
                # 403/AccessDenied can happen when file doesn't exist and bucket has restrictive policies
                logger.info(f"No existing workspace for {workspace_id} (error: {error_code}), creating new one")
                self._create_empty_workspace(workspace_id)
            else:
                logger.error(f"S3 download failed: {e}")
                raise

        except Exception as e:
            logger.error(f"Workspace download failed: {e}")
            # Create empty workspace on any error
            self._create_empty_workspace(workspace_id)

        return local_path

    def _create_empty_workspace(self, workspace_id: str) -> None:
        """Create empty workspace with default structure using sandboxed execution."""
        shell = self._get_shell(workspace_id)
        local_path = self._local_path(workspace_id)

        # Create directories via sandbox
        for subdir in self.DEFAULT_WORKSPACE_STRUCTURE:
            shell.mkdir(subdir)

        # Create initial config via sandbox
        config = {
            "workspace_id": workspace_id,
            "created_at": datetime.now().isoformat(),
            "version": 1,
        }
        shell.write_file(".agent/config.json", json.dumps(config, indent=2))

        logger.info(f"Created empty workspace at {local_path}")

    def upload(self, workspace_id: str, prefix: Optional[str] = None) -> str:
        """
        Tar and upload workspace to S3.

        Args:
            workspace_id: Workspace ID (agent_id or user_id)
            prefix: Optional S3 prefix override (e.g., "workspaces/users")

        Returns:
            S3 key of uploaded archive
        """
        local_path = self._local_path(workspace_id)
        tar_path = self._tar_path(workspace_id)
        s3_key = self._s3_key(workspace_id, prefix)

        if not local_path.exists():
            raise ValueError(f"Workspace does not exist: {local_path}")

        try:
            # Create tar archive
            logger.info(f"Creating workspace archive: {tar_path}")
            with tarfile.open(tar_path, "w:gz") as tar:
                # Add all files, using arcname="." to avoid nested directory
                for item in local_path.iterdir():
                    tar.add(item, arcname=item.name)

            # Upload to S3
            logger.info(f"Uploading workspace to s3://{self.bucket}/{s3_key}")
            self.s3.upload_file(str(tar_path), self.bucket, s3_key)

            # Clean up local tar
            tar_path.unlink()
            logger.info(f"Workspace uploaded successfully")

            return s3_key

        except Exception as e:
            logger.error(f"Workspace upload failed: {e}")
            raise

    def cleanup(self, workspace_id: str) -> None:
        """
        Remove local workspace after upload.

        Call this after upload() to free local disk space.

        Args:
            workspace_id: Workspace ID to clean up
        """
        local_path = self._local_path(workspace_id)
        tar_path = self._tar_path(workspace_id)

        if local_path.exists():
            shutil.rmtree(local_path)
            logger.info(f"Cleaned up local workspace: {local_path}")

        if tar_path.exists():
            tar_path.unlink()
            logger.info(f"Cleaned up tar file: {tar_path}")

    def workspace_exists(self, workspace_id: str, prefix: Optional[str] = None) -> bool:
        """Check if workspace exists in S3."""
        try:
            self.s3.head_object(Bucket=self.bucket, Key=self._s3_key(workspace_id, prefix))
            return True
        except ClientError:
            return False

    def delete_workspace(self, workspace_id: str, prefix: Optional[str] = None) -> None:
        """Delete workspace from S3 and local storage."""
        s3_key = self._s3_key(workspace_id, prefix)

        try:
            self.s3.delete_object(Bucket=self.bucket, Key=s3_key)
            logger.info(f"Deleted S3 workspace: s3://{self.bucket}/{s3_key}")
        except ClientError as e:
            logger.warning(f"Failed to delete S3 workspace: {e}")

        self.cleanup(workspace_id)

    def prepare_task_history(
        self,
        workspace_id: str,
        task_id: str,
    ) -> Path:
        """
        Prepare history directory for a new task execution using sandboxed execution.

        Creates: history/{date}/{task_id}/

        Args:
            workspace_id: Workspace ID (agent_id or user_id)
            task_id: Task ID

        Returns:
            Path to task history directory
        """
        shell = self._get_shell(workspace_id)
        ws_path = self._local_path(workspace_id)
        date_str = datetime.now().strftime("%Y-%m-%d")
        relative_history_dir = f"history/{date_str}/{task_id}"

        # Create directory and empty session log via sandbox
        shell.mkdir(relative_history_dir)
        shell.touch(f"{relative_history_dir}/session.jsonl")

        return ws_path / "history" / date_str / task_id

    def save_task_result(
        self,
        workspace_id: str,
        task_id: str,
        result: dict[str, Any],
    ) -> Path:
        """
        Save task result to workspace history using sandboxed execution.

        Args:
            workspace_id: Workspace ID (agent_id or user_id)
            task_id: Task ID
            result: Result data to save

        Returns:
            Path to result file
        """
        shell = self._get_shell(workspace_id)
        ws_path = self._local_path(workspace_id)
        date_str = datetime.now().strftime("%Y-%m-%d")
        relative_history_dir = f"history/{date_str}/{task_id}"

        # Create directory if needed and write result via sandbox
        shell.mkdir(relative_history_dir)
        shell.write_file(f"{relative_history_dir}/result.json", json.dumps(result, indent=2, default=str))

        return ws_path / "history" / date_str / task_id / "result.json"

    def append_to_session_log(
        self,
        workspace_id: str,
        task_id: str,
        entry: dict[str, Any],
    ) -> None:
        """
        Append entry to task session log using sandboxed execution.

        Args:
            workspace_id: Workspace ID (agent_id or user_id)
            task_id: Task ID
            entry: Log entry to append
        """
        shell = self._get_shell(workspace_id)
        date_str = datetime.now().strftime("%Y-%m-%d")
        relative_history_dir = f"history/{date_str}/{task_id}"

        # Ensure directory exists via sandbox
        shell.mkdir(relative_history_dir)

        # Add timestamp if not present
        if "timestamp" not in entry:
            entry["timestamp"] = datetime.now().isoformat()

        # Append to session log via sandbox
        shell.append_file(f"{relative_history_dir}/session.jsonl", json.dumps(entry) + "\n")
