"""
Execution Coordinator Configuration

Configuration classes for ExecutionCoordinator.
"""

from dataclasses import dataclass
from enum import Enum

from ..plan_service import PlanService
from ..protocols import ModelProviderProtocol
from .plan_step_executor import PlanStepExecutor


class CoordinatorMode(Enum):
    """How coordinator handles the task."""

    PLAN_AND_APPROVE = "plan_and_approve"  # Full planning flow
    DIRECT = "direct"  # Execute immediately without plan


@dataclass
class ExecutionCoordinatorConfig:
    """Configuration for ExecutionCoordinator."""

    plan_service: PlanService
    model_provider: ModelProviderProtocol | None = None
    plan_step_executor: PlanStepExecutor | None = None
    evaluate_after_steps: int = 1
    max_replans: int = 3
    org_model: str | None = None

    def __post_init__(self) -> None:
        """Validate configuration."""
        if self.evaluate_after_steps < 1:
            raise ValueError("evaluate_after_steps must be >= 1")
        if self.max_replans < 0:
            raise ValueError("max_replans must be >= 0")
