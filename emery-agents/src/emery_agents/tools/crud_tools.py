"""
CRUD Tools Module

AIDEV-NOTE: Comprehensive CRUD tools for Emery organization data management.
Provides create, read, update, delete, and list operations for agents, documents,
files, tables, and teams. Uses internal authentication and calls emery-api with RLS context.
"""

import os
import json
import httpx
from typing import Any, Dict, Optional
from smolagents import Tool
from ..grpc.generated.agent_worker_pb2 import ToolConfig


class BaseCrudTool(Tool):
    """Base class for all CRUD tools with common functionality."""

    def __init__(self, resource_type: str, method: str):
        super().__init__()
        self.resource_type = resource_type
        self.method = method
        # AIDEV-NOTE: Use emery-api base URL from environment, fallback to development default
        self.base_url = os.getenv("EMERY_API_BASE_URL", "http://localhost:3000/api")

    def _make_api_request(self, endpoint: str, method: str = "GET", data: Optional[Dict] = None,
                         auth_token: Optional[str] = None, organization_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Make authenticated API request to emery-api with RLS context.

        Args:
            endpoint: API endpoint path
            method: HTTP method (GET, POST, PUT, DELETE)
            data: Request body data for POST/PUT
            auth_token: Internal API authentication token
            organization_id: Organization ID for RLS context

        Returns:
            API response as dictionary
        """
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {}

        # AIDEV-NOTE: Add internal authentication header
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        # AIDEV-NOTE: Add organization context for RLS (Row Level Security)
        if organization_id:
            headers["X-Organization-ID"] = str(organization_id)

        # Add content type for JSON requests
        if data is not None:
            headers["Content-Type"] = "application/json"

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=data if data else None
                )

                # Handle HTTP errors
                if response.status_code >= 400:
                    error_detail = f"HTTP {response.status_code}"
                    try:
                        error_body = response.json()
                        if "error" in error_body:
                            error_detail = error_body["error"]
                        elif "message" in error_body:
                            error_detail = error_body["message"]
                    except:
                        error_detail = response.text[:200] if response.text else error_detail

                    return {
                        "success": False,
                        "error": f"API request failed: {error_detail}",
                        "status_code": response.status_code
                    }

                # Parse JSON response
                try:
                    return {
                        "success": True,
                        "data": response.json(),
                        "status_code": response.status_code
                    }
                except json.JSONDecodeError:
                    return {
                        "success": True,
                        "data": response.text,
                        "status_code": response.status_code
                    }

        except httpx.TimeoutException:
            return {
                "success": False,
                "error": f"Request timeout after 30 seconds",
                "endpoint": endpoint
            }
        except httpx.RequestError as e:
            return {
                "success": False,
                "error": f"Request error: {str(e)}",
                "endpoint": endpoint
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}",
                "endpoint": endpoint
            }


def load_agent_crud(config: ToolConfig) -> Any:
    """Load Agent CRUD tool with method-specific routing."""

    class AgentCrudTool(BaseCrudTool):
        """CRUD operations for Emery agents."""

        name = "agent_crud"
        description = "Create, read, update, delete, and list agents in your organization. Requires authentication and organization context."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "agent_id": {"type": "string", "description": "Agent ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Agent data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("agent", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   agent_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute agent CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Agent data is required for create operation"}

                return self._make_api_request(
                    endpoint="agents",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not agent_id:
                    return {"success": False, "error": "Agent ID is required for read operation"}

                return self._make_api_request(
                    endpoint=f"agents/{agent_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not agent_id:
                    return {"success": False, "error": "Agent ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Agent data is required for update operation"}

                return self._make_api_request(
                    endpoint=f"agents/{agent_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not agent_id:
                    return {"success": False, "error": "Agent ID is required for delete operation"}

                return self._make_api_request(
                    endpoint=f"agents/{agent_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "agents"
                if filters:
                    # Convert filters to query parameters
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return AgentCrudTool()


def load_document_crud(config: ToolConfig) -> Any:
    """Load Document CRUD tool with method-specific routing."""

    class DocumentCrudTool(BaseCrudTool):
        """CRUD operations for Emery documents."""

        name = "document_crud"
        description = "Create, read, update, delete, and list documents in your organization. Supports document content management and metadata operations."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "document_id": {"type": "string", "description": "Document ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Document data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("document", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   document_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute document CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Document data is required for create operation"}

                return self._make_api_request(
                    endpoint="documents",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not document_id:
                    return {"success": False, "error": "Document ID is required for read operation"}

                return self._make_api_request(
                    endpoint=f"documents/{document_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not document_id:
                    return {"success": False, "error": "Document ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Document data is required for update operation"}

                return self._make_api_request(
                    endpoint=f"documents/{document_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not document_id:
                    return {"success": False, "error": "Document ID is required for delete operation"}

                return self._make_api_request(
                    endpoint=f"documents/{document_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "documents"
                if filters:
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return DocumentCrudTool()


def load_file_crud(config: ToolConfig) -> Any:
    """Load File CRUD tool with method-specific routing."""

    class FileCrudTool(BaseCrudTool):
        """CRUD operations for Emery files."""

        name = "file_crud"
        description = "Create, read, update, delete, and list files in your organization. Supports file upload, download, and metadata management."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "file_id": {"type": "string", "description": "File ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "File data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("file", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   file_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute file CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "File data is required for create operation"}

                return self._make_api_request(
                    endpoint="files",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not file_id:
                    return {"success": False, "error": "File ID is required for read operation"}

                return self._make_api_request(
                    endpoint=f"files/{file_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not file_id:
                    return {"success": False, "error": "File ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "File data is required for update operation"}

                return self._make_api_request(
                    endpoint=f"files/{file_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not file_id:
                    return {"success": False, "error": "File ID is required for delete operation"}

                return self._make_api_request(
                    endpoint=f"files/{file_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "files"
                if filters:
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return FileCrudTool()


def load_table_crud(config: ToolConfig) -> Any:
    """Load Table CRUD tool with method-specific routing."""

    class TableCrudTool(BaseCrudTool):
        """CRUD operations for Emery tables."""

        name = "table_crud"
        description = "Create, read, update, delete, and list tables in your organization. Supports dynamic table schema management and data operations."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "table_id": {"type": "string", "description": "Table ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Table data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("table", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   table_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute table CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Table data is required for create operation"}

                return self._make_api_request(
                    endpoint="tables",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not table_id:
                    return {"success": False, "error": "Table ID is required for read operation"}

                return self._make_api_request(
                    endpoint=f"tables/{table_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not table_id:
                    return {"success": False, "error": "Table ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Table data is required for update operation"}

                return self._make_api_request(
                    endpoint=f"tables/{table_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not table_id:
                    return {"success": False, "error": "Table ID is required for delete operation"}

                return self._make_api_request(
                    endpoint=f"tables/{table_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "tables"
                if filters:
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return TableCrudTool()


def load_team_crud(config: ToolConfig) -> Any:
    """Load Team CRUD tool with method-specific routing."""

    class TeamCrudTool(BaseCrudTool):
        """CRUD operations for Emery teams."""

        name = "team_crud"
        description = "Create, read, update, delete, and list teams in your organization. Supports team membership and permission management."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "team_id": {"type": "string", "description": "Team ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Team data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("team", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   team_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute team CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Team data is required for create operation"}

                return self._make_api_request(
                    endpoint="teams",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not team_id:
                    return {"success": False, "error": "Team ID is required for read operation"}

                return self._make_api_request(
                    endpoint=f"teams/{team_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not team_id:
                    return {"success": False, "error": "Team ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Team data is required for update operation"}

                return self._make_api_request(
                    endpoint=f"teams/{team_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not team_id:
                    return {"success": False, "error": "Team ID is required for delete operation"}

                return self._make_api_request(
                    endpoint=f"teams/{team_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "teams"
                if filters:
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return TeamCrudTool()


def load_database_crud(config: ToolConfig) -> Any:
    """Load Database CRUD tool with method-specific routing."""

    class DatabaseCrudTool(BaseCrudTool):
        """CRUD operations for Emery databases."""

        name = "database_crud"
        description = "Create, read, update, delete, and list databases in your organization. Supports database configuration and connection management."
        inputs = {
            "method": {"type": "string", "description": "CRUD operation: create, read, update, delete, list"},
            "database_id": {"type": "string", "description": "Database ID for read, update, delete operations", "nullable": True},
            "data": {"type": "object", "description": "Database data for create and update operations", "nullable": True},
            "filters": {"type": "object", "description": "Filter criteria for list operation", "nullable": True},
            "auth_token": {"type": "string", "description": "Internal API authentication token"},
            "organization_id": {"type": "string", "description": "Organization ID for RLS context"}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("database", "crud")

        def forward(self, method: str, auth_token: str, organization_id: str,
                   database_id: Optional[str] = None, data: Optional[Dict] = None,
                   filters: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute database CRUD operation."""

            if method == "create":
                if not data:
                    return {"success": False, "error": "Database data is required for create operation"}

                return self._make_api_request(
                    endpoint="databases",
                    method="POST",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "read":
                if not database_id:
                    return {"success": False, "error": "Database ID is required for read operation"}

                return self._make_api_request(
                    endpoint=f"databases/{database_id}",
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "update":
                if not database_id:
                    return {"success": False, "error": "Database ID is required for update operation"}
                if not data:
                    return {"success": False, "error": "Database data is required for update operation"}

                return self._make_api_request(
                    endpoint=f"databases/{database_id}",
                    method="PUT",
                    data=data,
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "delete":
                if not database_id:
                    return {"success": False, "error": "Database ID is required for delete operation"}

                return self._make_api_request(
                    endpoint=f"databases/{database_id}",
                    method="DELETE",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            elif method == "list":
                endpoint = "databases"
                if filters:
                    query_params = []
                    for key, value in filters.items():
                        query_params.append(f"{key}={value}")
                    if query_params:
                        endpoint += "?" + "&".join(query_params)

                return self._make_api_request(
                    endpoint=endpoint,
                    method="GET",
                    auth_token=auth_token,
                    organization_id=organization_id
                )

            else:
                return {"success": False, "error": f"Unknown method: {method}. Supported: create, read, update, delete, list"}

    return DatabaseCrudTool()


# Registry of CRUD tools
CRUD_TOOLS = {
    "agent_crud": load_agent_crud,
    "document_crud": load_document_crud,
    "file_crud": load_file_crud,
    "table_crud": load_table_crud,
    "team_crud": load_team_crud,
    "database_crud": load_database_crud,
}