"""
Planning patterns for agent creation and configuration.

Migrated from:
- reasoning/capabilities/agent_builder.py PLANNING_GUIDANCE
"""

from emery_agents.planning.pattern import AutoApprovePolicy, PlanningPattern

AGENT_CREATE_PATTERN = PlanningPattern(
    id="plan:agent_create",
    name="Agent Creation",
    description="Planning patterns for creating and configuring AI agents with custom capabilities. "
    "Agents have personas, instructions, attached skills, and data access permissions.",
    triggers=[
        "create agent",
        "build agent",
        "make agent",
        "set up agent",
        "sales assistant",
        "support agent",
        "custom agent",
    ],
    capability_ids=["agent:agent_builder"],
    strategy="""
1. Define agent name and purpose
2. Write persona (personality/style)
3. Write instructions (behavior guidelines)
4. List skills to attach (must exist already)
5. Specify data access (table names)

AGENT COMPONENTS:
- Name: Identifier for the agent
- Persona: Personality and communication style
- Instructions: How the agent should behave
- Skills: Existing skills to attach
- Data Access: Tables the agent can read/write

ORDER: Create skills FIRST, then create the agent with skills attached.
Skills must exist before they can be attached to an agent.
""",
    tool_sequence=["agent_builder"],
    step_templates=[
        "Create agent '[name]' with persona: '[persona description]'. Instructions: '[behavior instructions]'. Attach skills: ['skill1', 'skill2']. Data access: tables ['table1', 'table2']. Verify: agent exists with [N] skills and access to [N] tables.",
        "Add skill '[skill_name]' to agent '[agent_name]'. Verify: skill attached to agent.",
    ],
    examples=[
        {
            "request": "Create a CRM assistant agent",
            "plan_steps": [
                "Create agent 'CRM Assistant' with persona: 'Helpful and professional sales assistant'. Instructions: 'Help users manage client relationships and track orders.' Attach skills: ['send_welcome_email', 'create_follow_up']. Data access: tables ['clients', 'orders']. Verify: agent exists with 2 skills and access to 2 tables.",
            ],
        },
        {
            "request": "Build a support agent for customer queries",
            "plan_steps": [
                "Create agent 'Support Bot' with persona: 'Friendly and patient customer support representative'. Instructions: 'Answer customer questions, look up order status, and escalate complex issues.' Attach skills: ['lookup_order', 'send_status_update']. Data access: tables ['customers', 'orders', 'tickets']. Verify: agent exists with 2 skills and access to 3 tables.",
            ],
        },
    ],
    common_mistakes=[
        "Attaching skills that don't exist yet",
        "Not specifying table names for data access",
        "Vague instructions",
        "Missing persona description",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_resource", "explicit_values", "additive_only"],
)


AGENT_EXECUTE_PATTERN = PlanningPattern(
    id="plan:agent_execute",
    name="Agent Execution",
    description="Planning patterns for executing existing agents with tasks. "
    "Execute agents by ID, not by replicating their logic.",
    triggers=[
        "run agent",
        "execute agent",
        "trigger agent",
        "use agent",
        "call agent",
        "@agent",
    ],
    capability_ids=["agent:agent_executor"],
    strategy="""
1. Find the agent ID (from workspace_context or via discovery)
2. Formulate the task/prompt for the agent
3. Execute by agent ID with the task
4. Verify successful execution

IMPORTANT:
- Execute agents by ID — do NOT replicate the agent's logic manually
- The agent has its own persona, instructions, skills, and data access
- Pass the task as a natural language prompt

IF AGENT ID IS UNKNOWN:
Add a discovery step first to find the agent by name.
""",
    tool_sequence=["agent_executor"],
    step_templates=[
        "Execute agent '[name]' (agent_id=[ID]) with task: '[task description]'. Verify: agent executed successfully.",
        "Find the agent ID for '[agent_name]' by listing available agents. Verify: agent found.",
    ],
    examples=[
        {
            "request": "Run my CRM assistant to draft a follow-up email",
            "plan_steps": [
                "Execute agent 'CRM Assistant' (agent_id=42) with task: 'Draft a follow-up email for client John Smith about the Q4 proposal.' Verify: agent executed successfully.",
            ],
        },
        {
            "request": "Trigger the support agent to look up order status",
            "plan_steps": [
                "Find the agent ID for 'Support Bot' by listing available agents. Verify: agent found.",
                "Execute agent 'Support Bot' (agent_id=<from step 1>) with task: 'Look up order status for order #12345.' Verify: agent executed successfully.",
            ],
        },
    ],
    common_mistakes=[
        "Trying to manually implement what the agent does",
        "Not including the agent ID",
        "Not verifying execution success",
        "Using agent_builder instead of agent_executor",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["explicit_values"],
)


# Export all agent-related patterns
AGENT_PATTERNS = [
    AGENT_CREATE_PATTERN,
    AGENT_EXECUTE_PATTERN,
]
