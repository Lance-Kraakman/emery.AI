"""CreateSkillTemplate signature for skill template planning."""

from __future__ import annotations

import dspy

from .models import SkillInputSpec, SkillOutputSpec, SkillTemplatePlanOutput


class CreateSkillTemplate(dspy.Signature):  # type: ignore[misc]
    """Create a reusable skill template with {{ variable }} placeholders.

    CRITICAL - PRESERVE EVERY RULE:
    Count the rules in the user's request. The prompt_template MUST contain ALL of them.
    Do NOT summarize rules. Do NOT paraphrase. Copy the conditional logic verbatim.

    EXAMPLE - Request has 3 rules:
    "Write a summary. (1) If female use she/her. (2) If male use he/him. (3) Include family if provided."

    WRONG (only 1 rule preserved):
        "Write a summary of {{ name }}. Include family: {{ family }}."

    CORRECT (all 3 rules preserved):
        "Write a summary of {{ name }} who is {{ age }} years old.
         {% if gender == 'female' %}Use she/her/hers pronouns.{% elif gender == 'male' %}Use he/him/his pronouns.{% endif %}
         {% if family %}{{ name }} has {{ family }}.{% endif %}"

    VARIABLE SYNTAX - {{ }} EVERYWHERE:
    - In text: "{{ name }} is {{ age }}"
    - Inside {% if %} blocks: "{% if family %}{{ name }} has {{ family }}{% endif %}"
    - WRONG: {% if family %}name has family{% endif %}
    - CORRECT: {% if family %}{{ name }} has {{ family }}{% endif %}

    TWO FIELDS:
    1. description: Summarize task + mention key rules. {{ variable }} OK. NO {% if %}.
    2. prompt_template: ALL rules from request, using {% if %} for conditionals.

    EXTERNAL TOOLS:
    If the skill uses a third-party service (Gmail, Slack, etc.), the prompt_template
    MUST name the specific tool to call (e.g., "Use the gmail_send_email tool to...").
    Set connection_required on the step to the service slug (e.g., 'gmail').
    """

    request: str = dspy.InputField(desc="What the skill should accomplish")
    workspace_context: str = dspy.InputField(
        desc="JSON of existing databases, tables, apps - check FIRST before asking"
    )
    proven_strategies: str = dspy.InputField(desc="ACE patterns for similar goals")
    conversation_history: str = dspy.InputField(
        desc="Previous messages in this session for context continuity"
    )
    skill_inputs: list[SkillInputSpec] = dspy.InputField(
        desc="Input variables - use as {{ name }} in templates"
    )
    skill_outputs: list[SkillOutputSpec] = dspy.InputField(
        desc="Expected outputs to be extracted post-execution"
    )
    configured_tools: str = dspy.InputField(
        desc="JSON list of tools explicitly configured for this skill. "
        "When tools are listed here, you MUST use them in the plan steps. "
        "Include the exact tool name in the step's tool_call field. "
        "Empty string if no tools are configured."
    )

    result: SkillTemplatePlanOutput = dspy.OutputField()
