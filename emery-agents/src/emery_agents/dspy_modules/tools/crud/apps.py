"""
App and Page CRUD operations as DSPy-compatible functions.

Ported from tools/app_tools.py.
"""

from __future__ import annotations

import uuid
from typing import Any, Callable

from ..http_client import make_request
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


def create_app_crud(api_key: str, org_id: str) -> Callable[..., str]:
    """
    Factory: Create app_crud function with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        app_crud function that DSPy ReAct can use
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
                endpoint="apps?format=llm",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not app_id:
                return "ERROR: app_id required for read"
            return make_request(
                endpoint=f"apps/{app_id}?format=llm",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "create":
            if not data or not data.get("name"):
                return "ERROR: data.name required for create"
            return make_request(
                endpoint="apps?format=llm",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update":
            if not app_id:
                return "ERROR: app_id required for update"
            return make_request(
                endpoint=f"apps/{app_id}?format=llm",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete":
            if not app_id:
                return "ERROR: app_id required for delete"
            return make_request(
                endpoint=f"apps/{app_id}?format=llm",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Valid: list, read, create, update, delete"

    return app_crud


def create_page_crud(api_key: str, org_id: str) -> Callable[..., str]:
    """
    Factory: Create page_crud function with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        page_crud function that DSPy ReAct can use
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
                endpoint=f"apps/{app_id}/pages?format=llm",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not page_id:
                return "ERROR: page_id required for read"
            return make_request(
                endpoint=f"pages/{page_id}?format=llm",
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
                endpoint=f"apps/{app_id}/pages?format=llm",
                method="POST",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "update":
            if not page_id:
                return "ERROR: page_id required for update"
            return make_request(
                endpoint=f"pages/{page_id}?format=llm",
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
                endpoint=f"pages/{page_id}/content?format=llm",
                method="PUT",
                data=data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "publish":
            if not page_id:
                return "ERROR: page_id required for publish"
            return make_request(
                endpoint=f"pages/{page_id}/publish?action=publish&format=llm",
                method="POST",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "unpublish":
            if not page_id:
                return "ERROR: page_id required for unpublish"
            return make_request(
                endpoint=f"pages/{page_id}/publish?action=unpublish&format=llm",
                method="POST",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete":
            if not page_id:
                return "ERROR: page_id required for delete"
            return make_request(
                endpoint=f"pages/{page_id}?format=llm",
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

    return page_crud
