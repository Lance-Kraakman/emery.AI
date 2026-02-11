"""
Simplified Entity Layer

Domain entities without DDD value object overhead.
Uses direct types (int, str) with validation in constructors.
"""

from .agent import Agent, AgentConfig
from .execution_context import ExecutionContext
from .skill_config import (
    InputDefinition,
    OutputDefinition,
    OutputSource,
    SkillConfig,
    SkillStep,
    StepToolConfig,
)
from .task import (
    RowMappingContext,
    SkillInputValue,
    SkillOutputValue,
    Task,
    TaskConfig,
    TaskInstructions,
)
from .workspace import (
    WorkspaceAgent,
    WorkspaceApp,
    WorkspaceData,
    WorkspaceDatabase,
    WorkspaceField,
    WorkspacePage,
    WorkspaceSkill,
    WorkspaceTable,
    WorkspaceView,
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
    # Workspace resource entities
    "WorkspaceField",
    "WorkspacePage",
    "WorkspaceApp",
    "WorkspaceAgent",
    "WorkspaceSkill",
    "WorkspaceTable",
    "WorkspaceDatabase",
    "WorkspaceView",
    "WorkspaceData",
]
