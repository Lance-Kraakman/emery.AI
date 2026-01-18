"""
TOON Format Utility for Python

Converts dicts/JSON to TOON (Token-Oriented Object Notation) format
for minimal token usage when passing data to LLMs.

Uses official toon-format SDK when available, falls back to manual formatting.

TOON is ~40-60% smaller than JSON for structured data.

Example:
    JSON: {"users":[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]}
    TOON: users[2]{id,name}:
          1,Alice
          2,Bob
"""

import json
from typing import Any, Dict, List, Optional, Sequence, Union

# Try to import official TOON library
try:
    from toon import encode as toon_encode
    HAS_TOON_LIB = True
except ImportError:
    HAS_TOON_LIB = False
    toon_encode = None  # type: ignore


def to_toon(data: Any) -> str:
    """
    Convert any data to TOON format using official SDK.
    Falls back to JSON if library not installed.
    """
    if HAS_TOON_LIB and toon_encode is not None:
        return toon_encode(data)
    # Fallback to JSON if library not installed
    if isinstance(data, (dict, list)):
        return json.dumps(data)
    return str(data)


def escape_toon_value(value: Any) -> str:
    """Escape special characters in TOON values."""
    if value is None:
        return ""
    s = str(value)
    # Escape commas and newlines
    if "," in s or "\n" in s or '"' in s:
        return f'"{s.replace(chr(34), chr(34)+chr(34))}"'
    return s


def dict_to_toon(
    data: Dict[str, Any],
    key_fields: Optional[List[str]] = None,
    include_meta: bool = False,
    meta_fields: Optional[List[str]] = None,
) -> str:
    """
    Convert a single dict to TOON format.

    Args:
        data: Dictionary to convert
        key_fields: Fields to include (default: all non-metadata fields)
        include_meta: Include metadata fields
        meta_fields: Specific metadata fields to include

    Returns:
        TOON formatted string
    """
    if not data:
        return ""

    # Determine which fields to include
    if key_fields:
        fields = key_fields.copy()
    else:
        # Exclude common metadata fields by default
        exclude = {"_extra", "metadata", "createdAt", "updatedAt", "ownerId",
                   "storageLocation", "s3Uri", "deltaPath"}
        fields = [k for k in data.keys() if k not in exclude]

    if include_meta and meta_fields:
        fields.extend(meta_fields)

    # Build single row
    values = [escape_toon_value(data.get(f, "")) for f in fields]
    return ",".join(values)


def list_to_toon(
    data: Sequence[Dict[str, Any]],
    name: str = "items",
    key_fields: Optional[List[str]] = None,
    include_meta: bool = False,
    meta_fields: Optional[List[str]] = None,
    max_items: int = 50,
) -> str:
    """
    Convert a list of dicts to TOON format.

    Args:
        data: List of dictionaries to convert
        name: Name for the collection (e.g., "tables", "rows")
        key_fields: Fields to include (auto-detected if None)
        include_meta: Include metadata fields
        meta_fields: Specific metadata fields to include
        max_items: Maximum items to include (truncate rest)

    Returns:
        TOON formatted string

    Example output:
        tables[3]{id,name,description}:
        1,Users,User accounts
        2,Orders,Customer orders
        # truncated: 10 more
    """
    if not data:
        return f"{name}[0]{{}}:"

    items = list(data)[:max_items]

    # Auto-detect fields from first item if not specified
    if key_fields is None:
        exclude = {"_extra", "metadata", "createdAt", "updatedAt", "ownerId",
                   "storageLocation", "s3Uri", "deltaPath"}
        key_fields = [k for k in items[0].keys() if k not in exclude]

    fields = key_fields.copy()
    if include_meta and meta_fields:
        fields.extend(meta_fields)

    # Build header
    header = f"{name}[{len(items)}]{{{','.join(fields)}}}:"

    # Build rows
    rows = []
    for item in items:
        values = [escape_toon_value(item.get(f, "")) for f in fields]
        rows.append(",".join(values))

    result = [header] + rows

    # Add truncation notice
    if len(data) > max_items:
        result.append(f"# truncated: {len(data) - max_items} more")

    return "\n".join(result)


def json_to_toon(data: Any, name: str = "data") -> str:
    """
    Convert any JSON-compatible data to TOON format.

    Handles:
    - List of dicts → tabular TOON
    - Single dict → single row
    - Primitives → as-is
    """
    if isinstance(data, list) and data and isinstance(data[0], dict):
        return list_to_toon(data, name=name)
    elif isinstance(data, dict):
        return dict_to_toon(data)
    else:
        return str(data)


# Specialized formatters for common entity types

def tables_to_toon(
    tables: Sequence[Dict[str, Any]],
    include_meta: bool = False,
) -> str:
    """Format tables list to TOON."""
    key_fields = ["id", "name", "description", "fieldCount"]
    meta_fields = ["databaseId", "createdAt"] if include_meta else None

    # Calculate fieldCount if not present
    for t in tables:
        if "fieldCount" not in t and "fields" in t:
            t["fieldCount"] = len(t.get("fields", []))

    return list_to_toon(
        tables,
        name="tables",
        key_fields=key_fields,
        include_meta=include_meta,
        meta_fields=meta_fields
    )


def fields_to_toon(
    fields: Sequence[Dict[str, Any]],
    include_meta: bool = False,
) -> str:
    """Format fields list to TOON."""
    key_fields = ["id", "name", "type"]
    meta_fields = ["required", "description"] if include_meta else None
    return list_to_toon(
        fields,
        name="fields",
        key_fields=key_fields,
        include_meta=include_meta,
        meta_fields=meta_fields
    )


def databases_to_toon(
    databases: Sequence[Dict[str, Any]],
    include_meta: bool = False,
) -> str:
    """Format databases list to TOON."""
    key_fields = ["id", "name", "slug"]
    meta_fields = ["tableCount", "createdAt"] if include_meta else None
    return list_to_toon(
        databases,
        name="databases",
        key_fields=key_fields,
        include_meta=include_meta,
        meta_fields=meta_fields
    )


def rows_to_toon(
    rows: Sequence[Dict[str, Any]],
    field_names: Optional[List[str]] = None,
    include_meta: bool = False,
) -> str:
    """
    Format row data to TOON.

    Args:
        rows: List of row data dicts
        field_names: Specific field names to include (auto-detect if None)
        include_meta: Include row metadata (id, createdAt, etc.)
    """
    if not rows:
        return "rows[0]{}:"

    # Auto-detect fields from first row, excluding system fields
    if field_names is None:
        exclude = {"_id", "_rowId", "_createdAt", "_updatedAt", "createdAt", "updatedAt"}
        field_names = [k for k in rows[0].keys() if k not in exclude]

    meta_fields = ["_rowId", "_createdAt"] if include_meta else None

    return list_to_toon(
        rows,
        name="rows",
        key_fields=field_names,
        include_meta=include_meta,
        meta_fields=meta_fields
    )
