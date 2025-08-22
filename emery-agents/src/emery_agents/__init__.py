"""
Emery Agents - Agent execution system for Emery.

This package provides:
- Simple Domain-Driven Design (DDD) architecture
- Domain entities with business logic
- Repository pattern for data access
- Application services for orchestration
- Clean separation of concerns following TypeScript patterns
"""

# Domain entities
from .domain.agents.entities.agent import Agent, AgentConfig
from .domain.agents.entities.task import Task, TaskInstructions, TaskConfig

# Repository interfaces
from .domain.agents.repositories.agent_repository import IAgentRepository
from .domain.agents.repositories.task_repository import ITaskRepository

# Application services
from .application.services.agent_task_service import (
    AgentTaskApplicationService,
    CreateTaskRequest,
    ExecuteTaskRequest,
    TaskExecutionResult
)

__version__ = "0.1.0"
__author__ = "Lance Kraakman"
__email__ = "lance@aifactory.nz"

__all__ = [
    # Domain entities
    "Agent",
    "AgentConfig",
    "Task",
    "TaskInstructions",
    "TaskConfig",
    
    # Repository interfaces
    "IAgentRepository",
    "ITaskRepository",
    
    # Application services
    "AgentTaskApplicationService",
    "CreateTaskRequest",
    "ExecuteTaskRequest",
    "TaskExecutionResult",
]
