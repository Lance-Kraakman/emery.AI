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

import asyncio
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Tuple, Optional, List

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

    # Base bwrap command - creates empty namespace by default
    BWRAP_BASE_CMD = [
        "bwrap",
        # System tools (read-only)
        "--ro-bind", "/usr", "/usr",
        "--ro-bind", "/bin", "/bin",
        # Minimal system access
        "--proc", "/proc",
        "--dev", "/dev",
        # Ephemeral tmpfs for system dirs
        "--tmpfs", "/tmp",
        "--tmpfs", "/var",
        "--tmpfs", "/run",
        # Create /etc with minimal required files
        "--tmpfs", "/etc",
        # Full isolation
        "--unshare-all",      # New namespaces (pid, net, user, etc.)
        "--new-session",      # New session (can't signal host processes)
        "--die-with-parent",  # Kill sandbox if parent dies
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

        # Optional: allow network access
        if allow_network:
            # Remove --unshare-all and add back everything except network
            cmd = [c for c in cmd if c != "--unshare-all"]
            cmd.extend([
                "--unshare-user",
                "--unshare-ipc",
                "--unshare-pid",
                "--unshare-uts",
                "--unshare-cgroup",
                # Note: NOT unsharing network
            ])

        # Additional bind mounts (for special cases)
        if additional_binds:
            for src, dest in additional_binds:
                cmd.extend(["--ro-bind", src, dest])

        # Run bash command in workspace
        cmd.extend(["bash", "-c", f"cd /workspace && {command}"])

        return cmd

    async def execute(
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
            return await self._execute_direct(command, workspace_path, timeout, env)

        # Build bwrap command
        cmd = self._build_command(command, workspace_path, allow_network)

        logger.debug(f"Executing sandboxed command: {command[:100]}...")
        logger.debug(f"Workspace: {workspace_path}")

        # Execute with empty environment by default (no host secrets)
        exec_env = env if env is not None else {}

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=exec_env,
                cwd=str(workspace_path),
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout
                )
                return ExecutionResult(
                    exit_code=proc.returncode or 0,
                    stdout=stdout_bytes.decode("utf-8", errors="replace"),
                    stderr=stderr_bytes.decode("utf-8", errors="replace"),
                    timed_out=False,
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
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

    async def _execute_direct(
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
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(workspace_path),
                env=env,
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(),
                    timeout=timeout
                )
                return ExecutionResult(
                    exit_code=proc.returncode or 0,
                    stdout=stdout_bytes.decode("utf-8", errors="replace"),
                    stderr=stderr_bytes.decode("utf-8", errors="replace"),
                    timed_out=False,
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
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

    async def execute_streaming(
        self,
        command: str,
        workspace_path: Path,
        timeout: int = 300,
        allow_network: bool = False,
    ):
        """
        Execute command and stream stdout/stderr in real-time.

        Yields (stream_type, line) tuples where stream_type is 'stdout' or 'stderr'.
        """
        import shutil
        if not shutil.which("bwrap"):
            logger.warning("bwrap not available, streaming without sandbox")
            async for item in self._stream_direct(command, workspace_path, timeout):
                yield item
            return

        cmd = self._build_command(command, workspace_path, allow_network)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env={},
            cwd=str(workspace_path),
        )

        async def read_stream(stream, stream_type):
            while True:
                line = await stream.readline()
                if not line:
                    break
                yield (stream_type, line.decode("utf-8", errors="replace").rstrip())

        # Create tasks for both streams
        stdout_task = asyncio.create_task(
            self._collect_lines(read_stream(proc.stdout, "stdout"))
        )
        stderr_task = asyncio.create_task(
            self._collect_lines(read_stream(proc.stderr, "stderr"))
        )

        try:
            done, pending = await asyncio.wait(
                [stdout_task, stderr_task],
                timeout=timeout,
                return_when=asyncio.ALL_COMPLETED
            )

            for task in done:
                for item in task.result():
                    yield item

            if pending:
                for task in pending:
                    task.cancel()
                proc.kill()
                yield ("stderr", f"Command timed out after {timeout} seconds")

        finally:
            await proc.wait()

    async def _stream_direct(self, command, workspace_path, timeout):
        """Stream output from direct execution (fallback)."""
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(workspace_path),
        )

        async def read_stream(stream, stream_type):
            while True:
                line = await stream.readline()
                if not line:
                    break
                yield (stream_type, line.decode("utf-8", errors="replace").rstrip())

        async for item in read_stream(proc.stdout, "stdout"):
            yield item
        async for item in read_stream(proc.stderr, "stderr"):
            yield item

        await proc.wait()

    async def _collect_lines(self, async_gen):
        """Collect all lines from an async generator."""
        lines = []
        async for item in async_gen:
            lines.append(item)
        return lines
