"""
ACE - Agentic Context Engineering

A standalone package for managing execution context and strategy accumulation.

Components:
- ExecutionContext: Curated insights from step execution results
- ExecutionEvolutionTracker: Change tracking and degradation detection
- StrategyRegistry: Proven execution patterns for reuse
- PlanningContext: Curated context between planning phases

Services:
- ExecutionContextService: LLM-based insight extraction from step results
- StrategyAccumulationService: Records and surfaces proven patterns to planner
- PlanningContextService: Curates context between planning phases

AIDEV-NOTE: This module was extracted from emery_agents/models and emery_agents/services
to create a cohesive, standalone package for context engineering functionality.
"""

# Models
from .models import (
    ExecutionContext,
    ExecutionInsight,
    InsightType,
    StepResult,
    create_insight,
    ExecutionEvolutionTracker,
    ExecutionDelta,
    ExecutionSnapshot,
    ExecutionChangeType,
    StrategyRegistry,
    StrategyRecord,
    ExecutionPattern,
    StrategyOutcome,
    PlanningContext,
    PlanningInsight,
    PlanningInsightType,
    PhaseGoal,
)

# Services
from .services import (
    ExecutionContextService,
    create_execution_context_service,
    StrategyAccumulationService,
    create_strategy_accumulation_service,
    PlanningContextService,
)

__all__ = [
    # Models - Execution Context
    "ExecutionContext",
    "ExecutionInsight",
    "InsightType",
    "StepResult",
    "create_insight",
    # Models - Execution Evolution
    "ExecutionEvolutionTracker",
    "ExecutionDelta",
    "ExecutionSnapshot",
    "ExecutionChangeType",
    # Models - Strategy Accumulation
    "StrategyRegistry",
    "StrategyRecord",
    "ExecutionPattern",
    "StrategyOutcome",
    # Models - Planning Context
    "PlanningContext",
    "PlanningInsight",
    "PlanningInsightType",
    "PhaseGoal",
    # Services
    "ExecutionContextService",
    "create_execution_context_service",
    "StrategyAccumulationService",
    "create_strategy_accumulation_service",
    "PlanningContextService",
]
