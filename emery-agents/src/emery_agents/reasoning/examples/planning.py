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
# Workspace File Operations (write_file, read_file, bash)
# =============================================================================

EXAMPLE_WRITE_FILE = _example(
    request="Write 'hello world' to a file called greeting.txt",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_write_file",
            goal="Write hello world content to greeting.txt file",
            context="Simple file write operation.",
            analysis="Direct file operation. Use write_file tool.",
            steps=[
                PlanStepOutput(
                    step_id="step_1_write_file",
                    description="Write 'hello world' to greeting.txt using write_file tool.",
                    tool_call="write_file",
                    parameters={"path": "greeting.txt", "content": "hello world"},
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

EXAMPLE_READ_FILE = _example(
    request="Read config.json and tell me what's in it",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_read_file",
            goal="Read and display contents of config.json",
            context="File read operation.",
            analysis="Direct file read. Use read_file tool.",
            steps=[
                PlanStepOutput(
                    step_id="step_1_read_file",
                    description="Read contents of config.json using read_file tool.",
                    tool_call="read_file",
                    parameters={"path": "config.json"},
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

EXAMPLE_RUN_TESTS = _example(
    request="Run the pytest tests",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_run_tests",
            goal="Execute pytest test suite",
            context="Command execution.",
            analysis="Run command in workspace. Use bash tool.",
            steps=[
                PlanStepOutput(
                    step_id="step_1_run_tests",
                    description="Run pytest to execute test suite using bash tool.",
                    tool_call="bash",
                    parameters={"command": "pytest"},
                    phase_name="Execution",
                    phase_order=1,
                )
            ],
            auto_approve_policy="auto",
            matched_conditions=["single_resource"],
        ),
        questions=None,
    ),
)

EXAMPLE_CREATE_AND_RUN_SCRIPT = _example(
    request="Create a Python script that prints numbers 1 to 10 and run it",
    result=PlanOrQuestionsOutput(
        plan=PlanOutput(
            plan_id="plan_create_script",
            goal="Create and execute Python script printing 1-10",
            context="Code generation and execution.",
            analysis="Two steps: write script, then run it.",
            steps=[
                PlanStepOutput(
                    step_id="step_1_write_script",
                    description="Write Python script with for loop printing 1-10.",
                    tool_call="write_file",
                    parameters={"path": "numbers.py", "content": "for i in range(1, 11):\n    print(i)"},
                    phase_name="Execution",
                    phase_order=1,
                ),
                PlanStepOutput(
                    step_id="step_2_run_script",
                    description="Execute the Python script.",
                    tool_call="bash",
                    parameters={"command": "python numbers.py"},
                    required_context=["step_1_write_script"],
                    phase_name="Execution",
                    phase_order=2,
                ),
            ],
            auto_approve_policy="auto",
            matched_conditions=["multi_step"],
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
    # Workspace file operations (write_file, read_file, bash)
    EXAMPLE_WRITE_FILE,
    EXAMPLE_READ_FILE,
    EXAMPLE_RUN_TESTS,
    EXAMPLE_CREATE_AND_RUN_SCRIPT,
    # Clarification
    EXAMPLE_NEEDS_CLARIFICATION,
]

# Autonomous demos: PlanOutput directly (not wrapped in PlanOrQuestionsOutput)
# Derived from PLANNING_DEMOS, excludes clarification examples
AUTONOMOUS_PLANNING_DEMOS: list[dspy.Example] = [
    dspy.Example(request=ex.request, result=ex.result.plan).with_inputs("request")
    for ex in PLANNING_DEMOS
    if ex.result.plan is not None
]
