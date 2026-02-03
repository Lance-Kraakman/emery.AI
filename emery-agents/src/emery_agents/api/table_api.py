"""Typed Table API - shared by tools and services."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field as dataclass_field
from typing import Any, Dict, List, Optional

from .http_client import make_request, unwrap_entity

logger = logging.getLogger(__name__)


@dataclass
class Table:
    """Table entity."""

    id: int
    name: str
    database_id: Optional[int] = None
    description: str = ""
    field_count: int = 0
    fields: List[Any] = dataclass_field(default_factory=list)
    slug: str = ""


class TableAPI:
    """Typed API for table operations.

    Usage:
        api = TableAPI(api_key, org_id)
        tables = api.list()
        tables = api.list(database_id=123)
        table = api.get(456)
    """

    def __init__(self, api_key: str, org_id: str, extra_headers: dict[str, str] | None = None):
        self._api_key = api_key
        self._org_id = org_id
        self._extra_headers = extra_headers

    def list(
        self,
        database_id: Optional[int] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Table]:
        """List tables, optionally filtered by database.

        Args:
            database_id: Optional database ID filter
            filters: Additional filter criteria

        Returns:
            List of Table objects
        """
        endpoint = "tables"
        params = []
        if database_id:
            params.append(f"databaseId={database_id}")
        if filters:
            params.extend(f"{key}={value}" for key, value in filters.items())
        if params:
            endpoint += "?" + "&".join(params)

        result = make_request(
            endpoint=endpoint,
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
            extra_headers=self._extra_headers,
        )

        if result.startswith("ERROR"):
            logger.debug(f"Table list failed: {result}")
            return []

        try:
            data = json.loads(result)
            return [
                Table(
                    id=t["id"],
                    name=t.get("name", ""),
                    database_id=t.get("databaseId"),
                    description=t.get("description", ""),
                    field_count=len(t.get("fields", [])),
                    fields=t.get("fields", []),
                    slug=t.get("slug", ""),
                )
                for t in data.get("data", [])
            ]
        except (json.JSONDecodeError, KeyError) as e:
            logger.debug(f"Table parse failed: {e}")
            return []

    def get(self, table_id: int) -> Optional[Table]:
        """Get table by ID.

        Args:
            table_id: Table ID

        Returns:
            Table object or None if not found
        """
        result = make_request(
            endpoint=f"tables/{table_id}",
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
            logger.warning(f"Table get: failed to parse response: {result[:200]}")
            return None

        try:
            return Table(
                id=entity["id"],
                name=entity.get("name", ""),
                database_id=entity.get("databaseId"),
                description=entity.get("description", ""),
                field_count=len(entity.get("fields", [])),
                fields=entity.get("fields", []),
                slug=entity.get("slug", ""),
            )
        except KeyError as e:
            logger.warning(f"Table get: missing field {e}: {result[:200]}")
            return None

    def create(
        self, name: str, database_id: int, description: str = ""
    ) -> Optional[Table]:
        """Create table.

        Args:
            name: Table name
            database_id: Parent database ID
            description: Optional description

        Returns:
            Created Table or None on failure
        """
        result = make_request(
            endpoint="tables",
            method="POST",
            data={
                "name": name,
                "databaseId": database_id,
                "description": description,
            },
            auth_token=self._api_key,
            org_id=self._org_id,
            extra_headers=self._extra_headers,
        )

        if result.startswith("ERROR"):
            logger.debug(f"Table create failed: {result}")
            return None

        entity = unwrap_entity(result)
        if entity is None:
            logger.warning(f"Table create: failed to parse response: {result[:200]}")
            return None

        try:
            return Table(
                id=entity["id"],
                name=entity.get("name", name),
                database_id=entity.get("databaseId", database_id),
                description=entity.get("description", description),
            )
        except KeyError as e:
            logger.warning(f"Table create: missing field {e}: {result[:200]}")
            return None

    def update(self, table_id: int, data: Dict[str, Any]) -> Optional[Table]:
        """Update table.

        Args:
            table_id: Table ID
            data: Update data (name, description, metadata)

        Returns:
            Updated Table or None on failure
        """
        result = make_request(
            endpoint=f"tables/{table_id}",
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
            logger.warning(f"Table update: failed to parse response: {result[:200]}")
            return None

        try:
            return Table(
                id=entity["id"],
                name=entity.get("name", ""),
                database_id=entity.get("databaseId"),
                description=entity.get("description", ""),
            )
        except KeyError as e:
            logger.warning(f"Table update: missing field {e}: {result[:200]}")
            return None

    def delete(self, table_id: int) -> bool:
        """Delete table.

        Args:
            table_id: Table ID

        Returns:
            True on success, False on failure
        """
        result = make_request(
            endpoint=f"tables/{table_id}",
            method="DELETE",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
            extra_headers=self._extra_headers,
        )

        return not result.startswith("ERROR")
