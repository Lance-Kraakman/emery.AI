"""
Domain Planners - DEPRECATED

The domain-specific planners (schema, app, automation) have been replaced
by capability-based planning. The PlanGenerator now uses:

1. Capability discovery tools (search_capabilities, list_capabilities, get_capability)
2. PlanOutputTool (submit_plan) for structured plan capture
3. A single ToolCallingAgent that discovers and routes to capabilities dynamically

This directory is kept for backwards compatibility but will be removed
in a future version.
"""

# No exports - domain planners have been removed
__all__: list[str] = []
