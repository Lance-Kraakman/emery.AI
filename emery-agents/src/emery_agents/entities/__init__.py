"""
Simplified Entity Layer

Domain entities without DDD value object overhead.
Uses direct types (int, str) with validation in constructors.
"""

from .agent import Agent, AgentConfig
from .task import Task, TaskConfig, TaskInstructions
from .execution_context import ExecutionContext
from .task import SkillInputValue, SkillOutputValue, RowMappingContext
from .skill_config import (
    SkillConfig,
    InputDefinition,
    OutputDefinition,
    OutputSource,
    StepToolConfig,
    SkillStep,
)

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
    # Skill config DTO
    "SkillConfig",
    "InputDefinition",
    "OutputDefinition",
    "OutputSource",
    "StepToolConfig",
    "SkillStep",
]
