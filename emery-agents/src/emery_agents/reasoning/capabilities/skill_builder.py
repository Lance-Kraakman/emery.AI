"""
Planning guidance for skill_builder capability.

This replaces prompts/capabilities/skill_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Skill Builder (agent:skill_builder)

**Choose when**: User wants to automate tasks, create workflows, or schedule actions.
**Examples**: "send weekly report", "automate follow-ups", "notify me when..."

### Tools Used by This Capability
The executor uses: **skill_crud**.
- skill_crud: Create/list/get/update/delete skills
Set tool_call="skill_crud".

### Important
Plan steps should BUILD the skill definition, NOT execute what the skill does.
To execute an existing skill, use skill_executor instead.

### Skill Components

- **Inputs**: Data required to run the skill (name, type, required flag)
- **Outputs**: Data captured after skill execution (name, type)
- **Instructions**: Natural language description of what the skill does
- **Persona**: Optional personality/style for the skill's execution

### External Integrations (Gmail, Slack, GitHub, etc.)

When a skill uses a third-party service:
1. Call search_external(service="<name>") during planning to find the exact action
2. Include the tool name in the step description (e.g., "using gmail_send_email")
3. Set connection_required to the app slug (e.g., "gmail")

### What the Executor Needs in the Step Description
The plan step executor receives ONLY the description text and tools. It does NOT see the plan goal,
capability guidance, or workspace context. Write the description as a COMPLETE instruction.

REQUIRED in every skill_builder step description:
1. **SKILL NAME**: Exact name in quotes
2. **INPUTS**: Each input with name, type, and whether required
3. **OUTPUTS**: Each output with name and type
4. **INSTRUCTIONS**: What the skill should do (natural language)
5. **CONNECTION**: If external integration, include tool name and connection_required slug
6. **OUTCOME**: What the executor should verify

**Step description templates:**

Create skill:
"Create skill '[name]' with inputs: [input_name] ([type], required), [input_name] ([type], optional). Outputs: [output_name] ([type]). Instructions: '[what the skill does]'. Verify: skill exists with [N] inputs and [N] outputs."

Create skill with external integration:
"Create skill '[name]' using [tool_name] integration. Inputs: [input_name] ([type], required). Outputs: [output_name] ([type]). Instructions: '[what the skill does]'. connection_required: [slug]. Verify: skill exists with connection."

BAD: "Create a skill that sends emails"
GOOD: "Create skill 'send_welcome_email' using gmail_send_email integration. Inputs: recipient_email (email, required), recipient_name (text, required). Outputs: email_sent (boolean). Instructions: 'Send a welcome email to the recipient introducing our services.' connection_required: gmail. Verify: skill exists with 2 inputs, 1 output, and gmail connection."
"""
