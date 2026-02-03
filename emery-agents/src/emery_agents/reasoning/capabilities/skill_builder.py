"""
Planning guidance for skill_builder capability.

This replaces prompts/capabilities/skill_builder/planning.j2
"""

PLANNING_GUIDANCE = """
## Skill Builder (agent:skill_builder)

**Choose when**: User wants to automate tasks, create workflows, or schedule actions.
**Examples**: "send weekly report", "automate follow-ups", "notify me when..."

### What skill_builder Creates

- Skills with defined inputs and outputs
- Skill instructions (what the skill does)
- Input/output mappings to tables

### Before Creating a Skill

Plan steps should BUILD the skill definition, NOT execute what the skill does.
Ensure you have:
- Skill name and purpose
- Required inputs (what data the skill needs)
- Expected outputs (what data the skill produces)
- Instructions for how the skill should behave

### Step Format Examples

- "Create skill 'send_welcome_email' with inputs: recipient_email (text), recipient_name (text). Output: email_sent (boolean)"
- "Create skill 'generate_report' with inputs: date_range (text), report_type (text). Output: report_content (text)"
- "Update skill 'process_order' to add output: tracking_number (text)"

### Skill Components

- **Inputs**: Data required to run the skill
- **Outputs**: Data captured after skill execution
- **Instructions**: Natural language description of what the skill does
- **Persona**: Optional personality/style for the skill's execution

### External Integrations (Gmail, Slack, GitHub, etc.)

When a skill uses a third-party service:
1. Call search_external(service="<name>") during planning to find the exact action
2. Include the tool name in the step description (e.g., "using gmail_send_email")
3. Set connection_required to the app slug (e.g., "gmail")

Example step descriptions:
- "Create skill 'send_gmail_email' using gmail_send_email integration. Inputs: to (text), subject (text), body (text). connection_required: gmail"
- "Create skill 'post_to_slack' using slack_send_message integration. Inputs: channel (text), message (text). connection_required: slack"
"""
