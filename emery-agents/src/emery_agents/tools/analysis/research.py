"""
System Research Tool for ResearchEmery agent.

Ported from tools/system_research_tool.py - removes smolagents.Tool dependency.

Unified introspection tool for querying Emery platform resources.
READ-ONLY operations only - safe for planning phase.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from emery_agents.api.http_client import make_request

logger = logging.getLogger(__name__)


class SystemResearchTool:
    """
    System introspection tool for researching Emery platform resources.

    READ-ONLY tool. All operations are safe for the planning phase.

    Attributes:
        name: Tool name for LLM
        description: Tool description for LLM
        inputs: Dict mapping input name to {type, description}
        output_type: Output type
    """

    name = "system_research"
    description = """Research Emery platform resources. READ-ONLY.

Resource types:
- organization: Get current organization info (id, name, mission, plan, model settings)
- agents: Find agents by name/role, get agent details (id, name, role, automations)
- skills: Find skills, get instructions/config (id, name, instructions, inputs, outputs)
- tasks: Query task history, get logs/results (id, status, result, logs)
- databases: List databases, get database details (id, name, slug)
- tables: List tables, get schema/fields (id, name, fields)
- apps: List apps, get pages/config (id, name, slug, pages)
- pages: Get page by ID with content (id, name, templateData), or list pages in app
- audit: Query audit events, get resource trails (eventType, resource, actor, timestamp)

Examples:
- Get organization info: system_research(resource_type="organization")
- List all agents: system_research(resource_type="agents")
- Find skill by name: system_research(resource_type="skills", query="summarize")
- Recent tasks: system_research(resource_type="tasks", filters={"limit": 10})
- Task by ID: system_research(resource_type="tasks", query="task-uuid-here")
- List databases: system_research(resource_type="databases")
- Get database by ID: system_research(resource_type="databases", query="5")
- Audit for skill: system_research(resource_type="audit", filters={"resourceType": "skill", "resourceId": "15"})
- Tables in database: system_research(resource_type="tables")
- Page content: system_research(resource_type="pages", query="22", include_details=True)
- Pages in app: system_research(resource_type="pages", filters={"app_id": 15})
"""

    inputs = {
        "resource_type": {
            "type": "string",
            "description": "Type to research: 'organization', 'agents', 'skills', 'tasks', 'databases', 'tables', 'apps', 'pages', 'audit'",
        },
        "query": {
            "type": "string",
            "description": "Resource ID or search term. For tasks use the task UUID.",
            "nullable": True,
        },
        "filters": {
            "type": "object",
            "description": "Filter options: limit (int), status (string), agent_id (int), resourceType (string), resourceId (string)",
            "nullable": True,
        },
        "include_details": {
            "type": "boolean",
            "description": "Include full details vs summary view (default: False)",
            "nullable": True,
        },
    }
    output_type = "object"

    def __init__(self, auth_token: str, org_id: str) -> None:
        self._auth_token = auth_token
        self._org_id = org_id

    def __call__(self, **kwargs: Any) -> dict[str, Any]:
        """Make the tool callable for DSPy ReAct."""
        return self.forward(**kwargs)

    def forward(
        self,
        resource_type: str,
        query: str | None = None,
        filters: dict[str, Any] | None = None,
        include_details: bool | None = None,
    ) -> dict[str, Any]:
        """Execute system research query. READ-ONLY operation."""
        resource_type = resource_type.lower()
        filters = filters or {}
        include_details = include_details or False

        logger.info(
            f"[SYSTEM_RESEARCH] Querying {resource_type} with query={query}, filters={filters}"
        )

        handlers = {
            "organization": lambda: self._research_organization(include_details),
            "agents": lambda: self._research_agents(query, filters, include_details),
            "skills": lambda: self._research_skills(query, filters, include_details),
            "tasks": lambda: self._research_tasks(query, filters, include_details),
            "databases": lambda: self._research_databases(
                query, filters, include_details
            ),
            "tables": lambda: self._research_tables(query, filters, include_details),
            "apps": lambda: self._research_apps(query, filters, include_details),
            "pages": lambda: self._research_pages(query, filters, include_details),
            "audit": lambda: self._research_audit(query, filters, include_details),
        }

        handler = handlers.get(resource_type)
        if handler:
            return handler()

        return {
            "success": False,
            "error": f"Unknown resource type: '{resource_type}'. "
            f"Supported types: organization, agents, skills, tasks, databases, tables, apps, pages, audit",
        }

    def _parse_response(self, response: str) -> dict[str, Any]:
        """Parse API response string to dict."""
        if response.startswith("ERROR"):
            return {"success": False, "error": response}
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"success": False, "error": f"Invalid response: {response[:200]}"}

    def _research_organization(self, include_details: bool) -> dict[str, Any]:
        """Research current organization."""
        endpoint = "organizations"
        params: list[str] = []
        if include_details:
            params.append("meta=1")
        if params:
            endpoint += "?" + "&".join(params)

        result = make_request(
            endpoint=endpoint,
            method="GET",
            data=None,
            auth_token=self._auth_token,
            org_id=self._org_id,
        )
        return self._parse_response(result)

    def _research_agents(
        self,
        query: str | None,
        filters: dict[str, Any],
        include_details: bool,
    ) -> dict[str, Any]:
        """Research agents - list or get by ID."""
        if query and query.isdigit():
            result = make_request(
                endpoint=f"agents/{query}",
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        else:
            endpoint = "agents"
            params = []
            if query:
                params.append(f"search={query}")
            if filters.get("status"):
                params.append(f"status={filters['status']}")
            if filters.get("limit"):
                params.append(f"limit={filters['limit']}")
            if params:
                endpoint += "?" + "&".join(params)

            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        return self._parse_response(result)

    def _research_skills(
        self,
        query: str | None,
        filters: dict[str, Any],
        include_details: bool,
    ) -> dict[str, Any]:
        """Research skills - list or get by ID."""
        if query and query.isdigit():
            result = make_request(
                endpoint=f"skills/{query}",
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        else:
            endpoint = "skills"
            params = []
            if filters.get("agent_id"):
                params.append(f"agentId={filters['agent_id']}")
            if filters.get("limit"):
                params.append(f"limit={filters['limit']}")
            if query:
                params.append(f"search={query}")
            if params:
                endpoint += "?" + "&".join(params)

            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        return self._parse_response(result)

    def _research_tasks(
        self,
        query: str | None,
        filters: dict[str, Any],
        include_details: bool,
    ) -> dict[str, Any]:
        """Research task history - list or get by ID."""
        if query:
            result = make_request(
                endpoint=f"tasks/{query}",
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        else:
            endpoint = "tasks"
            params = []
            if filters.get("status"):
                params.append(f"status={filters['status']}")
            if filters.get("agent_id"):
                params.append(f"agentId={filters['agent_id']}")
            if filters.get("limit"):
                params.append(f"limit={filters['limit']}")
            else:
                params.append("limit=20")
            if params:
                endpoint += "?" + "&".join(params)

            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        return self._parse_response(result)

    def _research_databases(
        self,
        query: str | None,
        filters: dict[str, Any],
        include_details: bool,
    ) -> dict[str, Any]:
        """Research databases - list or get by ID."""
        if query and query.isdigit():
            endpoint = f"databases/{query}"
            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        else:
            endpoint = "databases"
            if filters.get("limit"):
                endpoint += f"?limit={filters['limit']}"
            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        return self._parse_response(result)

    def _research_tables(
        self,
        query: str | None,
        filters: dict[str, Any],
        include_details: bool,
    ) -> dict[str, Any]:
        """Research tables - list or get schema by ID."""
        if query and query.isdigit():
            endpoint = f"tables/{query}"
            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        else:
            endpoint = "tables"
            if filters.get("database_id"):
                endpoint += f"?databaseId={filters['database_id']}"
            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        return self._parse_response(result)

    def _research_apps(
        self,
        query: str | None,
        filters: dict[str, Any],
        include_details: bool,
    ) -> dict[str, Any]:
        """Research apps - list or get by ID."""
        if query and query.isdigit():
            endpoint = f"apps/{query}"
            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        else:
            endpoint = "apps"
            if filters.get("limit"):
                endpoint += f"?limit={filters['limit']}"
            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        return self._parse_response(result)

    def _research_pages(
        self,
        query: str | None,
        filters: dict[str, Any],
        include_details: bool,
    ) -> dict[str, Any]:
        """Research pages - get by ID with content, or list pages in an app."""
        if query and query.isdigit():
            endpoint = f"pages/{query}"
            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        else:
            app_id = filters.get("app_id")
            if not app_id:
                return {
                    "success": False,
                    "error": "app_id filter required to list pages. Example: filters={'app_id': 15}",
                }
            endpoint = f"apps/{app_id}/pages"
            if filters.get("limit"):
                endpoint += f"?limit={filters['limit']}"
            result = make_request(
                endpoint=endpoint,
                method="GET",
                data=None,
                auth_token=self._auth_token,
                org_id=self._org_id,
            )
        return self._parse_response(result)

    def _research_audit(
        self,
        query: str | None,
        filters: dict[str, Any],
        include_details: bool,
    ) -> dict[str, Any]:
        """Research audit events - query with filters."""
        endpoint = "audit"
        params: list[str] = []

        if include_details:
            params.append("meta=1")

        if filters.get("resourceType"):
            params.append(f"resourceType={filters['resourceType']}")
        if filters.get("resourceId"):
            params.append(f"resourceId={filters['resourceId']}")
        if filters.get("eventType"):
            params.append(f"eventType={filters['eventType']}")
        if filters.get("eventCategory"):
            params.append(f"eventCategory={filters['eventCategory']}")
        if filters.get("actorId"):
            params.append(f"actorId={filters['actorId']}")
        if filters.get("limit"):
            params.append(f"limit={filters['limit']}")
        else:
            params.append("limit=50")

        if params:
            endpoint += "?" + "&".join(params)

        result = make_request(
            endpoint=endpoint,
            method="GET",
            data=None,
            auth_token=self._auth_token,
            org_id=self._org_id,
        )
        return self._parse_response(result)


def create_system_research_tool(
    api_key: str | None = None,
    organization_id: int | None = None,
) -> SystemResearchTool:
    """
    Create system research tool with auth context.

    Args:
        api_key: API key for authenticated requests
        organization_id: Organization context for RLS

    Returns:
        Configured SystemResearchTool instance
    """
    auth_token = api_key or ""
    org_id = str(organization_id) if organization_id else ""
    return SystemResearchTool(auth_token=auth_token, org_id=org_id)
