"""
Output tool factories for DSPy.

These tools capture structured output from agent execution.
"""

from __future__ import annotations

from .agent_output import (
    CapturedOutput,
    ExtractionStats,
    OutputCollector,
    TargetFieldMetadata,
    build_target_field_metadata_from_mappings,
    create_output_tool,
)
from .ask_question import (
    ClarificationRequestedException,
    QuestionCollector,
    create_ask_question_tool,
)
from .plan_output import (
    CapturedPlan,
    NormalizedStepData,
    PlanCollector,
    create_plan_output_tool,
)
from .recovery_output import (
    RecoveryCollector,
    RecoveryResult,
    create_recovery_output_tool,
)
from .step_output import StepCollector, create_step_output_tool

__all__ = [
    # Ask Question
    "ClarificationRequestedException",
    "QuestionCollector",
    "create_ask_question_tool",
    # Step Output
    "StepCollector",
    "create_step_output_tool",
    # Agent Output (submit_result)
    "CapturedOutput",
    "ExtractionStats",
    "OutputCollector",
    "TargetFieldMetadata",
    "build_target_field_metadata_from_mappings",
    "create_output_tool",
    # Plan Output (submit_plan)
    "CapturedPlan",
    "NormalizedStepData",
    "PlanCollector",
    "create_plan_output_tool",
    # Recovery Output (submit_recovery)
    "RecoveryCollector",
    "RecoveryResult",
    "create_recovery_output_tool",
]
