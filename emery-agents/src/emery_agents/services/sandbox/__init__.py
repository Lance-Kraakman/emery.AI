"""
Sandbox Module - Isolated execution environments for agent tasks.

Provides gVisor-based isolation for secure command execution.
gVisor intercepts ALL syscalls via its Sentry user-space kernel,
providing stronger isolation than namespace-based sandboxes.

Agents run in isolated gVisor containers with only their workspace accessible.
"""

from .gvisor_executor import ExecutionResult, GVisorExecutor, GVisorShell

__all__ = [
    "GVisorExecutor",
    "GVisorShell",
    "ExecutionResult",
]
