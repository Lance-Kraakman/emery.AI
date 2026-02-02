"""
Tool factories, loading, and capability management.

All tool definitions live here:
- crud/          CRUD tools for platform resources
- execution/     Bash, skill execution, dynamic dispatch
- integrations/  External integrations (Pipedream, API tools, etc.)
- analysis/      Security reports, research, classification
- output/        Plan/step/recovery output collectors
- discovery.py   Discovery tools (workspace, capabilities, web search)

Infrastructure:
- factories.py          create_crud_tools(), create_all_tools()
- loader.py             UnifiedToolLoader (metadata-driven)
- provider.py           ToolProvider (auth-scoped tool creation)
- capability_registry.py CapabilityRegistry (semantic capability search)
- tool_modes.py         ToolMode filtering (read-only vs mutation)

Import from submodules directly:
    from emery_agents.tools.factories import create_all_tools
    from emery_agents.tools.loader import UnifiedToolLoader
    from emery_agents.tools.capability_registry import CapabilityRegistry
"""
