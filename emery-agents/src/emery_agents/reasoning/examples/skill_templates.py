"""
Skill template examples for KNNFewShot demo selection.

Each example shows: given a request, produce this skill template.
KNN matches on request similarity to select relevant demos.

IMPORTANT: Only `request` is marked as input for KNN matching.
skill_inputs/skill_outputs are in examples as context for the model,
but not used for similarity matching.
"""

import dspy

from emery_agents.reasoning.signatures.planning import (
    SkillInputSpec,
    SkillOutputSpec,
    SkillTemplatePlanOutput,
    SkillTemplateStepOutput,
)


def _example(
    request: str,
    skill_inputs: list[SkillInputSpec],
    skill_outputs: list[SkillOutputSpec],
    result: SkillTemplatePlanOutput,
) -> dspy.Example:
    """Create a skill template example.

    Only `request` is marked as input for KNN matching.
    skill_inputs/skill_outputs are included as context.
    """
    return dspy.Example(
        request=request,
        skill_inputs=skill_inputs,
        skill_outputs=skill_outputs,
        result=result,
    ).with_inputs("request")


# =============================================================================
# Example 1: Simple text generation skill
# =============================================================================
EXAMPLE_SUMMARY_SKILL = _example(
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
        context="Pure text generation - no external tools needed",
        analysis="Text generation with optional conditional (years_experience).",
        steps=[
            SkillTemplateStepOutput(
                step_id="step_1",
                description="Write professional summary for {{ name }} as {{ role }}",
                prompt_template=(
                    "Write a professional summary for {{ name }} who works as a {{ role }}."
                    "{% if years_experience %} They have {{ years_experience }} years of experience.{% endif %}"
                    " Keep it concise (2-3 sentences)."
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
EXAMPLE_GREETING_SKILL = _example(
    request="Generate a greeting message. Use formal tone for business, casual otherwise.",
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
        context="Conditional text generation based on context",
        analysis="Greeting style depends on context value. Uses if/else.",
        steps=[
            SkillTemplateStepOutput(
                step_id="step_1",
                description="Generate greeting for {{ recipient_name }} based on {{ context }}",
                prompt_template=(
                    "Generate a greeting for {{ recipient_name }}.\n"
                    "{% if context == 'business' %}"
                    "Use a formal, professional tone."
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
EXAMPLE_EMAIL_SKILL = _example(
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
        context="Requires Gmail integration",
        analysis="Compose email with optional action items, then send via Gmail.",
        steps=[
            SkillTemplateStepOutput(
                step_id="step_1",
                description="Compose and send follow-up email to {{ recipient_email }}",
                tool_call="gmail_send_email",
                connection_required="gmail",
                prompt_template=(
                    "Compose a follow-up email about {{ meeting_topic }}.\n"
                    "{% if action_items %}"
                    "Include these action items:\n{{ action_items }}"
                    "{% endif %}\n"
                    "Send to {{ recipient_email }}."
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
EXAMPLE_LOOKUP_SKILL = _example(
    request="Look up a contact's details from the database",
    skill_inputs=[
        SkillInputSpec(name="contact_name", type="text", required=True),
    ],
    skill_outputs=[
        SkillOutputSpec(name="email", type="text"),
        SkillOutputSpec(name="phone", type="text"),
    ],
    result=SkillTemplatePlanOutput(
        plan_id="skill_contact_lookup",
        goal="Find contact details for {{ contact_name }}",
        context="Requires contacts table in workspace",
        analysis="Simple lookup query on contacts table.",
        steps=[
            SkillTemplateStepOutput(
                step_id="step_1",
                description="Query contacts table for {{ contact_name }}",
                tool_call="table_crud",
                prompt_template=(
                    "Look up {{ contact_name }} in the contacts table. "
                    "Return their email and phone."
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
