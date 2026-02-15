"""Shared docstring constants for planning signatures.

These constants are combined into full docstrings by the build_* functions.
This avoids duplicating large blocks of text between CreatePlan and CreatePlanAutonomous.
"""

from __future__ import annotations

CALLABLE_TOOLS_SECTION = """
## YOUR CALLABLE TOOLS (use during planning research)

You have EXACTLY 4 tools available:
1. system_research - Read existing tables, fields, pages from workspace
2. search_external - Find Pipedream integrations by service name
3. web_search - Research domain best practices, industry standards
4. finish - Complete planning and output your plan

>>> STOP: agent:schema_builder, agent:app_builder, table_crud, skill_tool are NOT callable.
>>> They are EXECUTION targets, not planning tools.
"""

STEP_QUALITY_RULES = """
STEP QUALITY RULES:
- Each step description must be a COMPLETE executor instruction (see PlanStepOutput.description).
- The plan step executor cannot see the plan goal, workspace context, or capability guidance.
  It only has the step description + tools. Write accordingly.
- Include concrete names, values, and types — never use vague references like "the table" or "appropriate fields".
- Use retrieved capabilities and patterns from planning_context as models for step descriptions.
- If a step requires looking something up first, write that INTO the description
  (e.g., "Look up the 'contacts' table schema, then add a 'phone' (phone) field").
- One step per distinct action. Never combine multiple actions into one step.
"""

PLANNING_PROCESS = """
## How to Write Plan Steps

Plan steps describe WHAT to do, not WHICH agent to call:

GOOD: "Create table 'contacts' with fields: name (text), email (email), phone (phone)"
BAD: "Use agent:schema_builder to create contacts table"

The executor will automatically route steps to the appropriate agent.

PLANNING PROCESS:
- Check workspace_context for existing resources before creating new ones.
- Use planning_context to understand what the system can do via retrieved capabilities and patterns.
- Use task_analysis for pre-analyzed intent, approach, and external service hints.

EXTERNAL INTEGRATIONS: If task_analysis lists external services (Gmail, Slack, etc.),
call search_external(service="<name>") to get specific tool names and input schemas.
Include the specific tool name (e.g., gmail_send_email) in step descriptions.
Set connection_required to the service slug for OAuth services.
"""

RESEARCH_TOOLS = """
RESEARCH TOOLS (call as needed, in any order — re-call to refine):
- search_external: Gets specific tool names/inputs for a service (e.g., gmail, slack).
- system_research: Gets field schemas, page content, resource details for existing workspace resources.
- web_search: Researches industry practices, business requirements, domain knowledge.

WHEN TO USE TOOLS vs ADD STEPS:

DEFAULT: USE TOOLS NOW (research during planning)
For most requests, call research tools FIRST, then generate an informed plan:
- Call web_search for domain best practices (CRM design, project management, etc.)
- Call search_capabilities to find available tools/integrations
- Call search_external for specific tool names and schemas
- Call system_research to check existing resource details
- THEN generate plan steps based on what you learned
- Include findings in the plan's `analysis` field

The plan should contain ACTION steps only (create, update, delete).
Research has already been done - don't add "research X" as a plan step.

EXCEPTION: ADD research steps to plan
Only defer research to plan steps when user EXPLICITLY wants this:
- "create a plan to research and then..." → ADD research steps
- "I want to review the research first" → ADD research steps
- "make a comprehensive plan I can re-run" → ADD research steps

These signals mean the user wants research as part of a replayable plan.
"""

CONTEXT_FIRST_SECTION = """
CONTEXT-FIRST APPROACH:
Before asking ANY clarifying question, CHECK if the answer is in your inputs:

1. workspace_context — Contains existing tables, fields, apps, agents.
   Example: If user says "add a field to the contacts table" and workspace_context
   shows a 'contacts' table exists, DON'T ask "which table?" — you know it's 'contacts'.

2. planning_context — Contains task analysis with entities already extracted.
   Example: If entities=['contacts', 'email'] was extracted, use these names.

3. conversation_history — Previous messages may contain clarification.
   Example: User may have specified details in an earlier message.

4. configured_tools — Tools may hint at the intended workflow.

ONLY ask when:
- Multiple equally-valid options exist (2+ tables could match)
- Destructive operation without explicit confirmation
- Business logic that genuinely requires user input

NEVER ask about:
- Resource names when only one exists or context makes it clear
- Field types when standard types are obvious (email → email, phone → phone)
- Naming conventions (use snake_case by default)

DEFAULTS vs QUESTIONS: Prefer a concrete plan with sensible defaults over vague questions.
The user can modify the plan before approving. Ask only when genuinely unsure:
destructive operations, ambiguous business rules, multiple valid approaches.
"""

AUTONOMOUS_MODE_SECTION = """
AUTONOMOUS MODE: You MUST generate a plan. You CANNOT ask clarifying questions.
When requirements are unclear, make sensible defaults and document them in 'analysis'.

HANDLING AMBIGUITY (AUTONOMOUS MODE):
Since you cannot ask questions, you MUST make decisions and document them:
- Make sensible defaults (most common choice, first reasonable option)
- Document ALL assumptions in the 'analysis' field
- Examples:
  - "Table name not specified → using 'contacts' (standard CRM naming)"
  - "Field types not specified → inferring: name (text), email (email), phone (phone)"
  - "No specific layout requested → using default grid view"
"""


def build_create_plan_docstring() -> str:
    """Build full CreatePlan docstring from shared parts."""
    return (
        "Create an execution plan or ask clarifying questions.\n"
        + CALLABLE_TOOLS_SECTION
        + STEP_QUALITY_RULES
        + PLANNING_PROCESS
        + CONTEXT_FIRST_SECTION
        + RESEARCH_TOOLS
    )


def build_create_plan_autonomous_docstring() -> str:
    """Build full CreatePlanAutonomous docstring from shared parts."""
    return (
        "Create an execution plan with sensible defaults (autonomous mode).\n"
        + AUTONOMOUS_MODE_SECTION
        + CALLABLE_TOOLS_SECTION
        + STEP_QUALITY_RULES
        + PLANNING_PROCESS
        + RESEARCH_TOOLS
    )
