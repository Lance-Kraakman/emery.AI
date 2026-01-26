"""
Sandbox Module - Isolated execution environments for agent tasks.

Provides bubblewrap (bwrap) based isolation for secure command execution.
Agents run in isolated filesystem namespaces with only their workspace accessible.
"""

from .bwrap_executor import BwrapExecutor, ExecutionResult, WorkspaceShell

__all__ = ["BwrapExecutor", "ExecutionResult", "WorkspaceShell"]
