"""
App and Page CRUD operations as DSPy-compatible functions.

Ported from tools/app_tools.py.
"""

from __future__ import annotations

import uuid
from typing import Any

import dspy

from emery_agents.api.http_client import make_request
from ..mutation_guard import check_mutation_allowed


def _ensure_block_ids(template_data: dict[str, Any]) -> dict[str, Any]:
    """
    Auto-generate id for any block missing it in content and zones.

    Puck requires every block to have a unique id prop.
    LLMs don't generate these, so we add them automatically.
    """
    if not isinstance(template_data, dict):
        return template_data

    # Process content array
    content = template_data.get("content", [])
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and isinstance(item.get("props"), dict):
                if "id" not in item["props"] or not item["props"]["id"]:
                    item["props"]["id"] = str(uuid.uuid4())[:8]

    # Process zones
    zones = template_data.get("zones", {})
    if isinstance(zones, dict):
        for zone_items in zones.values():
            if isinstance(zone_items, list):
                for item in zone_items:
                    if isinstance(item, dict) and isinstance(item.get("props"), dict):
                        if "id" not in item["props"] or not item["props"]["id"]:
                            item["props"]["id"] = str(uuid.uuid4())[:8]

    return template_data


def create_app_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create app_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the app_crud function
    """

    def app_crud(
        method: str,
        app_id: str | int | None = None,
        data: dict[str, Any] | None = None,
    ) -> str:
        """Manage Puck visual apps.

        Args:
            method: Operation - list, read, create, update, delete
            app_id: App ID for read/update/delete
            data: Data for create/update: {name, slug?, description?, themeConfig?}

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        method = method.lower()

        if method == "list":
            return make_request(
                endpoint="apps",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not app_id:
                return "ERROR: app_id required for read"
            return make_request(
                endpoint=f"apps/{app_id}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "create":
            if not data or not data.get("name"):
                return "ERROR: data.name required for create"
            return make_request(
                endpoint="apps",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update":
            if not app_id:
                return "ERROR: app_id required for update"
            return make_request(
                endpoint=f"apps/{app_id}",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete":
            if not app_id:
                return "ERROR: app_id required for delete"
            return make_request(
                endpoint=f"apps/{app_id}",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Valid: list, read, create, update, delete"

    return dspy.Tool(
        func=app_crud,
        name="app_crud",
        desc="Puck visual app management: list, read, create, update, delete apps.",
        arg_desc={
            "method": "Operation: list, read, create, update, delete",
            "app_id": "App ID (required for read, update, delete)",
            "data": "App data for create/update: {name, slug?, description?, themeConfig?}",
        },
    )


def create_page_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create page_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the page_crud function
    """

    def page_crud(
        method: str,
        app_id: str | int | None = None,
        page_id: str | int | None = None,
        data: dict[str, Any] | None = None,
    ) -> str:
        """Manage pages within Puck apps.

        Args:
            method: Operation - list, read, create, update, delete, update_content, publish, unpublish
            app_id: App ID for list/create operations
            page_id: Page ID for read/update/delete/publish operations
            data: Data for create/update: {name, slug?, templateData?, requiresAuth?, dialogs?}

        Returns:
            JSON string with result or error message
        """
        import json as json_module

        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        method = method.lower()

        if method == "list":
            if not app_id:
                return "ERROR: app_id required for list"
            return make_request(
                endpoint=f"apps/{app_id}/pages",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not page_id:
                return "ERROR: page_id required for read"
            return make_request(
                endpoint=f"pages/{page_id}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "create":
            if not app_id:
                return "ERROR: app_id required for create"
            if not data or not data.get("name"):
                return "ERROR: data.name required for create"
            if data.get("templateData"):
                data["templateData"] = _ensure_block_ids(data["templateData"])
            return make_request(
                endpoint=f"apps/{app_id}/pages",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update":
            if not page_id:
                return "ERROR: page_id required for update"
            return make_request(
                endpoint=f"pages/{page_id}",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update_content":
            if not page_id:
                return "ERROR: page_id required for update_content"
            if not data or "templateData" not in data:
                return "ERROR: data.templateData required for update_content"

            template_data = data.get("templateData")
            if isinstance(template_data, str):
                try:
                    template_data = json_module.loads(template_data)
                    data["templateData"] = template_data
                except json_module.JSONDecodeError as e:
                    return f"ERROR: templateData must be valid JSON object: {e}"

            if not isinstance(template_data, dict):
                return f"ERROR: templateData must be object, got {type(template_data).__name__}"

            data["templateData"] = _ensure_block_ids(template_data)

            return make_request(
                endpoint=f"pages/{page_id}/content",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "publish":
            if not page_id:
                return "ERROR: page_id required for publish"
            return make_request(
                endpoint=f"pages/{page_id}/publish?action=publish",
                method="POST",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "unpublish":
            if not page_id:
                return "ERROR: page_id required for unpublish"
            return make_request(
                endpoint=f"pages/{page_id}/publish?action=unpublish",
                method="POST",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete":
            if not page_id:
                return "ERROR: page_id required for delete"
            return make_request(
                endpoint=f"pages/{page_id}",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        else:
            return (
                f"ERROR: Unknown method: {method}. "
                f"Valid: list, read, create, update, delete, update_content, publish, unpublish"
            )

    return dspy.Tool(
        func=page_crud,
        name="page_crud",
        desc="Puck page management within apps: list, read, create, update, delete, update_content, publish, unpublish.",
        arg_desc={
            "method": "Operation: list, read, create, update, delete, update_content, publish, unpublish",
            "app_id": "App ID (required for list, create)",
            "page_id": "Page ID (required for read, update, delete, update_content, publish, unpublish)",
            "data": "Page data: {name, slug?, templateData?, requiresAuth?, dialogs?}",
        },
    )
