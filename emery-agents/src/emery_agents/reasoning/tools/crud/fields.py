"""
Field/Column CRUD operations as DSPy-compatible functions.

Ported from tools/field_tools.py.
"""

from __future__ import annotations

import urllib.parse
from typing import Any

import dspy

from ..http_client import make_request
from ..mutation_guard import check_mutation_allowed

# Valid field types for validation
VALID_FIELD_TYPES = {
    # Simple types (no config needed)
    "text", "number", "boolean", "date", "email", "phone", "json",
    # Config types (may need additional params)
    "relation",       # Required: related_table_id
    "file",           # Optional: allowedTypes, maxSize in field_config
    "document",       # No config needed
    "embedding",      # Required: embeddingSize (384|768|1536|3072) in field_config
    "single-select",  # Required: options array in field_config
    "multi-select",   # Required: options array in field_config
    # Auto-generated (read-only - users rarely create these)
    "autonumber",     # Optional: startingNumber, prefix, suffix, digits in field_config
    "created-at",     # No config needed
    "last-updated",   # Optional: watchFields in field_config
}


def create_field_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create field_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the field_crud function
    """

    def field_crud(
        method: str,
        table_id: str | None = None,
        field_name: str | None = None,
        field_type: str | None = None,
        field_required: bool | None = None,
        related_table_id: str | None = None,
        field_config: dict[str, Any] | None = None,
    ) -> str:
        """Column/field management: create_field, list_fields, delete_field.

        Supports field types: text, number, boolean, date, email, phone, json,
        relation, file, document, embedding, single-select, multi-select,
        autonumber, created-at, last-updated.

        Args:
            method: Operation - create_field, list_fields, delete_field
            table_id: Table ID (required for all operations)
            field_name: Column name for create_field/delete_field
            field_type: Field type (see supported types above)
            field_required: Whether field is required (default: false)
            related_table_id: Target table ID for relation fields
            field_config: Type-specific config (options for selects, embeddingSize, etc.)

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        if method == "create_field":
            # Validate required parameters
            if not table_id:
                return "ERROR: table_id is required for create_field operation"
            if not field_name:
                return "ERROR: field_name is required for create_field"
            if not field_type:
                return (
                    "ERROR: field_type is required for create_field. "
                    "Valid types: text, number, boolean, date, email, phone, json, "
                    "relation, file, document, embedding, single-select, multi-select"
                )

            # Validate field_type
            if field_type not in VALID_FIELD_TYPES:
                return (
                    f"ERROR: Invalid field_type '{field_type}'. "
                    f"Valid types: text, number, boolean, date, email, phone, json, "
                    f"relation, file, document, embedding, single-select, multi-select"
                )

            # Validate relation fields require related_table_id
            if field_type == "relation" and not related_table_id:
                return "ERROR: related_table_id is required for relation fields"

            # Validate select types require options
            if field_type in ("single-select", "multi-select"):
                if not field_config or not field_config.get("options"):
                    return (
                        f"ERROR: {field_type} requires field_config with 'options' array. "
                        f'Example: field_config={{"options": [{{"value": "Option A", "color": "blue"}}]}}'
                    )

            # Validate embedding fields require embeddingSize
            if field_type == "embedding":
                if not field_config or not field_config.get("embeddingSize"):
                    return (
                        "ERROR: embedding fields require field_config with 'embeddingSize'. "
                        'Valid sizes: 384, 768, 1536, 3072. Example: field_config={"embeddingSize": 1536}'
                    )
                if field_config.get("embeddingSize") not in (384, 768, 1536, 3072):
                    return f"ERROR: Invalid embeddingSize. Valid sizes: 384, 768, 1536, 3072"

            # Build request payload
            create_data: dict[str, Any] = {
                "tableId": int(table_id),
                "name": field_name,
                "type": field_type,
                "required": bool(field_required) if field_required is not None else False,
            }

            if related_table_id:
                create_data["relatedTableId"] = int(related_table_id)

            if field_config:
                create_data["metadata"] = field_config

            return make_request(
                endpoint="fields",
                method="POST",
                data=create_data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "list_fields":
            if not table_id:
                return "ERROR: table_id is required for list_fields operation"
            return make_request(
                endpoint=f"fields?tableId={table_id}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "delete_field":
            if not table_id:
                return "ERROR: table_id is required for delete_field operation"
            if not field_name:
                return "ERROR: field_name is required for delete_field"

            encoded_field_name = urllib.parse.quote(field_name)
            return make_request(
                endpoint=f"fields?tableId={table_id}&fieldName={encoded_field_name}",
                method="DELETE",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        else:
            return f"ERROR: Unknown method: {method}. Supported: create_field, list_fields, delete_field"

    return dspy.Tool(
        func=field_crud,
        name="field_crud",
        desc="Column/field management: create_field, list_fields, delete_field. Supports types: text, number, boolean, date, email, phone, json, relation, file, document, embedding, single-select, multi-select.",
        arg_desc={
            "method": "Operation: create_field, list_fields, delete_field",
            "table_id": "Table ID (required for all operations)",
            "field_name": "Column name (required for create_field, delete_field)",
            "field_type": "Field type: text, number, boolean, date, email, phone, json, relation, file, document, embedding, single-select, multi-select",
            "field_required": "Whether field is required (default: false)",
            "related_table_id": "Target table ID for relation fields",
            "field_config": "Type-specific config: {options: [...]} for selects, {embeddingSize: 1536} for embeddings",
        },
    )
