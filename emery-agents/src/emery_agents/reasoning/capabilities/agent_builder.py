"""
Planning guidance for agent_builder capability.

This replaces prompts/capabilities/agent_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Agent Builder (agent:agent_builder)

**Choose when**: User wants to create or configure AI agents with specific capabilities.
**Examples**: "create a sales assistant", "set up a support agent", "build a custom agent"

### Agent Components

- **Name**: Identifier for the agent
- **Persona**: Personality and communication style
- **Instructions**: How the agent should behave
- **Skills**: What the agent can do (existing skills to attach)
- **Data Access**: Which tables the agent can read/write

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every agent_builder step description:
1. **AGENT NAME**: Exact name in quotes
2. **PERSONA**: Description of personality/style
3. **INSTRUCTIONS**: How the agent should behave
4. **SKILLS**: Names of existing skills to attach (must exist already — create skills in earlier steps)
5. **DATA ACCESS**: Exact table names the agent can access
6. **OUTCOME**: What the executor should verify

**Step description templates:**

Create agent:
"Create agent '[name]' with persona: '[persona description]'. Instructions: '[behavior instructions]'. Attach skills: ['skill1', 'skill2']. Data access: tables ['table1', 'table2']. Verify: agent exists with [N] skills and access to [N] tables."

Add skill to agent:
"Add skill '[skill_name]' to agent '[agent_name]'. Verify: skill attached to agent."

BAD: "Create an agent for the CRM"
GOOD: "Create agent 'CRM Assistant' with persona: 'Helpful and professional sales assistant'. Instructions: 'Help users manage client relationships and track orders.' Attach skills: ['send_welcome_email', 'create_follow_up']. Data access: tables ['clients', 'orders']. Verify: agent exists with 2 skills and access to 2 tables."
"""
