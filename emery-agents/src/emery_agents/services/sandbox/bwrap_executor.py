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
- Network access (when enabled) goes through a filtering proxy that blocks
  all private/reserved IPs (RFC1918, localhost, AWS metadata, etc.)

Network isolation architecture (when allow_network=True):
- --unshare-net is ALWAYS used (sandbox has zero network interfaces)
- A filtering proxy runs on the host, listening on a Unix socket
- The socket is bind-mounted into the sandbox
- socat bridges the Unix socket to sandbox-local TCP (loopback)
- http_proxy/https_proxy env vars route all traffic through the proxy
- Tools that ignore proxy vars get ZERO network (safe default)
- Proxy resolves DNS and blocks private/reserved destination IPs

This mirrors Claude Code's sandboxing approach:
https://www.anthropic.com/engineering/claude-code-sandboxing
"""

import logging
import os
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Tuple

from .proxy_manager import ProxyManager
from .seccomp_filter import create_seccomp_fd

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
    # Key: use --ro-bind for /proc instead of --proc
    # which tries to mount a new filesystem (requires CAP_SYS_ADMIN)
    BWRAP_BASE_CMD = [
        "bwrap",
        # User namespace FIRST - enables unprivileged operation
        "--unshare-user",
        # Other namespaces (now allowed because we have user namespace)
        "--unshare-pid",
        "--unshare-uts",
        "--unshare-cgroup",
        "--unshare-ipc",
        # System tools (read-only)
        "--ro-bind", "/usr", "/usr",
        "--ro-bind", "/bin", "/bin",
        # Bind existing proc read-only (instead of mounting new procfs)
        "--ro-bind", "/proc", "/proc",
        # Minimal /dev — only essential device nodes, not full host /dev tree
        # (removes /dev/mem, /dev/kmem, raw block devices, etc.)
        "--tmpfs", "/dev",
        "--dev-bind", "/dev/null", "/dev/null",
        "--dev-bind", "/dev/zero", "/dev/zero",
        "--dev-bind", "/dev/full", "/dev/full",
        "--dev-bind", "/dev/random", "/dev/random",
        "--dev-bind", "/dev/urandom", "/dev/urandom",
        "--symlink", "/proc/self/fd", "/dev/fd",
        "--symlink", "/proc/self/fd/0", "/dev/stdin",
        "--symlink", "/proc/self/fd/1", "/dev/stdout",
        "--symlink", "/proc/self/fd/2", "/dev/stderr",
        # Ephemeral tmpfs for system dirs
        "--tmpfs", "/tmp",
        "--tmpfs", "/var",
        "--tmpfs", "/run",
        "--tmpfs", "/etc",
        # Session/parent controls
        "--new-session",
        "--die-with-parent",
    ]

    # Default base path for workspaces
    DEFAULT_BASE_PATH = Path("/tmp/workspace")

    def __init__(self, base_path: Optional[Path] = None) -> None:
        self._base_path = base_path or self.DEFAULT_BASE_PATH
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

    def _validate_workspace_id(self, workspace_id: str) -> Path:
        """Validate workspace_id and return safe workspace path.

        Raises ValueError if workspace_id contains path traversal characters
        or other dangerous patterns.

        Args:
            workspace_id: Alphanumeric workspace identifier (e.g., agent_id, user_id)

        Returns:
            Validated Path within base_path
        """
        if not workspace_id:
            raise ValueError("workspace_id cannot be empty")

        # Reject path traversal attempts
        if ".." in workspace_id:
            raise ValueError("Invalid workspace_id: contains path traversal '..'")

        # Reject path separators
        if "/" in workspace_id or "\\" in workspace_id:
            raise ValueError("Invalid workspace_id: contains path separator")

        # Length limit
        if len(workspace_id) > 255:
            raise ValueError("workspace_id exceeds maximum length of 255")

        # Character whitelist: alphanumeric, dash, underscore only
        if not re.match(r"^[a-zA-Z0-9_-]+$", workspace_id):
            raise ValueError(
                "Invalid workspace_id: must contain only alphanumeric, dash, underscore"
            )

        workspace_path = self._base_path / workspace_id

        # Double-check: ensure resolved path is within base_path
        try:
            workspace_path.resolve().relative_to(self._base_path.resolve())
        except ValueError:
            raise ValueError(f"Path traversal detected for workspace_id: {workspace_id}")

        return workspace_path

    def get_shell_for_id(
        self, workspace_id: str, allow_network: bool = False
    ) -> "WorkspaceShell":
        """Get a sandboxed shell for a workspace ID.

        This is the preferred method for getting shells. It validates the
        workspace_id internally and constructs the path safely.

        Args:
            workspace_id: Alphanumeric workspace identifier
            allow_network: Whether to allow network access (default False)

        Returns:
            WorkspaceShell bound to the validated workspace path
        """
        workspace_path = self._validate_workspace_id(workspace_id)
        return WorkspaceShell(self, workspace_path, allow_network)

    # Port used by socat inside the sandbox for the proxy bridge
    _PROXY_BRIDGE_PORT = 18080

    def _build_command(
        self,
        command: str,
        workspace_path: Path,
        seccomp_fd: int,
        allow_network: bool = False,
        proxy_socket_path: Optional[str] = None,
        additional_binds: Optional[List[Tuple[str, str]]] = None,
    ) -> List[str]:
        """Build the full bwrap command with all options."""
        cmd = self.BWRAP_BASE_CMD.copy()

        # Seccomp syscall filter (blocks dangerous syscalls like io_uring, bpf, ptrace)
        cmd.extend(["--seccomp", str(seccomp_fd)])

        # Handle lib directories (may vary by distro)
        for lib_dir in ["/lib", "/lib64", "/lib32"]:
            if os.path.exists(lib_dir):
                cmd.extend(["--ro-bind", lib_dir, lib_dir])

        # Bind the agent's workspace (read-write)
        cmd.extend(["--bind", str(workspace_path), "/workspace"])

        # Network isolation: ALWAYS unshare network namespace
        # When allow_network=True, proxy socket is mounted for filtered access
        cmd.extend(["--unshare-net"])

        # When network access is requested, mount the proxy socket into the sandbox
        if allow_network and proxy_socket_path:
            cmd.extend(["--bind", proxy_socket_path, "/tmp/proxy.sock"])

        # Additional bind mounts (for special cases)
        if additional_binds:
            for src, dest in additional_binds:
                cmd.extend(["--ro-bind", src, dest])

        # Build the actual command to run inside the sandbox
        if allow_network and proxy_socket_path:
            # Wrap command with proxy bridge setup:
            # 1. Bring up loopback interface (needed for socat TCP listener)
            # 2. Start socat to bridge Unix socket → TCP on loopback
            # 3. Set proxy env vars so curl/git/wget use the proxy
            # 4. Run the actual command
            port = self._PROXY_BRIDGE_PORT
            proxy_setup = (
                f"umask 0022 && ip link set lo up 2>/dev/null; "
                f"socat TCP-LISTEN:{port},fork,reuseaddr UNIX-CONNECT:/tmp/proxy.sock &"
                f" SOCAT_PID=$!; sleep 0.2; "
                f"export http_proxy=http://127.0.0.1:{port}; "
                f"export https_proxy=http://127.0.0.1:{port}; "
                f"export HTTP_PROXY=http://127.0.0.1:{port}; "
                f"export HTTPS_PROXY=http://127.0.0.1:{port}; "
                f"cd /workspace && {command}; "
                f"EXIT_CODE=$?; kill $SOCAT_PID 2>/dev/null; exit $EXIT_CODE"
            )
            cmd.extend(["bash", "-c", proxy_setup])
        else:
            # Standard: no network at all, permissive umask for shared access
            cmd.extend(["bash", "-c", f"umask 0022 && cd /workspace && {command}"])

        return cmd

    def execute(
        self,
        command: str,
        workspace_path: Path,
        timeout: int = 300,
        allow_network: bool = False,
        env: Optional[dict[str, str]] = None,
    ) -> ExecutionResult:
        """
        Execute a command in an isolated bwrap sandbox.

        Network is ALWAYS isolated (--unshare-net). When allow_network=True,
        a filtering proxy is started and bridged into the sandbox via socat.
        The proxy blocks all private/reserved IPs while allowing public internet.

        Args:
            command: Bash command to execute
            workspace_path: Path to agent's workspace (mounted at /workspace)
            timeout: Maximum execution time in seconds (default 5 minutes)
            allow_network: Whether to allow filtered network access (default False)
            env: Optional environment variables (empty by default for security)

        Returns:
            ExecutionResult with stdout, stderr, exit code, and timeout status
        """
        # Verify workspace exists
        if not workspace_path.exists():
            workspace_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created workspace directory: {workspace_path}")

        # When network is requested, ensure the filtering proxy is running
        proxy_socket_path = None
        if allow_network:
            try:
                proxy_mgr = ProxyManager.get_instance()
                proxy_socket_path = proxy_mgr.ensure_running()
                logger.info(
                    f"Network access enabled via filtering proxy at {proxy_socket_path}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to start network proxy, disabling network access: {e}"
                )
                # Fall back to no network rather than unrestricted network
                proxy_socket_path = None

        # Create seccomp filter — mandatory, fail if unavailable
        try:
            seccomp_fd = create_seccomp_fd()
        except Exception as e:
            logger.error(f"Seccomp filter creation failed: {e}")
            return ExecutionResult(
                exit_code=-1,
                stdout="",
                stderr=f"Sandbox security error: seccomp filter unavailable ({e})",
                timed_out=False,
            )

        # Build bwrap command
        cmd = self._build_command(
            command, workspace_path, seccomp_fd,
            allow_network=allow_network,
            proxy_socket_path=proxy_socket_path,
        )

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
                pass_fds=(seccomp_fd,),
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
        finally:
            os.close(seccomp_fd)

    def get_shell(self, workspace_path: Path, allow_network: bool = False) -> "WorkspaceShell":
        """Get a shell bound to a specific workspace."""
        return WorkspaceShell(self, workspace_path, allow_network)


class WorkspaceShell:
    """
    A bound shell for executing commands in a specific workspace.

    Created via BwrapExecutor.get_shell(workspace_path).
    All commands run in bwrap sandbox with workspace mounted at /workspace.
    """

    def __init__(
        self, executor: BwrapExecutor, workspace_path: Path, allow_network: bool = False
    ):
        self._executor = executor
        self._workspace_path = workspace_path
        self._allow_network = allow_network

    def run(self, command: str, timeout: int = 300) -> ExecutionResult:
        """Run a bash command in the sandbox. Command runs in /workspace."""
        return self._executor.execute(
            command=command,
            workspace_path=self._workspace_path,
            timeout=timeout,
            allow_network=self._allow_network,
        )

    def read_file(self, path: str) -> str:
        """Read file content. Returns content or error string."""
        result = self.run(f"cat '{path}'", timeout=30)
        return result.stdout if result.success else f"Error: {result.stderr}"

    def write_file(self, path: str, content: str) -> bool:
        """Write content to file (overwrites)."""
        cmd = f"cat > '{path}' << 'EOF'\n{content}\nEOF"
        return self.run(cmd, timeout=30).success

    def append_file(self, path: str, content: str) -> bool:
        """Append content to file."""
        cmd = f"cat >> '{path}' << 'EOF'\n{content}\nEOF"
        return self.run(cmd, timeout=30).success

    def mkdir(self, path: str) -> bool:
        """Create directory (with parents)."""
        return self.run(f"mkdir -p '{path}'", timeout=30).success

    def touch(self, path: str) -> bool:
        """Create empty file or update timestamp."""
        return self.run(f"touch '{path}'", timeout=30).success
