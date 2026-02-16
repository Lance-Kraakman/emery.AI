"""Pydantic models for planning operations."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .enums import QuestionType, TaskComplexity, TaskExecutionMode


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

    step_id: str = Field(description="Unique identifier (e.g., 'step_1_create_table')")
    description: str = Field(
        description=(
            "A COMPLETE, self-contained instruction for the plan step executor. "
            "The executor sees ONLY this text and has tools — it does NOT see the plan goal, "
            "workspace context, or capability guidance. Include ALL information needed to execute.\n\n"
            "REQUIRED:\n"
            "1. SPECIFIC resource names (exact table/app/skill name in quotes, not 'the table')\n"
            "2. SPECIFIC values (field names, types, option values, not 'appropriate fields')\n"
            "3. SPECIFIC actions (Create/Add/Update/Delete, not 'set up' or 'configure')\n"
            "4. SUCCESS criteria (what should exist after this step completes)\n\n"
            "If a step requires looking something up first, write that INTO the description "
            "(e.g., \"Look up the 'contacts' table schema, then add a 'phone' (phone) field\").\n\n"
            "BAD: 'Set up the contacts table with relevant fields'\n"
            'GOOD: \'Create table "contacts" with fields: full_name (text), email (email), '
            "phone (phone), status (single-select: Active, Inactive, Lead). "
            "Verify: table exists with 4 fields.'"
        )
    )
    tool_call: str | None = Field(
        default=None,
        description="Tool to invoke for this step. Include the specific tool name.",
    )
    parameters: dict[str, Any] | None = Field(
        default=None,
        description="Parameters for the tool_call. Values can be strings, lists, or nested dicts. "
        "Use {{ variable }} placeholders for skill template inputs.",
    )
    required_context: list[str] = Field(
        default_factory=list,
        description="Step IDs whose outputs this step depends on "
        "(e.g., ['step_1_create_table'] if this step needs the table ID from step 1).",
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
    prompt_template: str | None = Field(
        default=None,
        description="Jinja2 prompt template with {{ variable }} placeholders for skill inputs.",
    )
    connection_required: str | None = Field(
        default=None,
        description="App slug requiring OAuth connection (e.g., 'gmail', 'slack', 'github'). "
        "Set when the step uses an external integration that needs user authorization.",
    )


class SkillTemplateStepOutput(BaseModel):
    """Step output for skill templates. Same as PlanStepOutput but prompt_template is REQUIRED."""

    step_id: str = Field(description="Unique identifier for this step")
    description: str = Field(
        description="Human-readable summary of the task AND key rules. "
        "MUST use {{ input_name }} for each defined skill input. "
        "Example: 'Generate report for {{ topic }} using {{ format }} style.' "
        "NO {% if %} - only {{ }} placeholders."
    )
    tool_call: str | None = Field(
        default=None, description="Tool to call for this step (e.g., 'table_crud')"
    )
    parameters: dict[str, Any] | None = Field(
        default=None,
        description="Parameters for the tool call (values can include {{ }} for inputs)",
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
    prompt_template: str = Field(
        description="REQUIRED: Must preserve EVERY rule from the user's request. "
        "If user says 'if X then Y' or 'use Z format' - include it verbatim. "
        "Do NOT summarize rules - copy them. "
        "Use {{ variable }} EVERYWHERE including inside {% if %} blocks: "
        "{% if family %}{{ name }} has {{ family }}{% endif %} (NOT: name has family)."
    )
    connection_required: str | None = Field(
        default=None,
        description="App slug requiring OAuth connection (e.g., 'gmail', 'slack', 'github'). "
        "Set when the step uses an external integration that needs user authorization.",
    )


class PlanOutput(BaseModel):
    """DSPy output schema for a complete execution plan."""

    plan_id: str = Field(description="Unique identifier (e.g., 'plan_crm_setup')")
    goal: str = Field(
        description="One-sentence goal starting with a verb "
        "(e.g., 'Create a CRM system with contacts table and dashboard app')"
    )
    context: str = Field(
        description="What existing resources were found and how they inform this plan "
        "(e.g., 'Found existing contacts table — will add fields rather than recreate')"
    )
    analysis: str = Field(
        description="Brief reasoning for the chosen approach: why these steps, "
        "which capabilities, and any trade-offs considered"
    )
    steps: list[PlanStepOutput] = Field(
        description=(
            "Ordered steps. Each step is a COMPLETE, self-contained executor instruction. "
            "The plan step executor sees ONLY the step description — not the plan goal or context. "
            "Include all resource names, field types, and values in each step. "
            "One step per distinct action — do NOT combine multiple actions into one step."
        )
    )
    auto_approve_policy: str = Field(
        default="confirm",
        description="Auto-approve policy from matched planning pattern. "
        "'auto': approve if conditions met, 'confirm': default require approval, "
        "'explicit': always require approval (OAuth, destructive). "
        "Use search_planning_patterns to find the appropriate policy for this task type.",
    )
    matched_conditions: list[str] = Field(
        default_factory=list,
        description="Conditions from matched planning pattern that should be checked at runtime. "
        "Common conditions: 'single_resource' (<=2 steps), 'explicit_values' (step descriptions "
        "contain parentheses with types), 'additive_only' (no destructive operations). "
        "Set based on the planning pattern's auto_approve_conditions.",
    )


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
    options: list[str] | None = Field(
        default=None, description="Available options for choice questions"
    )
    reason: str = Field(description="Why this clarification is needed")


class PlanOrQuestionsOutput(BaseModel):
    """DSPy output schema: either a plan or clarifying questions."""

    plan: PlanOutput | None = Field(
        default=None, description="The execution plan if ready"
    )
    questions: list[ClarifyingQuestionOutput] | None = Field(
        default=None, description="Questions if clarification is needed"
    )


class TaskClassificationResult(BaseModel):
    """Result of classifying a task for execution routing."""

    mode: TaskExecutionMode = Field(
        description="Execution mode: 'DIRECT' (single clear action) or 'PLAN_AND_APPROVE' (multi-step or complex)"
    )
    complexity: TaskComplexity = Field(
        default=TaskComplexity.SIMPLE,
        description="Task complexity: 'simple' (1 step), 'medium' (2-4 steps), 'complex' (5+ steps or cross-capability)",
    )
    estimated_steps: int = Field(
        default=1,
        description="Estimated number of execution steps (1-20)",
    )
    primary_capability: str | None = Field(
        default=None,
        description="Primary capability needed (e.g., 'schema_builder', 'app_builder', 'skill_builder'). None if unclear.",
    )
    needs_clarification: bool = Field(
        description="Whether the task is too vague to proceed without user input"
    )
    clarification_questions: list[str] = Field(
        default_factory=list,
        description="Questions to ask ONLY if needs_clarification is true",
    )
    reasoning: str = Field(
        description="Brief explanation: what factors led to this classification"
    )


class GapItemOutput(BaseModel):
    """A single gap identified in request analysis."""

    concern_id: str = Field(description="ID of the concern that has a gap")
    context_found: str = Field(
        default="", description="What context was found (if any)"
    )
    reason_unclear: str = Field(
        description="Why this concern is unclear from the request"
    )
    suggested_question: str = Field(description="Question to ask to clarify this gap")
    suggested_options: list[str] | None = Field(
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
    context_summary: str = Field(
        description="Summary of what was understood from the request"
    )


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
    needs_clarification: bool = Field(
        default=False, description="Whether user input is needed"
    )
    clarifying_questions: list[ClarifyingQuestionOutput] = Field(
        default_factory=list, description="Questions if clarification needed"
    )


class RecordContext(BaseModel):
    """Context for record-level operations."""
    table_id: str | None = Field(default=None, description="Table ID")
    record_ids: list[str] = Field(default_factory=list, description="Record IDs or names")


class TriageAnalysis(BaseModel):
    """Analysis extracted during triage for downstream planning."""

    intent: str = Field(default="", description="One-sentence summary of user's goal")
    entities: list[str] = Field(default_factory=list, description="Resource/field/service names")
    approach: str = Field(default="step-by-step", description="Reasoning approach")
    external_services: list[str] = Field(default_factory=list, description="Third-party services")


class PlanReflection(BaseModel):
    """Simple reflection on a draft plan - like Claude's extended thinking."""

    quality_score: float = Field(
        ge=0.0,
        le=1.0,
        description="Overall plan quality. 1.0=ready, <0.7=needs improvement",
    )
    critique: str = Field(
        description="What's good and what could be better about this plan"
    )
    missing_info: list[str] = Field(
        description="Information gaps that should be researched before finalizing"
    )
    suggested_improvements: str = Field(
        description="How to improve the plan (more research, better steps, etc.)"
    )
    should_iterate: bool = Field(
        description="True if plan needs improvement, False if ready for user"
    )
