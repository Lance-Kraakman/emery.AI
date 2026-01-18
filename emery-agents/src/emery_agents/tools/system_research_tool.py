"""
System Research Tool for ResearchEmery agent.

Unified introspection tool for querying Emery platform resources.
READ-ONLY operations only - safe for planning phase.

AIDEV-NOTE: This tool provides system introspection capabilities for the
ResearchEmery agent. It queries internal platform resources (agents, skills,
tasks, tables, apps, audit) to help with planning and understanding the system.

AIDEV-NOTE: This tool is READ-ONLY and does not need mutation checks.
All operations are safe for the planning phase.
"""

import logging
from typing import Any, Dict, Optional

from smolagents import Tool

from .crud_tools import BaseCrudTool

logger = logging.getLogger(__name__)


def create_system_research_tool(
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Create system research tool with auth context in closure.

    This tool provides unified access to Emery platform resources:
    - organization: Get current organization info (name, mission, plan, settings)
    - agents: Find agents by name/role, get agent details
    - skills: Find skills, get instructions/config
    - tasks: Query task history, get logs/results
    - tables: List tables, get schema/fields
    - apps: List apps, get pages/config
    - audit: Query audit events, get resource trails

    Args:
        api_key: API key for authenticated requests
        organization_id: Organization context for RLS

    Returns:
        Configured SystemResearchTool instance
    """
    # CRITICAL: Capture auth in closure - NOT exposed in inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class SystemResearchTool(BaseCrudTool):
        """
        System introspection tool for researching Emery platform resources.

        AIDEV-NOTE: This is a READ-ONLY tool. All operations are safe for
        the planning phase and do not require HITL approval.
        """

        name = "system_research"
        description = """Research Emery platform resources. READ-ONLY.

Resource types:
- organization: Get current organization info (id, name, mission, plan, model settings)
- agents: Find agents by name/role, get agent details (id, name, role, automations)
- skills: Find skills, get instructions/config (id, name, instructions, inputs, outputs)
- tasks: Query task history, get logs/results (id, status, result, logs)
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
- Audit for skill: system_research(resource_type="audit", filters={"resourceType": "skill", "resourceId": "15"})
- Tables in database: system_research(resource_type="tables")
- Page content: system_research(resource_type="pages", query="22", include_details=True)
- Pages in app: system_research(resource_type="pages", filters={"app_id": 15})
"""

        inputs = {
            "resource_type": {
                "type": "string",
                "description": "Type to research: 'organization', 'agents', 'skills', 'tasks', 'tables', 'apps', 'pages', 'audit'"
            },
            "query": {
                "type": "string",
                "description": "Resource ID or search term. For tasks use the task UUID.",
                "nullable": True
            },
            "filters": {
                "type": "object",
                "description": "Filter options: limit (int), status (string), agent_id (int), resourceType (string), resourceId (string)",
                "nullable": True
            },
            "include_details": {
                "type": "boolean",
                "description": "Include full details vs summary view (default: False)",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            super().__init__("system", "research")

        def forward(
            self,
            resource_type: str,
            query: Optional[str] = None,
            filters: Optional[Dict] = None,
            include_details: Optional[bool] = None
        ) -> Dict[str, Any]:
            """
            Execute system research query.

            This is a READ-ONLY operation - no mutation checks needed.
            """
            resource_type = resource_type.lower()
            filters = filters or {}
            include_details = include_details or False

            logger.info(f"[SYSTEM_RESEARCH] Querying {resource_type} with query={query}, filters={filters}")

            if resource_type == "organization":
                return self._research_organization(include_details)
            elif resource_type == "agents":
                return self._research_agents(query, filters, include_details)
            elif resource_type == "skills":
                return self._research_skills(query, filters, include_details)
            elif resource_type == "tasks":
                return self._research_tasks(query, filters, include_details)
            elif resource_type == "tables":
                return self._research_tables(query, filters, include_details)
            elif resource_type == "apps":
                return self._research_apps(query, filters, include_details)
            elif resource_type == "pages":
                return self._research_pages(query, filters, include_details)
            elif resource_type == "audit":
                return self._research_audit(query, filters, include_details)
            else:
                return {
                    "success": False,
                    "error": f"Unknown resource type: '{resource_type}'. "
                             f"Supported types: organization, agents, skills, tasks, tables, apps, pages, audit"
                }

        def _research_organization(
            self,
            include_details: bool
        ) -> Dict[str, Any]:
            """Research current organization - get org info (name, mission, plan, settings)."""
            endpoint = "organizations"
            params = ["format=llm"]
            if include_details:
                params.append("meta=1")
            if params:
                endpoint += "?" + "&".join(params)
            return self._make_api_request(
                endpoint=endpoint,
                method="GET",
                auth_token=_auth_token,
                organization_id=_org_id
            )

        def _research_agents(
            self,
            query: Optional[str],
            filters: Dict,
            include_details: bool
        ) -> Dict[str, Any]:
            """Research agents - list or get by ID."""
            if query and query.isdigit():
                # Get specific agent by ID
                return self._make_api_request(
                    endpoint=f"agents/{query}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                # List agents with optional search
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
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

        def _research_skills(
            self,
            query: Optional[str],
            filters: Dict,
            include_details: bool
        ) -> Dict[str, Any]:
            """Research skills - list or get by ID."""
            if query and query.isdigit():
                # Get specific skill by ID
                return self._make_api_request(
                    endpoint=f"skills/{query}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                # List skills with optional filters
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
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

        def _research_tasks(
            self,
            query: Optional[str],
            filters: Dict,
            include_details: bool
        ) -> Dict[str, Any]:
            """Research task history - list or get by ID."""
            if query:
                # Get specific task by UUID
                return self._make_api_request(
                    endpoint=f"tasks/{query}",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                # List tasks with filters
                endpoint = "tasks"
                params = []
                if filters.get("status"):
                    params.append(f"status={filters['status']}")
                if filters.get("agent_id"):
                    params.append(f"agentId={filters['agent_id']}")
                if filters.get("limit"):
                    params.append(f"limit={filters['limit']}")
                else:
                    params.append("limit=20")  # Default limit
                if params:
                    endpoint += "?" + "&".join(params)
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

        def _research_tables(
            self,
            query: Optional[str],
            filters: Dict,
            include_details: bool
        ) -> Dict[str, Any]:
            """Research tables - list or get schema by ID."""
            if query and query.isdigit():
                # Get specific table with schema
                format_param = "format=llm" if not include_details else ""
                endpoint = f"tables/{query}"
                if format_param:
                    endpoint += f"?{format_param}"
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                # List tables
                endpoint = "tables?format=llm"
                if filters.get("database_id"):
                    endpoint += f"&databaseId={filters['database_id']}"
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

        def _research_apps(
            self,
            query: Optional[str],
            filters: Dict,
            include_details: bool
        ) -> Dict[str, Any]:
            """Research apps - list or get by ID."""
            if query and query.isdigit():
                # Get specific app with pages
                format_param = "format=llm" if not include_details else ""
                endpoint = f"apps/{query}"
                if format_param:
                    endpoint += f"?{format_param}"
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                # List apps with TOON format
                endpoint = "apps?format=llm"
                if filters.get("limit"):
                    endpoint += f"&limit={filters['limit']}"
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

        def _research_pages(
            self,
            query: Optional[str],
            filters: Dict,
            include_details: bool
        ) -> Dict[str, Any]:
            """Research pages - get by ID with content, or list pages in an app."""
            if query and query.isdigit():
                # Get specific page by ID with templateData
                # Use include_details to get full content (templateData)
                if include_details:
                    # Full page data with templateData
                    endpoint = f"pages/{query}"
                else:
                    # Summary only (TOON format)
                    endpoint = f"pages/{query}?format=llm"
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                # List pages for an app
                app_id = filters.get("app_id")
                if not app_id:
                    return {
                        "success": False,
                        "error": "app_id filter required to list pages. Example: filters={'app_id': 15}"
                    }
                endpoint = f"apps/{app_id}/pages?format=llm"
                if filters.get("limit"):
                    endpoint += f"&limit={filters['limit']}"
                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

        def _research_audit(
            self,
            query: Optional[str],
            filters: Dict,
            include_details: bool
        ) -> Dict[str, Any]:
            """Research audit events - query with filters."""
            endpoint = "audit"
            params = []

            # Use TOON format for LLM-optimized responses (unless details requested)
            if not include_details:
                params.append("format=llm")
            else:
                params.append("format=llm")
                params.append("meta=1")

            # Apply filters
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
                params.append("limit=50")  # Default limit

            if params:
                endpoint += "?" + "&".join(params)

            return self._make_api_request(
                endpoint=endpoint,
                method="GET",
                auth_token=_auth_token,
                organization_id=_org_id
            )

    return SystemResearchTool()
