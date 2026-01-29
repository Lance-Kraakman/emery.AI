"""
Task execution services.

Provides unified task execution for both background (ExecuteTask gRPC)
and chat (ProcessMessage with task_id) paths.
"""

from .task_executor import TaskExecutor

__all__ = ["TaskExecutor"]
