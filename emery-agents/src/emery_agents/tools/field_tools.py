"""Field/Column CRUD operations - create, list, delete fields."""

import logging
import urllib.parse
from typing import Any, Dict, Optional
from smolagents import Tool
from .crud_tools import BaseCrudTool
from ..grpc.generated.agent_worker_pb2 import ToolConfig

logger = logging.getLogger(__name__)

# Valid field types for validation
# AIDEV-NOTE: Matches FieldType from src/ddd/domain/tables/value-objects/table-field.ts
VALID_FIELD_TYPES = {
    # Simple types (no config needed)
    'text', 'number', 'boolean', 'date', 'email', 'phone', 'json',
    # Config types (may need additional params)
    'relation',      # Required: related_table_id
    'file',          # Optional: allowedTypes, maxSize in field_config
    'document',      # No config needed
    'embedding',     # Required: embeddingSize (384|768|1536|3072) in field_config
    'single-select', # Required: options array in field_config
    'multi-select',  # Required: options array in field_config
    # Auto-generated (read-only - users rarely create these)
    'autonumber',    # Optional: startingNumber, prefix, suffix, digits in field_config
    'created-at',    # No config needed
    'last-updated',  # Optional: watchFields in field_config
}


def load_field_crud(config: ToolConfig, api_key: Optional[str] = None, organization_id: Optional[int] = None) -> Tool:
    """
    Load Field CRUD tool for schema/column operations.

    AIDEV-NOTE: Supports 3 field operations: create_field, list_fields, delete_field
    Calls the /api/fields endpoint which maps to TableApplicationService.createField/deleteField/getFieldsForTable.

    Table operations are in table_tools.py (load_table_crud).
    Row operations are in row_tools.py (load_row_crud).

    Auth is captured in closure variables (_auth_token, _org_id) - NOT exposed in inputs.
    """
    # Capture auth in closure - NOT exposed to LLM via inputs schema
    _auth_token = api_key or ""
    _org_id = str(organization_id) if organization_id else ""

    # Extract pre-configured table_id from config if present (for reference tools)
    _preconfigured_table_id = config.config.get("table_id") if config and config.config else None

    class FieldCrudTool(BaseCrudTool):
        """CRUD operations for Emery table fields/columns."""

        name = "field_crud"
        description = "Column/field management: create_field (add column), list_fields (get all columns), delete_field (remove column). Supports field types: text, number, boolean, date, email, phone, json, relation, file, document, embedding, single-select, multi-select, autonumber, created-at, last-updated."
        inputs = {
            "method": {"type": "string", "description": "Operation: create_field, list_fields, delete_field"},
            "table_id": {"type": "string", "description": "Table ID (required for all operations)", "nullable": True},
            "field_name": {"type": "string", "description": "Column name for create_field/delete_field", "nullable": True},
            "field_type": {"type": "string", "description": "Field type: text, number, boolean, date, email, phone, json, relation, file, document, embedding, single-select, multi-select, autonumber, created-at, last-updated", "nullable": True},
            "field_required": {"type": "boolean", "description": "Whether field is required (default: false)", "nullable": True},
            "related_table_id": {"type": "string", "description": "Target table ID for relation fields (required if field_type='relation')", "nullable": True},
            "field_config": {"type": "object", "description": "Type-specific config: {options: [{value, color}]} for selects, {embeddingSize: 384|768|1536|3072} for embedding, {prefix, suffix, digits} for autonumber", "nullable": True}
        }
        output_type = "object"

        def __init__(self):
            super().__init__("field", "crud")

        def forward(self, method: str, table_id: Optional[str] = None,
                   field_name: Optional[str] = None, field_type: Optional[str] = None,
                   field_required: Optional[bool] = None, related_table_id: Optional[str] = None,
                   field_config: Optional[Dict] = None) -> Dict[str, Any]:
            """Execute field CRUD operation."""

            # Check if mutation is allowed during planning phase
            blocked = self._check_mutation_allowed(method)
            if blocked:
                return blocked

            # Pre-configured table_id takes priority over LLM-provided (for reference tools)
            effective_table_id = _preconfigured_table_id or table_id

            if method == "create_field":
                # Validate required parameters
                if not effective_table_id:
                    return {"success": False, "error": "table_id is required for create_field operation"}
                if not field_name:
                    return {"success": False, "error": "field_name is required for create_field. Provide the column name to create."}
                if not field_type:
                    return {"success": False, "error": "field_type is required for create_field. Valid types: text, number, boolean, date, email, phone, json, relation, file, document, embedding, single-select, multi-select, autonumber, created-at, last-updated"}

                # Validate field_type
                if field_type not in VALID_FIELD_TYPES:
                    return {
                        "success": False,
                        "error": f"Invalid field_type '{field_type}'. Valid types: text, number, boolean, date, email, phone, json, relation, file, document, embedding, single-select, multi-select, autonumber, created-at, last-updated"
                    }

                # Validate relation fields require related_table_id
                if field_type == "relation" and not related_table_id:
                    return {
                        "success": False,
                        "error": "related_table_id is required for relation fields. Provide the ID of the table this field should link to."
                    }

                # Validate select types require options
                if field_type in ("single-select", "multi-select"):
                    if not field_config or not field_config.get("options"):
                        return {
                            "success": False,
                            "error": f"{field_type} requires field_config with 'options' array. Example: field_config={{\"options\": [{{\"value\": \"Option A\", \"color\": \"blue\"}}, {{\"value\": \"Option B\", \"color\": \"green\"}}]}}"
                        }

                # Validate embedding fields require embeddingSize
                if field_type == "embedding":
                    if not field_config or not field_config.get("embeddingSize"):
                        return {
                            "success": False,
                            "error": "embedding fields require field_config with 'embeddingSize'. Valid sizes: 384, 768, 1536, 3072. Example: field_config={\"embeddingSize\": 1536}"
                        }
                    if field_config.get("embeddingSize") not in (384, 768, 1536, 3072):
                        return {
                            "success": False,
                            "error": f"Invalid embeddingSize {field_config.get('embeddingSize')}. Valid sizes: 384, 768, 1536, 3072"
                        }

                # Build request payload
                create_data: Dict[str, Any] = {
                    "tableId": int(effective_table_id),
                    "name": field_name,
                    "type": field_type,
                    "required": bool(field_required) if field_required is not None else False,
                }

                # Add related table ID for relation fields
                if related_table_id:
                    create_data["relatedTableId"] = int(related_table_id)

                # Merge field_config into metadata if provided
                # The API accepts this as part of the field creation
                if field_config:
                    create_data["metadata"] = field_config

                # Request TOON format for minimal token usage
                return self._make_api_request_with_deadline(
                    endpoint="fields?format=llm",
                    method="POST",
                    data=create_data,
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "list_fields":
                if not effective_table_id:
                    return {"success": False, "error": "table_id is required for list_fields operation"}

                # Request TOON format for minimal token usage
                return self._make_api_request_with_deadline(
                    endpoint=f"fields?tableId={effective_table_id}&format=llm",
                    method="GET",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            elif method == "delete_field":
                if not effective_table_id:
                    return {"success": False, "error": "table_id is required for delete_field operation"}
                if not field_name:
                    return {"success": False, "error": "field_name is required for delete_field. First use list_fields to see available fields."}

                # URL encode field_name in case it contains special characters
                encoded_field_name = urllib.parse.quote(field_name)

                # Request TOON format for minimal token usage
                return self._make_api_request_with_deadline(
                    endpoint=f"fields?tableId={effective_table_id}&fieldName={encoded_field_name}&format=llm",
                    method="DELETE",
                    auth_token=_auth_token,
                    organization_id=_org_id
                )

            else:
                return {
                    "success": False,
                    "error": f"Unknown method: {method}. Supported: create_field, list_fields, delete_field"
                }

    return FieldCrudTool()
