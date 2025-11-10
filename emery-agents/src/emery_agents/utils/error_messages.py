"""
User-Friendly Error Messages

Maps technical errors to user-friendly messages with actionable hints.
Follows pattern: Friendly message + helpful hint, NO technical details shown to users.

AIDEV-NOTE: Error messages should:
- Be clear and non-technical
- Provide actionable next steps
- Never expose internal implementation details
- Include helpful hints when possible
"""

from typing import TypedDict, Optional
from enum import Enum


class ErrorSeverity(Enum):
    """Error severity levels that determine recovery strategy."""
    TRANSIENT = "transient"      # Auto-retry once (network, rate limits)
    RECOVERABLE = "recoverable"  # Clear agent memory, manual retry (invalid input)
    FATAL = "fatal"              # Remove session (auth failures)


class ErrorMessageInfo(TypedDict, total=False):
    """Structured error message information."""
    user_message: str           # User-friendly error message (required)
    hint: Optional[str]         # Actionable hint for user
    severity: str               # Error severity level
    can_retry: bool            # Can user retry?
    auto_retry: bool           # Should we auto-retry?


# Error message mapping with user-friendly messages and hints
ERROR_MESSAGES: dict[str, ErrorMessageInfo] = {
    # ============================================================
    # TRANSIENT ERRORS - Auto-retry once with exponential backoff
    # ============================================================

    "rate_limit": {
        "user_message": "I'm processing a lot of requests right now. Retrying in a moment...",
        "hint": "You can continue chatting normally.",
        "severity": ErrorSeverity.TRANSIENT.value,
        "can_retry": True,
        "auto_retry": True
    },

    "rate_limit_exceeded": {
        "user_message": "I've reached my usage limit for now. Retrying shortly...",
        "hint": "This usually resolves within a minute.",
        "severity": ErrorSeverity.TRANSIENT.value,
        "can_retry": True,
        "auto_retry": True
    },

    "network_timeout": {
        "user_message": "Connection issue detected. Retrying...",
        "hint": None,
        "severity": ErrorSeverity.TRANSIENT.value,
        "can_retry": True,
        "auto_retry": True
    },

    "service_unavailable": {
        "user_message": "AI service is temporarily unavailable. Retrying...",
        "hint": None,
        "severity": ErrorSeverity.TRANSIENT.value,
        "can_retry": True,
        "auto_retry": True
    },

    "connection_error": {
        "user_message": "Network connection interrupted. Retrying...",
        "hint": None,
        "severity": ErrorSeverity.TRANSIENT.value,
        "can_retry": True,
        "auto_retry": True
    },

    # ============================================================
    # RECOVERABLE ERRORS - Clear agent memory, manual retry
    # ============================================================

    "input_too_large": {
        "user_message": "Your message is too large to process.",
        "hint": "Try breaking it into smaller parts or removing some attachments.",
        "severity": ErrorSeverity.RECOVERABLE.value,
        "can_retry": True,
        "auto_retry": False
    },

    "context_length_exceeded": {
        "user_message": "Our conversation has become too long for me to process.",
        "hint": "Start a new chat to continue with a fresh context.",
        "severity": ErrorSeverity.RECOVERABLE.value,
        "can_retry": False,
        "auto_retry": False
    },

    "invalid_format": {
        "user_message": "I couldn't understand the format of your request.",
        "hint": "Try rephrasing your message in plain text.",
        "severity": ErrorSeverity.RECOVERABLE.value,
        "can_retry": True,
        "auto_retry": False
    },

    "malformed_request": {
        "user_message": "There was an issue with your request format.",
        "hint": "Please try rephrasing or simplifying your message.",
        "severity": ErrorSeverity.RECOVERABLE.value,
        "can_retry": True,
        "auto_retry": False
    },

    "bad_request": {
        "user_message": "I couldn't process your request.",
        "hint": "Try simplifying your message or removing special characters.",
        "severity": ErrorSeverity.RECOVERABLE.value,
        "can_retry": True,
        "auto_retry": False
    },

    "content_filter": {
        "user_message": "Your message contains content that I cannot process.",
        "hint": "Please rephrase your message and try again.",
        "severity": ErrorSeverity.RECOVERABLE.value,
        "can_retry": True,
        "auto_retry": False
    },

    "tool_execution_error": {
        "user_message": "I encountered an issue while using a tool.",
        "hint": "Try rephrasing your request or asking me to use a different approach.",
        "severity": ErrorSeverity.RECOVERABLE.value,
        "can_retry": True,
        "auto_retry": False
    },

    # ============================================================
    # FATAL ERRORS - Remove session, suggest new chat
    # ============================================================

    "auth_error": {
        "user_message": "Authentication issue detected.",
        "hint": "Please check your API keys in Settings or contact support.",
        "severity": ErrorSeverity.FATAL.value,
        "can_retry": False,
        "auto_retry": False
    },

    "unauthorized": {
        "user_message": "Access denied.",
        "hint": "Please verify your API configuration in Settings.",
        "severity": ErrorSeverity.FATAL.value,
        "can_retry": False,
        "auto_retry": False
    },

    "forbidden": {
        "user_message": "You don't have permission to perform this action.",
        "hint": "Contact your administrator to verify your access level.",
        "severity": ErrorSeverity.FATAL.value,
        "can_retry": False,
        "auto_retry": False
    },

    "model_not_found": {
        "user_message": "The AI model is temporarily unavailable.",
        "hint": "Try selecting a different model in Settings.",
        "severity": ErrorSeverity.FATAL.value,
        "can_retry": False,
        "auto_retry": False
    },

    "api_key_invalid": {
        "user_message": "Your API key appears to be invalid.",
        "hint": "Please update your API key in Settings.",
        "severity": ErrorSeverity.FATAL.value,
        "can_retry": False,
        "auto_retry": False
    },

    "quota_exceeded": {
        "user_message": "Your usage quota has been exceeded.",
        "hint": "Please check your billing settings or upgrade your plan.",
        "severity": ErrorSeverity.FATAL.value,
        "can_retry": False,
        "auto_retry": False
    },

    "service_configuration_error": {
        "user_message": "System configuration issue detected.",
        "hint": "Please contact support for assistance.",
        "severity": ErrorSeverity.FATAL.value,
        "can_retry": False,
        "auto_retry": False
    },

    # ============================================================
    # GENERIC FALLBACK - For unmapped errors
    # ============================================================

    "unknown_error": {
        "user_message": "Something unexpected happened.",
        "hint": "Please try again. If the issue persists, start a new chat.",
        "severity": ErrorSeverity.RECOVERABLE.value,
        "can_retry": True,
        "auto_retry": False
    }
}


def get_error_message(error_type: str) -> ErrorMessageInfo:
    """
    Get user-friendly error message for a given error type.

    Args:
        error_type: Error type identifier (e.g., "rate_limit", "input_too_large")

    Returns:
        ErrorMessageInfo with user message, hint, and recovery metadata
    """
    return ERROR_MESSAGES.get(error_type, ERROR_MESSAGES["unknown_error"])


def get_severity(error_type: str) -> ErrorSeverity:
    """
    Get error severity level for recovery strategy.

    Args:
        error_type: Error type identifier

    Returns:
        ErrorSeverity enum value
    """
    error_info = get_error_message(error_type)
    return ErrorSeverity(error_info["severity"])
