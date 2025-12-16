"""
Emery Agents - Simplified Agent Execution Service

Simplified architecture without DDD overhead:
- entities/ - Simple dataclasses with validation
- services/ - Business logic (executor, model provider, tool loader)
- grpc/ - gRPC services and protobuf
- types.py - Consolidated enums and type aliases
- No DDD: No value objects, interfaces, or DI container

"""

__version__ = "3.0.0-simplified"

# Export simplified entities
from .entities import Agent, AgentConfig, Task, TaskConfig, TaskInstructions, ExecutionContext

# Export services
from .services import AgentExecutor, SmolagentsModelProvider, UnifiedToolLoader, TokenUsage

# Export types
from .types import (
    ExecutionMode,
    TaskStatus,
    WorkerStatus,
    ModelType,
    AgentId,
    OrganizationId,
    TaskId,
)

# Export gRPC server for main entry point
from .grpc.server import main as grpc_serve

__all__ = [
    # Entities
    "Agent",
    "AgentConfig",
    "Task",
    "TaskConfig",
    "TaskInstructions",
    "ExecutionContext",
    # Services
    "AgentExecutor",
    "SmolagentsModelProvider",
    "UnifiedToolLoader",
    "TokenUsage",
    # Types
    "ExecutionMode",
    "TaskStatus",
    "WorkerStatus",
    "ModelType",
    "AgentId",
    "OrganizationId",
    "TaskId",
    # gRPC
    "grpc_serve",
]
