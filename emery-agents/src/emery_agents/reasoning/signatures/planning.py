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


class SkillInputSpec(BaseModel):
    """Input variable for skill templates."""

    name: str = Field(description="Variable name - use as {{ name }} in templates")
    type: str = Field(default="text", description="Data type")
    required: bool = Field(default=True)


class SkillOutputSpec(BaseModel):
    """Output variable for skill templates."""

    name: str = Field(description="Output variable name")
    type: str = Field(default="text", description="Data type")


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
    prompt_template: Optional[str] = Field(
        default=None,
        description="Jinja2 prompt template with {{ variable }} placeholders for skill inputs.",
    )


class SkillTemplateStepOutput(BaseModel):
    """Step output for skill templates. Same as PlanStepOutput but prompt_template is REQUIRED."""

    step_id: str = Field(description="Unique identifier for this step")
    description: str = Field(
        description="Human-readable description of what this step does. "
                    "Can use {{ variable }} for inputs. NO {% if %} control structures allowed."
    )
    tool_call: Optional[str] = Field(
        default=None, description="Tool to call for this step (e.g., 'table_crud')"
    )
    parameters: Optional[dict[str, Any]] = Field(
        default=None, description="Parameters for the tool call (values can include {{ }} for inputs)"
    )
    target_agent: Optional[str] = Field(
        default=None, description="Specialized agent to delegate to (e.g., 'schema_builder')"
    )
    required_context: list[str] = Field(
        default_factory=list, description="Context keys required from previous steps"
    )
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
    # REQUIRED for templates (vs optional in PlanStepOutput)
    prompt_template: str = Field(
        description="REQUIRED: Contains ALL execution instructions from the user's request. "
                    "Include every rule, condition, example, and requirement - NOTHING should be lost. "
                    "Use {{ variable }} for inputs. {% if %} conditionals allowed here."
    )


class PlanOutput(BaseModel):
    """DSPy output schema for a complete execution plan."""

    plan_id: str = Field(description="Unique identifier for this plan")
    goal: str = Field(description="The high-level goal this plan achieves")
    context: str = Field(description="Summary of workspace context used for planning")
    analysis: str = Field(description="Analysis of the request and approach")
    steps: list[PlanStepOutput] = Field(description="Ordered list of steps to execute")


class SkillTemplatePlanOutput(BaseModel):
    """DSPy output schema for a skill template plan with {{ variable }} placeholders."""

    plan_id: str = Field(description="Unique identifier for this plan")
    goal: str = Field(description="The high-level goal this skill template achieves")
    context: str = Field(description="Summary of workspace context used for planning")
    analysis: str = Field(description="Analysis of the request and approach")
    steps: list[SkillTemplateStepOutput] = Field(
        description="Ordered list of steps with required prompt_template fields"
    )


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
    Use conversation_history for context from previous messages in this session.
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
    conversation_history: str = dspy.InputField(
        desc="Previous messages in this session for context continuity"
    )

    result: PlanOrQuestionsOutput = dspy.OutputField()


class CreateSkillTemplate(dspy.Signature):  # type: ignore[misc]
    """Create a reusable skill template with {{ variable }} placeholders.

    TWO FIELDS - DIFFERENT SYNTAX RULES:

    1. description: Human-readable step description
       - Can use {{ variable }} for inputs
       - NO {% if %} control structures allowed

    2. prompt_template: Full execution instructions
       - Must contain ALL rules, conditions, examples from the request
       - NOTHING from the request should be lost
       - {% if %} conditionals allowed here

    VARIABLE SYNTAX:
    - ALWAYS wrap skill input variables in {{ }}: {{ input_var }}
    - NEVER use bare variable names without {{ }}
    """

    request: str = dspy.InputField(desc="What the skill should accomplish")
    workspace_context: str = dspy.InputField(
        desc="JSON of existing databases, tables, apps - check FIRST before asking"
    )
    available_tools: list[str] = dspy.InputField(desc="Discovery tools available")
    capability_guidance: str = dspy.InputField(
        desc="Capability planning guidance - when to use each capability"
    )
    proven_strategies: str = dspy.InputField(desc="ACE patterns for similar goals")
    conversation_history: str = dspy.InputField(
        desc="Previous messages in this session for context continuity"
    )
    skill_inputs: list[SkillInputSpec] = dspy.InputField(
        desc="Input variables - use as {{ name }} in templates"
    )
    skill_outputs: list[SkillOutputSpec] = dspy.InputField(
        desc="Expected outputs to be extracted post-execution"
    )

    result: SkillTemplatePlanOutput = dspy.OutputField()


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


class GapItemOutput(BaseModel):
    """A single gap identified in request analysis."""

    concern_id: str = Field(description="ID of the concern that has a gap")
    context_found: str = Field(default="", description="What context was found (if any)")
    reason_unclear: str = Field(description="Why this concern is unclear from the request")
    suggested_question: str = Field(description="Question to ask to clarify this gap")
    suggested_options: Optional[list[str]] = Field(
        default=None, description="Suggested options if applicable"
    )


class GapAnalysisResultModel(BaseModel):
    """Result of analyzing gaps between request and domain concerns."""

    clear_concerns: list[str] = Field(
        default_factory=list, description="Concern IDs that are clearly addressed"
    )
    gaps: list[GapItemOutput] = Field(
        default_factory=list, description="Gaps needing clarification questions"
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


class StepModificationOutput(BaseModel):
    """DSPy output schema for a step modification."""

    step_id: str = Field(description="ID of the step to modify")
    new_description: str = Field(description="Updated description for the step")


class PlanDiffResult(BaseModel):
    """Result of generating a plan diff for incremental updates."""

    steps_to_skip: list[str] = Field(
        default_factory=list, description="Step IDs to mark as skipped"
    )
    steps_to_modify: list[StepModificationOutput] = Field(
        default_factory=list, description="Steps to modify"
    )
    steps_to_append: list[PlanStepOutput] = Field(
        default_factory=list, description="New steps to add at the end"
    )
    reasoning: str = Field(description="Why these changes are needed")
    needs_clarification: bool = Field(default=False, description="Whether user input is needed")
    clarifying_questions: list[ClarifyingQuestionOutput] = Field(
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
