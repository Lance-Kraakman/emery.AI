"""Typed Database API - shared by tools and services."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .http_client import make_request, unwrap_entity

logger = logging.getLogger(__name__)


@dataclass
class Database:
    """Database entity."""

    id: int
    name: str
    description: str = ""
    table_count: int = 0
    slug: str = ""


class DatabaseAPI:
    """Typed API for database operations.

    Usage:
        api = DatabaseAPI(api_key, org_id)
        databases = api.list()
        db = api.get(123)
        new_db = api.create("My Database", "Description")
    """

    def __init__(self, api_key: str, org_id: str, extra_headers: dict[str, str] | None = None):
        self._api_key = api_key
        self._org_id = org_id
        self._extra_headers = extra_headers

    def list(self, filters: Optional[Dict[str, Any]] = None) -> List[Database]:
        """List all databases.

        Args:
            filters: Optional filter criteria

        Returns:
            List of Database objects
        """
        endpoint = "databases"
        if filters:
            params = "&".join(f"{key}={value}" for key, value in filters.items())
            endpoint += f"?{params}"

        result = make_request(
            endpoint=endpoint,
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
            extra_headers=self._extra_headers,
        )

        if result.startswith("ERROR"):
            logger.warning(f"Database list failed: {result}")
            return []

        try:
            data = json.loads(result)
            return [
                Database(
                    id=db["id"],
                    name=db.get("name", ""),
                    description=db.get("description", ""),
                    table_count=db.get("tableCount", 0),
                    slug=db.get("slug", ""),
                )
                for db in data.get("data", [])
            ]
        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Database parse failed: {e}, raw: {result[:200]}")
            return []

    def get(self, database_id: int) -> Optional[Database]:
        """Get database by ID.

        Args:
            database_id: Database ID

        Returns:
            Database object or None if not found
        """
        result = make_request(
            endpoint=f"databases/{database_id}",
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
            extra_headers=self._extra_headers,
        )

        if result.startswith("ERROR"):
            return None

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"Database get: failed to parse response: {result[:200]}")
            return None

        try:
            return Database(
                id=entity["id"],
                name=entity.get("name", ""),
                description=entity.get("description", ""),
                table_count=entity.get("tableCount", 0),
                slug=entity.get("slug", ""),
            )
        except KeyError as e:
            logger.warning(f"Database get: missing field {e}: {result[:200]}")
            return None

    def create(self, name: str, description: str = "") -> Optional[Database]:
        """Create database.

        Args:
            name: Database name
            description: Optional description

        Returns:
            Created Database or None on failure
        """
        result = make_request(
            endpoint="databases",
            method="POST",
            data={"name": name, "description": description},
            auth_token=self._api_key,
            org_id=self._org_id,
            extra_headers=self._extra_headers,
        )

        if result.startswith("ERROR"):
            logger.debug(f"Database create failed: {result}")
            return None

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"Database create: failed to parse response: {result[:200]}")
            return None

        try:
            return Database(
                id=entity["id"],
                name=entity.get("name", name),
                description=entity.get("description", description),
            )
        except KeyError as e:
            logger.warning(f"Database create: missing field {e}: {result[:200]}")
            return None

    def update(
        self, database_id: int, data: Dict[str, Any]
    ) -> Optional[Database]:
        """Update database.

        Args:
            database_id: Database ID
            data: Update data (name, description)

        Returns:
            Updated Database or None on failure
        """
        result = make_request(
            endpoint=f"databases/{database_id}",
            method="PUT",
            data=data,
            auth_token=self._api_key,
            org_id=self._org_id,
            extra_headers=self._extra_headers,
        )

        if result.startswith("ERROR"):
            return None

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"Database update: failed to parse response: {result[:200]}")
            return None

        try:
            return Database(
                id=entity["id"],
                name=entity.get("name", ""),
                description=entity.get("description", ""),
            )
        except KeyError as e:
            logger.warning(f"Database update: missing field {e}: {result[:200]}")
            return None

    def delete(self, database_id: int) -> bool:
        """Delete database.

        Args:
            database_id: Database ID

        Returns:
            True on success, False on failure
        """
        result = make_request(
            endpoint=f"databases/{database_id}",
            method="DELETE",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
            extra_headers=self._extra_headers,
        )

        return not result.startswith("ERROR")
