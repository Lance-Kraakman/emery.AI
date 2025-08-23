"""
Core Types and Enums

AIDEV-NOTE: Enums matching protobuf definitions exactly.
"""

from enum import Enum


class StepType(Enum):
    """Step execution types matching protobuf StepType."""
    CODE_STEP = 0
    TOOL_STEP = 1


class TaskStatus(Enum):
    """Task execution status matching protobuf TaskStatus."""
    TASK_PENDING = 0
    TASK_IN_PROGRESS = 1
    TASK_COMPLETED = 2
    TASK_FAILED = 3
    TASK_CANCELLED = 4
    TASK_TIMEOUT = 5


class WorkerStatus(Enum):
    """Worker health status matching protobuf WorkerStatus."""
    WORKER_HEALTHY = 0
    WORKER_BUSY = 1
    WORKER_DEGRADED = 2
    WORKER_UNHEALTHY = 3
    WORKER_SHUTTING_DOWN = 4