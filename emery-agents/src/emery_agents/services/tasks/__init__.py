"""
Task execution services.

Provides unified task execution for both background (ExecuteTask gRPC)
and chat (ProcessMessage with task_id) paths.
"""

from .task_executor import TaskExecutor
from . import workspace_lock

__all__ = ["TaskExecutor", "workspace_lock"]
