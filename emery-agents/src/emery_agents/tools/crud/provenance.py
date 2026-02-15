"""Provenance tool for record modification history.

Uses existing rowHistory table via Next.js API.
"""

from __future__ import annotations

import dspy

from emery_agents.api.http_client import make_request


def create_record_history(
    api_key: str, org_id: str, extra_headers: dict[str, str] | None = None
) -> dspy.Tool:
    """Factory: Create record_history tool with auth in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context
        extra_headers: Optional additional headers

    Returns:
        dspy.Tool wrapping the record_history function
    """

    def record_history(table_id: str, record_id: str) -> str:
        """Get modification history for a record.

        Args:
            table_id: Table ID (numeric string)
            record_id: Record ID to get history for

        Returns:
            JSON with list of modifications (operation, changed_by, changed_at, version)
        """
        return make_request(
            endpoint=f"tables/{table_id}/rows/{record_id}/history",
            method="GET",
            data=None,
            auth_token=api_key,
            org_id=org_id,
            extra_headers=extra_headers,
        )

    return dspy.Tool(
        func=record_history,
        name="record_history",
        desc="Get modification history for a record - who changed it and when.",
        arg_desc={
            "table_id": "Table ID (numeric)",
            "record_id": "Record ID to get history for",
        },
    )
