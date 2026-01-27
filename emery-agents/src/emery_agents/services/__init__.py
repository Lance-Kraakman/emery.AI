"""
Services Layer

Business logic services without DDD interfaces or dependency injection.
Direct imports and concrete implementations only.

Submodules:
- context/: Context and configuration management
- models/: LLM/Model management
- analysis/: Analysis utilities (gap analyzer, token usage, embeddings)
- http/: HTTP and external communication
- tools/: Tool loading and capabilities
- data/: Data processing and storage
- skills/: Skill execution
- agents/: Agent-related services
- execution/: Execution state and handlers
- planning/: Plan generation and management
- sandbox/: Safe code execution
"""

# Models (LLM/Model management)
from .models import ModelProvider, TokenUsage

# Context (context and configuration)
from .context import ContextResolver, ContextSyncService, ContextSyncServiceFactory

# Tools (tool loading and capabilities)
from .tools import UnifiedToolLoader, CapabilityRegistry

# Data (data processing and storage)
from .data import ResultStorageService, ResultStorageServiceFactory, StoredResult

# Agents (agent-related services)
from .agents import AgentExecutor, AgentAPIService, AgentData, SkillData

# Root-level services
from .plan_service import PlanService, PlanServiceFactory

# Events (from execution events module — canonical source)
from .execution.events import (
    PlanCreatedEvent,
    PlanApprovedEvent,
    StepStartedEvent,
    StepCompletedEvent,
    StepFailedEvent,
    ExecutionCompletedEvent,
    EvaluationResult,
    EvaluationCompletedEvent,
    ReplanTriggeredEvent,
    GoalAchievedEvent,
    ExecutionBlockedEvent,
    PhaseStartedEvent,
    PhaseCompletedEvent,
)

# NOTE: ExecutionCoordinator has been replaced by LangGraph orchestrators.
# All callers now use create_plan_execute_graph() or generate_plan_node() directly.

from ..entities.models.task_ledger import TaskLedger, create_ledger_from_plan

# Orchestrators (LangGraph-based — primary orchestration path)
from ..orchestrators import create_plan_execute_graph, create_plan_only_graph

__all__ = [
    "ModelProvider",
    "TokenUsage",
    "UnifiedToolLoader",
    "AgentExecutor",
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
    "PhaseStartedEvent",
    "PhaseCompletedEvent",
    "ResultStorageService",
    "ResultStorageServiceFactory",
    "StoredResult",
    "TaskLedger",
    "create_ledger_from_plan",
    "AgentAPIService",
    "AgentData",
    "SkillData",
    "CapabilityRegistry",
    # Orchestrators
    "create_plan_execute_graph",
    "create_plan_only_graph",
]
