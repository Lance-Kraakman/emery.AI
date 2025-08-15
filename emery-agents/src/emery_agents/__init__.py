"""
Emery Agents - Agent execution system for Emery.

This package provides:
- Multi-step agent workflow execution
- Integration with smolagents for AI capabilities  
- MCP server integration via Pipedream Connect
- Execution tracking and reporting
"""

from .core.types import (
    Agent, StepExecution,
    StepType, TriggerType, TaskStatus, Task,
    CapabilityConfig, TriggerConfig, ExecutionContext,
    ToolConfig, ServerConfig, StepConfig
)
from .integrations.smolagents import SmolAgentsOrchestrator

__version__ = "0.1.0"
__author__ = "Lance Kraakman"
__email__ = "lance@aifactory.nz"

__all__ = [
    # Core types
    "Agent",
    "StepExecution",
    "StepType",
    "TriggerType",
    "TaskStatus",
    "Task",
    "CapabilityConfig",
    "TriggerConfig",
    "ExecutionContext",
    "ToolConfig",
    "ServerConfig",
    "StepConfig",
    
    # Integrations
    "SmolAgentsOrchestrator",
]
