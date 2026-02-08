"""
gVisor (runsc) Executor for Isolated Command Execution.

Executes bash commands in a gVisor sandbox using the ptrace platform.
gVisor intercepts ALL syscalls in user-space via its Sentry kernel,
meaning the real Linux kernel is never exposed to agent code.

Security model:
- Sentry: User-space kernel that handles all syscalls
- Gofer: Separate process that mediates filesystem access
- Synthetic /proc, /sys: No host information leakage
- Platform: ptrace (works on Fargate, no KVM required)

Network isolation:
- Default: No network (--network=none)
- With allowNetwork: Proxy socket mounted for filtered HTTP access

Reference: https://gvisor.dev/docs/
"""

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path

from .proxy_manager import ProxyManager

logger = logging.getLogger(__name__)

# Minimal PATH for sandbox
SANDBOX_PATH = "/usr/local/bin:/usr/bin:/bin"


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


class GVisorExecutor:
    """
    Execute bash commands in gVisor sandbox using ptrace platform.

    gVisor provides strong kernel isolation:
    - All syscalls intercepted by Sentry (user-space kernel)
    - Synthetic /proc, /sys (no host info leak)
    - Gofer process mediates all filesystem access
    - No kernel attack surface exposed

    Requires:
    - runsc binary installed (gVisor runtime)
    - SYS_PTRACE capability in container
    """

    # Default base path for workspaces
    DEFAULT_BASE_PATH = Path("/tmp/workspace")

    # gVisor container ID prefix
    CONTAINER_PREFIX = "emery-sandbox-"

    def __init__(self, base_path: Path | None = None) -> None:
        self._base_path = base_path or self.DEFAULT_BASE_PATH
        self._verify_runsc_available()

    def _verify_runsc_available(self) -> None:
        """Check if gVisor runsc is installed."""
        if not shutil.which("runsc"):
            raise RuntimeError(
                "gVisor (runsc) not found in PATH. "
                "Install with: apt-get install runsc"
            )

    def _validate_workspace_id(self, workspace_id: str) -> Path:
        """Validate workspace_id and return safe workspace path."""
        if not workspace_id:
            raise ValueError("workspace_id cannot be empty")

        if ".." in workspace_id:
            raise ValueError("Invalid workspace_id: contains path traversal '..'")

        if "/" in workspace_id or "\\" in workspace_id:
            raise ValueError("Invalid workspace_id: contains path separator")

        if len(workspace_id) > 255:
            raise ValueError("workspace_id exceeds maximum length of 255")

        if not re.match(r"^[a-zA-Z0-9_-]+$", workspace_id):
            raise ValueError(
                "Invalid workspace_id: must contain only alphanumeric, dash, underscore"
            )

        workspace_path = self._base_path / workspace_id

        try:
            workspace_path.resolve().relative_to(self._base_path.resolve())
        except ValueError:
            raise ValueError(
                f"Path traversal detected for workspace_id: {workspace_id}"
            )

        return workspace_path

    def get_shell_for_id(
        self, workspace_id: str, allow_network: bool = False
    ) -> "GVisorShell":
        """Get a sandboxed shell for a workspace ID."""
        workspace_path = self._validate_workspace_id(workspace_id)
        return GVisorShell(self, workspace_path, allow_network)

    def _create_oci_config(
        self,
        command: str,
        workspace_path: Path,
        allow_network: bool = False,
        proxy_socket_path: str | None = None,
    ) -> dict:
        """Create OCI runtime specification for gVisor."""
        # Build mount list
        mounts = [
            # Workspace (read-write)
            {
                "destination": "/workspace",
                "source": str(workspace_path),
                "type": "bind",
                "options": ["rbind", "rw"],
            },
            # System tools (read-only)
            {
                "destination": "/usr",
                "source": "/usr",
                "type": "bind",
                "options": ["rbind", "ro"],
            },
            {
                "destination": "/bin",
                "source": "/bin",
                "type": "bind",
                "options": ["rbind", "ro"],
            },
            # Libraries
            {
                "destination": "/lib",
                "source": "/lib",
                "type": "bind",
                "options": ["rbind", "ro"],
            },
            # Ephemeral directories
            {"destination": "/tmp", "source": "tmpfs", "type": "tmpfs"},
            {"destination": "/var", "source": "tmpfs", "type": "tmpfs"},
            {"destination": "/run", "source": "tmpfs", "type": "tmpfs"},
            {"destination": "/etc", "source": "tmpfs", "type": "tmpfs"},
            # /etc/alternatives for Debian symlinks
            {
                "destination": "/etc/alternatives",
                "source": "/etc/alternatives",
                "type": "bind",
                "options": ["rbind", "ro"],
            },
            # proc and dev are provided by gVisor (synthetic)
        ]

        # Add lib64 if it exists
        if os.path.exists("/lib64"):
            mounts.append({
                "destination": "/lib64",
                "source": "/lib64",
                "type": "bind",
                "options": ["rbind", "ro"],
            })

        # Add proxy socket if network enabled
        if allow_network and proxy_socket_path:
            mounts.append({
                "destination": "/tmp/proxy.sock",
                "source": proxy_socket_path,
                "type": "bind",
                "options": ["rbind", "rw"],
            })

        # Build environment
        env = [f"PATH={SANDBOX_PATH}"]
        if allow_network and proxy_socket_path:
            port = 18080
            env.extend([
                f"http_proxy=http://127.0.0.1:{port}",
                f"https_proxy=http://127.0.0.1:{port}",
                f"HTTP_PROXY=http://127.0.0.1:{port}",
                f"HTTPS_PROXY=http://127.0.0.1:{port}",
            ])

        # Build the command
        if allow_network and proxy_socket_path:
            port = 18080
            full_command = (
                f"ip link set lo up 2>/dev/null; "
                f"socat TCP-LISTEN:{port},fork,reuseaddr UNIX-CONNECT:/tmp/proxy.sock & "
                f"SOCAT_PID=$!; sleep 0.2; "
                f"cd /workspace && {command}; "
                f"EXIT_CODE=$?; kill $SOCAT_PID 2>/dev/null; exit $EXIT_CODE"
            )
        else:
            full_command = f"cd /workspace && {command}"

        return {
            "ociVersion": "1.0.0",
            "process": {
                "terminal": False,
                "user": {"uid": 0, "gid": 0},
                "args": ["bash", "-c", full_command],
                "env": env,
                "cwd": "/workspace",
                "capabilities": {
                    "bounding": [],
                    "effective": [],
                    "inheritable": [],
                    "permitted": [],
                    "ambient": [],
                },
                "rlimits": [
                    {"type": "RLIMIT_NOFILE", "hard": 1024, "soft": 1024},
                ],
                "noNewPrivileges": True,
            },
            "root": {
                "path": "rootfs",
                "readonly": False,
            },
            "hostname": "sandbox",
            "mounts": mounts,
            "linux": {
                "namespaces": [
                    {"type": "pid"},
                    {"type": "ipc"},
                    {"type": "uts"},
                    {"type": "mount"},
                    {"type": "network"},
                ],
            },
        }

    def execute(
        self,
        command: str,
        workspace_path: Path,
        timeout: int = 300,
        allow_network: bool = False,
        env: dict[str, str] | None = None,
    ) -> ExecutionResult:
        """
        Execute a command in a gVisor sandbox.

        Args:
            command: Bash command to execute
            workspace_path: Path to agent's workspace (mounted at /workspace)
            timeout: Maximum execution time in seconds (default 5 minutes)
            allow_network: Whether to allow filtered network access (default False)
            env: Optional additional environment variables

        Returns:
            ExecutionResult with stdout, stderr, exit code, and timeout status
        """
        # Verify workspace exists
        if not workspace_path.exists():
            workspace_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Created workspace directory: {workspace_path}")

        # Start network proxy if needed
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
                proxy_socket_path = None

        # Create temporary directory for OCI bundle
        container_id = f"{self.CONTAINER_PREFIX}{uuid.uuid4().hex[:12]}"
        bundle_dir = Path(tempfile.mkdtemp(prefix="gvisor-bundle-"))

        try:
            # Create OCI config
            config = self._create_oci_config(
                command,
                workspace_path,
                allow_network=allow_network,
                proxy_socket_path=proxy_socket_path,
            )

            # Write config.json
            config_path = bundle_dir / "config.json"
            with open(config_path, "w") as f:
                json.dump(config, f, indent=2)

            # Create rootfs directory (gVisor requires it even with bind mounts)
            rootfs_dir = bundle_dir / "rootfs"
            rootfs_dir.mkdir()

            # Create basic directory structure in rootfs
            for d in ["workspace", "usr", "bin", "lib", "tmp", "var", "run", "etc", "proc", "dev"]:
                (rootfs_dir / d).mkdir(exist_ok=True)

            # Build runsc command
            cmd = [
                "runsc",
                "--platform=ptrace",
                "--network=none",  # Always isolate network
                "--rootless=true",
                f"--root={bundle_dir}/state",
                "run",
                "--bundle", str(bundle_dir),
                container_id,
            ]

            logger.debug(f"Executing gVisor command: {command[:100]}...")
            logger.debug(f"Container ID: {container_id}")

            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    timeout=timeout,
                    cwd=str(bundle_dir),
                )
                return ExecutionResult(
                    exit_code=result.returncode,
                    stdout=result.stdout.decode("utf-8", errors="replace"),
                    stderr=result.stderr.decode("utf-8", errors="replace"),
                    timed_out=False,
                )
            except subprocess.TimeoutExpired:
                # Kill the container
                subprocess.run(
                    ["runsc", f"--root={bundle_dir}/state", "kill", container_id, "KILL"],
                    capture_output=True,
                )
                return ExecutionResult(
                    exit_code=-1,
                    stdout="",
                    stderr=f"Command timed out after {timeout} seconds",
                    timed_out=True,
                )
            except Exception as e:
                logger.exception(f"gVisor execution failed: {e}")
                return ExecutionResult(
                    exit_code=-1,
                    stdout="",
                    stderr=f"gVisor execution error: {str(e)}",
                    timed_out=False,
                )
        finally:
            # Cleanup: delete container and bundle
            try:
                subprocess.run(
                    ["runsc", f"--root={bundle_dir}/state", "delete", "-f", container_id],
                    capture_output=True,
                )
            except Exception:
                pass

            try:
                shutil.rmtree(bundle_dir, ignore_errors=True)
            except Exception:
                pass

    def get_shell(
        self, workspace_path: Path, allow_network: bool = False
    ) -> "GVisorShell":
        """Get a shell bound to a specific workspace."""
        return GVisorShell(self, workspace_path, allow_network)


class GVisorShell:
    """
    A bound shell for executing commands in a specific workspace.

    Created via GVisorExecutor.get_shell(workspace_path).
    All commands run in gVisor sandbox with workspace mounted at /workspace.
    """

    def __init__(
        self, executor: GVisorExecutor, workspace_path: Path, allow_network: bool = False
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
