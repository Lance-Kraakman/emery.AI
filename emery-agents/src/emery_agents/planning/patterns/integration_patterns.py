"""
Planning patterns for external service integrations.

These patterns always require explicit approval due to OAuth requirements.
"""

from emery_agents.planning.pattern import PlanningPattern, AutoApprovePolicy


EXTERNAL_INTEGRATION_PATTERN = PlanningPattern(
    id="plan:external_integration",
    name="External Service Integration",
    description="Patterns for connecting to external services like Gmail, Slack, etc. "
                "Requires OAuth connection and always needs user approval.",
    triggers=[
        "send email",
        "slack message",
        "integrate with",
        "connect to",
        "gmail",
        "outlook",
        "send notification",
        "external service",
        "api integration",
    ],
    capability_ids=["agent:skill_builder"],
    strategy="""
1. Use search_capabilities to find available integrations
2. Use search_external(service="<name>") to get specific tool names and schemas
3. Verify the integration is connected (check connection_required)
4. Create skill/automation with the specific tool

IMPORTANT:
- Always check if integration is available via search_capabilities
- Get exact tool name via search_external before creating steps
- Set connection_required on steps that need OAuth
- Include specific tool names in step descriptions (e.g., gmail_send_email)
""",
    tool_sequence=["skill_builder"],
    step_templates=[
        "Use [tool_name] to [action]. Inputs: [required_inputs]. Connection required: [service].",
    ],
    examples=[
        {
            "request": "Send an email via Gmail when a new contact is added",
            "plan_steps": [
                "Create skill that triggers on 'contacts' table insert, uses gmail_send_email tool. Connection required: gmail.",
            ],
        },
    ],
    common_mistakes=[
        "Not verifying the integration is available",
        "Not including specific tool names in steps",
        "Forgetting to set connection_required for OAuth services",
    ],
    auto_approve_policy=AutoApprovePolicy.EXPLICIT,  # Always require approval for OAuth
    auto_approve_conditions=[],
)


WEBHOOK_PATTERN = PlanningPattern(
    id="plan:webhook",
    name="Webhook Integration",
    description="Patterns for creating webhooks to receive external data.",
    triggers=[
        "webhook",
        "receive data",
        "incoming data",
        "api endpoint",
    ],
    capability_ids=["agent:skill_builder"],
    strategy="""
1. Define the webhook endpoint purpose
2. Specify expected payload structure
3. Define actions to take when webhook receives data
4. Set up any necessary data transformations
""",
    tool_sequence=["skill_builder"],
    step_templates=[
        "Create webhook endpoint for [purpose]. Expected payload: [structure]. Actions: [actions].",
    ],
    examples=[
        {
            "request": "Create a webhook to receive order updates",
            "plan_steps": [
                "Create webhook endpoint '/orders/update' that parses order data and updates the orders table.",
            ],
        },
    ],
    common_mistakes=[
        "Not validating incoming payload structure",
        "Not handling webhook errors gracefully",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["explicit_values"],
)


# Export all integration patterns
INTEGRATION_PATTERNS = [
    EXTERNAL_INTEGRATION_PATTERN,
    WEBHOOK_PATTERN,
]
