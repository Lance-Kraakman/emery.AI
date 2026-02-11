"""
DSPy Signatures for evaluation and recovery operations.

These signatures handle goal evaluation after execution and error recovery.
"""

from __future__ import annotations

from typing import Any

import dspy
from pydantic import BaseModel, Field


class GoalEvaluation(BaseModel):
    """Result of evaluating whether a goal was achieved."""

    achieved: bool = Field(
        description="True ONLY if ALL required deliverables from the goal are confirmed "
        "by tool_evidence. Partial completion = false."
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description="How confident the evaluation is. "
        "1.0 = all tool calls confirmed SUCCESS. "
        "0.8-0.9 = completed but minor quality concerns. "
        "0.5-0.7 = partial completion (some steps succeeded, others pending/failed). "
        "Below 0.5 = significant failures or missing evidence.",
    )
    completed_items: list[str] = Field(
        description="Specific deliverables confirmed done by tool_evidence "
        "(e.g., 'Created contacts table with 5 fields', 'Published CRM app')"
    )
    remaining_items: list[str] = Field(
        description="Specific deliverables NOT yet completed. "
        "Reference the original goal to identify what's missing."
    )
    blockers: list[str] = Field(
        default_factory=list,
        description="Concrete issues preventing completion — only from [FAILED] steps "
        "or FAILED tool calls. Not speculative concerns.",
    )
    next_steps: list[str] = Field(
        default_factory=list,
        description="Actionable steps to resolve remaining_items or blockers. "
        "Empty if achieved=true and confidence >= 0.9.",
    )


class EvaluateGoal(dspy.Signature):  # type: ignore[misc]
    """Evaluate whether the user's goal was achieved based on execution evidence.

    EVALUATION PROCESS:

    1. PARSE THE GOAL: Break the original_goal into discrete deliverables.
       Example: "Build a CRM with contacts table and dashboard"
       → deliverables: [contacts table, dashboard app]

    2. CHECK STEP RESULTS: Each result is prefixed with a status:
       - [COMPLETED] = step finished successfully. Trust this status.
       - [FAILED] = step encountered an error. Check tool_evidence for details.
       - [PENDING] = step has not run yet. This means work remains.

    3. VERIFY WITH TOOL EVIDENCE (ground truth):
       tool_evidence contains RAW API responses — this overrides step summaries.
       If tool_evidence shows SUCCESS for a tool call, that action worked.
       If tool_evidence shows FAILED, that action did not work, even if the
       step summary says otherwise.

    4. SCORE CONFIDENCE:
       - 1.0: All deliverables confirmed by tool_evidence SUCCESS calls.
       - 0.8-0.9: All steps completed but minor concerns (e.g., default values used).
       - 0.5-0.7: Partial — some deliverables done, others pending or failed.
       - Below 0.5: Major failures or most deliverables unconfirmed.

    5. PARTIAL SUCCESS RULES:
       - achieved=false if ANY deliverable is missing, even if most steps succeeded.
       - remaining_items must list SPECIFIC missing deliverables, not vague concerns.
       - blockers must come from actual [FAILED] steps or FAILED tool calls — never speculative.
    """

    original_goal: str = dspy.InputField(
        desc="The user's original goal. Break this into discrete deliverables for evaluation."
    )
    plan_steps: list[str] = dspy.InputField(
        desc="All planned steps (descriptions). Compare against results to find gaps."
    )
    step_results: list[str] = dspy.InputField(
        desc="Execution results prefixed with [COMPLETED], [FAILED], or [PENDING]. "
        "Map each result back to its planned step to assess coverage."
    )
    tool_evidence: str = dspy.InputField(
        desc="RAW tool/API call outcomes per step (SUCCESS/FAILED with response data). "
        "This is GROUND TRUTH — use it to verify what actually happened, "
        "overriding any ambiguous step summaries."
    )

    evaluation: GoalEvaluation = dspy.OutputField()


class DirectExecutionJudgement(BaseModel):
    """LLM judge assessment of a DIRECT execution result."""

    score: float = Field(
        ge=0.0,
        le=1.0,
        description="Quality score. "
        "1.0 = task fully addressed, tools succeeded, result is actionable. "
        "0.7-0.9 = task mostly addressed, minor gaps. "
        "0.4-0.6 = partially addressed, significant gaps or errors. "
        "Below 0.4 = failed, wrong, or irrelevant result.",
    )
    reasoning: str = Field(description="Brief explanation of the score (1-2 sentences)")


class JudgeDirectExecution(dspy.Signature):  # type: ignore[misc]
    """Judge whether a DIRECT execution result adequately addresses the user's task.

    SCORING CRITERIA:

    1. TASK COMPLETION: Does the result address what the user asked for?
       - Action tasks ("add a field"): Was the action performed? Check tool_evidence.
       - Research tasks ("research X"): Is the information relevant and substantive?
       - Conversational tasks ("tell me about"): Is the response helpful?

    2. TOOL EVIDENCE: Did tool calls succeed?
       - All SUCCESS = strong signal of completion.
       - Mixed SUCCESS/FAILED = partial, score accordingly.
       - All FAILED or no tools when tools were needed = low score.

    3. RESULT QUALITY: Is the result actionable and well-formed?
       - Not empty, not an error message, not a generic non-answer.
       - Specific to the task (not boilerplate).

    Score generously for conversational/research tasks that provide useful information.
    Score strictly for action tasks where tool evidence must confirm the action was taken.
    """

    task: str = dspy.InputField(desc="The user's original task")
    result: str = dspy.InputField(desc="The execution result to judge")
    tool_evidence: str = dspy.InputField(
        desc="Tool call outcomes: tool_name -> SUCCESS/FAILED with response preview. "
        "Empty string if no tools were called."
    )

    judgement: DirectExecutionJudgement = dspy.OutputField()


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
    """Analyze a step failure and propose the best recovery action.

    RECOVERY DECISION TREE:

    1. TRANSIENT ERRORS (timeout, rate limit, network) → retry with same parameters.
       Confidence: 0.9 (auto-fix).

    2. PARAMETER ERRORS (wrong field name, missing required param, invalid value)
       → retry with corrected_parameters.
       Confidence: 0.7-0.9 depending on certainty of the fix.

    3. LOGIC ERRORS (wrong capability, missing prerequisite step) → replan.
       Confidence: 0.5-0.7 (propose to user for confirmation).

    4. PERMANENT ERRORS (resource doesn't exist, permission denied, unsupported operation)
       → escalate to user with specific questions.
       Confidence: below 0.5.

    CONFIDENCE THRESHOLDS (used by the executor):
    - >= 0.8: Auto-fix, execute recovery without user approval.
    - 0.5-0.8: Propose recovery to user for confirmation.
    - < 0.5: Ask user what to do (include questions).
    """

    failed_step: str = dspy.InputField(
        desc="Description of the step that failed — what it was trying to do."
    )
    error_message: str = dspy.InputField(
        desc="The error message or exception. Parse for error codes, missing fields, "
        "or resource names to inform the recovery strategy."
    )
    context: str = dspy.InputField(
        desc="Execution state: completed steps, their results, and the remaining plan. "
        "Use to determine if a prerequisite was missed or if replanning is needed."
    )

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
    is_cancel: bool = Field(description="Whether this is a cancellation request")
    reasoning: str = Field(description="Brief explanation of the classification")
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

    insights: list[PlanningInsightModel] = Field(
        description="List of planning insights"
    )


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
    source_step_ids: list[str] = Field(
        description="Step IDs that contributed to this insight"
    )


class ExecutionInsightsResult(BaseModel):
    """Result of extracting execution insights."""

    insights: list[ExecutionInsightModel] = Field(
        description="List of execution insights"
    )


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
    """Synthesize step results into a final answer that directly addresses the user's goal.

    SYNTHESIS GUIDELINES:

    1. LEAD WITH THE OUTCOME: Start with what was accomplished, not the process.
       GOOD: "I've created your CRM system with a contacts table and dashboard app."
       BAD: "Step 1 created a table. Step 2 built an app. Step 3 configured fields."

    2. STRUCTURE BY DELIVERABLE, NOT BY STEP: Group results by what the user asked for.
       If they asked for "a table and an app", organize as: table details, then app details.

    3. INCLUDE ACTIONABLE DETAILS: Resource names, URLs, field names, record counts —
       anything the user needs to start using what was built.

    4. MENTION DECISIONS MADE: If defaults were chosen (field types, layouts, names),
       briefly mention them so the user can adjust if needed.

    5. SKIP INTERNAL MECHANICS: Don't mention step IDs, tool names, API calls,
       or execution phases. The user cares about results, not process.

    6. IF PARTIAL: Clearly state what was completed and what remains, with specific
       next steps the user can take.
    """

    goal: str = dspy.InputField(
        desc="The user's original goal — the answer must directly address this."
    )
    step_results: str = dspy.InputField(
        desc="Formatted results from each completed step. "
        "Extract resource names, IDs, URLs, and key details from these."
    )
    curated_context: str = dspy.InputField(
        desc="Additional execution insights (ACE context): decisions made, "
        "entities discovered, constraints encountered. Use to enrich the answer."
    )

    answer: str = dspy.OutputField(
        desc="User-facing summary of what was accomplished. Lead with the outcome, "
        "organize by deliverable, include actionable details. No step IDs or tool names."
    )


# === Reflexion Signatures ===


class StepReflection(BaseModel):
    """Reflection on a completed step's execution quality."""

    quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall quality: 1.0=optimal, 0.7-0.9=good with minor issues, "
        "0.5-0.7=suboptimal but functional, below 0.5=poor",
    )
    was_suboptimal: bool = Field(
        description="True if the step succeeded but could have been done better"
    )
    what_went_well: str = Field(description="Key positive aspects of the execution")
    what_could_improve: str = Field(
        description="Specific improvements for similar steps in the future"
    )
    refined_instructions: str = Field(
        description="Improved instructions that would produce better results. "
        "Empty string if execution was optimal.",
    )
    pattern_learned: str = Field(
        description="Reusable insight for subsequent steps. "
        "Example: 'Always check if table exists before creating fields'. "
        "Empty string if no pattern learned.",
    )


class ReflectOnExecution(dspy.Signature):  # type: ignore[misc]
    """Reflect on a completed step to extract insights for future steps.

    REFLECTION PROCESS:
    1. Compare step_result against step_description — did it accomplish the goal?
    2. Check tool_evidence for efficiency — were unnecessary tools called?
       Were there retries that could be avoided?
    3. Consider plan_goal — does this step's output set up the next steps well?
    4. Look at previous_reflections — are we repeating the same mistakes?

    FOCUS ON ACTIONABLE INSIGHTS:
    - "The table_crud tool returns the table ID in the response — pass this
      directly to the next step instead of looking it up again"
    - "Search returned too many results — use more specific keywords"
    - NOT vague observations like "the step could be faster"
    """

    step_description: str = dspy.InputField(desc="What the step was supposed to do")
    step_result: str = dspy.InputField(
        desc="What the step actually produced (truncated to 500 chars)"
    )
    tool_evidence: str = dspy.InputField(
        desc="Raw tool call outcomes — SUCCESS/FAILED with response previews"
    )
    plan_goal: str = dspy.InputField(
        desc="The overall plan goal — for assessing how this step contributes"
    )
    previous_reflections: str = dspy.InputField(
        desc="Rolling summary of reflections from previous steps (max 1500 chars). "
        "Check for recurring patterns.",
    )

    reflection: StepReflection = dspy.OutputField()
