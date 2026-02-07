"""
Planning patterns for agent creation and configuration.

Migrated from:
- reasoning/capabilities/agent_builder.py PLANNING_GUIDANCE
"""

from emery_agents.planning.pattern import PlanningPattern, AutoApprovePolicy


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


# Export all agent-related patterns
AGENT_PATTERNS = [
    AGENT_CREATE_PATTERN,
]
