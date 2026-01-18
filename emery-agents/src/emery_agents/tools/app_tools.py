"""
App and Page CRUD tools for AppBuilder agent.

AIDEV-NOTE: These tools provide CRUD operations for apps and pages in the Puck
visual page builder system. They follow the same pattern as other CRUD tools.

AIDEV-NOTE: Both tools use format=llm for TOON responses to minimize token usage.
"""

import logging
import uuid
from typing import Any, Dict, Optional, Union

from smolagents import Tool

from .crud_tools import BaseCrudTool

logger = logging.getLogger(__name__)


def ensure_block_ids(template_data: Dict) -> Dict:
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


def load_app_crud(
    config: Any = None,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Load App CRUD tool with auth context in closure.

    Methods:
    - list: List all apps in the organization
    - read: Get app by ID
    - create: Create new app
    - update: Update app settings
    - delete: Delete app (cascades to pages)
    """
    # CRITICAL: Capture auth in closure - NOT exposed in inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class AppCrudTool(BaseCrudTool):
        """CRUD operations for Puck apps."""

        name = "app_crud"
        description = """Manage Puck visual apps.

Methods:
- list: List all apps in organization
- read: Get app by ID
- create: Create new app (blocked during planning)
- update: Update app settings (blocked during planning)
- delete: Delete app and all pages (blocked during planning)

Examples:
- app_crud(method="list")
- app_crud(method="read", app_id=1)
- app_crud(method="create", data={"name": "My App"})
- app_crud(method="update", app_id=1, data={"name": "New Name"})
- app_crud(method="delete", app_id=1)
"""

        inputs = {
            "method": {
                "type": "string",
                "description": "Operation: list, read, create, update, delete"
            },
            "app_id": {
                "type": ["string", "integer"],  # LLMs often pass integers
                "description": "App ID for read/update/delete",
                "nullable": True
            },
            "data": {
                "type": "object",
                "description": "Data for create/update: {name, slug?, description?, themeConfig?}",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            super().__init__("app", "crud")

        def forward(
            self,
            method: str,
            app_id: Optional[Union[str, int]] = None,
            data: Optional[Dict] = None
        ) -> Dict[str, Any]:
            """Execute App CRUD operation."""

            # CRITICAL: Check mutation allowed during planning phase
            blocked = self._check_mutation_allowed(method)
            if blocked:
                return blocked

            method = method.lower()

            if method == "list":
                return self._make_api_request(
                    endpoint="apps?format=llm",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "read":
                if not app_id:
                    return {"success": False, "error": "app_id required for read"}
                return self._make_api_request(
                    endpoint=f"apps/{app_id}?format=llm",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "create":
                if not data or not data.get("name"):
                    return {"success": False, "error": "data.name required for create"}
                return self._make_api_request(
                    endpoint="apps?format=llm",
                    method="POST",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "update":
                if not app_id:
                    return {"success": False, "error": "app_id required for update"}
                return self._make_api_request(
                    endpoint=f"apps/{app_id}?format=llm",
                    method="PUT",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "delete":
                if not app_id:
                    return {"success": False, "error": "app_id required for delete"}
                return self._make_api_request(
                    endpoint=f"apps/{app_id}?format=llm",
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                return {"success": False, "error": f"Unknown method: {method}. Valid methods: list, read, create, update, delete"}

    return AppCrudTool()


def load_page_crud(
    config: Any = None,
    api_key: Optional[str] = None,
    organization_id: Optional[int] = None
) -> Tool:
    """
    Load Page CRUD tool with auth context in closure.

    Methods:
    - list: List all pages in an app
    - read: Get page by ID
    - create: Create new page in app
    - update: Update page metadata
    - delete: Delete page
    - update_content: Update page Puck content (templateData)
    - publish: Publish page (make public)
    - unpublish: Unpublish page (make private)
    - update_state: Update page state configuration (variables, persistence)
    - update_dialogs: Update all page dialogs configuration
    - add_dialog: Add a single dialog to the page
    """
    # CRITICAL: Capture auth in closure - NOT exposed in inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    class PageCrudTool(BaseCrudTool):
        """CRUD operations for Puck pages within apps."""

        name = "page_crud"
        description = """Manage pages within Puck apps.

Methods:
- list: List pages in an app (requires app_id)
- read: Get page by ID
- create: Create page in app (requires app_id, blocked during planning)
- update: Update page metadata (blocked during planning)
- delete: Delete page (blocked during planning)
- update_content: Update Puck visual content (blocked during planning)
- publish: Make page public (blocked during planning)
- unpublish: Make page private (blocked during planning)
- update_state: Update page state variables (blocked during planning)
- add_dialog: Add a dialog to the page (blocked during planning)

Examples:
- page_crud(method="list", app_id=1)
- page_crud(method="read", page_id=5)
- page_crud(method="create", app_id=1, data={"name": "Home"})
- page_crud(method="update", page_id=5, data={"name": "New Name"})
- page_crud(method="update_content", page_id=5, data={"templateData": {...}})
- page_crud(method="publish", page_id=5)
- page_crud(method="update_state", page_id=5, data={"variables": [{"name": "showLogin", "type": "boolean", "defaultValue": false}]})
- page_crud(method="add_dialog", page_id=5, data={"name": "Login", "stateKey": "showLogin", "title": "Sign In", "size": "md", "content": {...}})
"""

        inputs = {
            "method": {
                "type": "string",
                "description": "Operation: list, read, create, update, delete, update_content, publish, unpublish, update_state, add_dialog"
            },
            "app_id": {
                "type": ["string", "integer"],
                "description": "App ID for list/create operations",
                "nullable": True
            },
            "page_id": {
                "type": ["string", "integer"],
                "description": "Page ID for read/update/delete/publish operations",
                "nullable": True
            },
            "data": {
                "type": "object",
                "description": "Data for create/update: {name, slug?, description?, templateData?, requiresAuth?, allowedRoles?, variables?, dialogs?}",
                "nullable": True
            }
        }
        output_type = "object"

        def __init__(self):
            super().__init__("page", "crud")

        def forward(
            self,
            method: str,
            app_id: Optional[Union[str, int]] = None,
            page_id: Optional[Union[str, int]] = None,
            data: Optional[Dict] = None
        ) -> Dict[str, Any]:
            """Execute Page CRUD operation."""

            # CRITICAL: Check mutation allowed during planning phase
            blocked = self._check_mutation_allowed(method)
            if blocked:
                return blocked

            method = method.lower()

            if method == "list":
                if not app_id:
                    return {"success": False, "error": "app_id required for list"}
                return self._make_api_request(
                    endpoint=f"apps/{app_id}/pages?format=llm",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "read":
                if not page_id:
                    return {"success": False, "error": "page_id required for read"}
                return self._make_api_request(
                    endpoint=f"pages/{page_id}?format=llm",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "create":
                if not app_id:
                    return {"success": False, "error": "app_id required for create"}
                if not data or not data.get("name"):
                    return {"success": False, "error": "data.name required for create"}
                # Auto-generate id for blocks if templateData is provided
                if data.get("templateData"):
                    data["templateData"] = ensure_block_ids(data["templateData"])
                return self._make_api_request(
                    endpoint=f"apps/{app_id}/pages?format=llm",
                    method="POST",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "update":
                if not page_id:
                    return {"success": False, "error": "page_id required for update"}
                return self._make_api_request(
                    endpoint=f"pages/{page_id}?format=llm",
                    method="PUT",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "update_content":
                if not page_id:
                    return {"success": False, "error": "page_id required for update_content"}
                if not data or "templateData" not in data:
                    return {"success": False, "error": "data.templateData required for update_content"}

                # Validate and parse templateData - LLMs sometimes pass JSON strings
                template_data = data.get("templateData")
                if isinstance(template_data, str):
                    import json
                    try:
                        template_data = json.loads(template_data)
                        data["templateData"] = template_data
                        logger.warning("page_crud: templateData was string, parsed to object")
                    except json.JSONDecodeError as e:
                        return {"success": False, "error": f"templateData must be valid JSON object: {e}"}

                if not isinstance(template_data, dict):
                    return {"success": False, "error": f"templateData must be object, got {type(template_data).__name__}"}

                # Auto-generate id for blocks missing it (LLMs don't generate these)
                template_data = ensure_block_ids(template_data)
                data["templateData"] = template_data

                # Validate templateData structure and block types
                from .validators import validate_page_template
                is_valid, validation_errors = validate_page_template(template_data)
                if not is_valid:
                    # Format errors for LLM consumption (max 5 errors)
                    error_messages = [f"- {e['path']}: {e['message']}" for e in validation_errors[:5]]
                    error_str = "\n".join(error_messages)
                    if len(validation_errors) > 5:
                        error_str += f"\n... and {len(validation_errors) - 5} more errors"
                    return {
                        "success": False,
                        "error": f"templateData validation failed:\n{error_str}",
                        "validation_errors": validation_errors
                    }

                return self._make_api_request(
                    endpoint=f"pages/{page_id}/content?format=llm",
                    method="PUT",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "publish":
                if not page_id:
                    return {"success": False, "error": "page_id required for publish"}
                return self._make_api_request(
                    endpoint=f"pages/{page_id}/publish?action=publish&format=llm",
                    method="POST",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "unpublish":
                if not page_id:
                    return {"success": False, "error": "page_id required for unpublish"}
                return self._make_api_request(
                    endpoint=f"pages/{page_id}/publish?action=unpublish&format=llm",
                    method="POST",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "delete":
                if not page_id:
                    return {"success": False, "error": "page_id required for delete"}
                return self._make_api_request(
                    endpoint=f"pages/{page_id}?format=llm",
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "update_state":
                # Update page state configuration (variables, persistence)
                if not page_id:
                    return {"success": False, "error": "page_id required for update_state"}
                if not data:
                    return {"success": False, "error": "data required for update_state (variables or persistence)"}
                return self._make_api_request(
                    endpoint=f"pages/{page_id}/state?format=llm",
                    method="PUT",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            elif method == "add_dialog":
                # Add a dialog to the page
                if not page_id:
                    return {"success": False, "error": "page_id required for add_dialog"}
                if not data or not data.get("name") or not data.get("stateKey"):
                    return {"success": False, "error": "data.name and data.stateKey required for add_dialog"}
                return self._make_api_request(
                    endpoint=f"pages/{page_id}/dialogs?format=llm",
                    method="POST",
                    data=data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )
            else:
                return {"success": False, "error": f"Unknown method: {method}. Valid methods: list, read, create, update, delete, update_content, publish, unpublish, update_state, add_dialog"}

    return PageCrudTool()
