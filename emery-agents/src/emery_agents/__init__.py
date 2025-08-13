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
    # AIDEV-NOTE: Updated to new Task-based model - removed TaskExecution
)
from .core.runner import AgentRunner
from .integrations.smolagents import SmolAgentsIntegration
from .integrations.mcp_servers import MCPServerIntegration
from .integrations.emery_client import EmeryClientIntegration

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
    
    # Core runner
    "AgentRunner",
    
    # Integrations
    "SmolAgentsIntegration",
    "MCPServerIntegration", 
    "EmeryClientIntegration",
]
