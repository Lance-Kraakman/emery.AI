"""Task analysis signatures: AnalyzeTask, ClassifyTask, AnalyzeGaps."""

from __future__ import annotations

import dspy

from .enums import TaskDomain
from .models import GapAnalysisResultModel, TaskClassificationResult


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
