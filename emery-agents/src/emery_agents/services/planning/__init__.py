"""
Planning Module

Modular planning infrastructure for plan generation, persistence, and analysis.

This module provides:
- PlanGenerator: Core logic for generating plans using capability discovery
- PlanRepository: gRPC persistence for plans
- FailureAnalyzer: Step failure analysis and recovery
- Dataclasses: PlanGenerationRequest, PlanGenerationResult, etc.

AIDEV-NOTE: Plan generation uses capability-based discovery instead of
domain-specific planners (schema, app, automation). The PlanGenerator:
1. Uses capability discovery tools to find relevant capabilities
2. Generates plan steps with target agents from discovered capabilities
3. Outputs structured plan via submit_plan tool
"""

from .models import (
    ToolResultSummary,
    PlanGenerationRequest,
    PlanGenerationResult,
    FailureAnalysisRequest,
)
from ..context import AgentInfo
from .plan_generator import PlanGenerator
from .plan_repository import PlanRepository
from .failure_analyzer import FailureAnalyzer
from .plan_differ import PlanDiff, PlanDiffer

__all__ = [
    # Models
    "AgentInfo",
    "ToolResultSummary",
    "PlanGenerationRequest",
    "PlanGenerationResult",
    "FailureAnalysisRequest",
    # Services
    "PlanGenerator",
    "PlanRepository",
    "FailureAnalyzer",
    # Plan Diffs
    "PlanDiff",
    "PlanDiffer",
]
