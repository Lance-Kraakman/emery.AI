"""
Bubblewrap (bwrap) Executor for Isolated Command Execution.

Executes bash commands in an isolated filesystem namespace using bubblewrap.
The namespace is empty by default - only explicitly bound paths are accessible.

Security model:
- Empty namespace: agent sees only what's explicitly mounted
- /workspace: Agent's workspace directory (read-write)
- /usr, /lib, /bin: System tools (read-only)
- /tmp: Ephemeral tmpfs (agent's own, not host's)
- No host env vars, no access to other agent workspaces, no network by default

This mirrors Claude Code's sandboxing approach:
https://www.anthropic.com/engineering/claude-code-sandboxing
"""

import logging
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Tuple

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    """Result of a sandboxed command execution."""
    exit_code: int
    stdout: str
    stderr: str
    timed_out: bool = False

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.timed_out

    def __str__(self) -> str:
        if self.timed_out:
            return f"TIMEOUT: Command exceeded time limit\n{self.stderr}"
        if not self.success:
            return f"FAILED (exit {self.exit_code}):\n{self.stderr or self.stdout}"
        return self.stdout


class BwrapExecutor:
    """
    Execute bash commands in isolated filesystem namespace using bubblewrap.

    The sandbox creates an empty namespace and only binds:
    - /workspace: The agent's workspace directory (read-write)
    - /usr, /lib, /bin: System tools (read-only)
    - /proc, /dev: Minimal system access
    - /tmp, /var/log, /run: Ephemeral tmpfs directories

    All other host paths are invisible to the sandboxed process.
    """

    # Base bwrap command - works unprivileged in containers
    # Key: use --ro-bind for /proc and /dev instead of --proc and --dev
    # which try to mount new filesystems (requires CAP_SYS_ADMIN)
    BWRAP_BASE_CMD = [
        "bwrap",
        # User namespace FIRST - enables unprivileged operation
        "--unshare-user",
        # Other namespaces (now allowed because we have user namespace)
        "--unshare-pid",
        "--unshare-uts",
        "--unshare-cgroup",
        # System tools (read-only)
        "--ro-bind", "/usr", "/usr",
        "--ro-bind", "/bin", "/bin",
        # Bind existing proc/dev read-only (instead of mounting new ones)
        "--ro-bind", "/proc", "/proc",
        "--dev-bind", "/dev", "/dev",
        # Ephemeral tmpfs for system dirs
        "--tmpfs", "/tmp",
        "--tmpfs", "/var",
        "--tmpfs", "/run",
        "--tmpfs", "/etc",
        # Session/parent controls
        "--new-session",
        "--die-with-parent",
    ]

    def __init__(self):
        self._verify_bwrap_available()

    def _verify_bwrap_available(self) -> None:
        """Check if bubblewrap is installed."""
        import shutil
        if not shutil.which("bwrap"):
            logger.warning(
                "bubblewrap (bwrap) not found in PATH. "
                "Sandboxed execution will fall back to direct execution. "
                "Install with: apt-get install bubblewrap"
            )

    def _build_command(
        self,
        command: str,
        workspace_path: Path,
        allow_network: bool = False,
        additional_binds: Optional[List[Tuple[str, str]]] = None,
    ) -> List[str]:
        """Build the full bwrap command with all options."""
        cmd = self.BWRAP_BASE_CMD.copy()

        # Handle lib directories (may vary by distro)
        for lib_dir in ["/lib", "/lib64", "/lib32"]:
            if os.path.exists(lib_dir):
                cmd.extend(["--ro-bind", lib_dir, lib_dir])

        # Bind the agent's workspace (read-write)
        cmd.extend(["--bind", str(workspace_path), "/workspace"])

        # Network isolation (default: no network)
        if not allow_network:
            cmd.extend(["--unshare-net"])

        # Additional bind mounts (for special cases)
        if additional_binds:
            for src, dest in additional_binds:
                cmd.extend(["--ro-bind", src, dest])

        # Run bash command in workspace
        cmd.extend(["bash", "-c", f"cd /workspace && {command}"])

        return cmd

    def execute(
        self,
        command: str,
        workspace_path: Path,
        timeout: int = 300,
        allow_network: bool = False,
        env: Optional[dict] = None,
    ) -> ExecutionResult:
        """
        Execute a command in an isolated bwrap sandbox.

        Args:
            command: Bash command to execute
            workspace_path: Path to agent's workspace (mounted at /workspace)
            timeout: Maximum execution time in seconds (default 5 minutes)
            allow_network: Whether to allow network access (default False)
            env: Optional environment variables (empty by default for security)

        Returns:
            ExecutionResult with stdout, stderr, exit code, and timeout status
        """
        # Verify workspace exists
        if not workspace_path.exists():
            workspace_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created workspace directory: {workspace_path}")

        # Check if bwrap is available
        import shutil
        if not shutil.which("bwrap"):
            # Fallback to direct execution (for development/testing)
            logger.warning("bwrap not available, executing without sandbox")
            return self._execute_direct(command, workspace_path, timeout, env)

        # Build bwrap command
        cmd = self._build_command(command, workspace_path, allow_network)

        logger.debug(f"Executing sandboxed command: {command[:100]}...")
        logger.debug(f"Workspace: {workspace_path}")

        # Execute with empty environment by default (no host secrets)
        exec_env = env if env is not None else {}

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                timeout=timeout,
                env=exec_env,
                cwd=str(workspace_path),
            )
            return ExecutionResult(
                exit_code=result.returncode,
                stdout=result.stdout.decode("utf-8", errors="replace"),
                stderr=result.stderr.decode("utf-8", errors="replace"),
                timed_out=False,
            )
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                exit_code=-1,
                stdout="",
                stderr=f"Command timed out after {timeout} seconds",
                timed_out=True,
            )
        except Exception as e:
            logger.exception(f"Sandbox execution failed: {e}")
            return ExecutionResult(
                exit_code=-1,
                stdout="",
                stderr=f"Sandbox execution error: {str(e)}",
                timed_out=False,
            )

    def _execute_direct(
        self,
        command: str,
        workspace_path: Path,
        timeout: int,
        env: Optional[dict],
    ) -> ExecutionResult:
        """
        Fallback: Execute command directly without sandboxing.

        Only used when bwrap is not available (development/testing).
        """
        logger.warning("Executing without sandbox isolation")

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                timeout=timeout,
                cwd=str(workspace_path),
                env=env,
            )
            return ExecutionResult(
                exit_code=result.returncode,
                stdout=result.stdout.decode("utf-8", errors="replace"),
                stderr=result.stderr.decode("utf-8", errors="replace"),
                timed_out=False,
            )
        except subprocess.TimeoutExpired:
            return ExecutionResult(
                exit_code=-1,
                stdout="",
                stderr=f"Command timed out after {timeout} seconds",
                timed_out=True,
            )
        except Exception as e:
            return ExecutionResult(
                exit_code=-1,
                stdout="",
                stderr=f"Direct execution error: {str(e)}",
                timed_out=False,
            )

