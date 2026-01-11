"""
Simplified Entity Layer

Domain entities without DDD value object overhead.
Uses direct types (int, str) with validation in constructors.
"""

from .agent import Agent, AgentConfig
from .task import Task, TaskConfig, TaskInstructions
from .execution_context import ExecutionContext
from .skill_io import SkillInputValue, SkillOutputValue, RowMappingContext

__all__ = [
    "Agent",
    "AgentConfig",
    "Task",
    "TaskConfig",
    "TaskInstructions",
    "ExecutionContext",
    "SkillInputValue",
    "SkillOutputValue",
    "RowMappingContext",
]
