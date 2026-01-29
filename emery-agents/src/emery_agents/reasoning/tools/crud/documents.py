"""
Document CRUD operations as DSPy-compatible functions.

Ported from tools/crud_tools.py (load_document_crud).
"""

from __future__ import annotations

from typing import Any

import dspy

from ..http_client import make_request
from ..mutation_guard import check_mutation_allowed


def _build_paragraph(text: str, bold: bool = False, italic: bool = False) -> dict[str, Any]:
    """Build a TipTap paragraph node with optional formatting."""
    marks = []
    if bold:
        marks.append({"type": "bold"})
    if italic:
        marks.append({"type": "italic"})

    text_node: dict[str, Any] = {"type": "text", "text": text}
    if marks:
        text_node["marks"] = marks

    return {"type": "paragraph", "content": [text_node]}


def _build_heading(text: str, level: int) -> dict[str, Any]:
    """Build a TipTap heading node."""
    return {
        "type": "heading",
        "attrs": {"level": level},
        "content": [{"type": "text", "text": text}]
    }


def _build_list(items: list[str], ordered: bool = False) -> dict[str, Any]:
    """Build a TipTap bullet or ordered list node."""
    list_items = [
        {
            "type": "listItem",
            "content": [
                {"type": "paragraph", "content": [{"type": "text", "text": item}]}
            ]
        }
        for item in items
    ]
    return {
        "type": "orderedList" if ordered else "bulletList",
        "content": list_items
    }


def create_document_crud(api_key: str, org_id: str) -> dspy.Tool:
    """
    Factory: Create document_crud tool with auth captured in closure.

    Args:
        api_key: Bearer token for authentication
        org_id: Organization ID for RLS context

    Returns:
        dspy.Tool wrapping the document_crud function
    """

    def document_crud(
        method: str,
        document_id: str | None = None,
        table_id: str | int | None = None,
        field_id: str | int | None = None,
        row_id: str | None = None,
        title: str | None = None,
        text: str | None = None,
        level: int | None = None,
        items: list[str] | None = None,
        position: int | None = None,
        bold: bool | None = None,
        italic: bool | None = None,
        ordered: bool | None = None,
        data: dict[str, Any] | None = None,
    ) -> str:
        """Document management with high-level content methods.

        Methods: create, read, list, append_text, append_heading, append_list,
                update_text, update_heading

        Args:
            method: Operation (see above)
            document_id: Document ID (required for read/update/append/modify)
            table_id: Table ID containing the document field
            field_id: Field ID of document column
            row_id: Row ID (optional for create)
            title: Document title (required for create)
            text: Text content for append_text, append_heading, update_text, update_heading
            level: Heading level 1-6 for append_heading, update_heading
            items: List items for append_list
            position: Block index (0-based) for update_text, update_heading
            bold: Make text bold
            italic: Make text italic
            ordered: Use ordered list instead of bullets
            data: Full TipTap JSON for 'update' method (low-level)

        Returns:
            JSON string with result or error message
        """
        # Check if mutation is allowed
        blocked = check_mutation_allowed(method)
        if blocked:
            return blocked

        # Coerce IDs to strings
        table_id_str = str(table_id) if table_id is not None else None
        field_id_str = str(field_id) if field_id is not None else None

        if method == "create":
            if not table_id or not field_id:
                return "ERROR: table_id and field_id are required for create operation"
            if not title:
                return "ERROR: title is required for create operation"

            create_data: dict[str, Any] = {
                "tableId": int(table_id),
                "fieldId": int(field_id),
                "title": title
            }
            if row_id:
                create_data["rowId"] = row_id
            if data:
                create_data["initialContent"] = data

            return make_request(
                endpoint="documents",
                method="POST",
                data=create_data,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "read":
            if not document_id:
                return "ERROR: document_id is required for read operation"
            if not table_id_str or not field_id_str:
                return "ERROR: table_id and field_id are required for read operation"
            return make_request(
                endpoint=f"documents/{document_id}?tableId={table_id_str}&fieldId={field_id_str}",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "list":
            return make_request(
                endpoint="documents",
                method="GET",
                data=None,
                auth_token=api_key,
                org_id=org_id,
            )

        elif method == "append_text":
            if not document_id or not table_id_str or not field_id_str:
                return "ERROR: document_id, table_id, and field_id are required"
            if not text:
                return "ERROR: text is required for append_text"
            node = _build_paragraph(text, bold=bool(bold), italic=bool(italic))
            return _modify_content(document_id, table_id_str, field_id_str, node, None, api_key, org_id)

        elif method == "append_heading":
            if not document_id or not table_id_str or not field_id_str:
                return "ERROR: document_id, table_id, and field_id are required"
            if not text:
                return "ERROR: text is required for append_heading"
            heading_level = level if level and 1 <= level <= 6 else 2
            node = _build_heading(text, heading_level)
            return _modify_content(document_id, table_id_str, field_id_str, node, None, api_key, org_id)

        elif method == "append_list":
            if not document_id or not table_id_str or not field_id_str:
                return "ERROR: document_id, table_id, and field_id are required"
            if not items or not isinstance(items, list):
                return "ERROR: items (array of strings) is required for append_list"
            node = _build_list(items, ordered=bool(ordered))
            return _modify_content(document_id, table_id_str, field_id_str, node, None, api_key, org_id)

        elif method == "update_text":
            if not document_id or not table_id_str or not field_id_str:
                return "ERROR: document_id, table_id, and field_id are required"
            if position is None:
                return "ERROR: position is required for update_text"
            if not text:
                return "ERROR: text is required for update_text"
            node = _build_paragraph(text, bold=bool(bold), italic=bool(italic))
            return _modify_content(document_id, table_id_str, field_id_str, node, position, api_key, org_id)

        elif method == "update_heading":
            if not document_id or not table_id_str or not field_id_str:
                return "ERROR: document_id, table_id, and field_id are required"
            if position is None:
                return "ERROR: position is required for update_heading"
            if not text:
                return "ERROR: text is required for update_heading"
            heading_level = level if level and 1 <= level <= 6 else 2
            node = _build_heading(text, heading_level)
            return _modify_content(document_id, table_id_str, field_id_str, node, position, api_key, org_id)

        else:
            return (
                f"ERROR: Unknown method: {method}. Supported: create, list, read, "
                f"append_text, append_heading, append_list, update_text, update_heading"
            )

    return dspy.Tool(
        func=document_crud,
        name="document_crud",
        desc="Document management with TipTap content: create, read, list, append_text, append_heading, append_list, update_text, update_heading.",
        arg_desc={
            "method": "Operation: create, read, list, append_text, append_heading, append_list, update_text, update_heading",
            "document_id": "Document ID (required for read/update/append)",
            "table_id": "Table ID containing the document field",
            "field_id": "Field ID of the document column",
            "row_id": "Row ID (optional for create)",
            "title": "Document title (required for create)",
            "text": "Text content for append_text, append_heading, update_text, update_heading",
            "level": "Heading level 1-6 for append_heading, update_heading",
            "items": "List items (array of strings) for append_list",
            "position": "Block index (0-based) for update_text, update_heading",
            "bold": "Make text bold",
            "italic": "Make text italic",
            "ordered": "Use ordered list instead of bullets",
            "data": "Full TipTap JSON for low-level update",
        },
    )


def _modify_content(
    doc_id: str,
    table_id: str,
    field_id: str,
    node: dict[str, Any],
    position: int | None,
    api_key: str,
    org_id: str,
) -> str:
    """Read document, append or replace at position, save."""
    import json

    # Read current document
    read_result = make_request(
        endpoint=f"documents/{doc_id}?tableId={table_id}&fieldId={field_id}",
        method="GET",
        data=None,
        auth_token=api_key,
        org_id=org_id,
    )

    if read_result.startswith("ERROR"):
        return read_result

    try:
        result_data = json.loads(read_result)
    except json.JSONDecodeError:
        return f"ERROR: Failed to parse document: {read_result}"

    # Get current content (API response may be nested)
    inner_data = result_data.get("data", result_data)
    if isinstance(inner_data, dict) and "data" in inner_data:
        inner_data = inner_data.get("data", {})
    current = inner_data.get("tiptapContent", {})
    content = current.get("content", [])

    # Modify content
    if position is not None:
        if 0 <= position < len(content):
            content[position] = node
        else:
            return f"ERROR: Position {position} out of range (0-{len(content)-1})"
    else:
        content.append(node)

    # Save updated document
    updated = {"type": "doc", "content": content}
    return make_request(
        endpoint=f"documents/{doc_id}?tableId={table_id}&fieldId={field_id}",
        method="PUT",
        data={"tiptapContent": updated},
        auth_token=api_key,
        org_id=org_id,
    )
