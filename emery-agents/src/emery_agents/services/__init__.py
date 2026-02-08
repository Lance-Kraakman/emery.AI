"""
Services Layer

Business logic services without DDD interfaces or dependency injection.
Direct imports and concrete implementations only.

Submodules:
- context/: Context and configuration management
- models/: LLM/Model management
- analysis/: Analysis utilities (gap analyzer, token usage, embeddings)
- http/: HTTP and external communication
- data/: Data processing and storage
- skills/: Skill execution
- agents/: Agent-related services
- execution/: Execution state and handlers
- planning/: Plan generation and management
- sandbox/: Safe code execution
- tasks/: Task execution (unified for gRPC and chat)
"""

# Models (LLM/Model management)
from ..entities.models.task_ledger import TaskLedger, create_ledger_from_plan

# Agents (agent-related services)
# AgentExecutor omitted: import directly from services.agents.executor (heavy, circular if eager)
from .agents import AgentAPIService

# Context (context and configuration)
from .context import ContextResolver, ContextSyncService, ContextSyncServiceFactory

# Credentials (shared credential types)
from .credentials import CredentialSource, ResolvedCredentials

# Data (data processing and storage)
from .data import ResultStorageService, ResultStorageServiceFactory, StoredResult

# Events (from execution events module — canonical source)
from .execution.events import (
    EvaluationCompletedEvent,
    EvaluationResult,
    ExecutionBlockedEvent,
    ExecutionCompletedEvent,
    GoalAchievedEvent,
    PlanApprovedEvent,
    PlanCreatedEvent,
    ReplanTriggeredEvent,
    StepCompletedEvent,
    StepFailedEvent,
    StepStartedEvent,
)
from .models import ModelProvider, TokenUsage

# Root-level services
from .plan_service import PlanService, PlanServiceFactory

# Tasks: import directly from .tasks to avoid circular imports

__all__ = [
    "ModelProvider",
    "TokenUsage",
    "ContextResolver",
    "ContextSyncService",
    "ContextSyncServiceFactory",
    "PlanService",
    "PlanServiceFactory",
    "PlanCreatedEvent",
    "PlanApprovedEvent",
    "StepStartedEvent",
    "StepCompletedEvent",
    "StepFailedEvent",
    "ExecutionCompletedEvent",
    "EvaluationResult",
    "EvaluationCompletedEvent",
    "ReplanTriggeredEvent",
    "GoalAchievedEvent",
    "ExecutionBlockedEvent",
    "ResultStorageService",
    "ResultStorageServiceFactory",
    "StoredResult",
    "TaskLedger",
    "create_ledger_from_plan",
    "AgentAPIService",
    # Tasks: import directly from .tasks
    # Credentials
    "ResolvedCredentials",
    "CredentialSource",
]
