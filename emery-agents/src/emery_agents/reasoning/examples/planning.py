"""
Planning examples for KNNFewShot demo selection.

Each example shows: given a request, produce this plan.
KNN matches on request similarity to select relevant demos.

IMPORTANT: Examples only have `request` (input) and `result` (output).
Runtime context (workspace, capabilities, etc.) is NOT in examples.
"""

import dspy

from emery_agents.reasoning.signatures.planning import (
    ClarifyingQuestionOutput,
    PlanOrQuestionsOutput,
    PlanOutput,
    PlanStepOutput,
    QuestionType,
)


def _example(request: str, result: PlanOrQuestionsOutput) -> dspy.Example:
    """Create a planning example with request (input) and result (output)."""
    return dspy.Example(request=request, result=result).with_inputs("request")


# =============================================================================
# Skill Execution Examples (high priority - should match skill requests)
# =============================================================================

EXAMPLE_EXECUTE_SKILL = _example(
    request="@skill:go-for-a-walk",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_execute_skill",
            goal="Execute the 'Go for a Walk' skill",
            context="Human task skill - assign and await completion.",
            analysis="Simple skill execution. No research needed - just run the skill.",
            steps=[
                PlanStepOutput(
                    step_id="step_1",
                    description="Execute skill 'Go for a Walk'. Human task - await completion.",
                    phase_name="Execution",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["skill_execution"],
        ),
        questions=None,
    ),
)

EXAMPLE_SKILL_WITH_INPUTS = _example(
    request="Run the weekly report skill and send to team@company.com",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_run_report",
            goal="Execute Weekly Report skill with recipient",
            context="Skill with input parameter.",
            analysis="Skill execution with input. Extract recipient from request.",
            steps=[
                PlanStepOutput(
                    step_id="step_1",
                    description="Execute 'Weekly Report' skill with recipient_email='team@company.com'.",
                    phase_name="Execution",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["skill_execution", "explicit_values"],
        ),
        questions=None,
    ),
)

EXAMPLE_LIST_SKILLS = _example(
    request="What skills do I have?",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_list_skills",
            goal="List available skills",
            context="Information request - format from workspace context.",
            analysis="Skills are in workspace context. No tool calls needed.",
            steps=[
                PlanStepOutput(
                    step_id="step_1",
                    description="Format and present available skills from workspace context.",
                    phase_name="Synthesis",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["read_only", "information_request"],
        ),
        questions=None,
    ),
)


# =============================================================================
# Table/Schema Examples
# =============================================================================

EXAMPLE_CREATE_TABLE = _example(
    request="Create a contacts table with name, email, and phone",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_create_contacts",
            goal="Create contacts table with name, email, phone fields",
            context="New table creation.",
            analysis="Single table with 3 explicit fields. Straightforward.",
            steps=[
                PlanStepOutput(
                    step_id="step_1",
                    description='Create table "contacts" with fields: name (text), email (email), phone (phone).',
                    phase_name="Execution",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["single_resource", "explicit_values"],
        ),
        questions=None,
    ),
)

EXAMPLE_ADD_FIELD = _example(
    request="Add a phone field to the contacts table",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_add_field",
            goal="Add phone field to contacts table",
            context="Adding field to existing table.",
            analysis="Single field addition. Non-destructive.",
            steps=[
                PlanStepOutput(
                    step_id="step_1",
                    description='Add field "phone" (phone type) to table "contacts".',
                    phase_name="Execution",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["single_resource", "additive_only"],
        ),
        questions=None,
    ),
)


# =============================================================================
# App/Dashboard Examples
# =============================================================================

EXAMPLE_CREATE_APP = _example(
    request="Create a task tracker with a tasks table and app to view them",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_task_tracker",
            goal="Create task tracker with table and app",
            context="Multi-step: table first, then app.",
            analysis="Two-step: create data storage, then UI. App depends on table.",
            steps=[
                PlanStepOutput(
                    step_id="step_1",
                    description='Create table "tasks" with: title, description, status, due_date.',
                    phase_name="Execution",
                    phase_order=1,
                ),
                PlanStepOutput(
                    step_id="step_2",
                    description='Create app "Task Tracker" with table view of tasks.',
                    required_context=["step_1"],
                    phase_name="Execution",
                    phase_order=2,
                ),
            ],
            auto_approve_policy="confirm",
            matched_conditions=["multi_resource"],
        ),
        questions=None,
    ),
)

EXAMPLE_BUILD_DASHBOARD = _example(
    request="Build me a dashboard for sales metrics",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_sales_dashboard",
            goal="Create sales dashboard",
            context="Dashboard app with charts.",
            analysis="Delegate to app_builder for dashboard creation.",
            steps=[
                PlanStepOutput(
                    step_id="step_1",
                    description="Create 'Sales Dashboard' app with charts: Sales by Region, Sales Over Time, Top Products. Use app_builder.",
                    phase_name="Execution",
                    phase_order=1,
                )
            ],
            auto_approve_policy="confirm",
            matched_conditions=["app_creation"],
        ),
        questions=None,
    ),
)


# =============================================================================
# Research Examples
# =============================================================================

EXAMPLE_RESEARCH = _example(
    request="What are best practices for CRM database design?",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_research",
            goal="Research CRM database design best practices",
            context="Research task - no modifications.",
            analysis="Pure research. Use web_search, then summarize.",
            steps=[
                PlanStepOutput(
                    step_id="step_1",
                    description="Search for CRM database design best practices. Summarize findings.",
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
# Clarification Examples
# =============================================================================

EXAMPLE_NEEDS_CLARIFICATION = _example(
    request="Set up email notifications",
    result=PlanOrQuestionsOutput(
        plan=None,
        questions=[
            ClarifyingQuestionOutput(
                question="What should trigger the email notifications?",
                question_type=QuestionType.CHOICE,
                options=[
                    "When a new record is added",
                    "On a schedule (daily, weekly)",
                    "When a field value changes",
                ],
                reason="Need trigger type to design automation.",
            ),
            ClarifyingQuestionOutput(
                question="Which email service?",
                question_type=QuestionType.CHOICE,
                options=["Gmail", "Outlook", "Custom SMTP"],
                reason="Different services need different setup.",
            ),
        ],
    ),
)


# =============================================================================
# Collected demos for export
# =============================================================================
PLANNING_DEMOS: list[dspy.Example] = [
    # Skill execution (highest priority for @skill: requests)
    EXAMPLE_EXECUTE_SKILL,
    EXAMPLE_SKILL_WITH_INPUTS,
    EXAMPLE_LIST_SKILLS,
    # Table/schema operations
    EXAMPLE_CREATE_TABLE,
    EXAMPLE_ADD_FIELD,
    # App/dashboard
    EXAMPLE_CREATE_APP,
    EXAMPLE_BUILD_DASHBOARD,
    # Research
    EXAMPLE_RESEARCH,
    # Clarification
    EXAMPLE_NEEDS_CLARIFICATION,
]
