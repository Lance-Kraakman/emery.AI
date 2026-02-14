"""
Triage examples for KNNFewShot demo selection.

Each example shows: given a task, produce this routing decision.
KNN matches on task similarity to select relevant demos.

IMPORTANT: Examples only have `task` (input) and outputs.
Runtime context (workspace, memory, etc.) is NOT in examples.
"""

import dspy


def _example(
    task: str,
    execution_mode: str,
    intent: str,
    reasoning: str = "",
    approach: str = "step-by-step",
    entities: list[str] | None = None,
    external_services: list[str] | None = None,
    response: str = "",
) -> dspy.Example:
    """Create a triage example with all input fields and routing outputs.

    All signature InputFields must be present to avoid DSPy warnings.
    Only `task` varies per demo; context fields are empty (runtime values).
    """
    return dspy.Example(
        # Inputs (all signature InputFields must be present)
        task=task,
        workspace_context="",  # Runtime context - empty in demos
        memory_context="",     # Runtime context - empty in demos
        image_context="",      # Runtime context - empty in demos
        # Outputs
        execution_mode=execution_mode,
        intent=intent,
        reasoning=reasoning,
        approach=approach,
        entities=entities or [],
        external_services=external_services or [],
        context_notes="",
        response=response,
    ).with_inputs("task", "workspace_context", "memory_context", "image_context")


# =============================================================================
# "plan" Mode Examples - State modifications, skill execution
# =============================================================================

EXAMPLE_SKILL_EXECUTION = _example(
    task="@skill:go-for-a-walk",
    execution_mode="plan",
    intent="Execute the 'Go for a Walk' skill",
    reasoning="Skill execution modifies state - requires plan mode.",
    approach="step-by-step",
    entities=["go-for-a-walk"],
)

EXAMPLE_SKILL_WITH_INPUTS = _example(
    task="Run the weekly report skill and send to team@company.com",
    execution_mode="plan",
    intent="Execute the 'Weekly Report' skill with recipient team@company.com",
    reasoning="Skill execution with parameters - requires plan mode.",
    approach="step-by-step",
    entities=["weekly report", "team@company.com"],
)

EXAMPLE_CREATE_TABLE = _example(
    task="Create a contacts table with name, email, and phone fields",
    execution_mode="plan",
    intent="Create a new 'contacts' table with name, email, and phone fields",
    reasoning="Creating a table modifies workspace state - requires plan mode.",
    approach="step-by-step",
    entities=["contacts", "name", "email", "phone"],
)

EXAMPLE_ADD_FIELD = _example(
    task="Add a phone field to the contacts table",
    execution_mode="plan",
    intent="Add a 'phone' field to the existing 'contacts' table",
    reasoning="Adding a field modifies table schema - requires plan mode.",
    approach="step-by-step",
    entities=["phone", "contacts"],
)

EXAMPLE_DELETE_TABLE = _example(
    task="Delete the old_data table",
    execution_mode="plan",
    intent="Delete the 'old_data' table from the workspace",
    reasoning="Deleting a table modifies workspace state - requires plan mode.",
    approach="step-by-step",
    entities=["old_data"],
)

EXAMPLE_BUILD_CRM = _example(
    task="Build me a CRM system",
    execution_mode="plan",
    intent="Create a CRM system with tables, apps, and workflows",
    reasoning="Complex multi-step task that modifies workspace - requires plan mode.",
    approach="systems-thinking",
    entities=["CRM"],
)

EXAMPLE_BUILD_APP = _example(
    task="Create an app to manage tasks",
    execution_mode="plan",
    intent="Create a task management app with table and UI",
    reasoning="Creating an app modifies workspace - requires plan mode.",
    approach="step-by-step",
    entities=["tasks", "app"],
)

EXAMPLE_SEND_EMAIL = _example(
    task="Send an email to bob@example.com about the meeting",
    execution_mode="plan",
    intent="Send an email to bob@example.com about the meeting",
    reasoning="Sending email is an action that requires execution - plan mode.",
    approach="step-by-step",
    entities=["bob@example.com", "meeting"],
    external_services=["gmail"],
)

EXAMPLE_POST_SLACK = _example(
    task="Post a message to #general saying project is complete",
    execution_mode="plan",
    intent="Post a message to #general Slack channel",
    reasoning="Posting to Slack is an action that requires execution - plan mode.",
    approach="step-by-step",
    entities=["#general"],
    external_services=["slack"],
)


# =============================================================================
# "direct" Mode Examples - Research, Q&A, read-only lookups
# =============================================================================

EXAMPLE_RESEARCH = _example(
    task="What are best practices for CRM database design?",
    execution_mode="direct",
    intent="Research CRM database design best practices",
    reasoning="Research task - read-only, no state modifications.",
    approach="analytical",
)

EXAMPLE_EXPLAIN = _example(
    task="Explain how the contacts table is structured",
    execution_mode="direct",
    intent="Explain the structure of the contacts table",
    reasoning="Information request - read-only lookup.",
    approach="analytical",
    entities=["contacts"],
)

EXAMPLE_LIST = _example(
    task="What tables do I have?",
    execution_mode="direct",
    intent="List all tables in the workspace",
    reasoning="Listing resources - read-only lookup.",
    approach="step-by-step",
)

EXAMPLE_HOW_TO = _example(
    task="How do I create a new skill?",
    execution_mode="direct",
    intent="Explain how to create a new skill",
    reasoning="How-to question - informational, no action needed.",
    approach="step-by-step",
)

EXAMPLE_WHAT_IS = _example(
    task="What is the difference between a table and an app?",
    execution_mode="direct",
    intent="Explain the difference between tables and apps",
    reasoning="Conceptual question - informational.",
    approach="analytical",
)

EXAMPLE_SEARCH = _example(
    task="Search for information about competitor pricing",
    execution_mode="direct",
    intent="Search for competitor pricing information",
    reasoning="Web search task - read-only research.",
    approach="analytical",
)

EXAMPLE_DESCRIBE = _example(
    task="Tell me about my workspace",
    execution_mode="direct",
    intent="Describe the current workspace state",
    reasoning="Workspace overview request - read-only.",
    approach="step-by-step",
)

EXAMPLE_ANALYZE_IMAGE = _example(
    task="What's in this image?",
    execution_mode="direct",
    intent="Analyze the uploaded image and describe its contents",
    reasoning="Visual analysis - read-only interpretation.",
    approach="analytical",
)


# =============================================================================
# "respond" Mode Examples - Pure conversation, no tools needed
# =============================================================================

EXAMPLE_GREETING = _example(
    task="Hello!",
    execution_mode="respond",
    intent="Respond to greeting",
    reasoning="Simple greeting - no tools needed.",
    response="Hello! How can I help you today?",
)

EXAMPLE_THANKS = _example(
    task="Thank you for your help!",
    execution_mode="respond",
    intent="Acknowledge thanks",
    reasoning="Thank you message - no tools needed.",
    response="You're welcome! Let me know if you need anything else.",
)

EXAMPLE_PLATFORM_QUESTION = _example(
    task="What can you do?",
    execution_mode="respond",
    intent="Explain platform capabilities",
    reasoning="Platform capabilities question - respond with overview.",
    response="I can help you build databases, create apps, set up automations, and integrate with external services like Gmail, Slack, and more. What would you like to create?",
)

EXAMPLE_CLARIFICATION = _example(
    task="Can you explain that again?",
    execution_mode="respond",
    intent="Clarify previous response",
    reasoning="Clarification request - conversational.",
    response="Of course! What part would you like me to explain in more detail?",
)


# =============================================================================
# Edge Cases - Tricky routing decisions
# =============================================================================

EXAMPLE_SKILL_QUERY = _example(
    task="What skills do I have?",
    execution_mode="direct",
    intent="List available skills in the workspace",
    reasoning="Listing skills is read-only - direct mode.",
    approach="step-by-step",
)

EXAMPLE_SKILL_DETAILS = _example(
    task="Show me details of the weekly report skill",
    execution_mode="direct",
    intent="Get details of the weekly report skill",
    reasoning="Reading skill details is read-only - direct mode.",
    approach="step-by-step",
    entities=["weekly report"],
)

EXAMPLE_CAPABILITY_QUERY = _example(
    task="Can you send emails?",
    execution_mode="direct",
    intent="Check if email sending capability is available",
    reasoning="Capability inquiry - read-only, direct mode.",
    approach="step-by-step",
    external_services=["gmail"],
)

EXAMPLE_AMBIGUOUS_CREATE = _example(
    task="I need a way to track customer orders",
    execution_mode="plan",
    intent="Create a system to track customer orders",
    reasoning="Implies creation of tables/apps - plan mode.",
    approach="systems-thinking",
    entities=["customer", "orders"],
)


# =============================================================================
# Collected demos for export
# =============================================================================
TRIAGE_DEMOS: list[dspy.Example] = [
    # Plan mode - skill execution
    EXAMPLE_SKILL_EXECUTION,
    EXAMPLE_SKILL_WITH_INPUTS,
    # Plan mode - CRUD
    EXAMPLE_CREATE_TABLE,
    EXAMPLE_ADD_FIELD,
    EXAMPLE_DELETE_TABLE,
    # Plan mode - complex tasks
    EXAMPLE_BUILD_CRM,
    EXAMPLE_BUILD_APP,
    # Plan mode - external actions
    EXAMPLE_SEND_EMAIL,
    EXAMPLE_POST_SLACK,
    # Direct mode - research
    EXAMPLE_RESEARCH,
    EXAMPLE_EXPLAIN,
    EXAMPLE_LIST,
    EXAMPLE_HOW_TO,
    EXAMPLE_WHAT_IS,
    EXAMPLE_SEARCH,
    EXAMPLE_DESCRIBE,
    EXAMPLE_ANALYZE_IMAGE,
    # Respond mode
    EXAMPLE_GREETING,
    EXAMPLE_THANKS,
    EXAMPLE_PLATFORM_QUESTION,
    EXAMPLE_CLARIFICATION,
    # Edge cases
    EXAMPLE_SKILL_QUERY,
    EXAMPLE_SKILL_DETAILS,
    EXAMPLE_CAPABILITY_QUERY,
    EXAMPLE_AMBIGUOUS_CREATE,
]
