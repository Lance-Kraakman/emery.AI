"""Typed Row API - shared by tools and services."""

from __future__ import annotations

import json
import logging
from typing import Any

from .http_client import make_request

logger = logging.getLogger(__name__)


class RowAPI:
    """Typed API for row operations.

    Usage:
        api = RowAPI(api_key, org_id)
        rows = api.get_rows(table_id=1)
        row = api.get_row(table_id=1, row_id="abc")
        result = api.create_row(table_id=1, data={"name": "test"})
        result = api.upsert_row(table_id=1, data={...}, match_field_ids=[42, 55])
    """

    def __init__(self, api_key: str, org_id: str):
        self._api_key = api_key
        self._org_id = org_id

    @staticmethod
    def _clean_data(data: dict[str, Any]) -> dict[str, Any]:
        """Sanitize field values before sending to the API.

        - Strips None values (backend can't handle null for typed fields)
        - Coerces whole-number floats to int (e.g. 86.0 -> 86)
        """
        cleaned: dict[str, Any] = {}
        for k, v in data.items():
            if v is None:
                continue
            if isinstance(v, float) and v.is_integer():
                v = int(v)
            cleaned[k] = v
        return cleaned

    @staticmethod
    def _unwrap(result: str) -> dict[str, Any]:
        """Unwrap API response envelope, raise on error."""
        if result.startswith("ERROR") or result.startswith("PERMISSION_DENIED"):
            raise ValueError(result)
        try:
            parsed = json.loads(result)
            if isinstance(parsed, dict) and "data" in parsed:
                return parsed["data"]
            return parsed
        except (json.JSONDecodeError, TypeError):
            raise ValueError(f"Invalid API response: {result[:200]}")

    def create_row(self, table_id: int, data: dict[str, Any]) -> dict[str, Any]:
        """Create a new row.

        Args:
            table_id: Target table ID
            data: Field values {field_id_or_name: value, ...}

        Returns:
            Created row data
        """
        result = make_request(
            endpoint="rows",
            method="POST",
            data={
                "tableId": table_id,
                "data": self._clean_data(data),
                "dataKeyType": "id",
            },
            auth_token=self._api_key,
            org_id=self._org_id,
        )
        return self._unwrap(result)

    def update_row(
        self, table_id: int, row_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        """Update an existing row by ID.

        Args:
            table_id: Target table ID
            row_id: Row ID to update
            data: Field values to update

        Returns:
            Updated row data
        """
        result = make_request(
            endpoint="rows",
            method="PUT",
            data={
                "tableId": table_id,
                "rowId": row_id,
                "data": self._clean_data(data),
                "dataKeyType": "id",
            },
            auth_token=self._api_key,
            org_id=self._org_id,
        )
        return self._unwrap(result)

    def get_rows(
        self,
        table_id: int,
        filters: list[dict[str, Any]] | None = None,
        limit: int = 100,
        offset: int = 0,
        order_by: str | None = None,
        order_direction: str | None = None,
    ) -> list[dict[str, Any]]:
        """Query rows with optional filters.

        Args:
            table_id: Source table ID
            filters: Optional filter criteria [{field, operator, value}, ...]
            limit: Max rows to return
            offset: Pagination offset
            order_by: Field to sort by
            order_direction: ASC or DESC

        Returns:
            List of row dicts
        """
        params = [f"tableId={table_id}", f"limit={limit}", f"offset={offset}"]
        if order_by:
            params.append(f"orderBy={order_by}")
        if order_direction:
            params.append(f"orderDirection={order_direction}")
        if filters:
            params.append(f"filters={json.dumps(filters)}")

        endpoint = "rows?" + "&".join(params)
        result = make_request(
            endpoint=endpoint,
            method="GET",
            data=None,
            auth_token=self._api_key,
            org_id=self._org_id,
        )
        data = self._unwrap(result)
        if isinstance(data, dict):
            return data.get("rows", [])
        return data if isinstance(data, list) else []

    def get_row(self, table_id: int, row_id: str) -> dict[str, Any] | None:
        """Get a single row by ID.

        Args:
            table_id: Source table ID
            row_id: Row ID

        Returns:
            Row dict or None
        """
        rows = self.get_rows(
            table_id,
            filters=[{"field": "id", "operator": "eq", "value": row_id}],
            limit=1,
        )
        return rows[0] if rows else None

    def upsert_row(
        self,
        table_id: int,
        data: dict[str, Any],
        match_field_ids: list[int] | None = None,
    ) -> dict[str, Any]:
        """Create or update a row based on match field values.

        Queries for a row where all match fields equal their values in data.
        Updates if found, creates if not. Supports composite matching
        (e.g. Name + Phone must both match).

        Args:
            table_id: Target table ID
            data: Field values {field_id: value, ...}
            match_field_ids: Field IDs to match on (AND logic)

        Returns:
            Created or updated row data
        """
        if not match_field_ids:
            return self.create_row(table_id, data)

        # Build AND filters for all match fields
        filters = []
        for fid in match_field_ids:
            str_fid = str(fid)
            if str_fid not in data:
                logger.info(f"Upsert: match field {fid} not in data, creating")
                return self.create_row(table_id, data)
            filters.append({"field": str_fid, "operator": "eq", "value": data[str_fid]})

        # Query for existing row matching all fields
        rows = self.get_rows(table_id, filters=filters, limit=1)

        if rows:
            row_id = rows[0]["id"]
            logger.info(
                f"Upsert: found row {row_id} matching {len(filters)} fields, updating"
            )
            return self.update_row(table_id, row_id, data)
        else:
            logger.info(f"Upsert: no match on {len(filters)} fields, creating new row")
            logger.info(f"Upsert create_row data: {data}")
            return self.create_row(table_id, data)
