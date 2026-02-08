"""
DSPy Signatures for planning operations.

These signatures replace the Jinja2 planning templates with typed I/O contracts.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

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
        description="Tool to invoke for this step (e.g., 'skill_crud' for skill execution). "
        "Include the specific tool name when the step calls an external integration.",
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
    # REQUIRED for templates (vs optional in PlanStepOutput)
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
    # Auto-approve policy from planning patterns (use search_planning_patterns to determine)
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


class CreatePlan(dspy.Signature):  # type: ignore[misc]
    """Create an execution plan or ask clarifying questions.

    STEP QUALITY RULES:
    - Each step description must be a COMPLETE executor instruction (see PlanStepOutput.description).
    - The plan step executor cannot see the plan goal, workspace context, or capability guidance.
      It only has the step description + tools. Write accordingly.
    - Include concrete names, values, and types — never use vague references like "the table" or "appropriate fields".
    - Use capability_guidance step format examples and templates as models for step descriptions.
    - If a step requires looking something up first, write that INTO the description
      (e.g., "Look up the 'contacts' table schema, then add a 'phone' (phone) field").
    - One step per distinct action. Never combine multiple actions into one step.

    PLANNING PROCESS:
    - Check workspace_context for existing resources before creating new ones.
    - Use capability_guidance to understand what the system can do and which tools each capability uses.
    - Use task_analysis for pre-analyzed intent, approach, and external service hints.

    EXTERNAL INTEGRATIONS: If task_analysis lists external services (Gmail, Slack, etc.),
    call search_capabilities first to verify which integrations are available, then
    call search_external(service="<name>") to get specific tool names and input schemas.
    Include the specific tool name (e.g., gmail_send_email) in step descriptions.
    Set connection_required to the service slug for OAuth services.
    If multiple services match (e.g., Gmail and Outlook for "send email"), ask the user.

    DEFAULTS vs QUESTIONS: Prefer a concrete plan with sensible defaults over vague questions.
    The user can modify the plan before approving. Ask only when genuinely unsure:
    destructive operations, ambiguous business rules, multiple valid approaches.

    RESEARCH TOOLS (call as needed, in any order — re-call to refine):
    - search_capabilities: Discovers platform agents, external integrations, user skills. Good starting point.
    - search_external: Gets specific tool names/inputs for a known service (e.g., after finding it via search_capabilities).
    - system_research: Gets field schemas, page content, resource details for existing workspace resources.
    - web_search: Researches industry practices, business requirements, domain knowledge.

    WHEN TO USE TOOLS vs ADD STEPS:
    Detect user intent to decide whether to USE research tools NOW or ADD research steps to the plan.

    USE tools NOW (do research during planning):
    - Signals: "first", "before", "check first", "analyze before", "what does X look like", "then show me"
    - User feedback rejecting a plan that had analysis steps
    - Action: Call system_research, search_capabilities, etc. during this ReAct loop
    - Then: Generate a plan with only mutation/action steps (research already done)
    - Include findings in the plan's analysis field

    ADD steps to plan (self-contained plan for later):
    - Signals: "create a plan to...", "add steps for...", initial request without feedback
    - User explicitly wants a comprehensive plan they can review/re-run
    - Action: Add research steps to the plan for execution after approval
    - Result: Plan contains both research and mutation steps

    Examples:
    - "Update tables to match questionnaire" → ADD analysis steps to plan
    - Feedback: "analyze first, then show me changes" → USE tools NOW, then plan mutations only
    - "Create a plan to research and update everything" → ADD both types of steps
    """

    request: str = dspy.InputField(
        desc="The user's goal in natural language. May reference existing resources by name."
    )
    workspace_context: str = dspy.InputField(
        desc="Summary of existing workspace resources (databases, tables with field counts, "
        "apps, agents, skills). Check this BEFORE creating resources that may already exist. "
        "For detailed field schemas, use system_research(resource_type='tables', query='<name>', include_details=True). "
        "Do NOT guess field names or types — look them up if needed."
    )
    capability_guidance: str = dspy.InputField(
        desc="Routing table and instructions for system capabilities. "
        "Shows what the system can do, when to use each capability, "
        "which tools each capability uses, and step description templates. "
        "Use the step description templates to write executor-ready step descriptions."
    )
    planning_context: str = dspy.InputField(
        desc="Combined context for planning: task analysis (intent, domain, entities, approach), "
        "proven strategies from past executions, background memories, and delegation hints. "
        "Each section is labeled. Empty sections are omitted."
    )
    conversation_history: str = dspy.InputField(
        desc="Previous messages in this chat session for follow-up context."
    )
    configured_tools: str = dspy.InputField(
        desc="JSON list of tools explicitly configured for this skill. "
        "When tools are listed here, you MUST use them in the plan steps. "
        "Include the exact tool name in the step's tool_call field. "
        "You may also discover additional tools via search_external if needed. "
        "Empty string if no tools are configured."
    )

    result: PlanOrQuestionsOutput = dspy.OutputField()


class CreateSkillTemplate(dspy.Signature):  # type: ignore[misc]
    """Create a reusable skill template with {{ variable }} placeholders.

    CRITICAL - PRESERVE EVERY RULE:
    Count the rules in the user's request. The prompt_template MUST contain ALL of them.
    Do NOT summarize rules. Do NOT paraphrase. Copy the conditional logic verbatim.

    EXAMPLE - Request has 3 rules:
    "Write a summary. (1) If female use she/her. (2) If male use he/him. (3) Include family if provided."

    WRONG (only 1 rule preserved):
        "Write a summary of {{ name }}. Include family: {{ family }}."

    CORRECT (all 3 rules preserved):
        "Write a summary of {{ name }} who is {{ age }} years old.
         {% if gender == 'female' %}Use she/her/hers pronouns.{% elif gender == 'male' %}Use he/him/his pronouns.{% endif %}
         {% if family %}{{ name }} has {{ family }}.{% endif %}"

    VARIABLE SYNTAX - {{ }} EVERYWHERE:
    - In text: "{{ name }} is {{ age }}"
    - Inside {% if %} blocks: "{% if family %}{{ name }} has {{ family }}{% endif %}"
    - WRONG: {% if family %}name has family{% endif %}
    - CORRECT: {% if family %}{{ name }} has {{ family }}{% endif %}

    TWO FIELDS:
    1. description: Summarize task + mention key rules. {{ variable }} OK. NO {% if %}.
    2. prompt_template: ALL rules from request, using {% if %} for conditionals.

    EXTERNAL TOOLS:
    If the skill uses a third-party service (Gmail, Slack, etc.), the prompt_template
    MUST name the specific tool to call (e.g., "Use the gmail_send_email tool to...").
    Set connection_required on the step to the service slug (e.g., 'gmail').
    """

    request: str = dspy.InputField(desc="What the skill should accomplish")
    workspace_context: str = dspy.InputField(
        desc="JSON of existing databases, tables, apps - check FIRST before asking"
    )
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
    configured_tools: str = dspy.InputField(
        desc="JSON list of tools explicitly configured for this skill. "
        "When tools are listed here, you MUST use them in the plan steps. "
        "Include the exact tool name in the step's tool_call field. "
        "Empty string if no tools are configured."
    )

    result: SkillTemplatePlanOutput = dspy.OutputField()


class AnalyzeTask(dspy.Signature):  # type: ignore[misc]
    """Analyze a user request before planning. Extract intent, entities, approach, and external services.

    1. INTENT: What action does the user want? Start with a verb.
    2. DOMAIN: emery (workspace resources), web (external), automation (workflows), research (info gathering).
    3. ENTITIES: Concrete nouns — table names, field names, app names, service names.
       Resolve references using context (e.g., "the table" → actual table name).
    4. APPROACH: How should the planner think about this task?
       - analytical: data modeling, schema design, CRUD — break into components
       - systems-thinking: multiple interconnected resources — focus on relationships
       - step-by-step: procedural tasks with clear ordering — focus on sequencing
       - creative: open-ended tasks — automation design, workflow optimization
    5. EXTERNAL SERVICES: List any third-party services mentioned (gmail, slack, github, etc.).
       The planner will use this to call search_external during planning.
    6. NEEDS CLARIFICATION: true only if the request is too vague to plan at all.
       Missing details with sensible defaults do NOT need clarification.
    """

    request: str = dspy.InputField(
        desc="The user's request in natural language. May be brief or detailed."
    )
    context: str = dspy.InputField(
        desc="Workspace context JSON — existing resources that the request may reference. "
        "Use to resolve ambiguous references like 'the table' or 'my app'."
    )

    intent: str = dspy.OutputField(
        desc="One-sentence summary of the user's goal. Start with a verb "
        "(e.g., 'Create a contacts table with name, email, and phone fields')."
    )
    domain: TaskDomain = dspy.OutputField(
        desc="Primary domain: 'emery', 'web', 'automation', or 'research'."
    )
    entities: list[str] = dspy.OutputField(
        desc="Concrete nouns: resource names, field names, service names. "
        "Resolve references using context."
    )
    approach: str = dspy.OutputField(
        desc="Reasoning approach: 'analytical', 'systems-thinking', 'step-by-step', or 'creative'. "
        "Guides how the planner structures the plan."
    )
    external_services: list[str] = dspy.OutputField(
        desc="Third-party services mentioned (e.g., ['gmail', 'slack']). "
        "Empty list if none. The planner will call search_external for each."
    )
    needs_clarification: bool = dspy.OutputField(
        desc="True only if the request is too vague to plan. "
        "Missing details with sensible defaults = false."
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


class ClassifyTask(dspy.Signature):  # type: ignore[misc]
    """Classify a task to determine execution mode, complexity, and clarification needs.

    CLASSIFICATION RULES:

    DIRECT mode (execute immediately, no plan needed):
    - Single, well-defined action with clear parameters.
      Examples: "Add a 'phone' field to the contacts table", "Delete the old_data table".
    - RESEARCH and INFORMATION tasks — gathering info, web search, summarizing findings.
      These are single-action tasks even when they sound complex.
      Examples: "Research claude skills and tell me some skills I can copy",
      "What are best practices for CRM design?", "Find me examples of automation workflows",
      "Tell me about competitor X", "Summarize what our database contains".
    - Conversational queries: greetings, questions about capabilities, help requests.
    - All required information is present in the task or context (or discoverable via tools).
    - No ambiguous business logic or multi-step dependencies.

    PLAN_AND_APPROVE mode (create plan, get user approval, then execute):
    - Multiple CREATION or MODIFICATION steps involving different resources.
    - Complex business logic or data modeling decisions.
      Examples: "Build a CRM system", "Set up an inventory management workflow".
    - Cross-capability tasks (needs schema_builder AND app_builder).
    - NOTE: Research tasks are NOT PLAN_AND_APPROVE even if they sound complex.
      "Research X and tell me about Y" = DIRECT (uses web_search + synthesize).
      "What are best practices for X" = DIRECT (uses web_search).
      Only classify as PLAN_AND_APPROVE when the task requires BUILDING or MODIFYING
      multiple resources in the workspace.

    SCORING FACTORS:
    - Resource count: 1 resource = likely DIRECT, 2+ = likely PLAN_AND_APPROVE.
    - Verb complexity: "add"/"delete"/"research"/"find"/"tell me" = DIRECT;
      "build"/"set up"/"create system" = PLAN_AND_APPROVE.
    - Ambiguity: clear parameters = DIRECT, vague requirements = PLAN_AND_APPROVE.
    - Risk: read-only/additive/research = lower risk, destructive/schema changes = higher risk.

    CLARIFICATION:
    - Only flag needs_clarification when the task is too vague to even classify.
    - Missing details that have sensible defaults do NOT need clarification.
    - Prefer PLAN_AND_APPROVE with sensible defaults over asking questions.

    """

    task: str = dspy.InputField(desc="The user's task or request in natural language")
    context: str = dspy.InputField(
        desc=(
            "System state: existing resources (databases, tables, apps, agents), "
            "available capabilities, and conversation history. "
            "Use to assess whether the task references existing resources "
            "and how complex the execution would be."
        )
    )
    classification: TaskClassificationResult = dspy.OutputField()


class TriageTask(dspy.Signature):  # type: ignore[misc]
    """Analyze the user's task, extract intent/entities, and determine the best execution approach.

    You have access to discovery tools — use them to research before deciding.

    ALWAYS output intent, entities, approach, and external_services — these are used
    by the planner if the task is routed to "plan" mode. This avoids a separate analysis step.

    ROUTING RULES:

    "direct" — Read-only research, Q&A, information gathering:
    - Research/information tasks (web search, summarize, explain)
    - Conversational queries (greetings, questions, help)
    - Lookups that don't modify workspace state
    - Visual analysis of images ("what's in this image/PDF")
    - NEVER route skill execution or CRUD modifications here

    "plan" — Any action that modifies state, execute with plan:
    - Skill execution (run @skill-name, execute skill, trigger automation)
    - CRUD operations (add/update/delete tables, fields, apps, rows)
    - Single well-defined actions that modify workspace (add a field, delete a table)
    - Multiple steps or cross-capability tasks
    - Complex business logic or data modeling (build a CRM, set up workflows)
    - "build an app based on this mockup" + images → "plan" (multi-step using images)

    "respond" — Pure conversation, no tools needed:
    - Greetings, thank you messages
    - Questions about what the platform can do
    - Requests for clarification on previous responses
    - Never route to "respond" when images are present — respond cannot process images

    RESEARCH BEFORE DECIDING:
    - Use search_capabilities to check what capabilities exist for the task
    - Use system_research to check if referenced resources exist
    - Don't guess — verify when uncertain

    WHEN IN DOUBT: prefer "direct" for questions, research, and read-only tasks.
    Only use "plan" for EXPLICIT state modifications (create, update, delete, execute skill).

    Examples that should be "direct" (NOT plan):
    - "Tell me about X" → direct
    - "How do I..." → direct
    - "What is..." → direct
    - "List all..." → direct
    - "Explain..." → direct
    - "Search for..." → direct

    Examples that REQUIRE "plan":
    - "Create a table for..." → plan
    - "Add a field to..." → plan
    - "Delete the..." → plan
    - "@skill-name" → plan
    """

    task: str = dspy.InputField(desc="The user's task or request in natural language")
    workspace_context: str = dspy.InputField(
        desc="Current workspace state: existing resources (databases, tables, apps, agents, skills). "
        "Check this before making routing decisions."
    )
    memory_context: str = dspy.InputField(
        desc="Relevant memories from previous sessions. Lightweight background "
        "context — use for continuity. Empty if none."
    )
    image_context: str = dspy.InputField(
        desc="Description of user-uploaded images available for visual analysis. "
        "Empty string if no images. When present, 'direct' and 'plan' nodes "
        "can analyze these images — 'respond' cannot.",
        default="",
    )

    execution_mode: str = dspy.OutputField(desc="One of: 'direct', 'plan', 'respond'")
    reasoning: str = dspy.OutputField(
        desc="Brief explanation of why this route was chosen (1-2 sentences)"
    )
    context_notes: str = dspy.OutputField(
        desc="Key findings from any research tools called (resource IDs, capability matches, etc.). "
        "Passed to the next node to avoid duplicate lookups. Empty string if no research done."
    )
    response: str = dspy.OutputField(
        desc="When execution_mode is 'respond': the complete, natural answer to give the user. "
        "When execution_mode is 'direct' or 'plan': empty string."
    )
    # Task analysis fields — populated during triage to avoid a separate AnalyzeTask call
    intent: str = dspy.OutputField(
        desc="One-sentence summary of the user's goal. Start with a verb "
        "(e.g., 'Create a contacts table with name, email, and phone fields'). "
        "Always populated regardless of execution_mode."
    )
    entities: list[str] = dspy.OutputField(
        desc="Concrete nouns from the request: resource names, field names, service names. "
        "Resolve references using workspace_context (e.g., 'the table' → actual table name)."
    )
    approach: str = dspy.OutputField(
        desc="Reasoning approach: 'analytical', 'systems-thinking', 'step-by-step', or 'creative'. "
        "Guides how the planner structures the plan."
    )
    external_services: list[str] = dspy.OutputField(
        desc="Third-party services mentioned (e.g., ['gmail', 'slack']). "
        "Empty list if none. The planner will call search_external for each."
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
    needs_clarification: bool = Field(
        default=False, description="Whether user input is needed"
    )
    clarifying_questions: list[ClarifyingQuestionOutput] = Field(
        default_factory=list, description="Questions if clarification needed"
    )


class GeneratePlanDiff(dspy.Signature):  # type: ignore[misc]
    """Generate a minimal diff to fix or adjust the remaining plan after a replan trigger.

    PRINCIPLES:
    - Preserve completed work: never re-do steps that already succeeded.
    - Minimal changes: skip or modify existing steps rather than replacing the entire plan.
    - Append new steps only when the failure reveals missing work.
    - If the failure is transient (e.g., timeout), retry the same step rather than restructuring.
    - If clarification is needed from the user, set needs_clarification=true and provide questions.
    """

    goal: str = dspy.InputField(desc="The plan's overall goal (same as original plan)")
    reason: str = dspy.InputField(
        desc="Why replanning was triggered: step failure, goal not fully achieved, "
        "or replan_after flag on a completed step."
    )
    failed_step_info: str = dspy.InputField(
        desc="Details about the failed step: step_id, description, error message, "
        "and tool evidence. Empty string if replan was triggered by replan_after flag."
    )
    completed_context: str = dspy.InputField(
        desc="Summary of all completed step results so far. "
        "Use to understand what has already been accomplished."
    )
    pending_steps_json: str = dspy.InputField(
        desc="JSON array of remaining pending steps. These can be skipped, modified, or kept as-is."
    )

    diff: PlanDiffResult = dspy.OutputField()
