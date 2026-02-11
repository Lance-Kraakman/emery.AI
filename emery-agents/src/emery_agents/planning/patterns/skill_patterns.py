"""
Planning patterns for skill creation and execution.

Migrated from:
- reasoning/capabilities/skill_builder.py PLANNING_GUIDANCE
- reasoning/capabilities/skill_executor.py PLANNING_GUIDANCE
"""

from emery_agents.planning.pattern import AutoApprovePolicy, PlanningPattern

SKILL_CREATE_PATTERN = PlanningPattern(
    id="plan:skill_create",
    name="Skill Creation",
    description="Planning patterns for creating automated skills and workflows. "
    "Skills are reusable automations with inputs, outputs, and instructions.",
    triggers=[
        "create skill",
        "build skill",
        "make automation",
        "automate",
        "workflow",
        "schedule",
        "notify when",
        "send weekly",
    ],
    capability_ids=["agent:skill_builder"],
    strategy="""
1. Identify skill purpose and name
2. Define inputs (data required to run)
3. Define outputs (data captured after execution)
4. Write instructions (natural language)
5. For external integrations, call search_external first

SKILL COMPONENTS:
- Inputs: name, type, required flag
- Outputs: name, type
- Instructions: natural language description
- Persona: optional personality/style

IMPORTANT: Plan steps BUILD the skill definition, NOT execute what the skill does.
To execute an existing skill, use skill_executor instead.

EXTERNAL INTEGRATIONS (Gmail, Slack, GitHub, etc.):
1. Call search_external(service="<name>") to find exact tool
2. Include tool name in step description (e.g., "using gmail_send_email")
3. Set connection_required to app slug (e.g., "gmail")
""",
    tool_sequence=["skill_builder"],
    step_templates=[
        "Create skill '[name]' with inputs: [input_name] ([type], required), [input_name] ([type], optional). Outputs: [output_name] ([type]). Instructions: '[what the skill does]'. Verify: skill exists with [N] inputs and [N] outputs.",
        "Create skill '[name]' using [tool_name] integration. Inputs: [input_name] ([type], required). Outputs: [output_name] ([type]). Instructions: '[what the skill does]'. connection_required: [slug]. Verify: skill exists with connection.",
    ],
    examples=[
        {
            "request": "Create a skill that sends welcome emails",
            "plan_steps": [
                "Create skill 'send_welcome_email' using gmail_send_email integration. Inputs: recipient_email (email, required), recipient_name (text, required). Outputs: email_sent (boolean). Instructions: 'Send a welcome email to the recipient introducing our services.' connection_required: gmail. Verify: skill exists with 2 inputs, 1 output, and gmail connection.",
            ],
        },
        {
            "request": "Build a summary generator skill",
            "plan_steps": [
                "Create skill 'generate_summary' with inputs: topic (text, required), max_length (number, optional). Outputs: summary (text). Instructions: 'Generate a concise summary of the given topic in the specified length.' Verify: skill exists with 2 inputs and 1 output.",
            ],
        },
    ],
    common_mistakes=[
        "Trying to execute the skill instead of building it",
        "Not specifying input types",
        "Missing connection_required for external integrations",
        "Not including the specific tool name for integrations",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


SKILL_EXECUTE_PATTERN = PlanningPattern(
    id="plan:skill_execute",
    name="Skill Execution",
    description="Planning patterns for running, executing, or triggering existing skills. "
    "Execute skills by ID, not by replicating their logic.",
    triggers=[
        "run skill",
        "execute skill",
        "trigger skill",
        "use skill",
        "call skill",
        "@skill",
    ],
    capability_ids=["agent:skill_executor"],
    strategy="""
1. Find the skill ID (from workspace_context or via discovery)
2. Determine required inputs
3. Execute by skill ID
4. Verify successful execution

IMPORTANT:
- Execute skills by ID — do NOT replicate the skill's logic manually
- The skill has its own instructions, tools, and model
- Pass data={} if no explicit inputs are needed

IF SKILL ID IS UNKNOWN:
Add a discovery step first to find the skill by name.
""",
    tool_sequence=["skill_executor"],
    step_templates=[
        "Execute skill '[name]' (skill_id=[ID]) with inputs: [key]='[value]'. Verify: skill executed successfully.",
        "Find the skill ID for '[skill_name]' by listing available skills. Verify: skill found.",
    ],
    examples=[
        {
            "request": "Run my generate-summary skill with topic 'Q4 financials'",
            "plan_steps": [
                "Execute skill 'generate-summary' (skill_id=42) with inputs: topic='Q4 financials'. Verify: skill executed successfully.",
            ],
        },
        {
            "request": "Trigger the weekly report skill",
            "plan_steps": [
                "Find the skill ID for 'weekly-report' by listing available skills. Verify: skill found.",
                "Execute skill 'weekly-report' (skill_id=<from step 1>) with inputs: {}. Verify: skill executed successfully.",
            ],
        },
    ],
    common_mistakes=[
        "Trying to manually implement what the skill does",
        "Not including the skill ID",
        "Not verifying execution success",
        "Using skill_builder instead of skill_executor",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["explicit_values"],
)


# Export all skill-related patterns
SKILL_PATTERNS = [
    SKILL_CREATE_PATTERN,
    SKILL_EXECUTE_PATTERN,
]
