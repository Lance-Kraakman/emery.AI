"""
Manages the SandboxProxy subprocess lifecycle.

The proxy runs as a SEPARATE subprocess (not in the gRPC server process)
so that a proxy exploit doesn't directly compromise the gRPC server.

Singleton per container — started lazily on first allow_network=True execution.
"""

import logging
import os
import signal
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Default socket path for the proxy
DEFAULT_SOCKET_PATH = "/tmp/sandbox-proxy.sock"

# How long to wait for proxy to start (seconds)
STARTUP_TIMEOUT = 5.0

# How often to check if proxy is alive
HEALTH_CHECK_INTERVAL = 0.1


class ProxyManager:
    """Manages a singleton SandboxProxy subprocess per container.

    The proxy is started lazily on first use and kept alive for the lifetime
    of the container. If it dies, it's automatically restarted on next use.

    Usage:
        manager = ProxyManager.get_instance()
        socket_path = manager.ensure_running()
        # ... use socket_path in bwrap bind mount ...
    """

    _instance: Optional["ProxyManager"] = None

    def __init__(self, socket_path: str = DEFAULT_SOCKET_PATH):
        self.socket_path = socket_path
        self._process: Optional[subprocess.Popen[bytes]] = None

    @classmethod
    def get_instance(cls) -> "ProxyManager":
        """Get or create the singleton ProxyManager."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def ensure_running(self) -> str:
        """Ensure the proxy subprocess is running. Returns the socket path.

        Starts the proxy if not running. Restarts if the process died.
        Waits for the socket to become available before returning.
        """
        if self._process is not None and self._process.poll() is None:
            # Process still running — verify socket exists
            if os.path.exists(self.socket_path):
                return self.socket_path
            else:
                logger.warning("Proxy process alive but socket missing, restarting")
                self._kill_process()

        if self._process is not None and self._process.poll() is not None:
            exit_code = self._process.poll()
            logger.warning(f"Proxy process died with exit code {exit_code}, restarting")
            self._process = None

        # Start the proxy as a subprocess
        return self._start()

    def _start(self) -> str:
        """Start the proxy subprocess and wait for socket to appear."""
        # Clean up stale socket
        if os.path.exists(self.socket_path):
            os.unlink(self.socket_path)

        # Launch proxy as subprocess using the same Python interpreter
        proxy_module = "emery_agents.services.sandbox.network_proxy"
        self._process = subprocess.Popen(
            [sys.executable, "-m", proxy_module, self.socket_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        logger.info(f"Started SandboxProxy subprocess (PID {self._process.pid})")

        # Wait for socket to appear
        start_time = time.monotonic()
        while time.monotonic() - start_time < STARTUP_TIMEOUT:
            if self._process.poll() is not None:
                # Process died during startup
                stderr = self._process.stderr.read().decode() if self._process.stderr else ""
                raise RuntimeError(
                    f"SandboxProxy died during startup (exit {self._process.returncode}): {stderr[:500]}"
                )

            if os.path.exists(self.socket_path):
                logger.info(f"SandboxProxy ready at {self.socket_path}")
                return self.socket_path

            time.sleep(HEALTH_CHECK_INTERVAL)

        # Timeout — kill and raise
        self._kill_process()
        raise RuntimeError(
            f"SandboxProxy failed to start within {STARTUP_TIMEOUT}s"
        )

    def _kill_process(self) -> None:
        """Kill the proxy subprocess."""
        if self._process is None:
            return

        try:
            self._process.send_signal(signal.SIGTERM)
            self._process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            self._process.kill()
            self._process.wait(timeout=1)
        except Exception:
            pass

        self._process = None

        if os.path.exists(self.socket_path):
            try:
                os.unlink(self.socket_path)
            except OSError:
                pass

    def shutdown(self) -> None:
        """Stop the proxy subprocess. Called on container shutdown."""
        logger.info("Shutting down SandboxProxy")
        self._kill_process()

    @property
    def is_running(self) -> bool:
        """Check if the proxy is currently running."""
        return (
            self._process is not None
            and self._process.poll() is None
            and os.path.exists(self.socket_path)
        )
