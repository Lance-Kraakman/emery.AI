"""
Outbound HTTP API layer.

All outbound HTTP data access lives here, parallel to grpc/ for inbound.
Provides both sync (make_request) and async (httpx.AsyncClient) API patterns.
"""

from .http_client import make_request, get_http_client, get_base_url, unwrap_entity, HTTPClient
from .database_api import DatabaseAPI, Database
from .table_api import TableAPI, Table
from .row_api import RowAPI
from .app_api import AppAPI, App
from .agent_api import AgentAPI, AgentAPIService, fetch_agent_by_id_sync
from .skill_api import SkillAPI, SkillAPIService
from .workspace_api import WorkspaceAPI

__all__ = [
    "make_request",
    "get_http_client",
    "get_base_url",
    "unwrap_entity",
    "HTTPClient",
    "DatabaseAPI",
    "Database",
    "TableAPI",
    "Table",
    "RowAPI",
    "AppAPI",
    "App",
    "AgentAPI",
    "AgentAPIService",
    "fetch_agent_by_id_sync",
    "SkillAPI",
    "SkillAPIService",
    "WorkspaceAPI",
]
