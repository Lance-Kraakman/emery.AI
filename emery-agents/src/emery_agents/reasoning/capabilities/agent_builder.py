"""
Planning guidance for agent_builder capability.

This replaces prompts/capabilities/agent_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Agent Builder (agent:agent_builder)

**Choose when**: User wants to create or configure AI agents with specific capabilities.
**Examples**: "create a sales assistant", "set up a support agent", "build a custom agent"

### What agent_builder Creates

- Agent configurations (name, persona, instructions)
- Agent-skill associations
- Data access permissions (which tables agent can use)

### Before Creating an Agent

Ensure you have:
- Agent name and purpose
- Persona/style for the agent
- Skills the agent should have access to
- Tables/data the agent needs to access

### Step Format Examples

- "Create agent 'Sales Assistant' with access to 'leads' and 'contacts' tables, persona: helpful and professional"
- "Add skill 'send_followup_email' to 'Customer Support' agent"
- "Update 'Inventory Manager' agent to include access to 'suppliers' table"

### Agent Components

- **Name**: Identifier for the agent
- **Persona**: Personality and communication style
- **Instructions**: How the agent should behave
- **Skills**: What the agent can do
- **Data Access**: Which tables the agent can read/write
"""
