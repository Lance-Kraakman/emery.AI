"""
Skill template examples for few-shot learning.

These examples demonstrate proper {{ variable }} usage, conditional logic
with {% if %}, and template structure for skill creation.
"""

import dspy

from emery_agents.reasoning.signatures.planning import (
    SkillInputSpec,
    SkillOutputSpec,
    SkillTemplatePlanOutput,
    SkillTemplateStepOutput,
)


# Input field names for CreateSkillTemplate signature
_INPUT_FIELDS = (
    "request",
    "workspace_context",
    "capability_guidance",
    "proven_strategies",
    "conversation_history",
    "skill_inputs",
    "skill_outputs",
    "configured_tools",
)


def _create_example(
    request: str,
    skill_inputs: list[SkillInputSpec],
    skill_outputs: list[SkillOutputSpec],
    result: SkillTemplatePlanOutput,
    workspace_context: str = '{"_summary": "Empty workspace", "resources": []}',
    capability_guidance: str = "",
    proven_strategies: str = "",
    conversation_history: str = "",
    configured_tools: str = "",
) -> dspy.Example:
    """Helper to create a properly-typed dspy.Example for skill templates."""
    return dspy.Example(
        request=request,
        workspace_context=workspace_context,
        capability_guidance=capability_guidance,
        proven_strategies=proven_strategies,
        conversation_history=conversation_history,
        skill_inputs=skill_inputs,
        skill_outputs=skill_outputs,
        configured_tools=configured_tools,
        result=result,
    ).with_inputs(*_INPUT_FIELDS)


# =============================================================================
# Example 1: Simple text generation skill
# =============================================================================
EXAMPLE_SUMMARY_SKILL = _create_example(
    request="Write a professional summary for a person",
    skill_inputs=[
        SkillInputSpec(name="name", type="text", required=True),
        SkillInputSpec(name="role", type="text", required=True),
        SkillInputSpec(name="years_experience", type="number", required=False),
    ],
    skill_outputs=[
        SkillOutputSpec(name="summary", type="text"),
    ],
    result=SkillTemplatePlanOutput(
        plan_id="skill_summary",
        goal="Generate professional summary for {{ name }}",
        context="No workspace resources needed - pure text generation",
        analysis="Simple text generation using input variables. Optional years_experience "
        "should be conditionally included.",
        steps=[
            SkillTemplateStepOutput(
                step_id="step_1_generate_summary",
                description="Write professional summary for {{ name }} as {{ role }}",
                prompt_template=(
                    "Write a professional summary for {{ name }} who works as a {{ role }}."
                    "{% if years_experience %} They have {{ years_experience }} years of experience.{% endif %}"
                    " Keep it concise (2-3 sentences) and highlight their expertise."
                ),
                phase_name="Execution",
                phase_order=1,
            )
        ],
    ),
)


# =============================================================================
# Example 2: Skill with conditional logic
# =============================================================================
EXAMPLE_GREETING_SKILL = _create_example(
    request="Generate a greeting message. Use formal tone if business context, casual otherwise.",
    skill_inputs=[
        SkillInputSpec(name="recipient_name", type="text", required=True),
        SkillInputSpec(name="context", type="text", required=True),
        SkillInputSpec(name="sender_name", type="text", required=False),
    ],
    skill_outputs=[
        SkillOutputSpec(name="greeting", type="text"),
    ],
    result=SkillTemplatePlanOutput(
        plan_id="skill_greeting",
        goal="Generate appropriate greeting for {{ recipient_name }}",
        context="No workspace resources needed - conditional text generation",
        analysis="Greeting style depends on context - formal for business, casual otherwise. "
        "Sender name is optional.",
        steps=[
            SkillTemplateStepOutput(
                step_id="step_1_generate_greeting",
                description="Generate greeting for {{ recipient_name }} based on {{ context }}",
                prompt_template=(
                    "Generate a greeting message for {{ recipient_name }}.\n"
                    "{% if context == 'business' %}"
                    "Use a formal, professional tone appropriate for business communication."
                    "{% else %}"
                    "Use a friendly, casual tone."
                    "{% endif %}"
                    "{% if sender_name %}\nSign off as {{ sender_name }}.{% endif %}"
                ),
                phase_name="Execution",
                phase_order=1,
            )
        ],
    ),
)


# =============================================================================
# Example 3: Skill with external tool call
# =============================================================================
EXAMPLE_EMAIL_SKILL = _create_example(
    request="Send a follow-up email after a meeting",
    skill_inputs=[
        SkillInputSpec(name="recipient_email", type="text", required=True),
        SkillInputSpec(name="meeting_topic", type="text", required=True),
        SkillInputSpec(name="action_items", type="text", required=False),
    ],
    skill_outputs=[
        SkillOutputSpec(name="email_sent", type="boolean"),
    ],
    result=SkillTemplatePlanOutput(
        plan_id="skill_followup_email",
        goal="Send follow-up email about {{ meeting_topic }}",
        context="Requires Gmail integration for sending",
        analysis="Two-step process: compose personalized email, then send via Gmail. "
        "Action items are conditionally included if provided.",
        steps=[
            SkillTemplateStepOutput(
                step_id="step_1_send_email",
                description="Compose and send follow-up email to {{ recipient_email }}",
                tool_call="gmail_send_email",
                connection_required="gmail",
                prompt_template=(
                    "Compose a professional follow-up email about the {{ meeting_topic }} meeting.\n"
                    "{% if action_items %}"
                    "Include these action items:\n{{ action_items }}"
                    "{% endif %}\n"
                    "Keep it concise and actionable. Use the gmail_send_email tool to send to {{ recipient_email }}."
                ),
                phase_name="Execution",
                phase_order=1,
            )
        ],
    ),
)


# =============================================================================
# Example 4: Data lookup skill
# =============================================================================
EXAMPLE_LOOKUP_SKILL = _create_example(
    request="Look up a contact's details from the database",
    skill_inputs=[
        SkillInputSpec(name="contact_name", type="text", required=True),
    ],
    skill_outputs=[
        SkillOutputSpec(name="email", type="text"),
        SkillOutputSpec(name="phone", type="text"),
    ],
    workspace_context='{"_summary": "1 table: contacts", "resources": [{"type": "table", "name": "contacts", "fields": ["name", "email", "phone"]}]}',
    result=SkillTemplatePlanOutput(
        plan_id="skill_contact_lookup",
        goal="Find contact details for {{ contact_name }}",
        context="contacts table exists with name, email, phone fields",
        analysis="Simple lookup query on existing contacts table. Extract email and phone from result.",
        steps=[
            SkillTemplateStepOutput(
                step_id="step_1_lookup_contact",
                description="Query contacts table for {{ contact_name }}",
                tool_call="table_crud",
                prompt_template=(
                    "Look up the contact named {{ contact_name }} in the contacts table. "
                    "Return their email and phone number."
                ),
                phase_name="Execution",
                phase_order=1,
            )
        ],
    ),
)


# =============================================================================
# Collected demos for export
# =============================================================================
SKILL_TEMPLATE_DEMOS: list[dspy.Example] = [
    EXAMPLE_SUMMARY_SKILL,
    EXAMPLE_GREETING_SKILL,
    EXAMPLE_EMAIL_SKILL,
    EXAMPLE_LOOKUP_SKILL,
]
