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

# DDD Application services
from .application.di.container import container
from .domain.execution.services.capability_routing_service import CapabilityRoutingService

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
    
    # DDD Application services
    "container",
    "CapabilityRoutingService",
]
