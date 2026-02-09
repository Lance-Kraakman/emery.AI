"""
Canonical planning examples for few-shot learning.

These examples are passed to the PlannerModule as demos to improve
planning quality. They demonstrate good step descriptions, proper
tool selection, and appropriate plan structure.

Usage:
    from emery_agents.reasoning.examples.planning import PLANNING_DEMOS

    planner = dspy.ReAct(CreatePlan, tools=tools, demos=PLANNING_DEMOS)
"""

import dspy

from emery_agents.reasoning.signatures.planning import (
    ClarifyingQuestionOutput,
    PlanOrQuestionsOutput,
    PlanOutput,
    PlanStepOutput,
    QuestionType,
)


# Input field names for CreatePlan signature
_INPUT_FIELDS = (
    "request",
    "workspace_context",
    "capability_guidance",
    "planning_context",
    "conversation_history",
    "configured_tools",
)


def _create_example(
    request: str,
    workspace_context: str,
    planning_context: str,
    result: PlanOrQuestionsOutput,
    capability_guidance: str = "",
    conversation_history: str = "",
    configured_tools: str = "",
) -> dspy.Example:
    """Helper to create a properly-typed dspy.Example."""
    return dspy.Example(
        request=request,
        workspace_context=workspace_context,
        capability_guidance=capability_guidance,
        planning_context=planning_context,
        conversation_history=conversation_history,
        configured_tools=configured_tools,
        result=result,
    ).with_inputs(*_INPUT_FIELDS)


# =============================================================================
# Example 1: Simple table creation (single step, explicit values)
# =============================================================================
EXAMPLE_CREATE_TABLE = _create_example(
    request="Create a contacts table with name, email, and phone",
    workspace_context='{"_summary": "Empty workspace", "resources": []}',
    planning_context="""## Task Analysis
Intent: Create a contacts table with name, email, and phone fields
Domain: emery
Entities: contacts, name, email, phone
Approach: analytical""",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_create_contacts",
            goal="Create contacts table with name, email, and phone fields",
            context="Empty workspace - creating new table from scratch",
            analysis="Single table creation with 3 explicit field types. Straightforward schema design.",
            steps=[
                PlanStepOutput(
                    step_id="step_1_create_contacts_table",
                    description=(
                        'Create table "contacts" with fields: '
                        "name (text), email (email), phone (phone). "
                        "Verify: table exists with exactly 3 fields."
                    ),
                    phase_name="Execution",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["single_resource", "explicit_values", "additive_only"],
        ),
        questions=None,
    ),
)


# =============================================================================
# Example 2: Multi-step task (app with linked table)
# =============================================================================
EXAMPLE_CREATE_APP_WITH_TABLE = _create_example(
    request="Create a task tracker with a tasks table and a simple app to view them",
    workspace_context='{"_summary": "Empty workspace", "resources": []}',
    planning_context="""## Task Analysis
Intent: Create a task tracking system with database and UI
Domain: emery
Entities: tasks, task tracker, app
Approach: systems-thinking""",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_task_tracker",
            goal="Create task tracker with tasks table and viewing app",
            context="Empty workspace - need both data layer and UI",
            analysis="Two-step task: first create data storage (table), then create UI (app). "
            "App depends on table existing first.",
            steps=[
                PlanStepOutput(
                    step_id="step_1_create_tasks_table",
                    description=(
                        'Create table "tasks" with fields: '
                        "title (text), description (long-text), "
                        "status (single-select: To Do, In Progress, Done), "
                        "due_date (date). "
                        "Verify: table exists with 4 fields."
                    ),
                    phase_name="Execution",
                    phase_order=1,
                ),
                PlanStepOutput(
                    step_id="step_2_create_tasks_app",
                    description=(
                        'Create app "Task Tracker" with a single page "Tasks" '
                        'that displays records from the "tasks" table in a table view. '
                        "Include columns: title, status, due_date. "
                        "Verify: app exists with one page showing task data."
                    ),
                    required_context=["step_1_create_tasks_table"],
                    phase_name="Execution",
                    phase_order=2,
                ),
            ],
            auto_approve_policy="confirm",
            matched_conditions=["explicit_values", "additive_only"],
        ),
        questions=None,
    ),
)


# =============================================================================
# Example 3: Adding to existing resource
# =============================================================================
EXAMPLE_ADD_FIELD = _create_example(
    request="Add a phone field to the contacts table",
    workspace_context="""{
        "_summary": "1 database, 1 table",
        "resources": [
            {"type": "database", "name": "Main", "id": "db_1", "tables": [
                {"name": "contacts", "id": "tbl_1", "field_count": 2, "fields": ["name", "email"]}
            ]}
        ]
    }""",
    planning_context="""## Task Analysis
Intent: Add a phone field to existing contacts table
Domain: emery
Entities: contacts, phone
Approach: analytical""",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_add_phone_field",
            goal="Add phone field to contacts table",
            context="contacts table exists with name and email fields - adding phone",
            analysis="Single field addition to existing table. Non-destructive change.",
            steps=[
                PlanStepOutput(
                    step_id="step_1_add_phone_field",
                    description=(
                        'Add field "phone" (phone type) to table "contacts". '
                        "Verify: contacts table now has 3 fields: name, email, phone."
                    ),
                    phase_name="Execution",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["single_resource", "explicit_values", "additive_only"],
        ),
        questions=None,
    ),
)


# =============================================================================
# Example 4: Research/discovery task (uses web_search)
# =============================================================================
EXAMPLE_RESEARCH_TASK = _create_example(
    request="What are best practices for CRM database design?",
    workspace_context='{"_summary": "Empty workspace", "resources": []}',
    planning_context="""## Task Analysis
Intent: Research CRM database design best practices
Domain: research
Entities: CRM, database
Approach: analytical""",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_crm_research",
            goal="Research and summarize CRM database design best practices",
            context="Research task - no workspace modifications needed",
            analysis="Pure research task. Use web_search to gather information, then synthesize findings.",
            steps=[
                PlanStepOutput(
                    step_id="step_1_research_crm",
                    description=(
                        "Search for CRM database design best practices. "
                        "Look for: common entities (contacts, companies, deals, activities), "
                        "recommended relationships, field types for each entity. "
                        "Summarize findings with actionable recommendations."
                    ),
                    tool_call="web_search",
                    phase_name="Discovery",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["read_only"],
        ),
        questions=None,
    ),
)


# =============================================================================
# Example 5: Task needing clarification
# =============================================================================
EXAMPLE_NEEDS_CLARIFICATION = _create_example(
    request="Set up email notifications",
    workspace_context='{"_summary": "Empty workspace", "resources": []}',
    planning_context="""## Task Analysis
Intent: Set up email notifications
Domain: automation
Entities: email, notifications
Approach: systems-thinking
External services: email""",
    result=PlanOrQuestionsOutput(
        plan=None,
        questions=[
            ClarifyingQuestionOutput(
                question="What should trigger the email notifications?",
                question_type=QuestionType.CHOICE,
                options=[
                    "When a new record is added to a table",
                    "On a scheduled time (daily, weekly)",
                    "When a field value changes",
                    "Manual trigger from a button",
                ],
                reason="Need to know the trigger type to design the automation correctly",
            ),
            ClarifyingQuestionOutput(
                question="Which email service would you like to use?",
                question_type=QuestionType.CHOICE,
                options=["Gmail", "Outlook", "Custom SMTP"],
                reason="Different services require different OAuth connections and have different capabilities",
            ),
        ],
    ),
)


# =============================================================================
# Collected demos for export
# =============================================================================
PLANNING_DEMOS: list[dspy.Example] = [
    EXAMPLE_CREATE_TABLE,
    EXAMPLE_CREATE_APP_WITH_TABLE,
    EXAMPLE_ADD_FIELD,
    EXAMPLE_RESEARCH_TASK,
    EXAMPLE_NEEDS_CLARIFICATION,
]
