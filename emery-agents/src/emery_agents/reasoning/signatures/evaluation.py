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

    Each step_result is prefixed with its status:
    - [COMPLETED] means the step finished successfully — trust this status.
    - [FAILED] means the step encountered an error.
    - [PENDING] means the step has not run yet.

    The tool_evidence field contains RAW outputs from actual tool/API calls.
    This is ground truth — use it to verify what actually happened.
    If tool_evidence shows all calls returned valid data (SUCCESS),
    the steps succeeded regardless of how the summary text reads.

    If all required steps are [COMPLETED] and tool_evidence confirms SUCCESS,
    the goal is achieved. Only mark blockers for [FAILED] steps or tool
    calls that returned FAILED status.
    """

    original_goal: str = dspy.InputField(desc="The original user goal or request")
    plan_steps: list[str] = dspy.InputField(desc="Steps that were planned")
    step_results: list[str] = dspy.InputField(
        desc="Results from each step, prefixed with [COMPLETED], [FAILED], or [PENDING]"
    )
    tool_evidence: str = dspy.InputField(
        desc="Raw tool call outcomes per step showing actual API responses (SUCCESS/FAILED). This is ground truth."
    )

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


class InterruptClassificationResult(BaseModel):
    """Result of classifying a user interrupt during plan execution."""

    classification: str = Field(
        description="Classification: 'CONTEXT_ADD', 'SCOPE_CHANGE', or 'CANCEL'"
    )
    requires_replan: bool = Field(
        description="Whether this interrupt requires replanning"
    )
    is_cancel: bool = Field(
        description="Whether this is a cancellation request"
    )
    reasoning: str = Field(
        description="Brief explanation of the classification"
    )
    suggested_action: str = Field(
        default="", description="Suggested next action (especially for SCOPE_CHANGE)"
    )


class ClassifyInterrupt(dspy.Signature):  # type: ignore[misc]
    """Classify a user interrupt during plan execution.

    Categories:
    - CONTEXT_ADD: User provides additional info/clarification - continue with new context
    - SCOPE_CHANGE: User wants to change direction - requires replanning
    - CANCEL: User wants to stop execution entirely

    Default to CONTEXT_ADD if unclear - it's the safest option.
    """

    interrupt_message: str = dspy.InputField(desc="The user's interrupt message")
    current_plan_summary: str = dspy.InputField(desc="Summary of current plan goal")
    completed_steps: str = dspy.InputField(desc="Summary of completed steps")
    remaining_steps: str = dspy.InputField(desc="Summary of remaining steps")

    classification: InterruptClassificationResult = dspy.OutputField()


# ACE (Agentic Context Engineering) Signatures

class PlanningInsightModel(BaseModel):
    """A single planning insight extracted from phase output."""

    insight_type: str = Field(
        description="Type: 'entity', 'decision', 'constraint', or 'dependency'"
    )
    summary: str = Field(description="Brief description of the insight")
    key_facts: list[str] = Field(description="Key facts related to this insight")


class PlanningInsightsResult(BaseModel):
    """Result of extracting planning insights."""

    insights: list[PlanningInsightModel] = Field(description="List of planning insights")


class ExtractPlanningInsights(dspy.Signature):  # type: ignore[misc]
    """Extract planning insights from phase output.

    Types:
    - entity: Found entity (table, app, field, skill)
    - decision: Planning decision that affects other phases
    - constraint: Limitation discovered
    - dependency: Dependency between phases
    """

    phase_name: str = dspy.InputField(desc="Name of the phase that completed")
    context: str = dspy.InputField(desc="Raw context output from the phase")
    analysis: str = dspy.InputField(desc="Raw analysis output from the phase")

    result: PlanningInsightsResult = dspy.OutputField()


class ExecutionInsightModel(BaseModel):
    """A single execution insight extracted from step results."""

    insight_type: str = Field(
        description="Type: 'DISCOVERY', 'DECISION', 'ARTIFACT', 'CONSTRAINT', or 'ERROR_RECOVERY'"
    )
    summary: str = Field(description="1-2 sentence actionable summary")
    key_facts: list[str] = Field(description="Bullet points of essential facts")
    source_step_ids: list[str] = Field(description="Step IDs that contributed to this insight")


class ExecutionInsightsResult(BaseModel):
    """Result of extracting execution insights."""

    insights: list[ExecutionInsightModel] = Field(description="List of execution insights")


class ExtractExecutionInsights(dspy.Signature):  # type: ignore[misc]
    """Extract insights from step execution results.

    Focus on ACTIONABLE insights that help future steps:
    - DISCOVERY: Found something new (entity, pattern, relationship)
    - DECISION: Made a choice affecting future steps
    - ARTIFACT: Created something (record, field, table)
    - CONSTRAINT: Learned a limitation or requirement
    - ERROR_RECOVERY: How an error was resolved
    """

    step_results_json: str = dspy.InputField(desc="JSON of step results to analyze")

    result: ExecutionInsightsResult = dspy.OutputField()


class StrategyRankingModel(BaseModel):
    """A single strategy ranking."""

    pattern_id: str = Field(description="Strategy pattern ID")
    relevance: float = Field(ge=0.0, le=1.0, description="Relevance score 0.0-1.0")
    reason: str = Field(default="", description="Brief reason for ranking")


class StrategyRankingsResult(BaseModel):
    """Result of ranking strategies."""

    rankings: list[StrategyRankingModel] = Field(
        description="Strategies ranked by relevance (most relevant first)"
    )


class RankStrategies(dspy.Signature):  # type: ignore[misc]
    """Rank strategies by relevance to a goal.

    Only include strategies that are actually relevant - omit irrelevant ones.
    """

    goal: str = dspy.InputField(desc="The goal to match strategies against")
    strategies_json: str = dspy.InputField(desc="JSON list of strategy summaries")

    result: StrategyRankingsResult = dspy.OutputField()


class SynthesizeAnswer(dspy.Signature):  # type: ignore[misc]
    """Synthesize step results into a coherent final answer.

    Create a well-organized summary that directly addresses the goal.
    Do NOT just list the steps - synthesize into a unified response.
    """

    goal: str = dspy.InputField(desc="The original goal or request")
    step_results: str = dspy.InputField(desc="Formatted results from each step")
    curated_context: str = dspy.InputField(desc="Additional insights from execution")

    answer: str = dspy.OutputField(desc="Synthesized, coherent final answer")
