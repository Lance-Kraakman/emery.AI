"""
Discovery tools for the executor.

These tools enable the executor to discover what resources exist,
what capabilities are available, and what integrations are accessible.

Wraps existing infrastructure as dspy.Tool instances:
- SystemResearchTool → system_research
- WorkspaceAPI → workspace_overview
- CapabilityRegistry → search_capabilities
- External integrations → search_external
"""

from __future__ import annotations

import json
import logging

import dspy

from ddgs import DDGS

from .analysis.research import SystemResearchTool
from .api.workspace_api import WorkspaceAPI
from .integrations.pipedream import get_pipedream_tool_info, list_pipedream_tools_by_app
from ...services.tools.capability_registry import CapabilityRegistry

logger = logging.getLogger(__name__)


def create_system_research_dspy_tool(api_key: str, org_id: str) -> dspy.Tool:
    """Create system_research tool wrapping SystemResearchTool."""
    tool = SystemResearchTool(auth_token=api_key, org_id=org_id)

    def system_research(
        resource_type: str,
        query: str = "",
        filters: str = "{}",
        include_details: bool = False,
    ) -> str:
        """Research platform resources (READ-ONLY)."""
        filters_dict = json.loads(filters) if filters else {}
        result = tool.forward(
            resource_type=resource_type,
            query=query or None,
            filters=filters_dict,
            include_details=include_details,
        )
        return json.dumps(result, default=str)

    return dspy.Tool(
        func=system_research,
        name="system_research",
        desc=(
            "Research platform resources (READ-ONLY). "
            "Query agents, skills, databases, tables, apps, pages, tasks, audit, organization."
        ),
        arg_desc={
            "resource_type": (
                "Type: 'agents', 'skills', 'databases', 'tables', 'apps', "
                "'pages', 'tasks', 'audit', 'organization'"
            ),
            "query": "Resource ID or search term (optional)",
            "filters": (
                "JSON string of filters: {limit, status, agent_id, database_id, "
                "resourceType, resourceId} (optional)"
            ),
            "include_details": "Include full details vs summary (default: false)",
        },
    )


def create_workspace_overview_tool(api_key: str, org_id: str) -> dspy.Tool:
    """Create workspace_overview tool wrapping WorkspaceAPI."""
    api = WorkspaceAPI(api_key=api_key, org_id=org_id)

    def workspace_overview() -> str:
        """Get complete workspace overview in one call."""
        data = api.get_all()
        return json.dumps(
            {
                "apps": [
                    {
                        "id": a.id,
                        "name": a.name,
                        "pages": [{"id": p.id, "name": p.name} for p in a.pages],
                    }
                    for a in data.apps
                ],
                "agents": [
                    {"id": a.id, "name": a.name, "description": a.description}
                    for a in data.agents
                ],
                "skills": [
                    {
                        "id": s.id,
                        "name": s.name,
                        "description": s.description,
                        "agent_id": s.agent_id,
                    }
                    for s in data.skills
                ],
                "databases": [
                    {
                        "id": d.id,
                        "name": d.name,
                        "tables": [
                            {
                                "id": t.id,
                                "name": t.name,
                                "field_count": t.field_count,
                                "fields": [
                                    {"name": f.name, "type": f.type}
                                    for f in t.fields
                                ],
                            }
                            for t in d.tables
                        ],
                    }
                    for d in data.databases
                ],
                "views": [
                    {
                        "id": v.id,
                        "name": v.name,
                        "table_id": v.table_id,
                        "view_type": v.view_type,
                    }
                    for v in data.views
                ],
            },
            default=str,
        )

    return dspy.Tool(
        func=workspace_overview,
        name="workspace_overview",
        desc=(
            "WHEN TO USE: Call this first when you need to know what EXISTING resources "
            "the workspace contains before creating or modifying anything.\n"
            "WHAT IT RETURNS: Complete snapshot — all databases (with tables and field schemas), "
            "apps (with pages), agents, skills, and views in a single JSON response.\n"
            "NOTE: This returns existing USER DATA resources, not platform capabilities. "
            "For capabilities (what the platform can do), use search_capabilities instead."
        ),
        arg_desc={},
    )


def create_capability_search_tool(registry: "CapabilityRegistry") -> dspy.Tool:
    """Create search_capabilities tool wrapping CapabilityRegistry.search()."""

    def search_capabilities(query: str, limit: int = 5) -> str:
        """Semantic search for platform capabilities."""
        results = registry.search(query=query, limit=limit)
        return json.dumps(
            [
                {
                    "id": c.id,
                    "name": c.name,
                    "type": c.type.value,
                    "description": c.description,
                    "actions": c.actions,
                    "entities": c.entities,
                }
                for c in results
            ],
            default=str,
        )

    return dspy.Tool(
        func=search_capabilities,
        name="search_capabilities",
        desc=(
            "WHEN TO USE: Search for PLATFORM CAPABILITIES — what the system can do, "
            "not what the user has already built. Use when you need to find the right "
            "agent/capability to delegate a task to.\n"
            "WHAT IT RETURNS: Ranked list of capabilities with id, name, description, "
            "actions, and entities. The id maps to target_agent in plan steps.\n"
            "NOTE: For existing user resources (tables, apps), use workspace_overview instead."
        ),
        arg_desc={
            "query": "Natural language description of what you need to do "
                     "(e.g., 'create database tables', 'build a dashboard app', 'generate PDF reports')",
            "limit": "Max results to return (default: 5)",
        },
    )


def create_external_search_tool() -> dspy.Tool:
    """Create search_external tool for external integrations."""

    def search_external(service: str = "", integration_name: str = "") -> str:
        """Search available external integrations."""
        if integration_name:
            info = get_pipedream_tool_info(integration_name)
            if info:
                return json.dumps(info)
            return json.dumps({"error": f"Integration not found: {integration_name}"})

        tools_by_app = list_pipedream_tools_by_app()
        if service:
            tools = tools_by_app.get(service, [])
            return json.dumps({"service": service, "integrations": tools})

        # Return all services with integration counts (not full list — could be huge)
        return json.dumps({svc: len(tools) for svc, tools in tools_by_app.items()})

    return dspy.Tool(
        func=search_external,
        name="search_external",
        desc=(
            "Search available external integrations (Slack, GitHub, Google, etc.). "
            "List integrations by service name or get details for a specific integration."
        ),
        arg_desc={
            "service": "Filter by service (e.g., 'slack', 'github'). Empty for all services with integration counts.",
            "integration_name": "Get details for specific integration. Empty to list.",
        },
    )


def create_web_search_tool() -> dspy.Tool:
    """Create web_search tool wrapping DuckDuckGo search."""

    def web_search(query: str, max_results: int = 5) -> str:
        """Search the web for information.

        IMPORTANT BOUNDARIES:
        - Use this tool for RESEARCH and INFORMATION GATHERING only
        - Results are reference material — do NOT copy-paste raw content as implementation
        - To BUILD anything based on research, use the appropriate capability tools
          (schema_builder, app_builder, page_builder, etc.)
        - This tool helps you understand WHAT to build, not HOW to build it in Emery
        """
        try:
            ddgs = DDGS()
            results = list(ddgs.text(query, max_results=min(max_results, 10)))
            if not results:
                return f"No results found for: {query}"

            formatted = []
            for i, r in enumerate(results, 1):
                title = r.get("title", "No title")
                body = r.get("body", "No description")
                href = r.get("href", "")
                formatted.append(f"{i}. {title}\n   {body}\n   URL: {href}")
            return "\n\n".join(formatted)
        except Exception as e:
            logger.error(f"Web search failed: {e}")
            return f"Search failed: {e}"

    return dspy.Tool(
        func=web_search,
        name="web_search",
        desc=(
            "Search the web for external information (READ-ONLY research tool). "
            "Use for: researching businesses, finding examples, understanding industry practices, "
            "gathering requirements. "
            "DO NOT use results as direct implementation — use Emery capability tools "
            "(schema_builder, app_builder, etc.) to build based on research findings."
        ),
        arg_desc={
            "query": "Search query string (e.g., 'CRM best practices', 'competitor company overview')",
            "max_results": "Maximum results to return (default: 5, max: 10)",
        },
    )


def create_discovery_tools(
    api_key: str,
    org_id: str,
    capability_registry: "CapabilityRegistry | None" = None,
) -> list[dspy.Tool]:
    """
    Create all discovery tools with auth captured.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context
        capability_registry: Optional registry for capability search

    Returns:
        List of dspy.Tool instances for discovery operations
    """
    tools: list[dspy.Tool] = [
        create_system_research_dspy_tool(api_key, org_id),
        create_workspace_overview_tool(api_key, org_id),
        create_external_search_tool(),
    ]

    if capability_registry:
        tools.append(create_capability_search_tool(capability_registry))

    # Add web search (DuckDuckGo — read-only research tool)
    tools.append(create_web_search_tool())

    logger.info(f"Created {len(tools)} discovery tools")
    return tools
