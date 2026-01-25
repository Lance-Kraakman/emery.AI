"""Typed App API - shared by tools and services."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field as dataclass_field
from typing import Any, Dict, List, Optional

from ..http_client import make_request

logger = logging.getLogger(__name__)


@dataclass
class App:
    """App entity."""

    id: int
    name: str
    description: str = ""
    slug: str = ""
    pages: List[Any] = dataclass_field(default_factory=list)


class AppAPI:
    """Typed API for app operations.

    Usage:
        api = AppAPI(api_key, org_id)
        apps = api.list()
        app = api.get(123)
    """

    def __init__(self, api_key: str, org_id: str):
        self._api_key = api_key
        self._org_id = org_id

    def list(self, filters: Optional[Dict[str, Any]] = None) -> List[App]:
        """List all apps.

        Args:
            filters: Optional filter criteria

        Returns:
            List of App objects
        """
        endpoint = "apps?format=llm"
        if filters:
            for key, value in filters.items():
                endpoint += f"&{key}={value}"

        result = make_request(
            endpoint=endpoint,
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            logger.debug(f"App list failed: {result}")
            return []

        try:
            data = json.loads(result)
            return [
                App(
                    id=app["id"],
                    name=app.get("name", ""),
                    description=app.get("description", ""),
                    slug=app.get("slug", ""),
                    pages=app.get("pages", []),
                )
                for app in data.get("data", [])
            ]
        except (json.JSONDecodeError, KeyError) as e:
            logger.debug(f"App parse failed: {e}")
            return []

    def get(self, app_id: int) -> Optional[App]:
        """Get app by ID.

        Args:
            app_id: App ID

        Returns:
            App object or None if not found
        """
        result = make_request(
            endpoint=f"apps/{app_id}",
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            return None

        try:
            app = json.loads(result)
            return App(
                id=app["id"],
                name=app.get("name", ""),
                description=app.get("description", ""),
                slug=app.get("slug", ""),
                pages=app.get("pages", []),
            )
        except (json.JSONDecodeError, KeyError):
            return None

    def create(self, name: str, description: str = "") -> Optional[App]:
        """Create app.

        Args:
            name: App name
            description: Optional description

        Returns:
            Created App or None on failure
        """
        result = make_request(
            endpoint="apps?format=llm",
            method="POST",
            data={"name": name, "description": description},
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            logger.debug(f"App create failed: {result}")
            return None

        try:
            app = json.loads(result)
            return App(
                id=app["id"],
                name=app.get("name", name),
                description=app.get("description", description),
            )
        except (json.JSONDecodeError, KeyError):
            return None

    def update(self, app_id: int, data: Dict[str, Any]) -> Optional[App]:
        """Update app.

        Args:
            app_id: App ID
            data: Update data

        Returns:
            Updated App or None on failure
        """
        result = make_request(
            endpoint=f"apps/{app_id}?format=llm",
            method="PUT",
            data=data,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            return None

        try:
            app = json.loads(result)
            return App(
                id=app["id"],
                name=app.get("name", ""),
                description=app.get("description", ""),
            )
        except (json.JSONDecodeError, KeyError):
            return None

    def delete(self, app_id: int) -> bool:
        """Delete app.

        Args:
            app_id: App ID

        Returns:
            True on success, False on failure
        """
        result = make_request(
            endpoint=f"apps/{app_id}?format=llm",
            method="DELETE",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        return not result.startswith("ERROR")
