"""
Permission Error Parser - Extracts structured permission info from API errors.

AIDEV-NOTE: This module parses RBAC permission errors returned by the Next.js API
to provide actionable error messages in both interactive and autonomous modes.

Supports two error formats:
1. Structured JSON errors (from PermissionDeniedError.toJSON())
2. Legacy string errors (fallback pattern matching)

Usage:
    error_response = {"code": "PERMISSION_DENIED", "permission": "database:view", ...}
    perm_error = parse_permission_error(error_response)
    if perm_error:
        user_message = format_permission_error_for_user(perm_error)
"""

import logging
import re
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class ParsedPermissionError:
    """Structured permission error information.

    Attributes:
        permission: Full permission string (e.g., "database:view")
        resource: Resource type (e.g., "database")
        resource_id: Specific resource ID if applicable
        action: Action being attempted (e.g., "view")
        raw_message: Original error message
    """

    permission: str
    resource: str | None
    resource_id: int | None
    action: str
    raw_message: str


def parse_permission_error(error_response: Any) -> ParsedPermissionError | None:
    """
    Parse API error response for permission information.

    Handles both structured JSON errors and legacy string errors:
    - Structured: {"code": "PERMISSION_DENIED", "permission": "...", ...}
    - Legacy: "Permission denied: resource:action" or "403 Unauthorized"

    Args:
        error_response: API error JSON dict or error string

    Returns:
        ParsedPermissionError if parseable, None otherwise
    """
    # Handle structured error response (preferred format)
    if isinstance(error_response, dict):
        code = error_response.get("code")

        if code == "PERMISSION_DENIED":
            return ParsedPermissionError(
                permission=error_response.get("permission", "unknown"),
                resource=error_response.get("resource"),
                resource_id=_safe_int(error_response.get("resourceId")),
                action=error_response.get("action", "unknown"),
                raw_message=error_response.get("error", "Permission denied"),
            )

        # Try to extract from error string field
        error_str = error_response.get("error", "")
        if error_str:
            return _parse_from_string(str(error_str))

    # Handle plain string error
    if isinstance(error_response, str):
        return _parse_from_string(error_response)

    return None


def _parse_from_string(error_str: str) -> ParsedPermissionError | None:
    """Parse permission info from error string using pattern matching."""

    # Pattern: "Permission denied: resource:action"
    match = re.search(r"Permission denied:\s*(\w+):(\w+)", error_str, re.IGNORECASE)
    if match:
        resource, action = match.groups()
        return ParsedPermissionError(
            permission=f"{resource}:{action}",
            resource=resource,
            resource_id=None,
            action=action,
            raw_message=error_str,
        )

    # Pattern: "You need 'permission' permission" or "requires 'permission'"
    match = re.search(
        r"(?:need|requires?)['\s]+([a-z_]+:[a-z_]+)", error_str, re.IGNORECASE
    )
    if match:
        permission = match.group(1)
        parts = permission.split(":")
        return ParsedPermissionError(
            permission=permission,
            resource=parts[0] if len(parts) > 0 else None,
            resource_id=None,
            action=parts[1] if len(parts) > 1 else "unknown",
            raw_message=error_str,
        )

    # Pattern: "Unauthorized" or "403" - generic permission error
    if "unauthorized" in error_str.lower() or "403" in error_str:
        return ParsedPermissionError(
            permission="unknown",
            resource=None,
            resource_id=None,
            action="unknown",
            raw_message=error_str,
        )

    return None


def _safe_int(value: Any) -> int | None:
    """Safely convert value to int, returning None on failure."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def format_permission_error_for_user(perm_error: ParsedPermissionError) -> str:
    """
    Format permission error for user display.

    Creates a user-friendly message that clearly states what permission is needed.

    Args:
        perm_error: Parsed permission error

    Returns:
        User-friendly error message
    """
    if perm_error.resource and perm_error.resource_id:
        return (
            f"Access denied: You need '{perm_error.action}' permission "
            f"for {perm_error.resource} #{perm_error.resource_id}"
        )
    elif perm_error.permission != "unknown":
        return f"Access denied: You need '{perm_error.permission}' permission"
    else:
        return f"Access denied: {perm_error.raw_message}"


def format_permission_error_for_agent(
    perm_error: ParsedPermissionError, is_interactive: bool = False
) -> str:
    """
    Format permission error with guidance for agent/autonomous mode.

    Provides actionable guidance on how to resolve the permission issue.

    Args:
        perm_error: Parsed permission error
        is_interactive: Whether in interactive chat mode (can request access)

    Returns:
        Error message with guidance
    """
    base_message = format_permission_error_for_user(perm_error)

    if is_interactive:
        return f"{base_message}\n\nYou can request access to this resource."
    else:
        return (
            f"{base_message}\n\n"
            f"To complete this task, ask an administrator to grant "
            f"'{perm_error.permission}' permission."
        )
