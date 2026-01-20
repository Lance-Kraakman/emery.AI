"""
Planning Module

Modular planning infrastructure for plan generation, persistence, and analysis.

This module provides:
- PlanGenerator: Core logic for generating plans from instructions
- PlanRepository: gRPC persistence for plans
- FailureAnalyzer: Step failure analysis and recovery
- Dataclasses: PlanGenerationRequest, PlanGenerationResult, etc.
- Domain Planners: Schema, App, Automation planners with LLM classification

AIDEV-NOTE: The original monolithic PlanService (~700 lines) has been split into:
- models.py: Typed dataclasses for requests/results
- plan_generator.py: LLM-based plan generation
- plan_repository.py: gRPC persistence
- failure_analyzer.py: Recovery analysis
- planners/: Domain-specific planners with routing

The PlanService class in plan_service.py is now a facade that delegates to these modules.
"""

from .models import (
    AgentInfo,
    ToolResultSummary,
    PlanGenerationRequest,
    PlanGenerationResult,
    FailureAnalysisRequest,
)
from .plan_generator import PlanGenerator
from .plan_repository import PlanRepository
from .failure_analyzer import FailureAnalyzer

# Domain planners
from .planners import (
    DomainPlanner,
    DomainPlanResult,
    PlannerClassifier,
    DomainClassification,
    SchemaDomainPlanner,
    AppDomainPlanner,
    AutomationDomainPlanner,
    PlannerRouter,
)

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
    # Domain Planners
    "DomainPlanner",
    "DomainPlanResult",
    "PlannerClassifier",
    "DomainClassification",
    "SchemaDomainPlanner",
    "AppDomainPlanner",
    "AutomationDomainPlanner",
    "PlannerRouter",
]
