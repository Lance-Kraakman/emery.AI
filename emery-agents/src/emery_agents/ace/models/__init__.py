"""
ACE Models

Dataclasses for Agentic Context Engineering:
- ExecutionContext: Curated insights from step execution
- ExecutionEvolutionTracker: Change tracking and degradation detection
- StrategyRegistry: Proven execution patterns
- PlanningContext: Curated context between planning phases
"""

from .execution_context import (
    ExecutionContext,
    ExecutionInsight,
    InsightType,
    StepResult,
    create_insight,
)
from .execution_evolution import (
    ExecutionEvolutionTracker,
    ExecutionDelta,
    ExecutionSnapshot,
    ExecutionChangeType,
)
from .strategy_accumulation import (
    StrategyRegistry,
    StrategyRecord,
    ExecutionPattern,
    StrategyOutcome,
)
from .planning_context import (
    PlanningContext,
    PlanningInsight,
    PlanningInsightType,
    PhaseGoal,
)

__all__ = [
    # Execution Context
    "ExecutionContext",
    "ExecutionInsight",
    "InsightType",
    "StepResult",
    "create_insight",
    # Execution Evolution
    "ExecutionEvolutionTracker",
    "ExecutionDelta",
    "ExecutionSnapshot",
    "ExecutionChangeType",
    # Strategy Accumulation
    "StrategyRegistry",
    "StrategyRecord",
    "ExecutionPattern",
    "StrategyOutcome",
    # Planning Context
    "PlanningContext",
    "PlanningInsight",
    "PlanningInsightType",
    "PhaseGoal",
]
