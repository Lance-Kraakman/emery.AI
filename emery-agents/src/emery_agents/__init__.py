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
from .entities import (
    Agent,
    AgentConfig,
    ExecutionContext,
    Task,
    TaskConfig,
    TaskInstructions,
)

# Export gRPC server for main entry point
from .grpc.server import main as grpc_serve

# Export services
# AgentExecutor omitted: import directly from services.agents.executor (heavy, circular if eager)
from .services import ModelProvider, TokenUsage

# Export types
from .types import (
    AgentId,
    ExecutionMode,
    ModelType,
    OrganizationId,
    TaskId,
    TaskStatus,
    WorkerStatus,
)

__all__ = [
    # Entities
    "Agent",
    "AgentConfig",
    "Task",
    "TaskConfig",
    "TaskInstructions",
    "ExecutionContext",
    # Services
    "ModelProvider",
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
