"""Unified Workspace API - single call for all workspace resources."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..http_client import make_request

logger = logging.getLogger(__name__)


@dataclass
class WorkspacePage:
    """Page within an app."""
    id: int
    name: str
    slug: str


@dataclass
class WorkspaceApp:
    """App with its pages."""
    id: int
    name: str
    slug: str
    description: str = ""
    pages: List[WorkspacePage] = field(default_factory=list)


@dataclass
class WorkspaceAgent:
    """Agent entity."""
    id: int
    name: str
    description: str = ""


@dataclass
class WorkspaceSkill:
    """Skill entity."""
    id: int
    name: str
    description: str = ""
    agent_id: Optional[int] = None
    agent_name: Optional[str] = None


@dataclass
class WorkspaceTable:
    """Table within a database."""
    id: int
    name: str
    field_count: int = 0


@dataclass
class WorkspaceDatabase:
    """Database with its tables."""
    id: int
    name: str
    tables: List[WorkspaceTable] = field(default_factory=list)


@dataclass
class WorkspaceView:
    """Data view entity."""
    id: int
    name: str
    table_id: int
    view_type: str = "grid"


@dataclass
class WorkspaceData:
    """Complete workspace data from unified endpoint."""
    apps: List[WorkspaceApp] = field(default_factory=list)
    agents: List[WorkspaceAgent] = field(default_factory=list)
    skills: List[WorkspaceSkill] = field(default_factory=list)
    databases: List[WorkspaceDatabase] = field(default_factory=list)
    views: List[WorkspaceView] = field(default_factory=list)


class WorkspaceAPI:
    """Unified workspace API - single call for all resources.

    Fetches complete workspace context in one API call:
    - Apps (with pages)
    - Agents
    - Skills
    - Databases (with tables)
    - Views

    Usage:
        api = WorkspaceAPI(api_key, org_id)
        workspace = api.get_all()
        print(f"Found {len(workspace.apps)} apps")
    """

    def __init__(self, api_key: str, org_id: str):
        self._api_key = api_key
        self._org_id = org_id

    def get_all(self) -> WorkspaceData:
        """Fetch complete workspace context in one call.

        Returns:
            WorkspaceData containing all workspace resources
        """
        result = make_request(
            endpoint="workspace",
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            logger.warning(f"Workspace API failed: {result}")
            return WorkspaceData()

        try:
            response = json.loads(result)
            data = response.get("data", {})

            return WorkspaceData(
                apps=self._parse_apps(data.get("apps", [])),
                agents=self._parse_agents(data.get("agents", [])),
                skills=self._parse_skills(data.get("skills", [])),
                databases=self._parse_databases(data.get("databases", [])),
                views=self._parse_views(data.get("views", [])),
            )

        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Workspace parse failed: {e}")
            return WorkspaceData()

    def _parse_apps(self, apps_data: List[Dict[str, Any]]) -> List[WorkspaceApp]:
        """Parse apps with their pages."""
        apps = []
        for app in apps_data:
            pages = [
                WorkspacePage(
                    id=p.get("id", 0),
                    name=p.get("name", ""),
                    slug=p.get("slug", ""),
                )
                for p in app.get("pages", [])
            ]
            apps.append(WorkspaceApp(
                id=app.get("id", 0),
                name=app.get("name", ""),
                slug=app.get("slug", ""),
                description=app.get("description", ""),
                pages=pages,
            ))
        return apps

    def _parse_agents(self, agents_data: List[Dict[str, Any]]) -> List[WorkspaceAgent]:
        """Parse agents."""
        return [
            WorkspaceAgent(
                id=a.get("id", 0),
                name=a.get("name", ""),
                description=a.get("description", ""),
            )
            for a in agents_data
        ]

    def _parse_skills(self, skills_data: List[Dict[str, Any]]) -> List[WorkspaceSkill]:
        """Parse skills."""
        return [
            WorkspaceSkill(
                id=s.get("id", 0),
                name=s.get("name", ""),
                description=s.get("description", ""),
                agent_id=s.get("agentId"),
                agent_name=s.get("agentName"),
            )
            for s in skills_data
        ]

    def _parse_databases(self, databases_data: List[Dict[str, Any]]) -> List[WorkspaceDatabase]:
        """Parse databases with their tables."""
        databases = []
        for db in databases_data:
            tables = [
                WorkspaceTable(
                    id=t.get("id", 0),
                    name=t.get("name", ""),
                    field_count=t.get("fieldCount", 0),
                )
                for t in db.get("tables", [])
            ]
            databases.append(WorkspaceDatabase(
                id=db.get("id", 0),
                name=db.get("name", ""),
                tables=tables,
            ))
        return databases

    def _parse_views(self, views_data: List[Dict[str, Any]]) -> List[WorkspaceView]:
        """Parse views."""
        return [
            WorkspaceView(
                id=v.get("id", 0),
                name=v.get("name", ""),
                table_id=v.get("tableId", 0),
                view_type=v.get("viewType", "grid"),
            )
            for v in views_data
        ]
