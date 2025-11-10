"""
Error Classification System

Classifies raw exceptions into error types with user-friendly messages.
Pattern matches on exception messages, HTTP status codes, and API-specific errors.

AIDEV-NOTE: This module converts technical exceptions into structured error types
that map to user-friendly messages. Never expose raw exceptions to users.
"""

import re
from typing import Optional
from dataclasses import dataclass
from .error_messages import get_error_message, get_severity, ErrorSeverity, ErrorMessageInfo


@dataclass
class ClassifiedError:
    """Structured error classification result."""
    error_type: str                    # Error type identifier (e.g., "rate_limit")
    severity: ErrorSeverity           # TRANSIENT, RECOVERABLE, or FATAL
    user_message: str                 # User-friendly error message
    hint: Optional[str]               # Actionable hint for user
    can_retry: bool                   # Can user retry?
    auto_retry: bool                  # Should we auto-retry?
    technical_details: str            # Raw error (for logging only)


def classify_error(exception: Exception) -> ClassifiedError:
    """
    Classify a raw exception into a structured error type.

    This function:
    1. Analyzes the exception message and type
    2. Pattern matches against known error scenarios
    3. Maps to user-friendly error types
    4. Returns structured error information

    Args:
        exception: Raw exception from agent execution

    Returns:
        ClassifiedError with user-friendly message and recovery metadata
    """
    error_message = str(exception).lower()
    error_type = type(exception).__name__

    # Capture raw error for logging (never shown to users)
    technical_details = f"{error_type}: {str(exception)}"

    # ============================================================
    # Pattern matching to classify error type
    # ============================================================

    # TRANSIENT ERRORS - Auto-retry patterns
    if _is_rate_limit_error(error_message):
        classified_type = "rate_limit"

    elif _is_network_error(error_message, error_type):
        classified_type = "network_timeout"

    elif _is_service_unavailable(error_message):
        classified_type = "service_unavailable"

    # RECOVERABLE ERRORS - Clear memory patterns
    elif _is_input_too_large(error_message):
        classified_type = "input_too_large"

    elif _is_context_length_exceeded(error_message):
        classified_type = "context_length_exceeded"

    elif _is_bad_request(error_message):
        classified_type = "bad_request"

    elif _is_content_filter_error(error_message):
        classified_type = "content_filter"

    elif _is_tool_execution_error(error_message):
        classified_type = "tool_execution_error"

    # FATAL ERRORS - Remove session patterns
    elif _is_auth_error(error_message):
        classified_type = "auth_error"

    elif _is_api_key_invalid(error_message):
        classified_type = "api_key_invalid"

    elif _is_model_not_found(error_message):
        classified_type = "model_not_found"

    elif _is_quota_exceeded(error_message):
        classified_type = "quota_exceeded"

    # GENERIC FALLBACK
    else:
        classified_type = "unknown_error"

    # ============================================================
    # Get user-friendly message and metadata
    # ============================================================

    error_info = get_error_message(classified_type)
    severity = get_severity(classified_type)

    return ClassifiedError(
        error_type=classified_type,
        severity=severity,
        user_message=error_info["user_message"],
        hint=error_info.get("hint"),
        can_retry=error_info["can_retry"],
        auto_retry=error_info["auto_retry"],
        technical_details=technical_details
    )


# ============================================================
# Pattern Matching Helper Functions
# ============================================================

def _is_rate_limit_error(error_message: str) -> bool:
    """Check if error is a rate limit error."""
    patterns = [
        r"rate limit",
        r"too many requests",
        r"429",
        r"throttl",
        r"quota.*exceeded",
        r"limit exceeded"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_network_error(error_message: str, error_type: str) -> bool:
    """Check if error is a network/connection error."""
    network_exceptions = [
        "TimeoutError", "ConnectionError", "ConnectTimeout",
        "ReadTimeout", "HTTPError", "RequestException"
    ]

    patterns = [
        r"timeout",
        r"connection",
        r"network",
        r"unreachable",
        r"timed out",
        r"connect.*failed"
    ]

    return (
        error_type in network_exceptions or
        any(re.search(pattern, error_message) for pattern in patterns)
    )


def _is_service_unavailable(error_message: str) -> bool:
    """Check if service is temporarily unavailable."""
    patterns = [
        r"503",
        r"service unavailable",
        r"temporarily unavailable",
        r"server.*down",
        r"maintenance"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_input_too_large(error_message: str) -> bool:
    """Check if input exceeds size limits."""
    patterns = [
        r"too large",
        r"exceeds.*limit",
        r"request.*too big",
        r"payload.*large",
        r"413",
        r"max.*size"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_context_length_exceeded(error_message: str) -> bool:
    """Check if context length exceeded."""
    patterns = [
        r"context.*length",
        r"token.*limit",
        r"maximum.*tokens",
        r"context.*window",
        r"sequence.*long"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_bad_request(error_message: str) -> bool:
    """Check if request is malformed."""
    patterns = [
        r"bad request",
        r"400",
        r"invalid.*request",
        r"malformed",
        r"parse error"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_content_filter_error(error_message: str) -> bool:
    """Check if content filtered."""
    patterns = [
        r"content.*filter",
        r"inappropriate.*content",
        r"policy.*violation",
        r"blocked.*content"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_tool_execution_error(error_message: str) -> bool:
    """Check if tool execution failed."""
    patterns = [
        r"tool.*error",
        r"tool.*failed",
        r"function.*error",
        r"execution.*failed"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_auth_error(error_message: str) -> bool:
    """Check if authentication error."""
    patterns = [
        r"401",
        r"unauthorized",
        r"authentication.*failed",
        r"not authenticated",
        r"invalid.*credentials"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_api_key_invalid(error_message: str) -> bool:
    """Check if API key is invalid."""
    patterns = [
        r"api.*key.*invalid",
        r"invalid.*token",
        r"bad.*api.*key",
        r"unauthorized.*api"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_model_not_found(error_message: str) -> bool:
    """Check if model not found."""
    patterns = [
        r"404",
        r"model.*not.*found",
        r"model.*unavailable",
        r"model.*exist"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)


def _is_quota_exceeded(error_message: str) -> bool:
    """Check if quota/billing exceeded."""
    patterns = [
        r"quota.*exceeded",
        r"billing.*limit",
        r"insufficient.*funds",
        r"credit.*exceeded",
        r"payment.*required"
    ]
    return any(re.search(pattern, error_message) for pattern in patterns)
