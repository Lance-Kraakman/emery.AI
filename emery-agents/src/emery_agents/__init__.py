"""
Emery Agents - Pure agent execution service for protobuf requests.

This package provides:
- Simple protobuf-compatible execution service
- Core domain entities matching protobuf schema exactly
- Smolagents integration with streaming progress
- Dual execution modes: capability-based and instruction-based
"""

# Core entities matching protobuf
from .core.entities import (
    TaskRequest, TaskProgress, AgentConfig, CapabilityConfig, 
    StepConfig, ToolConfig, ServerConfig, InstructionConfig,
    WorkerInfo, CancelTaskRequest, CancelTaskResponse
)
from .core.types import StepType, TaskStatus, WorkerStatus

# Execution services
from .execution.capability_router import CapabilityRouter
from .execution.tool_loader import ToolLoader
# Import SmolAgentsExecutionService only when needed to avoid smolagents dependency
# from .infrastructure.execution.smolagents_execution_service import SmolAgentsExecutionService

__version__ = "2.0.0-protobuf"
__author__ = "Lance Kraakman"
__email__ = "lance@aifactory.nz"

__all__ = [
    # Core entities
    "TaskRequest",
    "TaskProgress", 
    "AgentConfig",
    "CapabilityConfig",
    "StepConfig",
    "ToolConfig",
    "ServerConfig",
    "InstructionConfig",
    "WorkerInfo",
    "CancelTaskRequest",
    "CancelTaskResponse",
    
    # Core types
    "StepType",
    "TaskStatus", 
    "WorkerStatus",
    
    # Execution services
    "CapabilityRouter",
    "ToolLoader",
    # "SmolAgentsExecutionService",  # Import manually when needed
]
