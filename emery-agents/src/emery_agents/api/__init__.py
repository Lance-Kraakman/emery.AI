"""
Outbound HTTP API layer.

All outbound HTTP data access lives here, parallel to grpc/ for inbound.
Provides both sync (make_request) and async (httpx.AsyncClient) API patterns.
"""

from .agent_api import AgentAPI, AgentAPIService, fetch_agent_by_id_sync
from .app_api import App, AppAPI
from .database_api import Database, DatabaseAPI
from .http_client import (
    HTTPClient,
    get_base_url,
    get_http_client,
    make_request,
    unwrap_entity,
)
from .row_api import RowAPI
from .skill_api import SkillAPI, SkillAPIService
from .table_api import Table, TableAPI
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
