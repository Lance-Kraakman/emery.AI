"""
Output tool factories for DSPy.

These tools capture structured output from agent execution.
Note: Agent output capture (submit_result) has been replaced by OutputExtractorModule
in dspy_modules/modules/extractor.py - extraction is now a post-processing step.
"""

from __future__ import annotations

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
