"""
DSPy Signatures for planning operations.

These signatures replace the Jinja2 planning templates with typed I/O contracts.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

import dspy
from pydantic import BaseModel, Field


class TaskDomain(str, Enum):
    """Domain classification for tasks."""
    EMERY = "emery"
    WEB = "web"
    AUTOMATION = "automation"
    RESEARCH = "research"


class TaskComplexity(str, Enum):
    """Complexity level for tasks."""
    SIMPLE = "simple"
    MEDIUM = "medium"
    COMPLEX = "complex"


class TaskExecutionMode(str, Enum):
    """Execution mode for task routing."""
    DIRECT = "DIRECT"
    PLAN_AND_APPROVE = "PLAN_AND_APPROVE"


class QuestionType(str, Enum):
    """Types of clarifying questions."""
    CHOICE = "choice"
    TEXT = "text"
    CONFIRMATION = "confirmation"


class PlanStepOutput(BaseModel):
    """DSPy output schema for a single plan step."""

    step_id: str = Field(description="Unique identifier for this step")
    description: str = Field(description="Human-readable description of what this step does")
    tool_call: Optional[str] = Field(
        default=None, description="Tool to call for this step (e.g., 'table_crud')"
    )
    parameters: Optional[dict[str, Any]] = Field(
        default=None, description="Parameters for the tool call (values can be strings, lists, or dicts)"
    )
    target_agent: Optional[str] = Field(
        default=None, description="Specialized agent to delegate to (e.g., 'schema_builder')"
    )
    required_context: list[str] = Field(
        default_factory=list, description="Context keys required from previous steps"
    )
    # Phase fields for execution control
    phase_name: str = Field(
        default="Execution",
        description="Phase: Discovery|Analysis|Execution|Summary",
    )
    phase_order: int = Field(
        default=1,
        description="Order within the phase (1, 2, 3...)",
    )
    replan_after: bool = Field(
        default=False,
        description="Re-evaluate plan after this step completes",
    )


class PlanOutput(BaseModel):
    """DSPy output schema for a complete execution plan."""

    plan_id: str = Field(description="Unique identifier for this plan")
    goal: str = Field(description="The high-level goal this plan achieves")
    context: str = Field(description="Summary of workspace context used for planning")
    analysis: str = Field(description="Analysis of the request and approach")
    steps: list[PlanStepOutput] = Field(description="Ordered list of steps to execute")


class ClarifyingQuestionOutput(BaseModel):
    """DSPy output schema for a clarifying question."""

    question: str = Field(description="The question to ask")
    question_type: QuestionType = Field(
        description="Type of question: 'choice', 'text', or 'confirmation'"
    )
    options: Optional[list[str]] = Field(
        default=None, description="Available options for choice questions"
    )
    reason: str = Field(description="Why this clarification is needed")


class PlanOrQuestionsOutput(BaseModel):
    """DSPy output schema: either a plan or clarifying questions."""

    plan: Optional[PlanOutput] = Field(default=None, description="The execution plan if ready")
    questions: Optional[list[ClarifyingQuestionOutput]] = Field(
        default=None, description="Questions if clarification is needed"
    )


class CreatePlan(dspy.Signature):  # type: ignore[misc]
    """Create an execution plan or ask clarifying questions if truly ambiguous.

    Check workspace_context for existing resources before asking questions.
    Use capability_guidance to understand which capability to delegate to.
    """

    request: str = dspy.InputField(desc="User's goal or task")
    workspace_context: str = dspy.InputField(
        desc="JSON of existing databases, tables, apps - check FIRST before asking"
    )
    available_tools: list[str] = dspy.InputField(desc="Discovery tools available")
    capability_guidance: str = dspy.InputField(
        desc="Capability planning guidance - when to use each capability"
    )
    proven_strategies: str = dspy.InputField(desc="ACE patterns for similar goals")

    result: PlanOrQuestionsOutput = dspy.OutputField()


class AnalyzeTask(dspy.Signature):  # type: ignore[misc]
    """Analyze user request to understand intent and extract entities.

    This is the first step before planning - understanding what the user wants.
    """

    request: str = dspy.InputField(desc="The user's request or goal")
    context: str = dspy.InputField(desc="Workspace context")

    intent: str = dspy.OutputField(desc="What the user wants to achieve")
    domain: TaskDomain = dspy.OutputField(desc="Domain: emery|web|automation|research")
    entities: list[str] = dspy.OutputField(desc="Key entities mentioned in the request")
    complexity: TaskComplexity = dspy.OutputField(desc="Complexity level: simple|medium|complex")


class TaskClassificationResult(BaseModel):
    """Result of classifying a task for execution routing."""

    mode: TaskExecutionMode = Field(description="Execution mode: 'DIRECT' (simple) or 'PLAN_AND_APPROVE' (complex)")
    needs_clarification: bool = Field(description="Whether clarification questions are needed")
    clarification_questions: list[str] = Field(
        default_factory=list, description="Questions to ask if clarification needed"
    )
    reasoning: str = Field(description="Explanation of the classification decision")


class ClassifyTask(dspy.Signature):  # type: ignore[misc]
    """Classify a task to determine execution mode and clarification needs.

    DIRECT mode: Simple, clear command with all details provided.
    PLAN_AND_APPROVE mode: Complex task, multiple steps, or needs clarification.

    Be conservative - only use DIRECT for truly simple, unambiguous tasks.
    """

    task: str = dspy.InputField(desc="The user's task or request")
    context: str = dspy.InputField(desc="Available context about the system state")

    classification: TaskClassificationResult = dspy.OutputField()


class GapAnalysisResultModel(BaseModel):
    """Result of analyzing gaps between request and domain concerns."""

    clear_concerns: list[str] = Field(
        default_factory=list, description="Concern IDs that are clearly addressed"
    )
    gaps: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Gaps needing questions: [{concern_id, reason_unclear, suggested_question, suggested_options?}]"
    )
    context_summary: str = Field(description="Summary of what was understood from the request")


class AnalyzeGaps(dspy.Signature):  # type: ignore[misc]
    """Analyze user request against domain concerns to find gaps.

    Check each concern against the request and context. Only generate questions
    for genuine gaps - not for things already specified.
    """

    agent_name: str = dspy.InputField(desc="Name of agent to check concerns for")
    user_request: str = dspy.InputField(desc="The user's original request")
    gathered_context: str = dspy.InputField(desc="Additional context gathered")
    concerns_json: str = dspy.InputField(desc="JSON list of domain concerns to check")

    analysis: GapAnalysisResultModel = dspy.OutputField()


class PlanDiffResult(BaseModel):
    """Result of generating a plan diff for incremental updates."""

    steps_to_skip: list[str] = Field(
        default_factory=list, description="Step IDs to mark as skipped"
    )
    steps_to_modify: list[dict[str, str]] = Field(
        default_factory=list, description="Steps to modify: [{step_id, new_description}]"
    )
    steps_to_append: list[dict[str, Any]] = Field(
        default_factory=list,
        description="New steps to add: [{description, target_agent?, phase_name?, phase_order?}]"
    )
    reasoning: str = Field(description="Why these changes are needed")
    needs_clarification: bool = Field(default=False, description="Whether user input is needed")
    clarifying_questions: list[dict[str, Any]] = Field(
        default_factory=list, description="Questions if clarification needed"
    )


class GeneratePlanDiff(dspy.Signature):  # type: ignore[misc]
    """Generate minimal diff to address a replan reason.

    Preserve existing steps when possible. Only include changes that are necessary.
    """

    goal: str = dspy.InputField(desc="The plan's overall goal")
    reason: str = dspy.InputField(desc="Why replanning was triggered")
    failed_step_info: str = dspy.InputField(desc="Info about the failed step (if any)")
    completed_context: str = dspy.InputField(desc="Summary of completed step results")
    pending_steps_json: str = dspy.InputField(desc="JSON of pending steps")

    diff: PlanDiffResult = dspy.OutputField()
