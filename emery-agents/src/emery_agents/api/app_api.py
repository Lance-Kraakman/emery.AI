"""Typed App API - shared by tools and services."""

from __future__ import annotations

import builtins
import json
import logging
from dataclasses import dataclass
from dataclasses import field as dataclass_field
from typing import Any

from .http_client import make_request, unwrap_entity

logger = logging.getLogger(__name__)


@dataclass
class App:
    """App entity."""

    id: int
    name: str
    description: str = ""
    slug: str = ""
    pages: list[Any] = dataclass_field(default_factory=list)


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

    def list(self, filters: dict[str, Any] | None = None) -> builtins.list[App]:
        """List all apps.

        Args:
            filters: Optional filter criteria

        Returns:
            List of App objects
        """
        endpoint = "apps"
        if filters:
            params = "&".join(f"{key}={value}" for key, value in filters.items())
            endpoint += f"?{params}"

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

    def get(self, app_id: int) -> App | None:
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

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"App get: failed to parse response: {result[:200]}")
            return None

        try:
            return App(
                id=entity["id"],
                name=entity.get("name", ""),
                description=entity.get("description", ""),
                slug=entity.get("slug", ""),
                pages=entity.get("pages", []),
            )
        except KeyError as e:
            logger.warning(f"App get: missing field {e}: {result[:200]}")
            return None

    def create(self, name: str, description: str = "") -> App | None:
        """Create app.

        Args:
            name: App name
            description: Optional description

        Returns:
            Created App or None on failure
        """
        result = make_request(
            endpoint="apps",
            method="POST",
            data={"name": name, "description": description},
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            logger.debug(f"App create failed: {result}")
            return None

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"App create: failed to parse response: {result[:200]}")
            return None

        try:
            return App(
                id=entity["id"],
                name=entity.get("name", name),
                description=entity.get("description", description),
            )
        except KeyError as e:
            logger.warning(f"App create: missing field {e}: {result[:200]}")
            return None

    def update(self, app_id: int, data: dict[str, Any]) -> App | None:
        """Update app.

        Args:
            app_id: App ID
            data: Update data

        Returns:
            Updated App or None on failure
        """
        result = make_request(
            endpoint=f"apps/{app_id}",
            method="PUT",
            data=data,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        if result.startswith("ERROR"):
            return None

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"App update: failed to parse response: {result[:200]}")
            return None

        try:
            return App(
                id=entity["id"],
                name=entity.get("name", ""),
                description=entity.get("description", ""),
            )
        except KeyError as e:
            logger.warning(f"App update: missing field {e}: {result[:200]}")
            return None

    def delete(self, app_id: int) -> bool:
        """Delete app.

        Args:
            app_id: App ID

        Returns:
            True on success, False on failure
        """
        result = make_request(
            endpoint=f"apps/{app_id}",
            method="DELETE",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )

        return not result.startswith("ERROR")
