"""
DSPy Signatures for evaluation and recovery operations.

These signatures handle goal evaluation after execution and error recovery.
"""

from __future__ import annotations

from typing import Any, Optional

import dspy
from pydantic import BaseModel, Field


class GoalEvaluation(BaseModel):
    """Result of evaluating whether a goal was achieved."""

    achieved: bool = Field(description="Whether the goal was fully achieved")
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0"
    )
    completed_items: list[str] = Field(description="Items that were successfully completed")
    remaining_items: list[str] = Field(description="Items that still need to be done")
    blockers: list[str] = Field(
        default_factory=list, description="Issues blocking completion"
    )
    next_steps: list[str] = Field(
        default_factory=list, description="Recommended next steps"
    )


class EvaluateGoal(dspy.Signature):  # type: ignore[misc]
    """Evaluate if the goal was achieved based on execution results.

    Compare the original goal with what was actually accomplished.
    Be honest about partial completions and blockers.
    """

    original_goal: str = dspy.InputField(desc="The original user goal or request")
    plan_steps: list[str] = dspy.InputField(desc="Steps that were planned")
    step_results: list[str] = dspy.InputField(desc="Results from each step execution")

    evaluation: GoalEvaluation = dspy.OutputField()


class RecoveryAction(BaseModel):
    """Proposed action to recover from a failure.

    Aligned with models/plan.py RecoveryResult for consistency.
    """

    action_type: str = Field(
        description="Type of recovery: 'retry', 'skip', 'replan', or 'escalate'"
    )
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in the recovery (0.0 to 1.0)"
    )
    corrected_parameters: dict[str, Any] = Field(
        default_factory=dict,
        description="Parameters to add/change for retry attempts",
    )
    reasoning: str = Field(description="Why this recovery action was chosen")
    questions: list[str] = Field(
        default_factory=list,
        description="Questions to ask user if low confidence",
    )


class AnalyzeRecovery(dspy.Signature):  # type: ignore[misc]
    """Analyze failure and propose recovery action.

    Determine the best way to recover from a step failure.
    Consider whether the error is transient, permanent, or requires replanning.
    Return high confidence (>0.8) for auto-fix, medium (0.5-0.8) for user confirmation.
    """

    failed_step: str = dspy.InputField(desc="Description of the step that failed")
    error_message: str = dspy.InputField(desc="Error message from the failure")
    context: str = dspy.InputField(desc="Context about the execution state")

    recovery: RecoveryAction = dspy.OutputField()


class StepEvaluation(BaseModel):
    """Evaluation of a single step's execution."""

    step_id: str = Field(description="ID of the evaluated step")
    success: bool = Field(description="Whether the step succeeded")
    output_quality: float = Field(
        ge=0.0, le=1.0, description="Quality of the output (0.0 to 1.0)"
    )
    issues: list[str] = Field(default_factory=list, description="Any issues found")
    suggestions: list[str] = Field(
        default_factory=list, description="Suggestions for improvement"
    )


class EvaluateStep(dspy.Signature):  # type: ignore[misc]
    """Evaluate the quality and correctness of a step's execution.

    Check if the step output matches expectations and quality standards.
    """

    step_description: str = dspy.InputField(desc="What the step was supposed to do")
    step_output: str = dspy.InputField(desc="What the step actually produced")
    expected_outcome: str = dspy.InputField(desc="What outcome was expected")

    evaluation: StepEvaluation = dspy.OutputField()
